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
    const mustChangePassword=user.mustChangePassword===true;
    return NextResponse.json({
      authenticated:true,
      role:user.role,
      user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId:user.tenantId,mustChangePassword},
      session:{email:user.email||user.username||"",role:user.role,tenantId:user.tenantId,mustChangePassword}
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("WDCC_AUTH_SESSION_ERROR",error);
    return NextResponse.json({authenticated:false,user:null,session:null,error:"auth_service_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
