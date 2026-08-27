import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {cloudflareDataBucket} from "../../../lib/cloudflareR2";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAX_BYTES=15*1024*1024;
function json(body:any,status:number,rid:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}})}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  try{
    const user=await currentUser();if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return json({ok:false,error:"Unauthorized",requestId:rid},401,rid);
    const form=await request.formData();const file=form.get("file") as any;const vehicleId=String(form.get("vehicleId")||"").trim();const correlationId=String(form.get("requestId")||rid).slice(0,160)||rid;
    if(!vehicleId||!file||typeof file.stream!=="function")return json({ok:false,error:"invalid_upload",requestId:rid},400,rid);
    const contentType=String(file.type||"").toLowerCase(),size=Number(file.size||0);if(!allowedTypes.has(contentType)||size<=0||size>MAX_BYTES)return json({ok:false,error:"invalid_file",requestId:rid},400,rid);
    const state=await readState();const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);if(!vehicle)return json({ok:false,error:"Vehicle not found",requestId:rid},404,rid);
    if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))return json({ok:false,error:"Forbidden",requestId:rid},403,rid);
    if(String(vehicle.status||"").toLowerCase()==="archived")return json({ok:false,error:"Vehicle archived",requestId:rid},409,rid);
    const safe=String(file.name||"photo").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"photo";const pathname=`media/wdcc/${vehicleId}/${crypto.randomUUID()}-${safe}`;
    await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname}).catch(()=>{});
    await cloudflareDataBucket().put(pathname,file.stream(),{httpMetadata:{contentType,cacheControl:"public,max-age=3600"},customMetadata:{vehicleId,userId:String(user.id||""),tenantId:String(user.tenantId||"wdcc"),requestId:correlationId}});
    await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:pathname}).catch(()=>{});
    return json({ok:true,pathname,size,contentType,requestId:correlationId},201,rid);
  }catch(error){const detail=error instanceof Error?error.message:"upload_failed";await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail}).catch(()=>{});console.error("WDCC_R2_UPLOAD_FAILED",JSON.stringify({requestId:rid,error:detail}));return json({ok:false,error:detail,requestId:rid},500,rid)}
}
