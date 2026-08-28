import {canonicalDealerBackend} from "./wdccAuthority";

const TRUSTED_ORIGINS=new Set(["https://dealer.wedontcarecars.com","https://wedontcarecars.com","https://www.wedontcarecars.com"]);
const mutationMethods=new Set(["POST","PUT","PATCH","DELETE"]);
const requestHeaderAllowlist=[
  // Keep the original compatibility sequence explicit; auth-session boundary
  // tests and old deployments rely on these five headers being carried.
  "content-type","accept","cookie","user-agent","idempotency-key",
  "accept-language","authorization","origin","referer",
  "cf-connecting-ip","x-real-ip","x-request-id","x-wdcc-event-id","x-wdcc-qa-signature","x-wdcc-request-id"
] as const;
const hopByHopResponseHeaders=new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade",
  // fetch transparently decodes upstream bodies, so these values cannot be
  // forwarded with the decoded stream.
  "content-encoding","content-length",
  // The frontend owns its CORS policy and must not reflect upstream values.
  "access-control-allow-origin","access-control-allow-credentials"
]);

function backendUrl(){
  const parsed=new URL(canonicalDealerBackend());
  const local=["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname.toLowerCase());
  const localMode=process.env.NODE_ENV!=="production"||String(process.env.WDCC_ENVIRONMENT||"").toLowerCase()==="e2e";
  if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=="/"||
    (parsed.protocol!=="https:"&&!(parsed.protocol==="http:"&&local&&localMode)))throw Error("INVALID_CANONICAL_BACKEND");
  return parsed;
}

function backendLabel(){try{return backendUrl().origin;}catch{return "invalid";}}

function normalizedOrigin(value:string){
  const raw=value.trim().replace(/\/$/,"").toLowerCase();
  if(!raw)return "";
  try{
    const parsed=new URL(raw);
    if(parsed.origin==="null"||parsed.username||parsed.password||parsed.pathname!=="/"||parsed.search||parsed.hash)return "";
    return parsed.origin.toLowerCase();
  }catch{return "";}
}

function configuredTrustedOrigins(){
  return String(process.env.WDCC_TRUSTED_ORIGINS||"")
    .split(",")
    .map(normalizedOrigin)
    .filter(Boolean);
}

function allowedOrigin(request:Request){
  const raw=String(request.headers.get("origin")||"").trim();
  if(!raw)return "";
  const origin=normalizedOrigin(raw);
  if(!origin)return null;
  try{if(origin===new URL(request.url).origin.toLowerCase())return origin;}catch{}
  if(TRUSTED_ORIGINS.has(origin)||configuredTrustedOrigins().includes(origin))return origin;
  return null;
}

function trustedMutation(request:Request){
  if(!mutationMethods.has(request.method.toUpperCase()))return true;
  // Server-to-server cron and QA requests legitimately omit Origin; browser
  // mutations must be same-origin or explicitly trusted.
  if(!request.headers.get("origin"))return true;
  return allowedOrigin(request)!==null;
}

function copyRequestHeaders(request:Request){
  const headers=new Headers();
  for(const name of requestHeaderAllowlist){const value=request.headers.get(name);if(value)headers.set(name,value);}
  headers.set("x-wdcc-facade","cloudflare-vercel-boundary-v1");
  headers.set("x-wdcc-proxy-hop","1");
  return headers;
}

function copyResponseHeaders(upstream:Response,request:Request){
  const headers=new Headers();
  for(const [name,value] of upstream.headers){const lower=name.toLowerCase();if(hopByHopResponseHeaders.has(lower)||lower==="set-cookie")continue;headers.append(name,value);}
  const getSetCookie=(upstream.headers as any).getSetCookie;
  let hasSetCookie=false;
  if(typeof getSetCookie==="function"){
    for(const cookie of getSetCookie.call(upstream.headers)){headers.append("set-cookie",cookie);hasSetCookie=true;}
  }else{
    const cookie=upstream.headers.get("set-cookie");if(cookie){headers.append("set-cookie",cookie);hasSetCookie=true;}
  }
  // Preserve the canonical route's public/private cache contract. Any response
  // that creates a browser session is necessarily private.
  if(hasSetCookie)headers.set("cache-control","private, no-store, max-age=0, must-revalidate");
  else if(!headers.has("cache-control"))headers.set("cache-control","private, no-store");
  const origin=allowedOrigin(request);
  if(origin){headers.set("access-control-allow-origin",origin);headers.set("access-control-allow-credentials","true");headers.append("vary","Origin");}
  headers.set("x-wdcc-backend","canonical-vercel");
  return headers;
}

export async function proxyDealer(request:Request,path:string){
  if(!trustedMutation(request))return new Response(JSON.stringify({ok:false,error:"origin_not_allowed"}),{status:403,headers:{"content-type":"application/json","cache-control":"no-store"}});
  if(String(request.headers.get("x-wdcc-proxy-hop")||"").trim())return new Response(JSON.stringify({ok:false,error:"proxy_loop_blocked"}),{status:508,headers:{"content-type":"application/json","cache-control":"no-store"}});
  try{
    if(!path.startsWith("/api/")||path.includes("#"))throw Error("INVALID_PROXY_PATH");
    const source=new URL(request.url);const backend=backendUrl();const target=new URL(path,backend);target.search=source.search;
    if(target.origin===source.origin)throw Error("PROXY_TARGET_EQUALS_SOURCE");
    const method=request.method.toUpperCase();const init:RequestInit={method,headers:copyRequestHeaders(request),redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000)};
    if(!["GET","HEAD"].includes(method))init.body=await request.arrayBuffer();
    const upstream=await fetch(target,init);
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:copyResponseHeaders(upstream,request)});
  }catch(error){
    console.error("WDCC_DEALER_PROXY_ERROR",{path,backend:backendLabel(),error});
    return new Response(JSON.stringify({ok:false,error:"dealer_backend_unavailable"}),{status:503,headers:{"content-type":"application/json","cache-control":"no-store","retry-after":"5"}});
  }
}

export async function backendHealth(){
  try{
    const backend=backendUrl().origin;
    const response=await fetch(`${backend}/api/health?facade=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
    const json=await response.json().catch(()=>({}));
    return {response,json};
  }catch(error){
    return {response:new Response(null,{status:503}),json:{ok:false,error:"dealer_backend_unavailable",detail:error instanceof Error?error.message:"unknown"}};
  }
}
