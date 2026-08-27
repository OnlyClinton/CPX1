import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {isInternalVehicleRecord,isQaVehicleRecord,mutateState,readState} from "../../../../lib/store";
import {recordVehicleAudit} from "../../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function canEdit(user:any,vehicle:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  return String(user.role).toLowerCase()==="platform_admin"||String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc");
}
function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,...headers}});
}
function mutationError(error:string,status:number){return Object.assign(new Error(error),{status});}
function storefrontBase(){return String(process.env.WDCC_STOREFRONT_VERIFY_URL||"https://wedontcarecars.com").trim().replace(/\/$/,"");}

async function verifyStorefront(id:string,expected:"visible"|"hidden"="visible"){
  let visible=false;let verified=false;let verification="pending";const attempts:any[]=[];
  for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    const target=`${storefrontBase()}/api/inventory?verify=${Date.now()}-${attempt}`;
    try{
      const publicResponse=await fetch(target,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(7000)});
      const contentType=publicResponse.headers.get("content-type")||"";
      const raw=await publicResponse.text();
      let publicJson:any=null;let parseError:string|null=null;
      try{publicJson=JSON.parse(raw);}catch(error){parseError=error instanceof Error?error.message:"json_parse_failed";}
      const hasItems=Array.isArray(publicJson?.items)||Array.isArray(publicJson?.inventory);
      const items=Array.isArray(publicJson?.items)?publicJson.items:Array.isArray(publicJson?.inventory)?publicJson.inventory:[];
      visible=publicResponse.ok&&hasItems&&items.some((item:any)=>String(item?.id)===String(id));
      attempts.push({attempt,status:publicResponse.status,ok:publicResponse.ok,redirected:publicResponse.redirected,url:publicResponse.url||target,contentType,contractValid:hasItems,itemCount:items.length,parseError,bodyPrefix:hasItems?undefined:raw.slice(0,180)});
      if(!publicResponse.ok){verification=`storefront_http_${publicResponse.status}`;continue;}
      if(!hasItems){verification="storefront_invalid_payload";continue;}
      if(expected==="hidden"){
        if(!visible){verified=true;verification="verified_hidden";break;}
        verification="unexpectedly_visible";
      }else{
        if(visible){verified=true;verification="verified_visible";break;}
        verification="not_yet_visible";
      }
    }catch(error){
      const message=error instanceof Error?`${error.name}:${error.message}`:"storefront_fetch_failed";
      attempts.push({attempt,error:message,url:target});
      verification="storefront_unreachable";
    }
  }
  return {visible,verified,expected,verification,vehicleId:id,attempts};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
  const rid=requestId(request);
  try{
    const [state,user]=await Promise.all([readState(),currentUser()]);
    const item=state.vehicles.find(vehicle=>vehicle.id===id);
    if(!item)return json({ok:false,error:"Not found"},404,rid);
    const publicReadable=String(item.status||"").toLowerCase()==="published"&&!isQaVehicleRecord(item)&&!isInternalVehicleRecord(item);
    if(!publicReadable&&!canEdit(user,item))return json({ok:false,error:"Not found"},404,rid);
    return json({ok:true,item,revision:state.revision},200,rid);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"read_failed"},500,rid);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const rid=requestId(request);
  if(!isDealerRuntime(request)){
    const requestCopy=request.clone();
    const body=await requestCopy.json().catch(()=>({}));
    const response=await proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
    if(!response.ok||String(body?.status||"").toLowerCase()!=="published")return response;
    const upstreamText=await response.text();let upstreamJson:any={};try{upstreamJson=JSON.parse(upstreamText);}catch{}
    const expected=isQaVehicleRecord(upstreamJson?.item)||isInternalVehicleRecord(upstreamJson?.item)?"hidden":"visible";
    const storefront=await verifyStorefront(id,expected);
    const status=storefront.verified?response.status:409;
    return Response.json({...upstreamJson,ok:storefront.verified,error:storefront.verified?undefined:"storefront_verification_failed",storefront},{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid,"X-WDCC-Storefront-Verified":storefront.verified?"1":"0","X-WDCC-Storefront-Expected":expected}});
  }

  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    await recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    return json({ok:false,error:"Unauthorized"},401,rid);
  }
  try{
    const body=await request.json();
    const publishingRequested=String(body?.status||"").toLowerCase()==="published";
    const mutation=await mutateState(state=>{
      const index=state.vehicles.findIndex(vehicle=>vehicle.id===id);
      if(index<0)throw mutationError("Not found",404);
      const current:any=state.vehicles[index];
      if(!canEdit(user,current))throw mutationError("Forbidden",403);

      const next:any={...current};
      if(body.year!==undefined)next.year=Math.trunc(Number(body.year));
      if(body.make!==undefined)next.make=text(body.make,80);
      if(body.model!==undefined)next.model=text(body.model,80);
      if(body.trim!==undefined)next.trim=text(body.trim,80);
      if(body.price!==undefined)next.price=Number(body.price);
      if(body.downPayment!==undefined)next.downPayment=Number(body.downPayment);
      if(body.mileage!==undefined)next.mileage=Math.trunc(Number(body.mileage));
      if(body.stock!==undefined)next.stock=text(body.stock,80);
      if(body.vin!==undefined)next.vin=text(body.vin,40);
      if(body.bodyStyle!==undefined)next.bodyStyle=text(body.bodyStyle,40);
      if(body.condition!==undefined)next.condition=text(body.condition,40);
      if(body.transmission!==undefined)next.transmission=text(body.transmission,40);
      if(body.exteriorColor!==undefined)next.exteriorColor=text(body.exteriorColor,40);
      if(body.interiorColor!==undefined)next.interiorColor=text(body.interiorColor,40);
      if(body.drivetrain!==undefined)next.drivetrain=text(body.drivetrain,40);
      if(body.fuelType!==undefined)next.fuelType=text(body.fuelType,40);
      if(body.description!==undefined)next.description=text(body.description,3000);
      if(body.internalOnly!==undefined||body.visibility!==undefined){
        next.internalOnly=body.internalOnly===true||String(body.visibility||"").toLowerCase()==="internal";
        next.visibility=next.internalOnly?"internal":"public";
      }

      if(Array.isArray(body.photoPathnames)){
        const requested=body.photoPathnames.map((value:unknown)=>text(value,500)).filter((value:string)=>value.startsWith(`media/wdcc/${id}/`));
        next.photoPathnames=[...new Set(requested)].slice(0,50);
        if(body.primaryPhotoPathname===undefined&&next.primaryPhotoPathname&&!next.photoPathnames.includes(next.primaryPhotoPathname))next.primaryPhotoPathname=next.photoPathnames[0]||null;
      }
      if(body.primaryPhotoPathname!==undefined){
        const primary=text(body.primaryPhotoPathname,500);
        if(primary&&!next.photoPathnames.includes(primary))throw mutationError("primary_photo_must_be_uploaded",400);
        next.primaryPhotoPathname=primary||null;
      }
      if(body.status!==undefined){
        const status=String(body.status).toLowerCase();
        if(!["draft","published","archived"].includes(status))throw mutationError("invalid_status",400);
        next.status=status;
      }

      const maxYear=new Date().getUTCFullYear()+1;
      if(!Number.isInteger(Number(next.year))||Number(next.year)<1901||Number(next.year)>maxYear)throw mutationError("valid_year_required",400);
      if(!String(next.make||"").trim()||!String(next.model||"").trim())throw mutationError("make_and_model_required",400);
      if(!Number.isFinite(Number(next.price))||Number(next.price)<=0||Number(next.price)>10_000_000)throw mutationError("valid_price_required",400);
      if(!Number.isFinite(Number(next.downPayment||0))||Number(next.downPayment||0)<0||Number(next.downPayment||0)>Number(next.price))throw mutationError("invalid_down_payment",400);
      if(!Number.isInteger(Number(next.mileage||0))||Number(next.mileage||0)<0||Number(next.mileage||0)>2_000_000)throw mutationError("invalid_mileage",400);
      if(next.stock&&state.vehicles.some((vehicle:any,vehicleIndex:number)=>vehicleIndex!==index&&String(vehicle.tenantId||"wdcc")===String(next.tenantId||"wdcc")&&String(vehicle.stock||"").toLowerCase()===String(next.stock).toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))throw mutationError("stock_number_already_exists",409);
      if(next.status==="published"&&(!Array.isArray(next.photoPathnames)||next.photoPathnames.length===0))throw mutationError("photo_required_before_publish",409);

      next.updatedAt=new Date().toISOString();
      state.vehicles[index]=next;
      const photoChanged=JSON.stringify(next.photoPathnames||[])!==JSON.stringify(current.photoPathnames||[])||next.primaryPhotoPathname!==current.primaryPhotoPathname;
      const statusChanged=next.status!==current.status;
      const action=statusChanged?`vehicle.status.${next.status}`:photoChanged?"vehicle.photo_checkpoint":"vehicle.update";
      state.audit.push({id:crypto.randomUUID(),at:next.updatedAt,action,actor:user.id,actorRole:user.role,vehicleId:id,requestId:rid,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0});
      return {next,current,photoChanged,statusChanged,action};
    });

    const {next,action}=mutation.result;
    await recordVehicleAudit({action,outcome:"ok",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0,detail:`revision:${mutation.state.revision};attempt:${mutation.attempt}`});

    let storefront:any=undefined;
    if(publishingRequested){
      const expected=isQaVehicleRecord(next)||isInternalVehicleRecord(next)?"hidden":"visible";
      storefront=await verifyStorefront(id,expected);
      const lastAttempt=Array.isArray(storefront.attempts)&&storefront.attempts.length?storefront.attempts[storefront.attempts.length-1]:null;
      await recordVehicleAudit({action:"vehicle.storefront_verify",outcome:storefront.verified?"ok":"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0,detail:`${storefront.verification};expected:${expected}:${JSON.stringify(lastAttempt||{})}`});
      if(!storefront.verified){
        return json({ok:false,error:"storefront_verification_failed",item:next,revision:mutation.state.revision,requestId:rid,storefront,mutationAttempt:mutation.attempt},409,rid,{"X-WDCC-Storefront-Verified":"0","X-WDCC-Storefront-Expected":expected});
      }
    }
    return json({ok:true,item:next,revision:mutation.state.revision,requestId:rid,storefront,mutationAttempt:mutation.attempt},200,rid,storefront?{"X-WDCC-Storefront-Verified":"1","X-WDCC-Storefront-Expected":storefront.expected}:{});
  }catch(error){
    const detail=error instanceof Error?error.message:"update_failed";
    const status=Number((error as any)?.status||500);
    await recordVehicleAudit({action:"vehicle.update",outcome:"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,detail});
    return json({ok:false,error:detail},status,rid);
  }
}
