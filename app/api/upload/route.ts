import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {mediaAuthority} from "../../../lib/wdccAuthority";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer","dealer_agent","tenant_admin","platform_admin"]);
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAX_BYTES=15*1024*1024;

function json(body:any,status:number,rid:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});}
function safeName(value:string){return String(value||"photo").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"photo";}
function validImageSignature(type:string,bytes:Uint8Array){
  if(type==="image/jpeg")return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(type==="image/png")return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);
  if(type==="image/webp")return String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(type==="image/avif")return String.fromCharCode(...bytes.slice(4,8))==="ftyp"&&String.fromCharCode(...bytes.slice(8,32)).includes("avif");
  return false;
}

async function authorizeVehicle(rid:string,vehicleId:string){
  const user=await currentUser();
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))throw Error("Unauthorized");
  const state=await readState();
  const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);
  if(!vehicle)throw Error("Vehicle not found");
  if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
  if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
  return {user,vehicle};
}

async function cloudflareUpload(request:Request,rid:string,authority:any){
  const form=await request.formData();
  const vehicleId=String(form.get("vehicleId")||"").trim();
  const suppliedRid=String(form.get("requestId")||rid).trim().slice(0,160)||rid;
  const file=form.get("file");
  if(!vehicleId||!(file instanceof File))return json({ok:false,error:"vehicleId_and_file_required",requestId:suppliedRid},400,suppliedRid);
  if(!allowedTypes.has(file.type)||file.size<=0||file.size>MAX_BYTES)return json({ok:false,error:"invalid_photo",requestId:suppliedRid},400,suppliedRid);
  const fileBuffer=await file.arrayBuffer();
  if(!validImageSignature(file.type,new Uint8Array(fileBuffer.slice(0,32))))return json({ok:false,error:"invalid_image_content",requestId:suppliedRid},400,suppliedRid);

  try{
    const {user,vehicle}=await authorizeVehicle(suppliedRid,vehicleId);
    const pathname=`media/wdcc/${vehicleId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:suppliedRid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname});

    const response=await fetch(`${authority.options.mediaServiceUrl}/media?p=${encodeURIComponent(pathname)}`,{
      method:"PUT",
      headers:{"Content-Type":file.type,Authorization:`Bearer ${authority.options.mediaServiceToken}`},
      body:fileBuffer,
      cache:"no-store",
      signal:AbortSignal.timeout(15000)
    });
    const result:any=await response.json().catch(()=>({}));
    if(!response.ok||result?.ok!==true)throw Error(`media_provider_failed:${response.status}:${result?.error||"unknown"}`);
    await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:suppliedRid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:pathname});
    return json({ok:true,pathname,contentType:file.type,size:file.size,sha256:result.sha256,provider:"cloudflare"},200,suppliedRid);
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:suppliedRid,vehicleId:vehicleId||null,detail});
    const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:detail==="Vehicle not found"?404:400;
    return json({ok:false,error:detail,requestId:suppliedRid},status,suppliedRid);
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  const media=mediaAuthority();
  if(media.mode==="cloudflare-do")return cloudflareUpload(request,rid,media);

  const uploadToken=String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(!uploadToken){
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail:"upload_authority_unavailable"});
    console.error("WDCC_UPLOAD_AUTHORITY_MISSING",JSON.stringify({requestId:rid,hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
    return json({ok:false,error:"upload_authority_unavailable",requestId:rid},503,rid);
  }
  try{
    const body=(await request.json())as HandleUploadBody;
    const result=await handleUpload({
      body,request,token:uploadToken,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        let payload:any={};try{payload=JSON.parse(clientPayload||"{}");}catch{}
        const vehicleId=String(payload.vehicleId||"");
        const correlationId=String(payload.requestId||rid).slice(0,160)||rid;
        if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`))throw Error("Invalid upload path");
        const {user,vehicle}=await authorizeVehicle(correlationId,vehicleId);
        await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname});
        return {allowedContentTypes:[...allowedTypes],maximumSizeInBytes:MAX_BYTES,addRandomSuffix:true,tokenPayload:JSON.stringify({vehicleId,userId:user.id,actorRole:user.role,tenantId:user.tenantId||"wdcc",requestId:correlationId,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock})};
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        let payload:any={};try{payload=JSON.parse(tokenPayload||"{}");}catch{}
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
