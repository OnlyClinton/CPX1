import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {del} from "@vercel/blob";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {backupVehiclePhotoToDrive} from "../../../lib/googleDriveVehicleBackup";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);

function json(body:any,status:number,rid:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
}

function driveBackupRequired(){
  return ["1","true","yes","required"].includes(String(process.env.WDCC_DRIVE_BACKUP_REQUIRED||"").trim().toLowerCase());
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
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
        const user=await currentUser();
        if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
          await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"denied",requestId:rid,actorId:user?.id||null,actorRole:user?.role||null,detail:"auth_required"});
          throw Error("Unauthorized");
        }
        let payload:any={};try{payload=JSON.parse(clientPayload||"{}");}catch{}
        const vehicleId=String(payload.vehicleId||"");
        const correlationId=String(payload.requestId||rid).slice(0,160)||rid;
        if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`)){
          await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"failed",requestId:correlationId,vehicleId:vehicleId||null,actorId:user.id,actorRole:user.role,detail:"invalid_upload_path"});
          throw Error("Invalid upload path");
        }
        const state=await readState();
        const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);
        if(!vehicle)throw Error("Vehicle not found");
        if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
        if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
        await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname});
        return {
          allowedContentTypes:["image/jpeg","image/png","image/webp","image/avif"],
          maximumSizeInBytes:15*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({vehicleId,userId:user.id,actorRole:user.role,tenantId:user.tenantId||"wdcc",requestId:correlationId,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock})
        };
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        let payload:any={};try{payload=JSON.parse(tokenPayload||"{}");}catch{}
        const correlationId=String(payload.requestId||rid);
        const vehicleId=String(payload.vehicleId||"");
        await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:correlationId,vehicleId:vehicleId||null,actorId:payload.userId||null,actorRole:payload.actorRole||null,year:payload.year,make:payload.make,model:payload.model,mileage:payload.mileage,stock:payload.stock,detail:blob.pathname});

        try{
          const source=await fetch(blob.url,{cache:"no-store"});
          if(!source.ok)throw Error(`drive_backup_source_fetch_failed:${source.status}`);
          const backup=await backupVehiclePhotoToDrive({
            bytes:await source.arrayBuffer(),
            contentType:source.headers.get("content-type")||"application/octet-stream",
            filename:blob.pathname.split("/").pop()||"vehicle-photo",
            vehicleId,
            requestId:correlationId,
            sourcePathname:blob.pathname
          });
          await recordVehicleAudit({
            action:"vehicle.photo_backup",
            outcome:backup.status==="uploaded"?"ok":"skipped",
            requestId:correlationId,
            vehicleId:vehicleId||null,
            actorId:payload.userId||null,
            actorRole:payload.actorRole||null,
            year:payload.year,make:payload.make,model:payload.model,mileage:payload.mileage,stock:payload.stock,
            detail:JSON.stringify({provider:"google-drive",folderId:backup.folderId,fileId:backup.fileId||null,sha256:backup.sha256,status:backup.status,reason:backup.reason||null})
          });
        }catch(error){
          const detail=error instanceof Error?error.message:"drive_backup_failed";
          await recordVehicleAudit({action:"vehicle.photo_backup",outcome:"failed",requestId:correlationId,vehicleId:vehicleId||null,actorId:payload.userId||null,actorRole:payload.actorRole||null,detail});
          if(driveBackupRequired()){
            try{
              await del(blob.url,{token:uploadToken});
              await recordVehicleAudit({action:"vehicle.photo_rollback",outcome:"ok",requestId:correlationId,vehicleId:vehicleId||null,actorId:payload.userId||null,actorRole:payload.actorRole||null,detail:blob.pathname});
            }catch(rollbackError){
              const rollbackDetail=rollbackError instanceof Error?rollbackError.message:"primary_photo_rollback_failed";
              await recordVehicleAudit({action:"vehicle.photo_rollback",outcome:"failed",requestId:correlationId,vehicleId:vehicleId||null,actorId:payload.userId||null,actorRole:payload.actorRole||null,detail:rollbackDetail});
              console.error("WDCC_PRIMARY_PHOTO_ROLLBACK_FAILED",JSON.stringify({requestId:correlationId,vehicleId,pathname:blob.pathname,detail:rollbackDetail,driveBackupError:detail}));
              throw Error(`drive_backup_failed_primary_rollback_failed:${detail}`);
            }
            throw Error(`drive_backup_required:${detail}`);
          }
          console.error("WDCC_DRIVE_BACKUP_FAILED",JSON.stringify({requestId:correlationId,vehicleId,pathname:blob.pathname,detail}));
        }
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
