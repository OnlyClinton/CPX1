import {NextResponse} from "next/server";
import {isDealerRuntime,requestId} from "../../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../../lib/dealerProxy";
import {readState,type User} from "../../../../../lib/store";
import {canonicalAuthEmailForLogin,canonicalAuthEmailForUser,findActiveUser,normalizeLogin,requestCanonicalPasswordReset} from "../../../../../lib/passwordRecovery";

export const dynamic="force-dynamic";

const GENERIC={ok:true,message:"If that WDCC account is eligible for recovery, a reset link will arrive shortly. Check spam or contact a platform administrator if it does not."};

function reply(body:any,status:number,rid:string){
  return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
}
function active(user:User){return user.status!=="disabled"&&!user.disabled;}
function userForCanonicalEmail(users:User[],email:string){
  const admin=email.startsWith("admin@");
  const roles=admin?new Set(["platform_admin","tenant_admin","admin"]):new Set(["dealer_agent","dealer"]);
  return users.find(user=>active(user)&&roles.has(String(user.role||"").toLowerCase()))||null;
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/password-reset/request");
  const rid=requestId(request);
  const body=await request.json().catch(()=>({}));
  const login=normalizeLogin(body?.login||body?.email||body?.username);
  if(!login)return reply(GENERIC,200,rid);

  try{
    const state=await readState();
    const directEmail=canonicalAuthEmailForLogin(login);
    const user=findActiveUser(state.users,login)||(directEmail?userForCanonicalEmail(state.users,directEmail):null);
    if(!user)return reply(GENERIC,200,rid);
    const email=canonicalAuthEmailForUser(user);
    if(!email)return reply(GENERIC,200,rid);

    const result=await requestCanonicalPasswordReset(email);
    if(!result.ok)console.warn("WDCC_NEON_PASSWORD_RESET_REQUEST_NOT_DELIVERED",{requestId:rid,status:result.status});
    return reply(GENERIC,200,rid);
  }catch(error){
    console.error("WDCC_NEON_PASSWORD_RESET_REQUEST_FAILED",{requestId:rid,error:error instanceof Error?error.message:"unknown"});
    return reply(GENERIC,200,rid);
  }
}
