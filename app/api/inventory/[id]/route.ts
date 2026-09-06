import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {fallbackVehicle} from "../../../../lib/publicInventoryFallback";
import {isInternalVehicleRecord,isQaVehicleRecord,readState,writeState} from "../../../../lib/store";
import {recordVehicleAudit} from "../../../../lib/vehicleAudit";
import {recoveryVehicleImage} from "../../../../lib/recoveryVehicleImage";
import {blobAuthority,mediaAuthority} from "../../../../lib/wdccAuthority";
import {del,get} from "@vercel/blob";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer","dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function canEdit(user:any,vehicle:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  return String(user.role).toLowerCase()==="platform_admin"||String(vehicle.tenantId||"wdcc")===String(user.tenantId||"wdcc");
}
function publicReadable(vehicle:any){return String(vehicle?.status||"").toLowerCase()==="published"&&!isQaVehicleRecord(vehicle)&&!isInternalVehicleRecord(vehicle)}
function publicReady(item:any){
  const year=Number(item?.year),price=Number(item?.price),mileage=Number(item?.mileage||0),downPayment=Number(item?.downPayment??item?.down_payment??0),maxYear=new Date().getUTCFullYear()+1;
  const photo=String(item?.primaryPhotoPathname||item?.photoPathnames?.[0]||recoveryVehicleImage(item)||"").trim();
  return publicReadable(item)&&Boolean(photo)&&Number.isInteger(year)&&year>=1901&&year<=maxYear&&Boolean(String(item?.make||"").trim())&&Boolean(String(item?.model||"").trim())&&Number.isFinite(price)&&price>0&&price<=10_000_000&&Number.isFinite(mileage)&&mileage>=0&&mileage<=2_000_000&&Number.isFinite(downPayment)&&downPayment>=0&&downPayment<=price;
}
function toPublicVehicle(item:any){return {id:String(item?.id||item?.slug||""),slug:String(item?.slug||item?.id||""),year:Number(item?.year),make:text(item?.make,80),model:text(item?.model,80),trim:text(item?.trim,80),price:Number(item?.price),downPayment:Number(item?.downPayment??item?.down_payment??0),mileage:Number(item?.mileage||0),stock:text(item?.stock??item?.stock_id,80),bodyStyle:text(item?.bodyStyle??item?.body_style,40),condition:text(item?.condition,40),transmission:text(item?.transmission,40),exteriorColor:text(item?.exteriorColor??item?.exterior_color,40),interiorColor:text(item?.interiorColor??item?.interior_color,40),drivetrain:text(item?.drivetrain,40),fuelType:text(item?.fuelType??item?.fuel_type,40),description:text(item?.description,3000),status:"published",primaryPhotoPathname:text(item?.primaryPhotoPathname,500),photoPathnames:Array.isArray(item?.photoPathnames)?item.photoPathnames.map((value:unknown)=>text(value,500)).filter(Boolean).slice(0,50):[],primary_image_url:text(recoveryVehicleImage(item),1000),image:"",photoPending:item?.photoPending===true};}
function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,...headers}});
}
async function uploadedMediaExists(pathname:string){
  if(!pathname.startsWith("media/wdcc/")||pathname.includes(".."))return false;
  try{
    const media=mediaAuthority();
    if(media.mode==="cloudflare-do"){
      const response=await fetch(`${media.options.mediaServiceUrl}/media?p=${encodeURIComponent(pathname)}`,{
        method:"HEAD",headers:{Authorization:`Bearer ${media.options.mediaServiceToken}`},cache:"no-store",signal:AbortSignal.timeout(7000)
      });
      return response.ok&&String(response.headers.get("content-type")||"").toLowerCase().startsWith("image/");
    }
    const authority=blobAuthority();
    if(authority.mode==="missing"||authority.mode==="cloudflare-do")return false;
    const result=await get(pathname,{access:"private",useCache:false,...authority.options});
    return Boolean(result&&result.statusCode===200&&String(result.blob?.contentType||"").toLowerCase().startsWith("image/"));
  }catch{return false;}
}
async function deleteUploadedMedia(pathname:string){
  if(!pathname.startsWith("media/wdcc/")||pathname.includes(".."))return false;
  try{
    const media=mediaAuthority();
    if(media.mode==="cloudflare-do"){
      const response=await fetch(`${media.options.mediaServiceUrl}/media?p=${encodeURIComponent(pathname)}`,{
        method:"DELETE",headers:{Authorization:`Bearer ${media.options.mediaServiceToken}`},cache:"no-store",signal:AbortSignal.timeout(7000)
      });
      return response.ok;
    }
    const authority=blobAuthority();
    if(authority.mode==="missing"||authority.mode==="cloudflare-do")return false;
    await del(pathname,authority.options as any);
    return true;
  }catch{return false;}
}
async function verifyStorefront(id:string,expected:"visible"|"hidden"="visible"){
  let visible=false;let verified=false;let verification="pending";const attempts:any[]=[];
  for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    const target=`https://wedontcarecars.com/api/inventory?scope=public&verify=${Date.now()}-${attempt}`;
    try{
      const publicResponse=await fetch(target,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(7000)});
      const contentType=publicResponse.headers.get("content-type")||"";
      const raw=await publicResponse.text();
      let publicJson:any=null;let parseError:string|null=null;
      try{publicJson=JSON.parse(raw);}catch(error){parseError=error instanceof Error?error.message:"json_parse_failed";}
      const hasItems=Array.isArray(publicJson?.items)||Array.isArray(publicJson?.inventory);
      const items=Array.isArray(publicJson?.items)?publicJson.items:Array.isArray(publicJson?.inventory)?publicJson.inventory:[];
      visible=publicResponse.ok&&hasItems&&items.some((item:any)=>String(item?.id)===String(id)||String(item?.slug)===String(id));
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
  const publicScope=new URL(request.url).searchParams.get("scope")==="public";
  if(!isDealerRuntime(request)){
    const upstream=await proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
    // Dealer edit/preview requests are intentionally unfiltered and the
    // canonical backend remains responsible for authorization.
    if(!publicScope)return upstream;
    if(upstream.ok&&publicScope){const body=await upstream.json().catch(()=>({}));if(body?.item&&publicReady(body.item))return NextResponse.json({ok:true,item:toPublicVehicle(body.item)},{status:200,headers:{"Cache-Control":"public, max-age=0, must-revalidate","X-WDCC-Public-Inventory-Filter":"strict"}});return NextResponse.json({ok:false,error:"Not found"},{status:404,headers:{"Cache-Control":"public, max-age=60"}})}
    if(upstream.status<500)return NextResponse.json({ok:false,error:"Not found"},{status:404,headers:{"Cache-Control":"public, max-age=60"}});
    const item=fallbackVehicle(id);
    return item?NextResponse.json({ok:true,item:toPublicVehicle(item),degraded:true},{status:200,headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300","X-WDCC-Inventory-Source":"launch-fallback"}}):NextResponse.json({ok:false,error:"Not found"},{status:404,headers:{"Cache-Control":"public, max-age=60"}});
  }
  const rid=requestId(request);
  try{
    const [state,user]=await Promise.all([readState(),currentUser()]);
    const item=state.vehicles.find(vehicle=>vehicle.id===id||String(vehicle.slug||"")===id);
    if(!item)return json({ok:false,error:"Not found"},404,rid);
    const editor=canEdit(user,item);
    if((publicScope||!editor)&&!publicReady(item))return json({ok:false,error:"Not found"},404,rid);
    if(publicScope||!editor)return NextResponse.json({ok:true,item:toPublicVehicle(item)},{status:200,headers:{"Cache-Control":"public, max-age=0, must-revalidate","X-WDCC-Public-Inventory-Filter":"strict"}});
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
    return Response.json({...upstreamJson,storefront},{status:response.status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid,"X-WDCC-Storefront-Verified":storefront.verified?"1":"0","X-WDCC-Storefront-Expected":expected}});
  }

  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    await recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    return json({ok:false,error:"Unauthorized"},401,rid);
  }
  try{
    const body=await request.json();
    const state=await readState();
    const index=state.vehicles.findIndex(vehicle=>vehicle.id===id);
    if(index<0)return json({ok:false,error:"Not found"},404,rid);
    const current:any=state.vehicles[index];
    if(!canEdit(user,current)){
      await recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:current.year,make:current.make,model:current.model,mileage:current.mileage,stock:current.stock,status:current.status,detail:"forbidden"});
      return json({ok:false,error:"Forbidden"},403,rid);
    }

    const wasPublic=publicReady(current);
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
    if(body.internalOnly!==undefined||body.visibility!==undefined||body.listingVisibility!==undefined){
      const visibility=String(body.visibility??body.listingVisibility??"").toLowerCase();
      next.internalOnly=body.internalOnly===true||visibility==="internal"||visibility==="dealer_only";
      next.visibility=next.internalOnly?"internal":"public";
    }

    if(Array.isArray(body.photoPathnames)){
      const supplied:string[]=body.photoPathnames.map((value:unknown)=>text(value,500)).filter(Boolean);
      const requested:string[]=[...new Set<string>(supplied.filter(value=>value.startsWith(`media/wdcc/${id}/`)&&!value.includes("..")))].slice(0,50);
      if(requested.length!==new Set(supplied).size)return json({ok:false,error:"invalid_photo_path"},400,rid);
      const checks=await Promise.all(requested.map(uploadedMediaExists));
      if(checks.some(exists=>!exists))return json({ok:false,error:"uploaded_photo_not_found"},409,rid);
      next.photoPathnames=requested;
      if(next.primaryPhotoPathname&&!requested.includes(String(next.primaryPhotoPathname)))next.primaryPhotoPathname=requested[0]||null;
    }
    if(body.primaryPhotoPathname!==undefined){
      const primary=text(body.primaryPhotoPathname,500);
      if(primary&&!next.photoPathnames.includes(primary))return json({ok:false,error:"primary_photo_must_be_uploaded"},400,rid);
      next.primaryPhotoPathname=primary||null;
    }
    if(body.status!==undefined){
      const status=String(body.status).toLowerCase();
      if(!["draft","published","archived"].includes(status))return json({ok:false,error:"invalid_status"},400,rid);
      next.status=status;
    }

    const maxYear=new Date().getUTCFullYear()+1;
    if(!Number.isInteger(Number(next.year))||Number(next.year)<1901||Number(next.year)>maxYear)return json({ok:false,error:"valid_year_required"},400,rid);
    if(!String(next.make||"").trim()||!String(next.model||"").trim())return json({ok:false,error:"make_and_model_required"},400,rid);
    if(!Number.isFinite(Number(next.price))||Number(next.price)<=0||Number(next.price)>10_000_000)return json({ok:false,error:"valid_price_required"},400,rid);
    if(!Number.isFinite(Number(next.downPayment||0))||Number(next.downPayment||0)<0||Number(next.downPayment||0)>Number(next.price))return json({ok:false,error:"invalid_down_payment"},400,rid);
    if(!Number.isInteger(Number(next.mileage||0))||Number(next.mileage||0)<0||Number(next.mileage||0)>2_000_000)return json({ok:false,error:"invalid_mileage"},400,rid);
    if(next.stock&&state.vehicles.some((vehicle:any,vehicleIndex:number)=>vehicleIndex!==index&&String(vehicle.tenantId||"wdcc")===String(next.tenantId||"wdcc")&&String(vehicle.stock||"").toLowerCase()===String(next.stock).toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))return json({ok:false,error:"stock_number_already_exists"},409,rid);
    const storedPhoto=String(next.primaryPhotoPathname||next.photoPathnames?.[0]||"").trim();
    const hasPhoto=Boolean(storedPhoto||recoveryVehicleImage(next));
    if(next.status==="published"&&storedPhoto&&!await uploadedMediaExists(storedPhoto))return json({ok:false,error:"uploaded_photo_not_found"},409,rid);
    if(next.status==="published"&&!hasPhoto)return json({ok:false,error:"photo_required_before_publish"},409,rid);

    next.updatedAt=new Date().toISOString();
    state.vehicles[index]=next;
    const photoChanged=(next.photoPathnames?.length||0)!==(current.photoPathnames?.length||0)||next.primaryPhotoPathname!==current.primaryPhotoPathname;
    const statusChanged=next.status!==current.status;
    const isPublic=publicReady(next);
    const action=statusChanged?`vehicle.status.${next.status}`:photoChanged?"vehicle.photo_checkpoint":"vehicle.update";
    state.audit.push({id:crypto.randomUUID(),at:next.updatedAt,action,actor:user.id,actorRole:user.role,vehicleId:id,requestId:rid,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0});
    const saved=await writeState(state);
    await recordVehicleAudit({action,outcome:"ok",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0,detail:`revision:${saved.revision}`});

    let storefront:any=undefined;
    const explicitStatus=body.status!==undefined;
    if((explicitStatus&&next.status==="published")||(explicitStatus&&wasPublic!==isPublic)){
      const expected=isPublic?"visible":"hidden";
      storefront=await verifyStorefront(id,expected);
      const lastAttempt=Array.isArray(storefront.attempts)&&storefront.attempts.length?storefront.attempts[storefront.attempts.length-1]:null;
      await recordVehicleAudit({action:"vehicle.storefront_verify",outcome:storefront.verified?"ok":"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:next.year,make:next.make,model:next.model,mileage:next.mileage,stock:next.stock,status:next.status,photoCount:Array.isArray(next.photoPathnames)?next.photoPathnames.length:0,detail:`${storefront.verification};expected:${expected}:${JSON.stringify(lastAttempt||{})}`});
    }
    if(storefront&&!storefront.verified){
      return json({ok:false,error:"storefront_verification_failed",message:"The vehicle was saved, but customer visibility could not be verified. Keep this page open and retry when the storefront connection is healthy.",saved:true,item:next,revision:saved.revision,requestId:rid,storefront},409,rid,{"X-WDCC-Storefront-Verified":"0","X-WDCC-Storefront-Expected":storefront.expected});
    }
    return json({ok:true,item:next,revision:saved.revision,requestId:rid,storefront},200,rid,storefront?{"X-WDCC-Storefront-Verified":storefront.verified?"1":"0","X-WDCC-Storefront-Expected":storefront.expected}:{});
  }catch(error){
    await recordVehicleAudit({action:"vehicle.update",outcome:"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,detail:error instanceof Error?error.message:"update_failed"});
    return json({ok:false,error:error instanceof Error?error.message:"update_failed"},500,rid);
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const rid=requestId(request);
  if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return json({ok:false,error:"Unauthorized"},401,rid);
  if(request.headers.get("x-wdcc-confirm-delete")!=="qa-cleanup")return json({ok:false,error:"archive_required"},409,rid);
  try{
    const state=await readState();
    const index=state.vehicles.findIndex(vehicle=>vehicle.id===id);
    if(index<0)return json({ok:false,error:"Not found"},404,rid);
    const current:any=state.vehicles[index];
    if(!canEdit(user,current))return json({ok:false,error:"Forbidden"},403,rid);
    if(!isQaVehicleRecord(current))return json({ok:false,error:"archive_required"},409,rid);
    const paths=[current.primaryPhotoPathname,...(Array.isArray(current.photoPathnames)?current.photoPathnames:[])].map(value=>String(value||"")).filter(Boolean);
    state.vehicles.splice(index,1);
    state.audit.push({id:crypto.randomUUID(),at:new Date().toISOString(),action:"vehicle.qa_cleanup",actor:user.id,actorRole:user.role,vehicleId:id,requestId:rid});
    const saved=await writeState(state);
    const deleted=await Promise.all([...new Set(paths)].map(deleteUploadedMedia));
    return json({ok:true,vehicleId:id,revision:saved.revision,mediaDeleted:deleted.filter(Boolean).length},200,rid);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"delete_failed"},500,rid);}
}
