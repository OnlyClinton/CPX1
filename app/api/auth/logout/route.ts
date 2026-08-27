import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {clearSession} from "../../../../lib/auth";
import {appendRecoveryCookies,neonRecoveryEnabled,recoverySignOut} from "../../../../lib/wdccNeonRecovery";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/logout");
  try{
    if(neonRecoveryEnabled()){
      const signedOut=await recoverySignOut(request);
      const headers=new Headers({"Cache-Control":"no-store","X-WDCC-Recovery-Auth":"neon"});
      appendRecoveryCookies(headers,signedOut.cookies);
      return NextResponse.json({ok:signedOut.ok,recovery:true},{status:signedOut.ok?200:502,headers});
    }
    await clearSession();
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"logout_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
