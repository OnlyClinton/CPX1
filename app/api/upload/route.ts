import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {readState} from "../../../lib/store";
import {isTrustedWriteRequest,securityError} from "../../../lib/request-security";

const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);

export async function POST(request:Request){
  if(!isTrustedWriteRequest(request))return securityError();
  const body=(await request.json())as HandleUploadBody;
  try{
    return NextResponse.json(await handleUpload({
      body,request,token:process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken:async(pathname,clientPayload)=>{
        const user=await currentUser();
        if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))throw Error("Unauthorized");
        let vehicleId="";
        try{vehicleId=String(JSON.parse(clientPayload||"{}").vehicleId||"");}catch{}
        if(!vehicleId||!pathname.startsWith(`media/wdcc/${vehicleId}/`))throw Error("Invalid upload path");
        const state=await readState();
        const vehicle=state.vehicles.find(item=>item.id===vehicleId);
        if(!vehicle)throw Error("Vehicle not found");
        if(String(user.role).toLowerCase()!=="platform_admin"&&
          String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))throw Error("Forbidden");
        if(String(vehicle.status||"").toLowerCase()==="archived")throw Error("Vehicle archived");
        return {
          allowedContentTypes:["image/jpeg","image/png","image/webp","image/avif"],
          maximumSizeInBytes:10*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({vehicleId,userId:user.id,tenantId:user.tenantId||"wdcc"})
        };
      },
      onUploadCompleted:async()=>{}
    }),{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"upload_failed"
    },{status:400,headers:{"Cache-Control":"private, no-store"}});
  }
}
