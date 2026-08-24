import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {setSession,verifyPassword} from "../../../../lib/auth";
import {readState} from "../../../../lib/store";

export const dynamic="force-dynamic";

function norm(v:unknown){return String(v||"").trim().toLowerCase()}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/login");
  try{
    const body=await request.json().catch(()=>({}));
    const login=norm(body?.email||body?.username||body?.login);
    const password=String(body?.password||"");
    if(!login||!password)return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"no-store"}});
    const state=await readState();
    const user=state.users.find(u=>{
      if(u.status==="disabled"||u.disabled)return false;
      const aliases=[u.email,u.secondaryEmail,u.username,u.loginAlias,...(Array.isArray(u.aliases)?u.aliases:[])].map(norm).filter(Boolean);
      return aliases.includes(login);
    });
    if(!user||!verifyPassword(password,user.passwordHash))return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"no-store"}});
    await setSession(user);
    return NextResponse.json({ok:true,role:user.role,user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId:user.tenantId}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"login_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
