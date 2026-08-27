import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {setSession,verifyPassword} from "../../../../lib/auth";
import {readState} from "../../../../lib/store";
import {appendRecoveryCookies,neonRecoveryEnabled,recoveryRole,recoverySignIn} from "../../../../lib/wdccNeonRecovery";

export const dynamic="force-dynamic";

function norm(v:unknown){return String(v||"").trim().toLowerCase()}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/login");
  try{
    const body=await request.json().catch(()=>({}));
    const login=norm(body?.email||body?.username||body?.login);
    const password=String(body?.password||"");
    if(!login||!password)return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"no-store"}});

    if(neonRecoveryEnabled()){
      if(!login.includes("@"))return NextResponse.json({ok:false,error:"recovery_email_required"},{status:400,headers:{"Cache-Control":"no-store"}});
      const signed=await recoverySignIn(request,login,password);
      if(!signed.ok)return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"no-store"}});
      const user=signed.data?.user||signed.data?.data?.user||null;
      if(!user?.id)return NextResponse.json({ok:false,error:"recovery_session_missing"},{status:503,headers:{"Cache-Control":"no-store"}});
      const role=recoveryRole(user);
      const headers=new Headers({"Cache-Control":"no-store","X-WDCC-Recovery-Auth":"neon"});
      appendRecoveryCookies(headers,signed.cookies);
      return NextResponse.json({ok:true,role,tenantId:"wdcc",name:user.name||user.email||"WDCC User",mustChangePassword:false,user:{id:user.id,displayName:user.name||user.email,username:user.email,email:user.email,role,tenantId:"wdcc"},recovery:true},{headers});
    }

    const state=await readState();
    const user=state.users.find(u=>{
      if(u.status==="disabled"||u.disabled)return false;
      const aliases=[u.email,u.secondaryEmail,u.username,u.loginAlias,...(Array.isArray(u.aliases)?u.aliases:[])].map(norm).filter(Boolean);
      return aliases.includes(login);
    });
    if(!user||!verifyPassword(password,user.passwordHash))return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"no-store"}});
    await setSession(user);
    return NextResponse.json({ok:true,role:user.role,tenantId:user.tenantId||"wdcc",name:user.displayName||user.username||user.email||"WDCC Dealer",mustChangePassword:false,user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId:user.tenantId}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"login_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
