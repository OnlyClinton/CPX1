import {after,NextResponse} from "next/server";
import {currentUser,signedSessionSubject} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {canonicalDealerId,getVehicle,publicVehicleDto,publishVehicleForSignedSession,updateDraftVehiclePhotoCheckpoint,updateVehicle,vehicleStockExists} from "../../../../lib/wdccDb";
import {recordVehicleAudit} from "../../../../lib/vehicleAudit";
import {isVehicleMediaPathname,verifyVehicleMediaPathnames,verifyVehicleMediaPathnamesForPublish} from "../../../../lib/vehicleMedia";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const vehicleEditorPublishKeys=new Set(["photoPathnames","primaryPhotoPathname","status","internalOnly","visibility"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

async function editor(user:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  if(String(user.role||"").toLowerCase()==="platform_admin")return true;
  return String(user.tenantId||"")===await canonicalDealerId();
}

function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon",...headers}});
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const rid=requestId(request);
  if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
  const dealerScope=new URL(request.url).searchParams.get("scope")==="dealer";
  try{
    let user:any=null;
    try{user=await currentUser();}
    catch{
      if(dealerScope||String(request.headers.get("cookie")||"").includes("__Host-wdcc_session="))return json({ok:false,error:"auth_backend_unavailable"},503,rid);
    }
    let includeNonPublic=false;
    if(user){try{includeNonPublic=await editor(user);}catch{return json({ok:false,error:"auth_backend_unavailable"},503,rid);}}
    if(dealerScope&&(!user||!includeNonPublic))return json({ok:false,error:user?"Forbidden":"Unauthorized"},user?403:401,rid);
    const item=await getVehicle(id,{includeNonPublic});
    if(!item)return json({ok:false,error:"Not found"},404,rid);
    return json({ok:true,item:includeNonPublic?item:publicVehicleDto(item),source:"neon-canonical"},200,rid);
  }catch{return json({ok:false,error:"inventory_unavailable"},503,rid);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const rid=requestId(request);
  if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
  let body:any=null,bodyError:unknown=null;
  try{body=await request.json();}catch(error){bodyError=error;}
  const bodyObject=Boolean(body&&typeof body==="object"&&!Array.isArray(body));
  const bodyKeys=bodyObject?Object.keys(body):[];
  const vehicleEditorPublishShape=bodyObject&&bodyKeys.length===vehicleEditorPublishKeys.size&&bodyKeys.every(key=>vehicleEditorPublishKeys.has(key));
  const photoOnly=bodyObject&&Array.isArray(body.photoPathnames)&&
    bodyKeys.length>0&&bodyKeys.every(key=>key==="photoPathnames"||key==="primaryPhotoPathname");
  const rawPhotoPathnames:unknown[]=photoOnly?body.photoPathnames:[];
  const fastPathnames:string[]=[...new Set(rawPhotoPathnames.map(value=>text(value,1000)).filter(Boolean))];
  const fastPrimarySupplied=photoOnly&&body.primaryPhotoPathname!==undefined;
  const fastPrimary=fastPrimarySupplied?text(body.primaryPhotoPathname,1000):null;
  const safeDraftPhotoCheckpoint=photoOnly&&rawPhotoPathnames.length<=10&&fastPathnames.length<=10&&
    rawPhotoPathnames.every(value=>{const pathname=text(value,1000);return Boolean(pathname)&&isVehicleMediaPathname(id,pathname);})&&
    (!fastPrimary||(!/^https?:\/\//i.test(fastPrimary)&&isVehicleMediaPathname(id,fastPrimary)&&fastPathnames.includes(fastPrimary)));

  if(safeDraftPhotoCheckpoint){
    let subject:any;
    try{subject=await signedSessionSubject();}
    catch{return json({ok:false,error:"auth_backend_unavailable"},503,rid);}
    if(!subject||!editorRoles.has(String(subject.role||"").toLowerCase())){
      after(()=>recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:subject?.id||null,actorRole:subject?.role||null,detail:subject?"forbidden":"auth_required"}));
      return json({ok:false,error:subject?"Forbidden":"Unauthorized"},subject?403:401,rid);
    }
    let checkpoint:Awaited<ReturnType<typeof updateDraftVehiclePhotoCheckpoint>>;
    try{
      checkpoint=await updateDraftVehiclePhotoCheckpoint({
        vehicleId:id,subject,photoPathnames:fastPathnames,
        primaryPhotoPathname:fastPrimary||null,primarySupplied:fastPrimarySupplied
      });
    }catch{
      after(()=>recordVehicleAudit({action:"vehicle.photo_checkpoint",outcome:"failed",requestId:rid,vehicleId:id,actorId:subject.id,actorRole:subject.role,detail:"vehicle_update_failed"}));
      return json({ok:false,error:"auth_backend_unavailable"},503,rid);
    }
    if(checkpoint.outcome==="unauthorized"){
      after(()=>recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:subject.id,actorRole:subject.role,detail:"access_revoked"}));
      return json({ok:false,error:"Unauthorized"},401,rid);
    }
    if(checkpoint.outcome==="not_found")return json({ok:false,error:"Not found"},404,rid);
    if(checkpoint.outcome==="updated"){
      const updated:any=checkpoint.vehicle,actor=checkpoint.actor;
      after(()=>recordVehicleAudit({action:"vehicle.photo_checkpoint",outcome:"ok",requestId:rid,vehicleId:id,actorId:actor.id,actorRole:actor.role,year:updated.year,make:updated.make,model:updated.model,mileage:updated.mileage,stock:updated.stock,status:updated.status,photoCount:Array.isArray(updated.media)?updated.media.length:0,detail:"neon-canonical"}));
      return json({ok:true,item:updated,requestId:rid,source:"neon-canonical"},200,rid);
    }
  }

  if(vehicleEditorPublishShape){
    let subject:any;
    try{subject=await signedSessionSubject();}
    catch{return json({ok:false,error:"auth_backend_unavailable"},503,rid);}
    if(!subject||!editorRoles.has(String(subject.role||"").toLowerCase())){
      after(()=>recordVehicleAudit({action:"vehicle.status.published",outcome:"denied",requestId:rid,vehicleId:id,actorId:subject?.id||null,actorRole:subject?.role||null,detail:subject?"forbidden":"auth_required"}));
      return json({ok:false,error:subject?"Forbidden":"Unauthorized"},subject?403:401,rid);
    }

    const publishStatus=String(body.status||"").toLowerCase();
    if(publishStatus!=="published"&&publishStatus!=="available")return json({ok:false,error:"invalid_status"},400,rid);
    if(typeof body.internalOnly!=="boolean")return json({ok:false,error:"invalid_visibility"},400,rid);
    const visibility=String(body.visibility||"").toLowerCase();
    const publishVisibility: "internal"|"public"=body.internalOnly?"internal":"public";
    if(visibility!==publishVisibility)return json({ok:false,error:"invalid_visibility"},400,rid);
    if(!Array.isArray(body.photoPathnames)||body.photoPathnames.length<1||body.photoPathnames.length>10)return json({ok:false,error:"invalid_photo_count",minimum:1,maximum:10},400,rid);
    const photoPathnames:unknown[]=body.photoPathnames;
    if(photoPathnames.some(value=>typeof value!=="string"||value!==value.trim()||value.length>1000||!isVehicleMediaPathname(id,value)))return json({ok:false,error:"invalid_photo_set"},400,rid);
    const canonicalPathnames=photoPathnames as string[];
    if(new Set(canonicalPathnames).size!==canonicalPathnames.length)return json({ok:false,error:"invalid_photo_set"},400,rid);
    const primaryPhotoPathname=body.primaryPhotoPathname;
    if(typeof primaryPhotoPathname!=="string"||primaryPhotoPathname!==primaryPhotoPathname.trim()||!isVehicleMediaPathname(id,primaryPhotoPathname)||!canonicalPathnames.includes(primaryPhotoPathname))return json({ok:false,error:"primary_photo_must_be_uploaded"},400,rid);

    let mediaCheck:Awaited<ReturnType<typeof verifyVehicleMediaPathnamesForPublish>>|null=null;
    let mediaAuthorityFailed=false;
    try{mediaCheck=await verifyVehicleMediaPathnamesForPublish(id,canonicalPathnames);}
    catch{mediaAuthorityFailed=true;}
    const mediaVerified=!mediaAuthorityFailed&&mediaCheck?.ok===true&&mediaCheck.verified.length===canonicalPathnames.length;

    let publication:Awaited<ReturnType<typeof publishVehicleForSignedSession>>;
    try{
      publication=await publishVehicleForSignedSession({
        vehicleId:id,subject,photoPathnames:canonicalPathnames,primaryPhotoPathname,
        internalOnly:body.internalOnly,visibility:publishVisibility,mediaVerified
      });
    }catch{
      after(()=>recordVehicleAudit({action:"vehicle.status.published",outcome:"failed",requestId:rid,vehicleId:id,actorId:subject.id,actorRole:subject.role,detail:"vehicle_publish_failed"}));
      return json({ok:false,error:"publish_unavailable"},503,rid);
    }
    if(publication.outcome==="unauthorized"){
      after(()=>recordVehicleAudit({action:"vehicle.status.published",outcome:"denied",requestId:rid,vehicleId:id,actorId:subject.id,actorRole:subject.role,detail:"access_revoked"}));
      return json({ok:false,error:"Unauthorized"},401,rid);
    }
    if(publication.outcome==="not_found")return json({ok:false,error:"Not found"},404,rid);
    if(publication.outcome==="status_conflict")return json({ok:false,error:"vehicle_status_conflict",status:publication.status},409,rid);
    if(publication.outcome==="media_unverified"){
      if(mediaAuthorityFailed)return json({ok:false,error:"media_authority_unavailable"},503,rid);
      return json({ok:false,error:"media_missing_before_publish",missing:mediaCheck?.missing||canonicalPathnames,verified:mediaCheck?.verified||[]},409,rid);
    }
    const updated:any=publication.vehicle,actor=publication.actor;
    after(()=>recordVehicleAudit({action:"vehicle.status.published",outcome:"ok",requestId:rid,vehicleId:id,actorId:actor.id,actorRole:actor.role,year:updated.year,make:updated.make,model:updated.model,mileage:updated.mileage,stock:updated.stock,status:updated.status,photoCount:Array.isArray(updated.media)?updated.media.length:0,detail:"neon-canonical-fast-publish"}));
    const expected=updated.internalOnly?"hidden":"visible";
    const storefront={expected,verification:"committed",vehicleId:id};
    return json({ok:true,item:updated,requestId:rid,storefront,source:"neon-canonical"},200,rid,{"X-WDCC-Storefront-Expected":expected,"X-WDCC-Storefront-Verification":"committed"});
  }

  const[authResult,vehicleResult]=await Promise.allSettled([
    currentUser(),
    getVehicle(id,{includeNonPublic:true})
  ]);
  if(authResult.status==="rejected")return json({ok:false,error:"auth_backend_unavailable"},503,rid);
  const user:any=authResult.value;
  let permitted=false;
  if(user){try{permitted=await editor(user);}catch{return json({ok:false,error:"auth_backend_unavailable"},503,rid);}}
  if(!user||!permitted){
    after(()=>recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:user?.id||null,actorRole:user?.role||null,detail:user?"forbidden":"auth_required"}));
    return json({ok:false,error:user?"Forbidden":"Unauthorized"},user?403:401,rid);
  }
  try{
    if(vehicleResult.status==="rejected")throw vehicleResult.reason;
    if(bodyError)throw bodyError;
    if(!bodyObject)throw Error("invalid_request_body");
    const current:any=vehicleResult.value;
    if(!current)return json({ok:false,error:"Not found"},404,rid);
    const next:any={...current};
    if(body.year!==undefined)next.year=Math.trunc(Number(body.year));
    if(body.make!==undefined)next.make=text(body.make,80);if(body.model!==undefined)next.model=text(body.model,80);if(body.trim!==undefined)next.trim=text(body.trim,80);
    if(body.price!==undefined)next.price=Number(body.price);if(body.downPayment!==undefined||body.down_payment!==undefined)next.downPayment=Number(body.downPayment??body.down_payment);
    if(body.mileage!==undefined)next.mileage=Math.trunc(Number(body.mileage));if(body.stock!==undefined||body.stock_id!==undefined)next.stock=text(body.stock??body.stock_id,80).toUpperCase();
    if(body.vin!==undefined)next.vin=text(body.vin,40);if(body.bodyStyle!==undefined||body.body_style!==undefined)next.bodyStyle=text(body.bodyStyle??body.body_style,60);
    if(body.condition!==undefined)next.condition=text(body.condition,60);if(body.transmission!==undefined)next.transmission=text(body.transmission,60);
    if(body.exteriorColor!==undefined||body.exterior_color!==undefined)next.exteriorColor=text(body.exteriorColor??body.exterior_color,60);
    if(body.interiorColor!==undefined||body.interior_color!==undefined)next.interiorColor=text(body.interiorColor??body.interior_color,60);
    if(body.drivetrain!==undefined)next.drivetrain=text(body.drivetrain,60);if(body.fuelType!==undefined||body.fuel_type!==undefined)next.fuelType=text(body.fuelType??body.fuel_type,60);
    if(body.description!==undefined)next.description=text(body.description,5000);
    if(body.internalOnly!==undefined||body.visibility!==undefined){const visibility=String(body.visibility||"").toLowerCase();next.internalOnly=body.internalOnly===true||visibility==="internal"||visibility==="dealer_only";next.visibility=next.internalOnly?"internal":"public";}
    if(body.status!==undefined){const status=String(body.status).toLowerCase();if(!["draft","published","available","archived","quarantined","sold"].includes(status))return json({ok:false,error:"invalid_status"},400,rid);next.status=status==="available"?"published":status;}

    const maxYear=new Date().getUTCFullYear()+1;
    if(!Number.isInteger(Number(next.year))||Number(next.year)<1901||Number(next.year)>maxYear)return json({ok:false,error:"valid_year_required"},400,rid);
    if(!String(next.make||"").trim()||!String(next.model||"").trim())return json({ok:false,error:"make_and_model_required"},400,rid);
    if(!Number.isFinite(Number(next.price))||Number(next.price)<=0||Number(next.price)>10_000_000)return json({ok:false,error:"valid_price_required"},400,rid);
    if(!Number.isFinite(Number(next.downPayment||0))||Number(next.downPayment||0)<0||Number(next.downPayment||0)>Number(next.price))return json({ok:false,error:"invalid_down_payment"},400,rid);
    if(!Number.isInteger(Number(next.mileage||0))||Number(next.mileage||0)<0||Number(next.mileage||0)>2_000_000)return json({ok:false,error:"invalid_mileage"},400,rid);
    const stockSupplied=body.stock!==undefined||body.stock_id!==undefined;
    const stockChanged=stockSupplied&&String(next.stock||"").toLowerCase()!==String(current.stock||current.stock_id||"").toLowerCase();
    if(stockChanged&&next.stock&&await vehicleStockExists(String(next.stock),id))return json({ok:false,error:"stock_number_already_exists"},409,rid);

    if(body.photoPathnames!==undefined&&!Array.isArray(body.photoPathnames))return json({ok:false,error:"invalid_photo_set"},400,rid);
    const photoSetSupplied=Array.isArray(body.photoPathnames);
    if(photoSetSupplied&&body.photoPathnames.length>10)return json({ok:false,error:"invalid_photo_count",maximum:10},400,rid);
    const requestedValues:string[]=photoSetSupplied?body.photoPathnames.map((value:unknown)=>text(value,1000)):[];
    if(requestedValues.some(pathname=>!pathname||!isVehicleMediaPathname(id,pathname)))return json({ok:false,error:"invalid_photo_set"},400,rid);
    const requested:string[]=requestedValues;
    const currentPaths:string[]=Array.isArray(current.photoPathnames)?current.photoPathnames.map((value:unknown)=>text(value,1000)).filter((value:string)=>Boolean(value)):[];
    const allPathnames:string[]=[...new Set<string>(photoSetSupplied?requested:currentPaths)];
    const known=new Set(allPathnames);
    if(body.primaryPhotoPathname!==undefined){
      const primary=text(body.primaryPhotoPathname,1000);
      if(/^https?:\/\//i.test(primary))return json({ok:false,error:"primary_photo_must_be_uploaded"},400,rid);
      if(primary&&!known.has(primary))return json({ok:false,error:"primary_photo_must_be_uploaded"},400,rid);
      next.primaryPhotoPathname=primary||null;
    }else if(photoSetSupplied){
      const currentPrimary=text(current.primaryPhotoPathname,1000);
      next.primaryPhotoPathname=currentPrimary&&known.has(currentPrimary)?currentPrimary:(allPathnames[0]||null);
    }

    const selectedPrimary=text(next.primaryPhotoPathname,1000);
    const existingLegacyRemote=text(current.primaryImageUrl||current.primary_image_url,1000);
    const unchangedLegacyRemote=Boolean(
      current.status==="published"&&existingLegacyRemote&&/^https:\/\//i.test(existingLegacyRemote)&&
      !photoSetSupplied&&body.primaryPhotoPathname===undefined
    );
    const requiresMediaVerification=next.status==="published"&&(
      current.status!=="published"||photoSetSupplied||body.primaryPhotoPathname!==undefined
    );
    if(requiresMediaVerification&&allPathnames.length>10)return json({ok:false,error:"invalid_photo_count",maximum:10},400,rid);
    const hasPhoto=Boolean(selectedPrimary||unchangedLegacyRemote);
    if(requiresMediaVerification&&!hasPhoto)return json({ok:false,error:"photo_required_before_publish"},409,rid);
    if(requiresMediaVerification&&selectedPrimary&&!allPathnames.includes(selectedPrimary))return json({ok:false,error:"primary_photo_must_be_uploaded"},409,rid);
    if(requiresMediaVerification&&allPathnames.length){
      const mediaCheck=await verifyVehicleMediaPathnames(id,allPathnames);
      if(!mediaCheck.ok)return json({ok:false,error:"media_missing_before_publish",missing:mediaCheck.missing,verified:mediaCheck.verified},409,rid);
      if(selectedPrimary&&!mediaCheck.verified.includes(selectedPrimary))return json({ok:false,error:"media_missing_before_publish",missing:[selectedPrimary],verified:mediaCheck.verified},409,rid);
    }

    const normalizedChanges={
      ...body,
      downPayment:body.downPayment??body.down_payment,stock:body.stock??body.stock_id,bodyStyle:body.bodyStyle??body.body_style,
      exteriorColor:body.exteriorColor??body.exterior_color,interiorColor:body.interiorColor??body.interior_color,
      fuelType:body.fuelType??body.fuel_type,status:next.status,
      ...(photoSetSupplied?{photoPathnames:allPathnames}:{}),
      ...(photoSetSupplied||body.primaryPhotoPathname!==undefined?{primaryPhotoPathname:next.primaryPhotoPathname}:{}),
    };
    const updated:any=await updateVehicle(id,normalizedChanges,current);
    if(!updated)return json({ok:false,error:"Not found"},404,rid);
    const photoChanged=photoSetSupplied||body.primaryPhotoPathname!==undefined;
    const statusChanged=next.status!==current.status;
    const action=statusChanged?`vehicle.status.${next.status}`:photoChanged?"vehicle.photo_checkpoint":"vehicle.update";
    after(()=>recordVehicleAudit({action,outcome:"ok",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:updated.year,make:updated.make,model:updated.model,mileage:updated.mileage,stock:updated.stock,status:updated.status,photoCount:Array.isArray(updated.media)?updated.media.length:0,detail:"neon-canonical"}));

    let storefront:any=undefined;
    if(statusChanged&&["published","archived","quarantined","sold"].includes(next.status)){
      const expected=next.status==="published"&&!updated.internalOnly?"visible":"hidden";
      storefront={expected,verification:"committed",vehicleId:id};
    }
    return json({ok:true,item:updated,requestId:rid,storefront,source:"neon-canonical"},200,rid,storefront?{"X-WDCC-Storefront-Expected":storefront.expected,"X-WDCC-Storefront-Verification":"committed"}:{});
  }catch(error){
    const message=error instanceof Error?error.message:"update_failed",status=/duplicate key|unique constraint/i.test(message)?409:500;
    after(()=>recordVehicleAudit({action:"vehicle.update",outcome:"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,detail:status===409?"stock_number_already_exists":"vehicle_update_failed"}));
    return json({ok:false,error:status===409?"stock_number_already_exists":"vehicle_update_failed"},status,rid);
  }
}
