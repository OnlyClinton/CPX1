import crypto from "node:crypto";
import {cookies} from "next/headers";
import {readState,type User} from "./store";

const COOKIE="__Host-wdcc_session";
const SESSION_BACKEND=(process.env.WDCC_SESSION_BACKEND_URL||process.env.WDCC_DEALER_BACKEND_URL||"https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app").trim().replace(/\/$/,"");

function secret(){
  const value=process.env.SESSION_SECRET||"";
  if(value.length<32)throw Error("SESSION_SECRET_NOT_CONFIGURED");
  return value;
}
function sign(value:string){
  return crypto.createHmac("sha256",secret()).update(value).digest("base64url");
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
function token(user:User){
  const raw=Buffer.from(JSON.stringify({
    id:user.id,
    role:user.role,
    exp:Date.now()+4*60*60*1000
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

function active(user:any){return Boolean(user)&&String(user?.status||"").toLowerCase()!=="disabled"&&!user?.disabled;}

async function canonicalUser(id:string){
  try{
    const state=await readState();
    return state.users.find(user=>String(user.id)===String(id)&&active(user))||null;
  }catch{return null;}
}

async function userFromSessionAuthority(cookieValue:string){
  try{
    const response=await fetch(`${SESSION_BACKEND}/api/auth/session`,{
      method:"GET",
      headers:{cookie:`${COOKIE}=${cookieValue}`,accept:"application/json","x-wdcc-session-proxy":"dealer-command-v2"},
      cache:"no-store",
      signal:AbortSignal.timeout(8000)
    });
    const json=await response.json().catch(()=>({}));
    if(!response.ok||json?.authenticated!==true||!json?.user?.id)return null;
    const canonical=await canonicalUser(String(json.user.id));
    if(canonical)return canonical;
    const remote=json.user;
    if(!active(remote)||!remote?.role)return null;
    return {
      id:String(remote.id),
      email:remote.email?String(remote.email):undefined,
      secondaryEmail:remote.secondaryEmail?String(remote.secondaryEmail):undefined,
      username:remote.username?String(remote.username):undefined,
      loginAlias:remote.loginAlias?String(remote.loginAlias):undefined,
      aliases:Array.isArray(remote.aliases)?remote.aliases.map(String):undefined,
      displayName:remote.displayName?String(remote.displayName):undefined,
      role:String(remote.role),
      tenantId:remote.tenantId?String(remote.tenantId):undefined,
      status:remote.status?String(remote.status):"active",
      disabled:false
    } satisfies User;
  }catch(error){
    console.error("WDCC_SESSION_AUTHORITY_ERROR",error);
    return null;
  }
}

export async function currentUser(){
  const jar=await cookies();
  const value=jar.get(COOKIE)?.value;
  if(!value)return null;

  // Accept a locally signed session when the deployment intentionally shares the signing secret.
  const payload=parse(value);
  if(payload){
    const local=await canonicalUser(String(payload.id));
    if(local)return local;
  }

  // B01 is the immutable login/session authority for the current production portal.
  // This keeps Dealer Command working even when Vercel project secrets rotate independently.
  return userFromSessionAuthority(value);
}
export async function setSession(user:User){
  const jar=await cookies();
  jar.set(COOKIE,token(user),{
    httpOnly:true,
    secure:true,
    sameSite:"strict",
    path:"/",
    maxAge:4*60*60
  });
}
export async function clearSession(){
  const jar=await cookies();
  jar.delete(COOKIE);
}
