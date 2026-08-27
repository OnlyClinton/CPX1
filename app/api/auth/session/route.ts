import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/session");
  try{
    const user=await currentUser();
    if(!user)return NextResponse.json({authenticated:false,user:null,session:null},{headers:{"Cache-Control":"private, no-store"}});
    return NextResponse.json({authenticated:true,role:user.role,user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId:user.tenantId},session:{email:user.email||user.username||"",role:user.role,tenantId:user.tenantId,mustChangePassword:false}},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({authenticated:false,user:null,session:null,error:error instanceof Error?error.message:"session_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
