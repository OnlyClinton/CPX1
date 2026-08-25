import {sessionCookieHeader} from "../../../../lib/auth";
import {readState,type User} from "../../../../lib/store";

const AUTH_BASE="https://ep-curly-breeze-ay2iih1f.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
const LOGIN_MAP:Record<string,string>={admin:"admin@internal.wedontcarecars.com",dealer:"dealer@internal.wedontcarecars.com"};
export const dynamic="force-dynamic";

function resolveLogin(value:unknown){
  const raw=String(value||"").trim().toLowerCase();
  if(LOGIN_MAP[raw])return {email:LOGIN_MAP[raw],username:raw};
  if(raw==="admin@internal.wedontcarecars.com")return {email:raw,username:"admin"};
  if(raw==="dealer@internal.wedontcarecars.com")return {email:raw,username:"dealer"};
  return null;
}
function active(user:User){return user.status!=="disabled"&&!user.disabled;}
function identifiers(user:User){
  return [user.email,user.secondaryEmail,user.username,user.loginAlias,...(Array.isArray(user.aliases)?user.aliases:[])]
    .map(value=>String(value||"").trim().toLowerCase()).filter(Boolean);
}
async function accessUser(email:string,username:string){
  const state=await readState();
  const admin=email.startsWith("admin@");
  const roles=admin?new Set(["platform_admin","tenant_admin","admin"]):new Set(["dealer_agent","dealer"]);
  const candidates=state.users.filter(user=>active(user)&&roles.has(String(user.role||"").toLowerCase()));
  const keys=new Set([email.toLowerCase(),username.toLowerCase()]);
  return candidates.find(user=>identifiers(user).some(value=>keys.has(value)))||candidates[0]||null;
}
function copyCookies(upstream:Response,headers:Headers){
  const getter=(upstream.headers as any).getSetCookie;
  if(typeof getter==="function")for(const cookie of getter.call(upstream.headers))headers.append("set-cookie",cookie);
  else{const cookie=upstream.headers.get("set-cookie");if(cookie)headers.append("set-cookie",cookie);}
}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({}));
    const login=resolveLogin(body?.username||body?.email);
    const password=String(body?.password||"");
    if(!login||!password)return Response.json({ok:false,error:"login_and_password_required"},{status:400,headers:{"cache-control":"no-store"}});

    const upstream=await fetch(`${AUTH_BASE}/sign-in/email`,{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({email:login.email,password,rememberMe:true}),
      redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    const text=await upstream.text();
    let data:any={};
    try{data=text?JSON.parse(text):{};}catch{}
    if(!upstream.ok){
      const status=upstream.status===429?429:401;
      return Response.json({ok:false,error:status===429?"too_many_attempts":"invalid_credentials"},{status,headers:{"cache-control":"no-store"}});
    }

    const user=await accessUser(login.email,login.username);
    if(!user){
      console.error("WDCC_NEON_AUTH_NO_PORTAL_USER",{email:login.email});
      return Response.json({ok:false,error:"portal_access_not_configured"},{status:403,headers:{"cache-control":"no-store"}});
    }

    const headers=new Headers({"content-type":"application/json","cache-control":"private, no-store, max-age=0"});
    copyCookies(upstream,headers);
    headers.append("set-cookie",sessionCookieHeader(user));
    return new Response(JSON.stringify({ok:true,role:user.role,user:{id:user.id,email:login.email,username:login.username,displayName:user.displayName||data?.user?.name||(login.username==="admin"?"WDCC Admin":"WDCC Dealer"),role:user.role}}),{status:200,headers});
  }catch(error){
    console.error("WDCC_NEON_AUTH_LOGIN_ERROR",error);
    return Response.json({ok:false,error:"auth_service_unavailable"},{status:503,headers:{"cache-control":"no-store","retry-after":"5"}});
  }
}
