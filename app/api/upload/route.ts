import {issueSignedToken} from "@vercel/blob";
import {handleUploadPresigned,type HandleUploadPresignedBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {blobAuthority} from "../../../lib/wdccAuthority";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedContentTypes=["image/jpeg","image/png","image/webp","image/avif"];
const maximumSizeInBytes=15*1024*1024;

function json(body:any,status:number,rid:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
}

export async function POST(request:Request){
  // Frontends never own Blob credentials. They forward the authenticated upload
  // handshake to the exact Phoenix authority selected by canonicalDealerBackend().
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");

  const rid=requestId(request);
  try{
    const body=(await request.json())as HandleUploadPresignedBody;
    const authority=blobAuthority();
    if(authority.mode==="missing"){
      console.error("WDCC_UPLOAD_AUTHORITY_MISSING",JSON.stringify({requestId:rid,hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
      return json({ok:false,error:"upload_authority_unavailable",requestId:rid},503,rid);
    }

    const result=await handleUploadPresigned({
      body,
      request,
      getSignedToken:async(pathname,clientPayload)=>{
        let payload:any={};try{payload=JSON.parse(clientPayload||"{}");}catch{}
        const vehicleId=String(payload.vehicleId||"");
        const correlationId=String(payload.requestId||rid).slice(0,160)||rid;
        if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`))throw Error("Invalid upload path");

        const [state,user]=await Promise.all([readState(),currentUser()]);
        if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))throw Error("Unauthorized");
        const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);
        if(!vehicle)throw Error("Vehicle not found");
        if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
        if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");

        await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:`presigned:${authority.mode}:${pathname}`});

        const token=await issueSignedToken({
          pathname,
          operations:["put"],
          validUntil:Date.now()+10*60*1000,
          allowedContentTypes,
          maximumSizeInBytes,
          ...authority.options
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
    return json(result,200,rid);
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail});
    const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:detail==="upload_authority_unavailable"?503:400;
    return json({ok:false,error:detail,requestId:rid},status,rid);
  }
}
