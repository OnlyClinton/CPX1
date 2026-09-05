import crypto from "node:crypto";
import {cookies,headers} from "next/headers";
import {readState,type User} from "./store";
import {NEON_AUTH_BASE} from "./passwordRecovery";

export const SESSION_COOKIE="__Host-wdcc_session";
const SESSION_MAX_AGE=4*60*60;
const ADMIN_EMAIL="admin@internal.wedontcarecars.com";
const DEALER_EMAIL="dealer-v2@internal.wedontcarecars.com";
const PORTAL_EMAILS=new Set([ADMIN_EMAIL,DEALER_EMAIL]);

function secret(){
  const value=process.env.SESSION_SECRET||"";
  if(value.length<32)throw Error("SESSION_SECRET_NOT_CONFIGURED");
  return value;
}
function sign(value:string){
  return crypto.createHmac("sha256",secret()).update(value).digest("base64url");
}

// Legacy WDCC-state password helpers remain for bounded provisioning compatibility.
// Canonical dealer/admin sign-in and password lifecycle are owned by Neon Auth.
export function verifyPassword(value:string,stored?:string){
  if(!stored?.startsWith("scrypt$"))return false;
  const[,salt,digest]=stored.split("$");
  if(!salt||!digest)return false;
  try{
    const actual=crypto.scryptSync(value,Buffer.from(salt,"base64url"),64);
    const expected=Buffer.from(digest,"base64url");
    return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
  }catch{return false;}
}
export function passwordPolicyError(value:unknown){
  const password=String(value??"");
  if(password.length<12)return "password_must_be_at_least_12_characters";
  if(password.length>128)return "password_is_too_long";
  return "";
}
export function hashPassword(value:string){
  const policyError=passwordPolicyError(value);
  if(policyError)throw Error(policyError);
  const salt=crypto.randomBytes(24);
  const digest=crypto.scryptSync(value,salt,64);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

function token(user:User){
  const raw=Buffer.from(JSON.stringify({
    id:user.id,
    role:user.role,
    sessionVersion:Number(user.sessionVersion||0),
    exp:Date.now()+SESSION_MAX_AGE*1000
  })).toString("base64url");
  return `${raw}.${sign(raw)}`;
}
function parse(value?:string|null){
  if(!value)return null;
  const[raw,sig]=value.split(".");
  if(!raw||!sig)return null;
  try{
    const expected=Buffer.from(sign(raw));
    const supplied=Buffer.from(sig);
    if(expected.length!==supplied.length||!crypto.timingSafeEqual(expected,supplied))return null;
    const payload=JSON.parse(Buffer.from(raw,"base64url").toString());
    return Number(payload.exp)>Date.now()?payload:null;
  }catch{return null;}
}
function active(user:User){return user.status!=="disabled"&&!user.disabled;}
function identifiers(user:User){
  return [user.email,user.secondaryEmail,user.username,user.loginAlias,...(Array.isArray(user.aliases)?user.aliases:[])]
    .map(value=>String(value||"").trim().toLowerCase()).filter(Boolean);
}
async function neonCurrentUser(){
  try{
    const requestHeaders=await headers();
    const cookie=requestHeaders.get("cookie")||"";
    if(!cookie)return null;
    const upstream=await fetch(`${NEON_AUTH_BASE}/get-session`,{
      headers:{accept:"application/json",cookie},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10_000)
    });
    if(!upstream.ok)return null;
    const text=await upstream.text();
    let data:any=null;
    try{data=text?JSON.parse(text):null;}catch{return null;}
    const email=String(data?.user?.email||"").trim().toLowerCase();
    if(!data?.user||!PORTAL_EMAILS.has(email))return null;
    const admin=email===ADMIN_EMAIL;
    const roles=admin?new Set(["platform_admin","tenant_admin","admin"]):new Set(["dealer_agent","dealer"]);
    const keys=admin?new Set([ADMIN_EMAIL,"admin"]):new Set([DEALER_EMAIL,"dealer","bigpussy"]);
    const state=await readState();
    return state.users.find(user=>active(user)&&roles.has(String(user.role||"").toLowerCase())&&identifiers(user).some(value=>keys.has(value)))||
      state.users.find(user=>active(user)&&roles.has(String(user.role||"").toLowerCase()))||null;
  }catch{return null;}
}

export function sessionCookieValue(user:User){return token(user);}
export function sessionCookieHeader(user:User){return `${SESSION_COOKIE}=${sessionCookieValue(user)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;}
export function clearSessionCookieHeader(){return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;}

export async function currentUser(){
  const jar=await cookies();
  const payload=parse(jar.get(SESSION_COOKIE)?.value);
  if(payload){
    const state=await readState();
    const user=state.users.find(candidate=>
      candidate.id===payload.id&&active(candidate)&&Number(candidate.sessionVersion||0)===Number(payload.sessionVersion||0)
    );
    if(user)return user;
  }
  return neonCurrentUser();
}
export async function setSession(user:User){
  const jar=await cookies();
  jar.set(SESSION_COOKIE,sessionCookieValue(user),{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:SESSION_MAX_AGE});
}
export async function clearSession(){const jar=await cookies();jar.delete(SESSION_COOKIE);}
