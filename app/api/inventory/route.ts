import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {isInternalVehicleRecord,isQaVehicleRecord,publicVehicles,readState,writeState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function response(body:any,status:number,requestIdValue:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":requestIdValue}});
}

function publicEligible(item:any){
  const year=Number(item?.year);
  const price=Number(item?.price);
  const mileage=Number(item?.mileage||0);
  const downPayment=Number(item?.downPayment||0);
  const maxYear=new Date().getUTCFullYear()+1;
  return String(item?.status||"").toLowerCase()==="published"&&Number.isInteger(year)&&year>=1901&&year<=maxYear&&Boolean(String(item?.make||"").trim())&&Boolean(String(item?.model||"").trim())&&Number.isFinite(price)&&price>0&&price<=10_000_000&&Number.isFinite(mileage)&&mileage>=0&&mileage<=2_000_000&&Number.isFinite(downPayment)&&downPayment>=0&&downPayment<=price&&!isQaVehicleRecord(item)&&!isInternalVehicleRecord(item);
}

async function proxyPublicInventory(request:Request){
  let upstream:Response|null=null;
  const retryable=new Set([502,503,504]);
  for(let attempt=0;attempt<3;attempt++){
    upstream=await proxyDealer(request,"/api/inventory");
    if(upstream.ok||!retryable.has(upstream.status))break;
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
  if(!upstream)return NextResponse.json({ok:false,items:[],error:"dealer_backend_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"2"}});
  if(!upstream.ok)return upstream;
  const json=await upstream.json().catch(()=>({}));
  const source=Array.isArray(json?.items)?json.items:Array.isArray(json?.inventory)?json.inventory:[];
  const items=source.filter(publicEligible);
  return NextResponse.json({...json,ok:true,count:items.length,items},{status:200,headers:{"Cache-Control":"public, max-age=0, must-revalidate","X-WDCC-Public-Inventory-Filter":"strict","X-WDCC-Public-Inventory-Attempts":"3"}});
}

export async function GET(request:Request){
  if(!isDealerRuntime(request)){
    const hasSession=String(request.headers.get("cookie")||"").includes("__Host-wdcc_session=");
    return hasSession?proxyDealer(request,"/api/inventory"):proxyPublicInventory(request);
  }
  const rid=requestId(request);
  try{
    const [state,user]=await Promise.all([readState(),currentUser()]);
    let items;
    if(user&&editorRoles.has(String(user.role||"").toLowerCase())){
      items=String(user.role).toLowerCase()==="platform_admin"?state.vehicles:state.vehicles.filter(vehicle=>String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc"));
    }else items=publicVehicles(state).filter(publicEligible);
    return response({ok:true,count:items.length,items,revision:state.revision},200,rid);
  }catch(error){
    return response({ok:false,items:[],error:error instanceof Error?error.message:"read_failed"},500,rid);
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  const rid=requestId(request);
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    return response({ok:false,error:"Unauthorized"},401,rid);
  }
  try{
    const body=await request.json();
    const year=Math.trunc(Number(body?.year));
    const make=text(body?.make,80);
    const model=text(body?.model,80);
    const trim=text(body?.trim,80);
    const price=Number(body?.price);
    const downPayment=Number(body?.downPayment||0);
    const mileage=Math.trunc(Number(body?.mileage||0));
    const stock=text(body?.stock,80);
    const vin=text(body?.vin,40);
    const bodyStyle=text(body?.bodyStyle,40);
    const condition=text(body?.condition,40);
    const transmission=text(body?.transmission,40);
    const exteriorColor=text(body?.exteriorColor,40);
    const interiorColor=text(body?.interiorColor,40);
    const drivetrain=text(body?.drivetrain,40);
    const fuelType=text(body?.fuelType,40);
    const description=text(body?.description,3000);
    const internalOnly=body?.internalOnly===true||String(body?.visibility||"").toLowerCase()==="internal";
    const maxYear=new Date().getUTCFullYear()+1;
    const fail=async(error:string,status=400)=>{
      await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock,detail:error});
      return response({ok:false,error},status,rid);
    };
    if(!Number.isInteger(year)||year<1901||year>maxYear)return fail("valid_year_required");
    if(!make||!model)return fail("make_and_model_required");
    if(!Number.isFinite(price)||price<=0||price>10_000_000)return fail("valid_price_required");
    if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return fail("invalid_down_payment");
    if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return fail("invalid_mileage");

    const now=new Date().toISOString();
    const tenantId=String(user.tenantId||"wdcc");
    const state=await readState();
    if(stock&&state.vehicles.some(vehicle=>String(vehicle.tenantId||"wdcc")===tenantId&&String(vehicle.stock||"").toLowerCase()===stock.toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))return fail("stock_number_already_exists",409);

    const item={id:crypto.randomUUID(),tenantId,year,make,model,trim,price,downPayment,mileage,stock,vin,bodyStyle,condition,transmission,exteriorColor,interiorColor,drivetrain,fuelType,description,internalOnly,visibility:internalOnly?"internal":"public",status:"draft",photoPathnames:[],primaryPhotoPathname:null,createdAt:now,updatedAt:now,createdBy:user.id,uploadSource:"dealer-ui"};
    state.vehicles.push(item);
    state.audit.push({id:crypto.randomUUID(),at:now,action:"vehicle.create_draft",actor:user.id,actorRole:user.role,vehicleId:item.id,requestId:rid,year,make,model,mileage,stock});
    const saved=await writeState(state);
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"ok",requestId:rid,vehicleId:item.id,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock,status:"draft",photoCount:0,detail:`revision:${saved.revision}`});
    return response({ok:true,item,revision:saved.revision,requestId:rid},201,rid);
  }catch(error){
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,detail:error instanceof Error?error.message:"create_failed"});
    return response({ok:false,error:error instanceof Error?error.message:"create_failed"},500,rid);
  }
}
