import {currentUser} from "../../../../lib/auth";
import {readState,type User} from "../../../../lib/store";

const AUTH_BASE="https://ep-curly-breeze-ay2iih1f.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
export const dynamic="force-dynamic";

function active(user:User){return user.status!=="disabled"&&!user.disabled;}
function identifiers(user:User){
  return [user.email,user.secondaryEmail,user.username,user.loginAlias,...(Array.isArray(user.aliases)?user.aliases:[])]
    .map(value=>String(value||"").trim().toLowerCase()).filter(Boolean);
}
async function accessUser(email:string){
  const state=await readState();
  const admin=email==="admin@internal.wedontcarecars.com";
  const username=admin?"admin":"dealer";
  const roles=admin?new Set(["platform_admin","tenant_admin","admin"]):new Set(["dealer_agent","dealer"]);
  const candidates=state.users.filter(user=>active(user)&&roles.has(String(user.role||"").toLowerCase()));
  const keys=new Set([email,username]);
  return candidates.find(user=>identifiers(user).some(value=>keys.has(value)))||null;
}
function responseFor(user:User,email?:string,extraHeaders?:Headers){
  const headers=extraHeaders||new Headers();
  headers.set("content-type","application/json");
  headers.set("cache-control","private, no-store, max-age=0");
  return new Response(JSON.stringify({authenticated:true,user:{id:user.id,email:email||user.email||null,username:user.username||user.loginAlias||null,displayName:user.displayName||null,role:user.role}}),{status:200,headers});
}
function copyCookies(upstream:Response,headers:Headers){
  const getter=(upstream.headers as any).getSetCookie;
  if(typeof getter==="function")for(const cookie of getter.call(upstream.headers))headers.append("set-cookie",cookie);
  else{const cookie=upstream.headers.get("set-cookie");if(cookie)headers.append("set-cookie",cookie);}
}

export async function GET(request:Request){
  try{
    const user=await currentUser().catch(()=>null);
    if(user)return responseFor(user);

    const cookie=request.headers.get("cookie")||"";
    if(!cookie)return Response.json({authenticated:false},{headers:{"cache-control":"private, no-store"}});
    const upstream=await fetch(`${AUTH_BASE}/get-session`,{headers:{accept:"application/json",cookie},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10000)});
    const text=await upstream.text();
    let data:any=null;
    try{data=text?JSON.parse(text):null;}catch{}
    const email=String(data?.user?.email||"").toLowerCase();
    if(!upstream.ok||!data?.user||!["admin@internal.wedontcarecars.com","dealer@internal.wedontcarecars.com"].includes(email))return Response.json({authenticated:false},{headers:{"cache-control":"private, no-store"}});

    const access=await accessUser(email);
    if(!access)return Response.json({authenticated:false,error:"portal_access_not_configured"},{status:403,headers:{"cache-control":"private, no-store"}});
    const responseHeaders=new Headers();
    copyCookies(upstream,responseHeaders);
    return responseFor(access,email,responseHeaders);
  }catch(error){
    console.error("WDCC_NEON_AUTH_SESSION_ERROR",error);
    return Response.json({authenticated:false,error:"auth_service_unavailable"},{status:503,headers:{"cache-control":"no-store"}});
  }
}
