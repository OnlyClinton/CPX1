import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {requestId} from "../../../../lib/dealerRuntime";
import {getVehicle,listVehicles,updateVehicle} from "../../../../lib/wdccDb";
import {recordVehicleAudit} from "../../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const editor=(user:any)=>Boolean(user&&editorRoles.has(String(user.role||"").toLowerCase()));

function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon",...headers}});
}

async function verifyStorefront(id:string,expected:"visible"|"hidden"="visible"){
  const origin=(process.env.WDCC_STOREFRONT_ORIGIN||"https://wedontcarecars.com").replace(/\/$/,"");
  let visible=false,verified=false,verification="pending";const attempts:any[]=[];
  for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    const target=`${origin}/api/inventory?verify=${Date.now()}-${attempt}`;
    try{
      const res=await fetch(target,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(7000)});
      const raw=await res.text();let data:any={};try{data=JSON.parse(raw);}catch{}
      const hasItems=Array.isArray(data?.items)||Array.isArray(data?.inventory);
      const items=Array.isArray(data?.items)?data.items:Array.isArray(data?.inventory)?data.inventory:[];
      visible=res.ok&&hasItems&&items.some((item:any)=>String(item?.id)===id);
      attempts.push({attempt,status:res.status,contractValid:hasItems,itemCount:items.length,visible});
      if(res.ok&&hasItems&&((expected==="visible"&&visible)||(expected==="hidden"&&!visible))){verified=true;verification=expected==="visible"?"verified_visible":"verified_hidden";break;}
      verification=!res.ok?`storefront_http_${res.status}`:!hasItems?"storefront_invalid_payload":expected==="visible"?"not_yet_visible":"unexpectedly_visible";
    }catch(error){attempts.push({attempt,error:error instanceof Error?error.message:"fetch_failed"});verification="storefront_unreachable";}
  }
  return {visible,verified,expected,verification,vehicleId:id,attempts};
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const rid=requestId(request);
  try{
    const user=await currentUser().catch(()=>null);
    const item=await getVehicle(id,{includeNonPublic:editor(user)});
    if(!item)return json({ok:false,error:"Not found"},404,rid);
    return json({ok:true,item,source:"neon-canonical"},200,rid);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"read_failed"},500,rid);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const rid=requestId(request);const user=await currentUser().catch(()=>null);
  if(!editor(user)){
    await recordVehicleAudit({action:"vehicle.update",outcome:"denied",requestId:rid,vehicleId:id,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    return json({ok:false,error:"Unauthorized"},401,rid);
  }
  try{
    const body=await request.json();const current:any=await getVehicle(id,{includeNonPublic:true});
    if(!current)return json({ok:false,error:"Not found"},404,rid);
    const next:any={...current};
    if(body.year!==undefined)next.year=Math.trunc(Number(body.year));
    if(body.make!==undefined)next.make=text(body.make,80);if(body.model!==undefined)next.model=text(body.model,80);if(body.trim!==undefined)next.trim=text(body.trim,80);
    if(body.price!==undefined)next.price=Number(body.price);if(body.downPayment!==undefined)next.downPayment=Number(body.downPayment);if(body.mileage!==undefined)next.mileage=Math.trunc(Number(body.mileage));
    if(body.stock!==undefined)next.stock=text(body.stock,80);if(body.vin!==undefined)next.vin=text(body.vin,40);
    if(body.bodyStyle!==undefined)next.bodyStyle=text(body.bodyStyle,60);if(body.condition!==undefined)next.condition=text(body.condition,60);if(body.transmission!==undefined)next.transmission=text(body.transmission,60);
    if(body.exteriorColor!==undefined)next.exteriorColor=text(body.exteriorColor,60);if(body.interiorColor!==undefined)next.interiorColor=text(body.interiorColor,60);if(body.drivetrain!==undefined)next.drivetrain=text(body.drivetrain,60);if(body.fuelType!==undefined)next.fuelType=text(body.fuelType,60);if(body.description!==undefined)next.description=text(body.description,5000);
    if(body.internalOnly!==undefined||body.visibility!==undefined){next.internalOnly=body.internalOnly===true||String(body.visibility||"").toLowerCase()==="internal";next.visibility=next.internalOnly?"internal":"public";}
    if(body.status!==undefined){const status=String(body.status).toLowerCase();if(!["draft","published","available","archived","quarantined"].includes(status))return json({ok:false,error:"invalid_status"},400,rid);next.status=status==="available"?"published":status;}

    const maxYear=new Date().getUTCFullYear()+1;
    if(!Number.isInteger(Number(next.year))||Number(next.year)<1901||Number(next.year)>maxYear)return json({ok:false,error:"valid_year_required"},400,rid);
    if(!String(next.make||"").trim()||!String(next.model||"").trim())return json({ok:false,error:"make_and_model_required"},400,rid);
    if(!Number.isFinite(Number(next.price))||Number(next.price)<=0||Number(next.price)>10_000_000)return json({ok:false,error:"valid_price_required"},400,rid);
    if(!Number.isFinite(Number(next.downPayment||0))||Number(next.downPayment||0)<0||Number(next.downPayment||0)>Number(next.price))return json({ok:false,error:"invalid_down_payment"},400,rid);
    if(!Number.isInteger(Number(next.mileage||0))||Number(next.mileage||0)<0||Number(next.mileage||0)>2_000_000)return json({ok:false,error:"invalid_mileage"},400,rid);

    if(next.stock){const all=await listVehicles({includeNonPublic:true});if(all.some((vehicle:any)=>vehicle.id!==id&&String(vehicle.stock||"").toLowerCase()===String(next.stock).toLowerCase()&&String(vehicle.status||"").toLowerCase()!=="archived"))return json({ok:false,error:"stock_number_already_exists"},409,rid);}
    const requested=Array.isArray(body.photoPathnames)?body.photoPathnames.map((value:unknown)=>text(value,1000)).filter(Boolean):[];
    const known=new Set([...(Array.isArray(current.photoPathnames)?current.photoPathnames:[]),...requested, ...(Array.isArray(current.media)?current.media.map((m:any)=>text(m?.url,1000)).filter(Boolean):[])]);
    if(body.primaryPhotoPathname!==undefined){const primary=text(body.primaryPhotoPathname,1000);if(primary&&!known.has(primary)&&!/^https?:\/\//i.test(primary))return json({ok:false,error:"primary_photo_must_be_uploaded"},400,rid);next.primaryPhotoPathname=primary||null;}
    const hasPhoto=Boolean(next.primaryPhotoPathname||current.primaryImageUrl||body.primaryPhotoPathname||requested.length||current.photoPathnames?.length||current.media?.length);
    if(next.status==="published"&&!hasPhoto)return json({ok:false,error:"photo_required_before_publish"},409,rid);

    const updated:any=await updateVehicle(id,{...body,status:next.status});
    if(!updated)return json({ok:false,error:"Not found"},404,rid);
    const photoChanged=requested.length>0||body.primaryPhotoPathname!==undefined;
    const statusChanged=next.status!==current.status;
    const action=statusChanged?`vehicle.status.${next.status}`:photoChanged?"vehicle.photo_checkpoint":"vehicle.update";
    await recordVehicleAudit({action,outcome:"ok",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:updated.year,make:updated.make,model:updated.model,mileage:updated.mileage,stock:updated.stock,status:updated.status,photoCount:Array.isArray(updated.media)?updated.media.length:0,detail:"neon-canonical"});

    let storefront:any=undefined;
    if(statusChanged&&["published","archived","quarantined"].includes(next.status)){
      const expected=next.status==="published"&&!updated.internalOnly?"visible":"hidden";
      storefront=await verifyStorefront(id,expected);
      await recordVehicleAudit({action:"vehicle.storefront_verify",outcome:storefront.verified?"ok":"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,year:updated.year,make:updated.make,model:updated.model,mileage:updated.mileage,stock:updated.stock,status:updated.status,photoCount:Array.isArray(updated.media)?updated.media.length:0,detail:`${storefront.verification};expected:${expected}`});
    }
    return json({ok:true,item:updated,requestId:rid,storefront,source:"neon-canonical"},200,rid,storefront?{"X-WDCC-Storefront-Verified":storefront.verified?"1":"0","X-WDCC-Storefront-Expected":storefront.expected}:{});
  }catch(error){
    const message=error instanceof Error?error.message:"update_failed",status=/duplicate key|unique constraint/i.test(message)?409:500;
    await recordVehicleAudit({action:"vehicle.update",outcome:"failed",requestId:rid,vehicleId:id,actorId:user.id,actorRole:user.role,detail:message});
    return json({ok:false,error:status===409?"stock_number_already_exists":message},status,rid);
  }
}
