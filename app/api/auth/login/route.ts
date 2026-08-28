import {sessionCookieHeader} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {neonAuthUrl,revokeNeonAuthSession} from "../../../../lib/neonAuth";
import {resolvePortalAccess} from "../../../../lib/wdccDb";

type PortalRole="platform_admin"|"dealer_agent";
type LoginIdentity={email:string;username:string;expectedRole?:PortalRole};
type LoginMap={admin:LoginIdentity;dealer:LoginIdentity};

const CANONICAL_LOGIN_MAP:LoginMap={
  admin:{email:"admin@internal.wedontcarecars.com",username:"admin",expectedRole:"platform_admin"},
  dealer:{email:"dealer@internal.wedontcarecars.com",username:"dealer",expectedRole:"dealer_agent"}
};

export const dynamic="force-dynamic";

function validEmail(value:string){
  return value.length<=320&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loginMap():LoginMap{
  if(process.env.WDCC_ENVIRONMENT!=="e2e")return CANONICAL_LOGIN_MAP;
  const adminEmail=String(process.env.WDCC_E2E_ADMIN_EMAIL||"").trim().toLowerCase();
  const dealerEmail=String(process.env.WDCC_E2E_DEALER_EMAIL||"").trim().toLowerCase();
  if(!validEmail(adminEmail)||!validEmail(dealerEmail)||adminEmail===dealerEmail)throw Error("WDCC_E2E_LOGIN_IDENTITIES_INVALID");
  return {
    admin:{...CANONICAL_LOGIN_MAP.admin,email:adminEmail},
    dealer:{...CANONICAL_LOGIN_MAP.dealer,email:dealerEmail}
  };
}

function resolveLogin(value:unknown){
  const raw=String(value||"").trim().toLowerCase();
  const identities=loginMap();
  if(raw==="admin"||raw===identities.admin.email)return identities.admin;
  if(raw==="dealer"||raw===identities.dealer.email)return identities.dealer;
  if(validEmail(raw))return {email:raw,username:raw.split("@",1)[0]||"staff"};
  return null;
}

function trustedAuthOrigin(request:Request){
  const configured=process.env.WDCC_NEON_AUTH_ORIGIN||process.env.WDCC_STOREFRONT_ORIGIN;
  const raw=String(configured||new URL(request.url).origin).trim();
  if(!raw||/[\r\n]/.test(raw))throw Error("WDCC_NEON_AUTH_ORIGIN_INVALID");
  const url=new URL(raw);
  if(url.origin==="null"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("WDCC_NEON_AUTH_ORIGIN_INVALID");
  if(url.protocol==="https:")return url.origin;
  const explicitLocalMode=process.env.WDCC_ENVIRONMENT==="e2e"||process.env.WDCC_ENVIRONMENT==="dev";
  const loopback=url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="[::1]";
  if(url.protocol==="http:"&&explicitLocalMode&&loopback)return url.origin;
  throw Error("WDCC_NEON_AUTH_ORIGIN_INVALID");
}

function upstreamOriginFailure(status:number,data:any,text:string){
  if(status!==403)return false;
  const detail=[data?.code,data?.error?.code,data?.error,data?.message,text].map(value=>String(value||"")).join(" ");
  return /(origin|referer|trusted|cors|configuration|config_error)/i.test(detail);
}

function unavailable(){
  return Response.json({ok:false,error:"auth_service_unavailable"},{status:503,headers:{"cache-control":"no-store","retry-after":"5"}});
}

function invalidCredentials(){
  return Response.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"cache-control":"no-store"}});
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/login");
  try{
    const body=await request.json().catch(()=>({}));
    const rawLogin=body?.email||body?.username||body?.login;
    const password=String(body?.password||"");
    if(!String(rawLogin||"").trim()||!password)return Response.json({ok:false,error:"login_and_password_required"},{status:400,headers:{"cache-control":"no-store"}});
    const login=resolveLogin(rawLogin);
    if(!login)return invalidCredentials();
    const origin=trustedAuthOrigin(request);

    const upstream=await fetch(`${neonAuthUrl()}/sign-in/email`,{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json",origin,referer:`${origin}/`},
      body:JSON.stringify({email:login.email,password,rememberMe:false}),
      redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    const text=await upstream.text();
    let data:any={};
    try{data=text?JSON.parse(text):{};}catch{}
    if(!upstream.ok){
      if(upstream.status===429)return Response.json({ok:false,error:"too_many_attempts"},{status:429,headers:{"cache-control":"no-store","retry-after":upstream.headers.get("retry-after")||"30"}});
      if(upstream.status>=500||upstream.status===404||upstreamOriginFailure(upstream.status,data,text))return unavailable();
      return invalidCredentials();
    }

    const authenticatedEmail=String(data?.user?.email||"").trim().toLowerCase();
    const authenticatedId=String(data?.user?.id||"").trim();
    // Better Auth creates a server-side session while checking the password. WDCC
    // uses its own short-lived, membership-bound cookie, so revoke the upstream
    // session before returning on every successful credential-check path.
    if(!authenticatedId||authenticatedEmail!==login.email){
      try{await revokeNeonAuthSession(upstream.headers,origin);}
      catch(error){console.error("WDCC_NEON_AUTH_SESSION_REVOCATION_ERROR",error instanceof Error?error.message:"unknown");}
      console.error("WDCC_NEON_AUTH_IDENTITY_MISMATCH",{hasId:Boolean(authenticatedId),emailMatched:authenticatedEmail===login.email});
      return unavailable();
    }

    const[accessResult,revocationResult]=await Promise.allSettled([
      resolvePortalAccess({id:authenticatedId,email:authenticatedEmail}),
      revokeNeonAuthSession(upstream.headers,origin)
    ]);
    if(revocationResult.status==="rejected"){
      const error=revocationResult.reason;
      console.error("WDCC_NEON_AUTH_SESSION_REVOCATION_ERROR",error instanceof Error?error.message:"unknown");
      return unavailable();
    }
    if(accessResult.status==="rejected")throw accessResult.reason;
    const user=accessResult.value;
    if(!user||(login.expectedRole&&user.role!==login.expectedRole)){
      console.warn("WDCC_NEON_AUTH_PORTAL_ACCESS_DENIED",{hasAccess:Boolean(user),roleMatched:Boolean(user&&(!login.expectedRole||user.role===login.expectedRole))});
      return invalidCredentials();
    }

    const tenantId=user.tenantId;
    const displayName=user.displayName||data?.user?.name||(user.role==="platform_admin"?"WDCC Admin":"WDCC Dealer");
    const headers=new Headers({"content-type":"application/json","cache-control":"private, no-store, max-age=0"});
    headers.append("set-cookie",sessionCookieHeader({id:user.id,email:authenticatedEmail,role:user.role,tenantId}));
    return new Response(JSON.stringify({ok:true,role:user.role,tenantId,name:displayName,mustChangePassword:false,user:{id:user.id,email:authenticatedEmail,username:login.username,displayName,role:user.role,tenantId}}),{status:200,headers});
  }catch(error){
    console.error("WDCC_NEON_AUTH_LOGIN_ERROR",error);
    return unavailable();
  }
}
