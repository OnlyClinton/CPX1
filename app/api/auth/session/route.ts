import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {appendRecoveryCookies,neonRecoveryEnabled,recoverySession} from "../../../../lib/wdccNeonRecovery";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/session");
  try{
    if(neonRecoveryEnabled()){
      const recovered=await recoverySession(request);
      if(!recovered)return NextResponse.json({authenticated:false,user:null,session:null,recovery:true},{headers:{"Cache-Control":"private, no-store","X-WDCC-Recovery-Auth":"neon"}});
      const user=recovered.user;
      const headers=new Headers({"Cache-Control":"private, no-store","X-WDCC-Recovery-Auth":"neon"});
      appendRecoveryCookies(headers,recovered.cookies);
      return NextResponse.json({authenticated:true,role:recovered.role,user:{id:user.id,displayName:user.name||user.email,username:user.email,email:user.email,role:recovered.role,tenantId:"wdcc"},session:{email:user.email||"",role:recovered.role,tenantId:"wdcc",mustChangePassword:false},recovery:true},{headers});
    }
    const user=await currentUser();
    if(!user)return NextResponse.json({authenticated:false,user:null,session:null},{headers:{"Cache-Control":"private, no-store"}});
    return NextResponse.json({authenticated:true,role:user.role,user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId:user.tenantId},session:{email:user.email||user.username||"",role:user.role,tenantId:user.tenantId,mustChangePassword:false}},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({authenticated:false,user:null,session:null,error:error instanceof Error?error.message:"session_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
