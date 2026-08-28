import {after,NextResponse} from "next/server";
import {currentUser,signedSessionSubject} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {canonicalDealerId,createDraftVehicleForSignedSession,listVehicles,publicVehicleDto} from "../../../lib/wdccDb";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";
import {isIsolatedWorkersDevRequest,mockupPreviewInventoryPayload} from "../../../lib/visualProofInventory";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function response(body:any,status:number,rid:string,publicResponse=false,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":publicResponse?"public, max-age=0, must-revalidate":"private, no-store",
    "X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon",...headers
  }});
}

async function canEdit(user:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  if(String(user.role||"").toLowerCase()==="platform_admin")return true;
  return String(user.tenantId||"")===await canonicalDealerId();
}

export async function GET(request:Request){
  const rid=requestId(request);
  const dealerScope=new URL(request.url).searchParams.get("scope")==="dealer";
  if(isIsolatedWorkersDevRequest(request)&&process.env.WDCC_MOCKUP_PREVIEW==="1"){
    const fixture=mockupPreviewInventoryPayload();
    const items=fixture.items.map(publicVehicleDto);
    return response({...fixture,count:items.length,items},200,rid,true,{
      "Cache-Control":"no-store","X-WDCC-Inventory-Source":"r31-r25-design-reference",
      "X-WDCC-Inventory-Live":"false","X-WDCC-Mockup-Preview":"forced"
    });
  }
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  try{
    let user:any=null;
    try{user=await currentUser();}
    catch{
      if(dealerScope||String(request.headers.get("cookie")||"").includes("__Host-wdcc_session="))return response({ok:false,error:"auth_backend_unavailable"},503,rid);
    }
    let editor=false;
    if(user){try{editor=await canEdit(user);}catch{return response({ok:false,error:"auth_backend_unavailable"},503,rid);}}
    if(dealerScope&&(!user||!editor))return response({ok:false,error:user?"Forbidden":"Unauthorized"},user?403:401,rid);
    const items=await listVehicles({includeNonPublic:editor});
    const payload=editor?items:items.map(publicVehicleDto);
    return response({ok:true,count:payload.length,items:payload,inventory:payload,live:true,source:"neon-canonical"},200,rid,!editor,{
      "X-WDCC-Inventory-Source":"neon-canonical","X-WDCC-Inventory-Live":"true"
    });
  }catch{
    return response({ok:false,items:[],inventory:[],error:"inventory_unavailable",source:"neon-canonical"},503,rid);
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/inventory");
  const rid=requestId(request);
  let subject:any;
  try{subject=await signedSessionSubject();}
  catch{return response({ok:false,error:"auth_backend_unavailable"},503,rid);}
  if(!subject||!editorRoles.has(String(subject.role||"").toLowerCase())){
    after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"denied",requestId:rid,actorId:subject?.id||null,actorRole:subject?.role||null,detail:subject?"forbidden":"auth_required"}));
    return response({ok:false,error:subject?"Forbidden":"Unauthorized"},subject?403:401,rid);
  }
  let body:any;
  try{body=await request.json();}
  catch{
    after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:subject.id,actorRole:subject.role,detail:"invalid_request_body"}));
    return response({ok:false,error:"invalid_request_body"},400,rid);
  }
  const year=Math.trunc(Number(body?.year)),make=text(body?.make,80),model=text(body?.model,80),trim=text(body?.trim,80);
  const price=Number(body?.price),downPayment=Number(body?.downPayment??body?.down_payment??0),mileage=Math.trunc(Number(body?.mileage??0));
  const stock=text(body?.stock??body?.stock_id,80).toUpperCase(),vin=text(body?.vin,40),bodyStyle=text(body?.bodyStyle??body?.body_style,60);
  const condition=text(body?.condition,60),transmission=text(body?.transmission,60),exteriorColor=text(body?.exteriorColor??body?.exterior_color,60);
  const interiorColor=text(body?.interiorColor??body?.interior_color,60),drivetrain=text(body?.drivetrain,60),fuelType=text(body?.fuelType??body?.fuel_type,60);
  const requestedVisibility=String(body?.visibility||"").toLowerCase();
  const description=text(body?.description,5000),internalOnly=body?.internalOnly===true||requestedVisibility==="internal"||requestedVisibility==="dealer_only";
  const maxYear=new Date().getUTCFullYear()+1;
  const fail=(error:string,status=400)=>{
    after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:subject.id,actorRole:subject.role,year,make,model,mileage,stock,detail:error}));
    return response({ok:false,error},status,rid);
  };
  if(!Number.isInteger(year)||year<1901||year>maxYear)return fail("valid_year_required");
  if(!make||!model)return fail("make_and_model_required");
  if(!Number.isFinite(price)||price<=0||price>10_000_000)return fail("valid_price_required");
  if(!Number.isFinite(downPayment)||downPayment<0||downPayment>price)return fail("invalid_down_payment");
  if(!Number.isInteger(mileage)||mileage<0||mileage>2_000_000)return fail("invalid_mileage");
  try{
    const created=await createDraftVehicleForSignedSession({
      subject,
      vehicle:{
        year,make,model,trim,price,downPayment,mileage,stock,vin,bodyStyle,condition,transmission,
        exteriorColor,interiorColor,drivetrain,fuelType,description,internalOnly,uploadSource:"dealer-ui"
      }
    });
    if(created.outcome==="unauthorized"){
      after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"denied",requestId:rid,actorId:subject.id,actorRole:subject.role,year,make,model,mileage,stock,detail:"access_revoked"}));
      return response({ok:false,error:"Unauthorized"},401,rid);
    }
    if(created.outcome==="stock_conflict")return fail("stock_number_already_exists",409);
    const item=created.vehicle,actor=created.actor;
    after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"ok",requestId:rid,vehicleId:item.id,actorId:actor.id,actorRole:actor.role,year,make,model,mileage,stock:item.stock,status:"draft",photoCount:0,detail:"neon-canonical"}));
    return response({ok:true,item,requestId:rid,source:"neon-canonical"},201,rid);
  }catch(error){
    const message=error instanceof Error?error.message:"create_failed";
    const conflict=String((error as any)?.code||"")==="23505"||/duplicate key|unique constraint/i.test(message);
    after(()=>recordVehicleAudit({action:"vehicle.create_draft",outcome:"failed",requestId:rid,actorId:subject.id,actorRole:subject.role,detail:conflict?"stock_number_already_exists":"vehicle_create_failed"}));
    return response({ok:false,error:conflict?"stock_number_already_exists":"inventory_unavailable"},conflict?409:503,rid);
  }
}
