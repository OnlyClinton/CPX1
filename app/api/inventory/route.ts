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
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function response(body:any,status:number,requestIdValue:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":requestIdValue}});}
function publicEligible(item:any){
  const year=Number(item?.year),price=Number(item?.price),mileage=Number(item?.mileage||0),downPayment=Number(item?.downPayment||0),maxYear=new Date().getUTCFullYear()+1;
  return String(item?.status||"").toLowerCase()==="published"&&Number.isInteger(year)&&year>=1901&&year<=maxYear&&Boolean(String(item?.make||"").trim())&&Boolean(String(item?.model||"").trim())&&Number.isFinite(price)&&price>0&&price<=10_000_000&&Number.isFinite(mileage)&&mileage>=0&&mileage<=2_000_000&&Number.isFinite(downPayment)&&downPayment>=0&&downPayment<=price&&!isQaVehicleRecord(item)&&!isInternalVehicleRecord(item);
}
async function proxyPublicInventory(request:Request){
  const upstream=await proxyDealer(request,"/api/inventory");if(!upstream.ok)return upstream;
  const json=await upstream.json().catch(()=>({})),source=Array.isArray(json?.items)?json.items:Array.isArray(json?.inventory)?json.inventory:[],items=source.filter(publicEligible);
  return NextResponse.json({...json,ok:true,count:items.length,items},{status:200,headers:{"Cache-Control":"public, max-age=0, must-revalidate","X-WDCC-Public-Inventory-Filter":"strict"}});
}
async function persistVehicleWithReadback(item:any,user:any,rid:string){
  let lastRevision=0;
  for(let attempt=1;attempt<=4;attempt++){
    const state=await readState();
    const stock=String(item.stock||"").trim().toLowerCase();
    const conflict=stock&&state.vehicles.some((vehicle:any)=>String(vehicle.id)!==String(item.id)&&String(vehicle.tenantId||"wdcc")===String(item.tenantId||"wdcc")&&String(vehicle.stock||"").trim().toLowerCase()===stock&&String(vehicle.status||"").toLowerCase()!=="archived");
    if(conflict)throw Error("stock_number_already_exists");
    if(!state.vehicles.some((vehicle:any)=>String(vehicle.id)===String(item.id)))state.vehicles.push(item);
    if(!state.audit.some((event:any)=>event?.requestId===rid&&event?.vehicleId===item.id&&event?.action==="vehicle.create_draft"))state.audit.push({id:crypto.randomUUID(),at:new Date().toISOString(),action:"vehicle.create_draft",actor:user.id,actorRole:user.role,vehicleId:item.id,requestId:rid,year:item.year,make:item.make,model:item.model,mileage:item.mileage,stock:item.stock});
    const saved=await writeState(state);lastRevision=saved.revision;
    const readback=await readState();const persisted=readback.vehicles.find((vehicle:any)=>String(vehicle.id)===String(item.id));
    if(persisted)return{item:persisted,revision:readback.revision,attempt};
    await sleep(120*attempt);
  }
  throw Error(`vehicle_read_after_write_failed:${lastRevision}`);
}

export async function GET(request:Request){
  if(!isDealerRuntime(request)){const hasSession=String(request.headers.get("cookie")||"").includes("__Host-wdcc_session=");return hasSession?proxyDealer(request,"/api/inventory"):proxyPublicInventory(request);}
  const rid=requestId(request);
  try{
    const[state,user]=await Promise.all([readState(),currentUser()]);let items;
    if(user&&editorRoles.has(String(user.role||"").toLowerCase()))items=String(user.role).toLowerCase()==="platform_admin"?state.vehicles:state.vehicles.filter(vehicle=>String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc"));
    else items=publicVehicles(state).filter(publicEligible);
    return response({ok:true,count:items.length,items,revision:state.revision},200,rid);
  }catch(error){return response({ok:false,items:[],error:error instanceof Error?error.message:"read_failed"},500,rid);}
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  const rid=requestId(request),user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){await recordVehicleAudit({action:"vehicle.create_draft",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});return response({ok:false,error:"Unauthorized"},401,rid);}
  try{
    const body=await request.json(),year=Math.trunc(Number(body?.year)),make=text(body?.make,80),model=text(body?.model,80),trim=text(body?.trim,80),price=Number(body?.price),downPayment=Number(body?.downPayment||0),mileage=Math.trunc(Number(body?.mileage||0)),stock=text(body?.stock,80),vin=text(body?.vin,40),bodyStyle=text(body?.bodyStyle,40),condition=text(body?.condition,40),transmission=text(body?.transmission,40),exteriorColor=text(body?.exteriorColor,40),interiorColor=text(body?.interiorColor,40),drivetrain=text(body?.drivetrain,40),fuelType=text(body?.fuelType,40),description=text(body?.description,3000),internalOnly=body?.internalOnly===true||String(body?.visibility||"").toLowerCase()==="internal",maxYear=new Date().getUTCFullYear()+1;
    const fail=async(error:string,status=400)=>{await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock,detail:error});return response({ok:false,error},status,rid);};
    if(!Number.isInteger(year)||year<1901||year>maxYear)return fail("valid_year_required");if(!make||!model)return fail("make_and_model_required");if(!Number.isFinite(price)||price<=0||price>10_000_000)return fail("valid_price_required");if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return fail("invalid_down_payment");if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return fail("invalid_mileage");
    const tenantId=String(user.tenantId||"wdcc"),initial=await readState();
    if(stock&&initial.vehicles.some(vehicle=>String(vehicle.tenantId||"wdcc")===tenantId&&String(vehicle.stock||"").toLowerCase()===stock.toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))return fail("stock_number_already_exists",409);
    const now=new Date().toISOString(),item={id:crypto.randomUUID(),tenantId,year,make,model,trim,price,downPayment,mileage,stock,vin,bodyStyle,condition,transmission,exteriorColor,interiorColor,drivetrain,fuelType,description,internalOnly,visibility:internalOnly?"internal":"public",status:"draft",photoPathnames:[],primaryPhotoPathname:null,createdAt:now,updatedAt:now,createdBy:user.id,uploadSource:"dealer-ui"};
    const persisted=await persistVehicleWithReadback(item,user,rid);
    await recordVehicleAudit({action:"vehicle.create_draft",outcome:"ok",requestId:rid,vehicleId:item.id,actorId:user.id,actorRole:user.role,year,make,model,mileage,stock,status:"draft",photoCount:0,detail:`revision:${persisted.revision};readback_attempt:${persisted.attempt}`});
    return response({ok:true,item:persisted.item,revision:persisted.revision,requestId:rid,persistenceVerified:true,readbackAttempt:persisted.attempt},201,rid);
  }catch(error){
    const message=error instanceof Error?error.message:"create_failed";await recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,detail:message});
    return response({ok:false,error:message},message==="stock_number_already_exists"?409:500,rid);
  }
}
