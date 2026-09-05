import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {clearSession,currentUser,passwordPolicyError} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {NEON_AUTH_BASE} from "../../../../lib/passwordRecovery";
import {readState,writeState} from "../../../../lib/store";

export const dynamic="force-dynamic";

function reply(body:any,status:number,rid:string,extra?:Headers){
  const headers=extra||new Headers();
  headers.set("Cache-Control","no-store");
  headers.set("X-WDCC-Request-ID",rid);
  return NextResponse.json(body,{status,headers});
}
function copyCookies(upstream:Response,headers:Headers){
  const getter=(upstream.headers as any).getSetCookie;
  if(typeof getter==="function")for(const cookie of getter.call(upstream.headers))headers.append("set-cookie",cookie);
  else{const cookie=upstream.headers.get("set-cookie");if(cookie)headers.append("set-cookie",cookie);}
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/change-password");
  const rid=requestId(request);
  const user=await currentUser().catch(()=>null);
  if(!user)return reply({ok:false,error:"unauthorized"},401,rid);

  try{
    const body=await request.json().catch(()=>({}));
    const currentPassword=String(body?.currentPassword||"");
    const newPassword=String(body?.newPassword||"");
    if(!currentPassword)return reply({ok:false,error:"current_password_required"},400,rid);
    if(currentPassword===newPassword)return reply({ok:false,error:"new_password_must_differ"},400,rid);
    const policyError=passwordPolicyError(newPassword);
    if(policyError)return reply({ok:false,error:policyError},400,rid);

    const cookie=request.headers.get("cookie")||"";
    if(!cookie)return reply({ok:false,error:"unauthorized"},401,rid);
    const upstream=await fetch(`${NEON_AUTH_BASE}/change-password`,{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json",cookie},
      body:JSON.stringify({currentPassword,newPassword,revokeOtherSessions:true}),
      cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(15_000)
    });
    const responseHeaders=new Headers();
    copyCookies(upstream,responseHeaders);
    if(!upstream.ok){
      const error=upstream.status===400||upstream.status===401?"current_password_incorrect":"auth_service_unavailable";
      return reply({ok:false,error},upstream.status===400||upstream.status===401?401:503,rid,responseHeaders);
    }

    let stateSynchronized=false;
    let persisted=user;
    try{
      const state=await readState();
      const index=state.users.findIndex(candidate=>candidate.id===user.id);
      if(index>=0){
        const now=new Date().toISOString();
        const {passwordHash,passwordReset,...current}=state.users[index] as any;
        const updated={...current,mustChangePassword:false,passwordChangedAt:now,updatedAt:now,sessionVersion:Number(current.sessionVersion||0)+1};
        state.users[index]=updated;
        state.audit.push({id:crypto.randomUUID(),at:now,action:"user.password_changed",actor:user.id,actorRole:user.role,requestId:rid,authority:"neon_auth"});
        const saved=await writeState(state);
        persisted=saved.users.find(candidate=>candidate.id===user.id)||updated;
        stateSynchronized=true;
      }
    }catch(error){
      console.error("WDCC_PASSWORD_CHANGE_STATE_SYNC_FAILED",{requestId:rid,error:error instanceof Error?error.message:"unknown"});
    }

    // Remove the legacy WDCC session so the next authorization decision is made from Neon Auth.
    await clearSession().catch(()=>{});
    return reply({ok:true,role:persisted.role,stateSynchronized,user:{id:persisted.id,role:persisted.role,displayName:persisted.displayName,username:persisted.username}},200,rid,responseHeaders);
  }catch(error){
    console.error("WDCC_PASSWORD_CHANGE_FAILED",{requestId:rid,error:error instanceof Error?error.message:"unknown"});
    return reply({ok:false,error:"password_change_failed"},503,rid);
  }
}
