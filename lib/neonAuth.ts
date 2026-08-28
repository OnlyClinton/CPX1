function configuredNeonAuthUrl(){
  const value=String(process.env.WDCC_NEON_AUTH_URL||"").trim().replace(/\/+$/g,"");
  if(!value)throw Error("WDCC_NEON_AUTH_URL_NOT_CONFIGURED");
  let parsed:URL;
  try{parsed=new URL(value);}catch{throw Error("WDCC_NEON_AUTH_URL_INVALID");}
  if(parsed.username||parsed.password||parsed.search||parsed.hash)throw Error("WDCC_NEON_AUTH_URL_INVALID");

  const localMode=process.env.NODE_ENV!=="production"&&(process.env.WDCC_ENVIRONMENT==="e2e"||process.env.WDCC_ENVIRONMENT==="dev");
  const loopback=parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1"||parsed.hostname==="[::1]";
  if(parsed.protocol==="http:"&&localMode&&loopback)return parsed.toString().replace(/\/+$/g,"");

  const officialNeonHost=parsed.protocol==="https:"&&parsed.hostname.endsWith(".neon.tech")&&parsed.hostname.includes(".neonauth.");
  const managedAuthPath=/^\/[^/]+\/auth$/.test(parsed.pathname);
  if(!officialNeonHost||!managedAuthPath)throw Error("WDCC_NEON_AUTH_URL_INVALID");
  return parsed.toString().replace(/\/+$/g,"");
}

export function neonAuthUrl(){
  return configuredNeonAuthUrl();
}

export function neonAuthReadiness(){
  const configured=Boolean(String(process.env.WDCC_NEON_AUTH_URL||"").trim());
  if(!configured)return {configured:false,valid:false,provider:"neon-managed-better-auth",reason:"missing" as const};
  try{
    const parsed=new URL(configuredNeonAuthUrl());
    return {configured:true,valid:true,provider:"neon-managed-better-auth",host:parsed.hostname,reason:null};
  }catch{
    return {configured:true,valid:false,provider:"neon-managed-better-auth",reason:"invalid" as const};
  }
}

function upstreamCookieHeader(headers:Headers){
  const values=(headers as Headers&{getSetCookie?:()=>string[]}).getSetCookie?.()||[];
  if(values.length===0){
    const combined=headers.get("set-cookie");
    if(combined)values.push(combined);
  }
  const pairs:string[]=[];
  let sessionToken=false;
  for(const value of values){
    const pair=String(value).split(";",1)[0].trim();
    const separator=pair.indexOf("=");
    if(separator<=0)continue;
    const name=pair.slice(0,separator),cookieValue=pair.slice(separator+1);
    if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)||!cookieValue||/[\u0000-\u001f\u007f;,\r\n]/.test(cookieValue))continue;
    if(/(?:^|\.)session_token$/i.test(name))sessionToken=true;
    pairs.push(`${name}=${cookieValue}`);
  }
  const cookie=pairs.join("; ");
  if(!sessionToken||!cookie||cookie.length>8192)throw Error("WDCC_NEON_AUTH_SESSION_COOKIE_MISSING");
  return cookie;
}

// Three bounded attempts plus capped Retry-After delays consume at most 27s,
// leaving headroom for credential verification inside the 60s transport ceiling.
const REVOCATION_MAX_ATTEMPTS=3;
const REVOCATION_ATTEMPT_TIMEOUT_MS=8000;
const REVOCATION_BACKOFF_MS=[250,500] as const;
const REVOCATION_MAX_RETRY_AFTER_MS=1500;
const RETRYABLE_TRANSPORT_CODES=new Set(["ECONNRESET","ECONNREFUSED","EPIPE","ETIMEDOUT","EAI_AGAIN","ENOTFOUND","UND_ERR_CONNECT_TIMEOUT","UND_ERR_HEADERS_TIMEOUT","UND_ERR_SOCKET"]);

type RevocationDependencies={
  fetch?:typeof globalThis.fetch;
  sleep?:(delayMs:number)=>Promise<void>;
};

function sleep(delayMs:number){
  return new Promise<void>(resolve=>setTimeout(resolve,delayMs));
}

function retryableTransportError(error:unknown){
  if(error instanceof TypeError)return true;
  const name=String((error as {name?:unknown})?.name||"");
  if(name==="AbortError"||name==="TimeoutError")return true;
  const code=String((error as {code?:unknown,cause?:{code?:unknown}})?.code||(error as {cause?:{code?:unknown}})?.cause?.code||"").toUpperCase();
  return RETRYABLE_TRANSPORT_CODES.has(code);
}

function retryableStatus(status:number){
  return status===429||(status>=500&&status<=599);
}

function retryDelayMs(response:Response|undefined,attempt:number){
  const fallback=REVOCATION_BACKOFF_MS[Math.min(attempt-1,REVOCATION_BACKOFF_MS.length-1)];
  if(response?.status!==429)return fallback;
  const raw=String(response.headers.get("retry-after")||"").trim();
  if(!raw)return fallback;
  const seconds=Number(raw);
  const requested=Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();
  if(!Number.isFinite(requested)||requested<=0)return fallback;
  return Math.max(fallback,Math.min(Math.ceil(requested),REVOCATION_MAX_RETRY_AFTER_MS));
}

function revocationFailure(kind:"NON_RETRYABLE"|"RETRY_EXHAUSTED",detail:string,attempts:number,cause?:unknown){
  return new Error(`WDCC_NEON_AUTH_SESSION_REVOCATION_${kind}:${detail}:attempts=${attempts}`,cause===undefined?undefined:{cause});
}

export async function revokeNeonAuthSession(headers:Headers,origin:string,dependencies:RevocationDependencies={}){
  const cookie=upstreamCookieHeader(headers);
  const endpoint=`${neonAuthUrl()}/sign-out`;
  const fetchRequest=dependencies.fetch||globalThis.fetch;
  const wait=dependencies.sleep||sleep;
  for(let attempt=1;attempt<=REVOCATION_MAX_ATTEMPTS;attempt++){
    let response:Response|undefined;
    try{
      response=await fetchRequest(endpoint,{
        method:"POST",
        headers:{"content-type":"application/json","accept":"application/json",cookie,origin,referer:`${origin}/`},
        body:"{}",redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(REVOCATION_ATTEMPT_TIMEOUT_MS)
      });
    }catch(error){
      if(!retryableTransportError(error))throw revocationFailure("NON_RETRYABLE","transport",attempt,error);
      if(attempt===REVOCATION_MAX_ATTEMPTS)throw revocationFailure("RETRY_EXHAUSTED","transport",attempt,error);
      await wait(retryDelayMs(undefined,attempt));
      continue;
    }
    if(response.ok)return;
    if(!retryableStatus(response.status))throw revocationFailure("NON_RETRYABLE",`http_${response.status}`,attempt);
    if(attempt===REVOCATION_MAX_ATTEMPTS)throw revocationFailure("RETRY_EXHAUSTED",`http_${response.status}`,attempt);
    await wait(retryDelayMs(response,attempt));
  }
}
