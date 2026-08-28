import crypto from "node:crypto";
import {cookies} from "next/headers";
import {resolvePortalAccess,type PortalAccess} from "./wdccDb";
export {neonAuthReadiness,neonAuthUrl,revokeNeonAuthSession} from "./neonAuth";

export const SESSION_COOKIE="__Host-wdcc_session";
const SESSION_MAX_AGE=4*60*60;

export type AppSessionSubject={
  id:string;
  email:string;
  role:"platform_admin"|"dealer_agent";
  tenantId:string;
};

type SessionPayload=AppSessionSubject&{exp:number};

function sessionSecret(){
  const value=String(process.env.SESSION_SECRET||"");
  if(value.length<32)throw Error("SESSION_SECRET_NOT_CONFIGURED");
  return value;
}

function signature(raw:string,secret:string){
  return crypto.createHmac("sha256",secret).update(raw).digest("base64url");
}

function encodeSession(subject:AppSessionSubject,secret:string){
  const raw=Buffer.from(JSON.stringify({...subject,email:subject.email.trim().toLowerCase(),exp:Date.now()+SESSION_MAX_AGE*1000})).toString("base64url");
  return `${raw}.${signature(raw,secret)}`;
}

function parseSession(value:string|undefined,secret:string):SessionPayload|null{
  if(!value)return null;
  const[raw,supplied]=value.split(".");
  if(!raw||!supplied)return null;
  try{
    const expected=Buffer.from(signature(raw,secret),"base64url");
    const actual=Buffer.from(supplied,"base64url");
    if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return null;
    const payload=JSON.parse(Buffer.from(raw,"base64url").toString()) as Partial<SessionPayload>;
    const role=String(payload.role||"").toLowerCase();
    const id=String(payload.id||"").trim();
    const email=String(payload.email||"").trim().toLowerCase();
    const tenantId=String(payload.tenantId||"").trim();
    const exp=Number(payload.exp);
    if(!id||!email||!tenantId||!Number.isFinite(exp)||exp<=Date.now())return null;
    if(role!=="platform_admin"&&role!=="dealer_agent")return null;
    return {id,email,tenantId,role,exp};
  }catch{return null;}
}

export function sessionCookieValue(subject:AppSessionSubject){
  return encodeSession(subject,sessionSecret());
}

export function sessionCookieHeader(subject:AppSessionSubject){
  return `${SESSION_COOKIE}=${sessionCookieValue(subject)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookieHeader(){
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function sameAccess(payload:AppSessionSubject,user:PortalAccess){
  return String(user.id)===payload.id&&
    String(user.email||"").trim().toLowerCase()===payload.email&&
    String(user.role).toLowerCase()===payload.role&&
    String(user.tenantId)===payload.tenantId;
}

export async function signedSessionSubject():Promise<AppSessionSubject|null>{
  const secret=sessionSecret();
  const jar=await cookies();
  const payload=parseSession(jar.get(SESSION_COOKIE)?.value,secret);
  if(!payload)return null;
  return {id:payload.id,email:payload.email,role:payload.role,tenantId:payload.tenantId};
}

export async function currentUser(){
  const subject=await signedSessionSubject();
  if(!subject)return null;
  const user=await resolvePortalAccess({id:subject.id,email:subject.email});
  return user&&sameAccess(subject,user)?user:null;
}
