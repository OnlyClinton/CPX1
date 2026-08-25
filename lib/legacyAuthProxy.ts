import {canonicalDealerBackend} from "./wdccAuthority";

function requestHeaders(request:Request){
  const headers=new Headers();
  for(const name of ["content-type","accept","cookie","user-agent"]){
    const value=request.headers.get(name);
    if(value)headers.set(name,value);
  }
  headers.set("x-wdcc-auth-compat","canonical-v53");
  return headers;
}

function responseHeaders(upstream:Response){
  const headers=new Headers();
  for(const [name,value] of upstream.headers){
    const lower=name.toLowerCase();
    if(["connection","keep-alive","transfer-encoding","content-encoding","content-length","access-control-allow-origin","set-cookie"].includes(lower))continue;
    headers.append(name,value);
  }
  const getSetCookie=(upstream.headers as any).getSetCookie;
  if(typeof getSetCookie==="function"){
    for(const cookie of getSetCookie.call(upstream.headers))headers.append("set-cookie",cookie);
  }else{
    const cookie=upstream.headers.get("set-cookie");
    if(cookie)headers.append("set-cookie",cookie);
  }
  headers.set("cache-control","private, no-store, max-age=0, must-revalidate");
  headers.set("x-wdcc-auth-backend","canonical-v53");
  return headers;
}

export async function legacyAuthProxy(request:Request,path:string){
  const backend=canonicalDealerBackend();
  try{
    const source=new URL(request.url);
    const target=new URL(path,backend);
    target.search=source.search;
    const method=request.method.toUpperCase();
    const init:RequestInit={
      method,
      headers:requestHeaders(request),
      redirect:"manual",
      cache:"no-store",
      signal:AbortSignal.timeout(12000),
    };
    if(!["GET","HEAD"].includes(method))init.body=await request.arrayBuffer();
    const upstream=await fetch(target,init);
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders(upstream)});
  }catch(error){
    console.error("WDCC_LEGACY_AUTH_PROXY_ERROR",{path,backend,error});
    return Response.json({ok:false,error:"auth_backend_unavailable"},{status:503,headers:{"cache-control":"no-store","retry-after":"5"}});
  }
}
