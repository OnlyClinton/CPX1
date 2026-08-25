import {issueSignedToken} from "@vercel/blob";
import {handleUploadPresigned,type HandleUploadPresignedBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedContentTypes=["image/jpeg","image/png","image/webp","image/avif"];
const maximumSizeInBytes=15*1024*1024;

function blobAuth(){
  const token=String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(token)return {token};
  const oidcToken=String(process.env.VERCEL_OIDC_TOKEN||"").trim();
  const storeId=String(process.env.BLOB_STORE_ID||"").trim();
  if(oidcToken&&storeId)return {oidcToken,storeId};
  return null;
}

function vehicleIdFromPath(pathname:string){
  const match=/^media\/wdcc\/([^/]+)\//.exec(String(pathname||""));
  return match?.[1]||"";
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  try{
    const authority=blobAuth();
    if(!authority)throw Error("Blob upload authority unavailable");
    const body=(await request.json())as HandleUploadPresignedBody;
    const result=await handleUploadPresigned({
      body,
      request,
      getSignedToken:async(pathname)=>{
        const user=await currentUser();
        if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
          await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
          throw Error("Unauthorized");
        }
        const vehicleId=vehicleIdFromPath(pathname);
        if(!vehicleId){
          await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"failed",requestId:rid,actorId:user.id,actorRole:user.role,detail:"invalid_upload_path"});
          throw Error("Invalid upload path");
        }
        const state=await readState();
        const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);
        if(!vehicle)throw Error("Vehicle not found");
        if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
        if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
        await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:rid,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname});
        const token=await issueSignedToken({
          pathname,
          operations:["put"],
          allowedContentTypes,
          maximumSizeInBytes,
          ...(authority as any)
        });
        return {
          token,
          urlOptions:{
            allowedContentTypes,
            maximumSizeInBytes,
            addRandomSuffix:true,
            allowOverwrite:false
          }
        };
      }
    });
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail});
    const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:detail.includes("authority unavailable")?503:400;
    return NextResponse.json({ok:false,error:detail,requestId:rid},{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
  }
}
