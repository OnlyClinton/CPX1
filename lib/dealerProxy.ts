const BACKEND=(process.env.WDCC_DEALER_BACKEND_URL||"https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app").replace(/\/$/,"");
const TRUSTED_ORIGINS=new Set(["https://dealer.wedontcarecars.com"]);
const mutationMethods=new Set(["POST","PUT","PATCH","DELETE"]);

function trustedMutation(request:Request){
  if(!mutationMethods.has(request.method.toUpperCase()))return true;
  const origin=request.headers.get("origin");
  if(!origin)return true;
  return TRUSTED_ORIGINS.has(origin);
}

function copyRequestHeaders(request:Request){
  const headers=new Headers();
  for(const name of ["content-type","accept","cookie","user-agent"]){
    const value=request.headers.get(name);
    if(value)headers.set(name,value);
  }
  headers.set("x-wdcc-facade","v51-hardened");
  return headers;
}

function copyResponseHeaders(upstream:Response){
  const headers=new Headers();
  for(const [name,value] of upstream.headers){
    const lower=name.toLowerCase();
    if(["connection","keep-alive","transfer-encoding","content-encoding","content-length","access-control-allow-origin"].includes(lower))continue;
    if(lower==="set-cookie")continue;
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
  headers.set("access-control-allow-origin","https://dealer.wedontcarecars.com");
  headers.set("access-control-allow-credentials","true");
  headers.set("vary","Origin");
  headers.set("x-wdcc-backend","immutable-healthy-dealer");
  return headers;
}

export async function proxyDealer(request:Request,path:string){
  if(!trustedMutation(request)){
    return new Response(JSON.stringify({ok:false,error:"origin_not_allowed"}),{
      status:403,
      headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }
  const source=new URL(request.url);
  const target=new URL(path,BACKEND);
  target.search=source.search;
  const method=request.method.toUpperCase();
  const init:RequestInit={
    method,
    headers:copyRequestHeaders(request),
    redirect:"manual",
    cache:"no-store"
  };
  if(!["GET","HEAD"].includes(method))init.body=await request.arrayBuffer();
  const upstream=await fetch(target,init);
  return new Response(upstream.body,{
    status:upstream.status,
    statusText:upstream.statusText,
    headers:copyResponseHeaders(upstream)
  });
}

export async function backendHealth(){
  const response=await fetch(`${BACKEND}/api/health?facade=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  const json=await response.json().catch(()=>({}));
  return {response,json};
}
