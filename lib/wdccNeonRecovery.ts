import {previewRecoveryEnabled} from "./wdccPreviewRecoveryState";

const DEFAULT_AUTH_BASE="https://ep-autumn-union-aym7q37b.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
const DEFAULT_DATA_API="https://ep-autumn-union-aym7q37b.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1";

function cleanUrl(value:string){return value.trim().replace(/\/+$/g,"")}
function authBase(){return cleanUrl(process.env.WDCC_NEON_AUTH_BASE_URL||DEFAULT_AUTH_BASE)}
function dataApi(){return cleanUrl(process.env.WDCC_NEON_DATA_API_URL||DEFAULT_DATA_API)}
function incomingCookie(request:Request){return String(request.headers.get("cookie")||"").trim()}

export function neonRecoveryEnabled(){return previewRecoveryEnabled()}
export function recoveryRole(user:any){return String(user?.role||"").toLowerCase()==="admin"?"platform_admin":"dealer_agent"}

function setCookies(headers:Headers){
  const h=headers as Headers&{getSetCookie?:()=>string[]};
  const values=typeof h.getSetCookie==="function"?h.getSetCookie():[];
  if(values.length)return values;
  const one=headers.get("set-cookie");
  return one?[one]:[];
}
function normalizeCookie(value:string){
  // Cookies emitted by the branch auth service must be scoped to the isolated
  // application host when proxied through Next.js. Never preserve an upstream
  // Domain attribute; keep the cookie host-only and secure.
  return value
    .replace(/;\s*Domain=[^;]*/ig,"")
    .replace(/;\s*Path=[^;]*/i,"; Path=/");
}
function forwardedCookies(response:Response){return setCookies(response.headers).map(normalizeCookie)}

async function authFetch(path:string,request:Request,init:RequestInit={}){
  const headers=new Headers(init.headers||{});
  headers.set("Accept","application/json");
  const cookie=incomingCookie(request);
  if(cookie)headers.set("Cookie",cookie);
  const response=await fetch(`${authBase()}${path}`,{
    ...init,
    headers,
    cache:"no-store",
    redirect:"manual",
    signal:AbortSignal.timeout(10_000)
  });
  return response;
}

export async function recoverySignIn(request:Request,email:string,password:string){
  if(!previewRecoveryEnabled())throw Error("RECOVERY_AUTH_NOT_ENABLED");
  const response=await authFetch("/sign-in/email",request,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password,rememberMe:true})
  });
  const data=await response.json().catch(()=>null);
  return {ok:response.ok,status:response.status,data,cookies:forwardedCookies(response)};
}

export async function recoverySignOut(request:Request){
  if(!previewRecoveryEnabled())throw Error("RECOVERY_AUTH_NOT_ENABLED");
  const response=await authFetch("/sign-out",request,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  return {ok:response.ok,status:response.status,cookies:forwardedCookies(response)};
}

export async function recoverySession(request:Request){
  if(!previewRecoveryEnabled())return null;
  const response=await authFetch("/get-session",request,{method:"GET"});
  if(!response.ok)return null;
  const data=await response.json().catch(()=>null);
  const user=data?.user||data?.data?.user||null;
  const session=data?.session||data?.data?.session||null;
  if(!user||!session)return null;
  let jwt=String(response.headers.get("set-auth-jwt")||session?.token||"").trim();
  if(!jwt){
    const tokenResponse=await authFetch("/token",request,{method:"GET"}).catch(()=>null);
    if(tokenResponse?.ok){const tokenData=await tokenResponse.json().catch(()=>null);jwt=String(tokenData?.token||"").trim();}
  }
  return {user,session,jwt,role:recoveryRole(user),tenantId:"wdcc",cookies:forwardedCookies(response)};
}

export async function recoveryRpc(request:Request,name:string,body:Record<string,unknown>={}){
  const session=await recoverySession(request);
  if(!session)return {ok:false,status:401,error:"Unauthorized",session:null,data:null};
  if(!session.jwt)return {ok:false,status:503,error:"RECOVERY_JWT_UNAVAILABLE",session,data:null};
  const response=await fetch(`${dataApi()}/rpc/${encodeURIComponent(name)}`,{
    method:"POST",
    headers:{Authorization:`Bearer ${session.jwt}`,"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify(body),
    cache:"no-store",
    signal:AbortSignal.timeout(10_000)
  });
  const data=await response.json().catch(()=>null);
  return {ok:response.ok,status:response.status,error:response.ok?null:String(data?.message||data?.error||`RECOVERY_RPC_${response.status}`),session,data};
}

export function appendRecoveryCookies(headers:Headers,cookies:string[]){for(const cookie of cookies)headers.append("Set-Cookie",cookie)}
