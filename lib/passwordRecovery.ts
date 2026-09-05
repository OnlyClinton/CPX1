import type {User} from "./store";

export const NEON_AUTH_BASE="https://ep-curly-breeze-ay2iih1f.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
const ADMIN_EMAIL="admin@internal.wedontcarecars.com";
const DEALER_EMAIL="dealer-v2@internal.wedontcarecars.com";

const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
export const normalizeLogin=(value:unknown)=>clean(value,240).toLowerCase();

export function aliasesFor(user:User){
  return [user.username,user.email,user.secondaryEmail,user.loginAlias,...(Array.isArray(user.aliases)?user.aliases:[])]
    .map(normalizeLogin)
    .filter(Boolean);
}

export function findActiveUser(users:User[],login:string){
  return users.find(user=>user.status!=="disabled"&&!user.disabled&&aliasesFor(user).includes(login));
}

export function canonicalAuthEmailForLogin(value:unknown){
  const login=normalizeLogin(value);
  if(login==="admin"||login===ADMIN_EMAIL)return ADMIN_EMAIL;
  if(login==="dealer"||login==="bigpussy"||login===DEALER_EMAIL)return DEALER_EMAIL;
  return "";
}

export function canonicalAuthEmailForUser(user:User){
  const role=normalizeLogin(user.role);
  if(role==="platform_admin"||role==="tenant_admin"||role==="admin")return ADMIN_EMAIL;
  if(role==="dealer_agent"||role==="dealer")return DEALER_EMAIL;
  return "";
}

export function passwordResetOrigin(){
  const configured=clean(process.env.WDCC_PASSWORD_RESET_ORIGIN,500);
  if(configured){
    try{
      const url=new URL(configured);
      if(url.protocol==="https:")return url.origin;
    }catch{}
  }
  return "https://dealer.wedontcarecars.com";
}

export function passwordResetRedirect(){
  return new URL("/reset-password",passwordResetOrigin()).toString();
}

export async function requestCanonicalPasswordReset(email:string){
  const response=await fetch(`${NEON_AUTH_BASE}/request-password-reset`,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({email,redirectTo:passwordResetRedirect()}),
    cache:"no-store",
    redirect:"manual",
    signal:AbortSignal.timeout(15_000)
  });
  return {ok:response.ok,status:response.status};
}

export async function confirmCanonicalPasswordReset(token:string,newPassword:string){
  const response=await fetch(`${NEON_AUTH_BASE}/reset-password`,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({token,newPassword}),
    cache:"no-store",
    redirect:"manual",
    signal:AbortSignal.timeout(15_000)
  });
  return {ok:response.ok,status:response.status};
}
