import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {after,NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {getVehicleById} from "../../../lib/wdccDb";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";
import {captureVehicleMedia,isVehicleMediaPathname,parseVehicleMediaPathname,VEHICLE_PHOTO_CONTENT_TYPES,VEHICLE_PHOTO_MAX_BYTES,vehicleBlobClientUploadToken,vehicleMediaCaptureRoot} from "../../../lib/vehicleMedia";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const editorRoles=new Set(["dealer","dealer_agent","tenant_admin","platform_admin","admin"]);
const allowedTypes=new Set<string>(VEHICLE_PHOTO_CONTENT_TYPES);

function json(body:any,status:number,rid:string,headers:Record<string,string>={}){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,...headers}});
}
function uploadStatus(detail:string){
  if(detail==="Unauthorized")return 401;
  if(detail==="Forbidden")return 403;
  if(detail==="Vehicle not found")return 404;
  if(detail==="Vehicle archived")return 409;
  if(detail.includes("UNAVAILABLE")||detail.includes("MISSING"))return 503;
  return 400;
}
function payload(value:unknown){try{return JSON.parse(String(value||"{}"));}catch{return {};}}

function audit(event:Parameters<typeof recordVehicleAudit>[0]){
  after(()=>recordVehicleAudit(event));
}

async function authorizeVehicle(vehicleId:string){
  const[authResult,vehicleResult]=await Promise.allSettled([
    currentUser(),
    getVehicleById(vehicleId)
  ]);
  if(authResult.status==="rejected")throw Error("AUTH_BACKEND_UNAVAILABLE");
  const user:any=authResult.value;
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))throw Error("Unauthorized");
  if(vehicleResult.status==="rejected")throw Error("INVENTORY_BACKEND_UNAVAILABLE");
  const vehicle:any=vehicleResult.value;
  if(!vehicle)throw Error("Vehicle not found");
  const role=String(user.role||"").toLowerCase();
  const userTenant=String(user.dealerId||user.tenantId||"").trim();
  const vehicleTenant=String(vehicle.dealerId||vehicle.tenantId||"").trim();
  if(role!=="platform_admin"&&userTenant!==vehicleTenant)throw Error("Forbidden");
  if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
  return {user,vehicle};
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  try{
    const user:any=await currentUser();
    if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return json({ok:false,error:"Unauthorized"},401,rid);
    const capture=vehicleMediaCaptureRoot();
    if(!capture&&!vehicleBlobClientUploadToken())return json({ok:false,error:"upload_authority_unavailable"},503,rid);
    return json({ok:true,mode:capture?"e2e-local-capture":"vercel-blob-client",access:"private",maximumSizeInBytes:VEHICLE_PHOTO_MAX_BYTES,allowedContentTypes:[...VEHICLE_PHOTO_CONTENT_TYPES]},200,rid);
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:"upload_unavailable"},503,rid);}
}

async function captureUpload(request:Request,rid:string){
  if(!vehicleMediaCaptureRoot())return json({ok:false,error:"client_upload_handshake_required"},400,rid);
  const form=await request.formData();
  const vehicleId=String(form.get("vehicleId")||"").trim();
  const pathname=String(form.get("pathname")||"").trim();
  const correlationId=String(form.get("requestId")||rid).trim().slice(0,160)||rid;
  const file=form.get("file");
  if(!vehicleId||!isVehicleMediaPathname(vehicleId,pathname)||!(file instanceof File))return json({ok:false,error:"invalid_capture_upload",requestId:correlationId},400,correlationId);
  if(!allowedTypes.has(file.type)||file.size<=0||file.size>VEHICLE_PHOTO_MAX_BYTES)return json({ok:false,error:"invalid_photo",requestId:correlationId},400,correlationId);
  try{
    const {user,vehicle}=await authorizeVehicle(vehicleId);
    const stored=await captureVehicleMedia(pathname,new Uint8Array(await file.arrayBuffer()),file.type);
    audit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:JSON.stringify(stored)});
    return json({ok:true,...stored,url:`/api/media?p=${encodeURIComponent(stored.pathname)}`},200,correlationId,{"X-WDCC-Test-Capture":"1"});
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    audit({action:"vehicle.photo_upload",outcome:"failed",requestId:correlationId,vehicleId:vehicleId||null,detail});
    return json({ok:false,error:detail,requestId:correlationId},uploadStatus(detail),correlationId);
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  if(request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data"))return captureUpload(request,rid);
  const token=vehicleBlobClientUploadToken();
  if(!token){
    audit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail:"BLOB_CLIENT_UPLOAD_TOKEN_MISSING"});
    return json({ok:false,error:"upload_authority_unavailable",requestId:rid},503,rid);
  }
  try{
    const body=(await request.json()) as HandleUploadBody;
    const result=await handleUpload({
      body,request,token,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        const client=payload(clientPayload),vehicleId=String(client.vehicleId||"").trim();
        const correlationId=String(client.requestId||rid).trim().slice(0,160)||rid;
        if(!vehicleId||!isVehicleMediaPathname(vehicleId,pathname))throw Error("Invalid upload path");
        const parsed=parseVehicleMediaPathname(pathname);if(!parsed)throw Error("Invalid upload path");
        const {user,vehicle}=await authorizeVehicle(vehicleId);
        audit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:parsed.pathname});
        return {
          allowedContentTypes:[...VEHICLE_PHOTO_CONTENT_TYPES],maximumSizeInBytes:VEHICLE_PHOTO_MAX_BYTES,
          addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:31536000,validUntil:Date.now()+10*60*1000,
          tokenPayload:JSON.stringify({vehicleId,pathname:parsed.pathname,userId:user.id,actorRole:user.role,requestId:correlationId,sha256:/^[0-9a-f]{64}$/i.test(String(client.sha256||""))?String(client.sha256):null,size:Number(client.size)||null,contentType:allowedTypes.has(String(client.contentType||""))?String(client.contentType):null,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock})
        };
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        const completed=payload(tokenPayload),vehicleId=String(completed.vehicleId||"");
        if(!vehicleId||completed.pathname!==blob.pathname||!isVehicleMediaPathname(vehicleId,blob.pathname))throw Error("UPLOAD_COMPLETION_PATH_MISMATCH");
        audit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:String(completed.requestId||rid),vehicleId,actorId:completed.userId||null,actorRole:completed.actorRole||null,year:completed.year,make:completed.make,model:completed.model,mileage:completed.mileage,stock:completed.stock,detail:JSON.stringify({pathname:blob.pathname,url:blob.url,contentType:blob.contentType,size:completed.size,sha256:completed.sha256,provider:"vercel-blob"})});
      }
    });
    return json(result,200,rid);
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    audit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail});
    return json({ok:false,error:detail,requestId:rid},uploadStatus(detail),rid);
  }
}
