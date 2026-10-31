import crypto from "node:crypto";
import {cookies} from "next/headers";
import {readState,type User} from "./store";

export const SESSION_COOKIE="__Host-wdcc_session";
const SESSION_MAX_AGE=4*60*60;

function secret(){
  const value=process.env.SESSION_SECRET||"";
  if(value.length<32)throw Error("SESSION_SECRET_NOT_CONFIGURED");
  return value;
}
function sign(value:string){return crypto.createHmac("sha256",secret()).update(value).digest("base64url");}
function token(user:User){
  const raw=Buffer.from(JSON.stringify({id:user.id,role:user.role,exp:Date.now()+SESSION_MAX_AGE*1000})).toString("base64url");
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
/**
 * Shared reset/change password policy, consistent with account UI.
 * The canonical identity service remains authoritative for reset tokens and
 * may enforce additional provider-level credential restrictions.
 */
export function passwordPolicyError(value:string):string|null{
  if(typeof value!=="string"||value.length<12)return "password_must_be_at_least_12_characters";
  if(value.length>128)return "password_is_too_long";
  if([...value].some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127))
    return "password_contains_control_characters";
  const blocked=new Set(["password123456","123456789012","qwerty123456","letmein123456","admin12345678","changeme12345"]);
  if(blocked.has(value.toLowerCase().replaceAll(" ","")))return "password_too_common";
  return null;
}

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
export function sessionCookieValue(user:User){return token(user);}
export function sessionCookieHeader(user:User){return `${SESSION_COOKIE}=${sessionCookieValue(user)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;}
export function clearSessionCookieHeader(){return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;}
export async function currentUser(){
  try{
    const jar=await cookies();
    const payload=parse(jar.get(SESSION_COOKIE)?.value);
    if(!payload)return null;
    const state=await readState();
    return state.users.find(candidate=>candidate.id===payload.id&&active(candidate))||null;
  }catch{return null;}
}
export async function setSession(user:User){
  const jar=await cookies();
  jar.set(SESSION_COOKIE,sessionCookieValue(user),{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:SESSION_MAX_AGE});
}
export async function clearSession(){const jar=await cookies();jar.delete(SESSION_COOKIE);}
