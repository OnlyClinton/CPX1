import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {blobAuthority} from "../../../lib/wdccAuthority";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const maxBytes=15*1024*1024;

function json(body:any,status:number,rid:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/media-upload");
  const rid=requestId(request);
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return json({ok:false,error:"Unauthorized",requestId:rid},401,rid);

  const authority:any=blobAuthority();
  if(authority.mode!=="cloudflare-do")return json({ok:false,error:"cloudflare_media_authority_required",requestId:rid},503,rid);

  const url=new URL(request.url);
  const vehicleId=String(url.searchParams.get("vehicleId")||"").trim();
  const suppliedName=String(url.searchParams.get("filename")||"photo.jpg");
  const contentType=String(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  const contentLength=Number(request.headers.get("content-length")||0);
  if(!vehicleId)return json({ok:false,error:"vehicle_id_required",requestId:rid},400,rid);
  if(!allowedTypes.has(contentType))return json({ok:false,error:"unsupported_media_type",requestId:rid},415,rid);
  if(contentLength>maxBytes)return json({ok:false,error:"file_too_large",maxBytes,requestId:rid},413,rid);

  try{
    const state=await readState();
    const vehicle:any=state.vehicles.find(item=>String(item.id)===vehicleId);
    if(!vehicle)return json({ok:false,error:"vehicle_not_found",requestId:rid},404,rid);
    if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))return json({ok:false,error:"Forbidden",requestId:rid},403,rid);
    if(String(vehicle.status||"").toLowerCase()==="archived")return json({ok:false,error:"vehicle_archived",requestId:rid},409,rid);

    const safe=suppliedName.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-100)||"photo.jpg";
    const pathname=`media/wdcc/${vehicleId}/${crypto.randomUUID()}-${safe}`;
    const body=await request.arrayBuffer();
    if(!body.byteLength||body.byteLength>maxBytes)return json({ok:false,error:"invalid_media_size",maxBytes,requestId:rid},413,rid);

    const upstream=await fetch(`${authority.options.stateServiceUrl}/media/${encodeURIComponent(pathname)}`,{
      method:"PUT",
      headers:{
        Authorization:`Bearer ${authority.options.stateServiceToken}`,
        "Content-Type":contentType,
        "X-WDCC-Request-ID":rid
      },
      body,
      cache:"no-store"
    });
    const result:any=await upstream.json().catch(()=>({}));
    if(!upstream.ok||result?.ok!==true)throw Error(result?.error||`media_store_${upstream.status}`);
    await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:rid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:pathname});
    return json({ok:true,pathname,contentType,size:body.byteLength,provider:"cloudflare-do",requestId:rid},201,rid);
  }catch(error){
    const detail=error instanceof Error?error.message:"media_upload_failed";
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,vehicleId:vehicleId||null,actorId:user.id,actorRole:user.role,detail});
    return json({ok:false,error:detail,requestId:rid},500,rid);
  }
}
