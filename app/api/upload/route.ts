import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {dataApi,dealerIdentity,rowToVehicle} from "../../../lib/neonDealerData";

export const dynamic="force-dynamic";
function json(body:any,status:number,rid:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid,"X-WDCC-Media-Authority":"vercel-blob"}});}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  const uploadToken=String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(!uploadToken){
    console.error("WDCC_UPLOAD_AUTHORITY_MISSING",JSON.stringify({requestId:rid,hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
    return json({ok:false,error:"upload_authority_unavailable",requestId:rid},503,rid);
  }
  try{
    const body=(await request.json())as HandleUploadBody;
    const result=await handleUpload({
      body,request,token:uploadToken,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        const identity=await dealerIdentity(request);
        if(!identity||!identity.dealerId)throw Error("Unauthorized");
        let payload:any={};try{payload=JSON.parse(clientPayload||"{}");}catch{}
        const vehicleId=String(payload.vehicleId||"");
        const correlationId=String(payload.requestId||rid).slice(0,160)||rid;
        if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`))throw Error("Invalid upload path");
        const upstream=await dataApi(request,`vehicles?id=eq.${encodeURIComponent(vehicleId)}&select=*`,{},true);
        const rows=await upstream.json().catch(()=>[]);
        const row=upstream.ok&&Array.isArray(rows)?rows[0]:null;
        if(!row)throw Error("Vehicle not found");
        if(identity.role!=="platform_admin"&&String(row.dealer_id||"")!==identity.dealerId)throw Error("Forbidden");
        if(String(row.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
        const vehicle=rowToVehicle(row);
        return {
          allowedContentTypes:["image/jpeg","image/png","image/webp","image/avif"],
          maximumSizeInBytes:15*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({vehicleId,userId:identity.id,actorRole:identity.role,dealerId:identity.dealerId,requestId:correlationId,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock})
        };
      },
      onUploadCompleted:async({blob,tokenPayload})=>{
        let payload:any={};try{payload=JSON.parse(tokenPayload||"{}");}catch{}
        console.log("WDCC_VEHICLE_PHOTO_UPLOADED",JSON.stringify({requestId:String(payload.requestId||rid),vehicleId:payload.vehicleId||null,pathname:blob.pathname,url:blob.url}));
      }
    });
    return json(result,200,rid);
  }catch(error){
    const detail=error instanceof Error?error.message:"upload_failed";
    const status=detail==="Unauthorized"?401:detail==="Forbidden"?403:detail==="Vehicle not found"?404:400;
    console.error("WDCC_VEHICLE_PHOTO_UPLOAD_FAILED",JSON.stringify({requestId:rid,detail}));
    return json({ok:false,error:detail,requestId:rid},status,rid);
  }
}
