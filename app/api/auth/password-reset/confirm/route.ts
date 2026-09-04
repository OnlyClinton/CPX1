import {NextResponse} from "next/server";
import {clearSession,passwordPolicyError} from "../../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../../lib/dealerProxy";
import {confirmCanonicalPasswordReset} from "../../../../../lib/passwordRecovery";

export const dynamic="force-dynamic";

function reply(body:any,status:number,rid:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/password-reset/confirm");
  const rid=requestId(request);
  try{
    const body=await request.json().catch(()=>({}));
    const token=String(body?.token||"").trim();
    const password=String(body?.password||"");
    if(token.length<20)return reply({ok:false,error:"reset_link_invalid_or_expired"},400,rid);
    const policyError=passwordPolicyError(password);
    if(policyError)return reply({ok:false,error:policyError},400,rid);

    const result=await confirmCanonicalPasswordReset(token,password);
    if(!result.ok){
      if([400,401,403,404,422].includes(result.status))return reply({ok:false,error:"reset_link_invalid_or_expired"},400,rid);
      console.error("WDCC_NEON_PASSWORD_RESET_CONFIRM_FAILED",{requestId:rid,status:result.status});
      return reply({ok:false,error:"auth_service_unavailable"},503,rid);
    }

    // The canonical reset endpoint owns the credential. Remove any legacy WDCC
    // session so the next sign-in is evaluated against Neon Auth only.
    await clearSession().catch(()=>{});
    return reply({ok:true,authority:"neon_auth",next:"/login"},200,rid);
  }catch(error){
    console.error("WDCC_NEON_PASSWORD_RESET_CONFIRM_ERROR",{requestId:rid,error:error instanceof Error?error.message:"unknown"});
    return reply({ok:false,error:"password_reset_failed"},503,rid);
  }
}
