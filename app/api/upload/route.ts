import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {cloudflareDataAvailable,r2PutObject} from "../../../lib/cloudflareR2";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedContentTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAX_BYTES=15*1024*1024;

function json(body:any,status:number,rid:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}})}

async function authorizeVehicleUpload(vehicleId:string,pathname:string,rid:string){
  const user=await currentUser();
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
    await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
    throw Error("Unauthorized");
  }
  if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`)){
    await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"failed",requestId:rid,vehicleId:vehicleId||null,actorId:user.id,actorRole:user.role,detail:"invalid_upload_path"});
    throw Error("Invalid upload path");
  }
  const state=await readState();
  const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);
  if(!vehicle)throw Error("Vehicle not found");
  if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
  if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
  await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:rid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname});
  return {user,vehicle};
}

async function cloudflareUpload(request:Request,rid:string){
  const url=new URL(request.url);
  const vehicleId=String(url.searchParams.get("vehicleId")||"");
  const pathname=String(url.searchParams.get("pathname")||"");
  const contentType=String(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!allowedContentTypes.has(contentType))return json({ok:false,error:"unsupported_content_type",requestId:rid},415,rid);
  const declared=Number(request.headers.get("content-length")||0);
  if(declared>MAX_BYTES)return json({ok:false,error:"file_too_large",requestId:rid},413,rid);

  const {user,vehicle}=await authorizeVehicleUpload(vehicleId,pathname,rid);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)return json({ok:false,error:"file_too_large",requestId:rid},413,rid);
  await r2PutObject(pathname,bytes,contentType);
  await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:rid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:pathname});
  return json({ok:true,pathname,url:`/api/media?p=${encodeURIComponent(pathname)}`,contentType,size:bytes.byteLength,provider:"cloudflare-r2"},200,rid);
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);

  if(cloudflareDataAvailable()){
    try{return await cloudflareUpload(request,rid)}catch(error){
      const detail=error instanceof Error?error.message:"upload_failed";
      await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail});
      const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:detail==="Vehicle not found"?404:400;
      return json({ok:false,error:detail,requestId:rid},status,rid);
    }
  }

  const uploadToken=String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(!uploadToken){
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail:"upload_authority_unavailable"});
    return json({ok:false,error:"upload_authority_unavailable",requestId:rid},503,rid);
  }
  try{
    const body=(await request.json())as HandleUploadBody;
    const result=await handleUpload({
      body,request,token:uploadToken,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        let payload:any={};try{payload=JSON.parse(clientPayload||"{}")}catch{}
        const vehicleId=String(payload.vehicleId||"");
        const correlationId=String(payload.requestId||rid).slice(0,160)||rid;
        const {user,vehicle}=await authorizeVehicleUpload(vehicleId,pathname,correlationId);
        return {allowedContentTypes:[...allowedContentTypes],maximumSizeInBytes:MAX_BYTES,addRandomSuffix:true,tokenPayload:JSON.stringify({vehicleId,userId:user.id,actorRole:user.role,tenantId:user.tenantId||"wdcc",requestId:correlationId,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock})};
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        let payload:any={};try{payload=JSON.parse(tokenPayload||"{}")}catch{}
        await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:String(payload.requestId||rid),vehicleId:payload.vehicleId||null,actorId:payload.userId||null,actorRole:payload.actorRole||null,year:payload.year,make:payload.make,model:payload.model,mileage:payload.mileage,stock:payload.stock,detail:blob.pathname});
      }
    });
    return json(result,200,rid);
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail});
    const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:400;
    return json({ok:false,error:detail,requestId:rid},status,rid);
  }
}
