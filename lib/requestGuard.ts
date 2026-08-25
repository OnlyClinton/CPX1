type Bucket={count:number;resetAt:number};

declare global{var __wdccRateBuckets:Map<string,Bucket>|undefined}
const buckets=globalThis.__wdccRateBuckets||(globalThis.__wdccRateBuckets=new Map<string,Bucket>());
const botUa=/(?:bot|crawler|spider|slurp|headlesschrome|python-requests|curl\/|wget\/|scrapy|httpclient|axios\/)/i;

export function requestIp(request:Request){
  return String(request.headers.get("x-vercel-forwarded-for")||request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"unknown").split(",")[0].trim().slice(0,120);
}

export function isLikelyBot(request:Request){
  const ua=String(request.headers.get("user-agent")||"");
  if(!ua)return true;
  return botUa.test(ua);
}

function localRateLimit(request:Request,scope:string,limit:number,windowMs:number){
  const now=Date.now();const ip=requestIp(request);const key=`${scope}:${ip}`;
  let bucket=buckets.get(key);
  if(!bucket||bucket.resetAt<=now){bucket={count:0,resetAt:now+windowMs};buckets.set(key,bucket)}
  bucket.count++;
  if(buckets.size>5000){for(const [k,v] of buckets)if(v.resetAt<=now)buckets.delete(k)}
  return {allowed:bucket.count<=limit,remaining:Math.max(0,limit-bucket.count),retryAfterSeconds:Math.max(1,Math.ceil((bucket.resetAt-now)/1000)),ip,mode:"local" as const,count:bucket.count};
}

async function distributedRateLimit(request:Request,scope:string,limit:number,windowMs:number){
  const url=String(process.env.UPSTASH_REDIS_REST_URL||"").replace(/\/$/,"");
  const token=String(process.env.UPSTASH_REDIS_REST_TOKEN||"");
  if(!url||!token)return null;
  const ip=requestIp(request);const window=Math.floor(Date.now()/windowMs);const key=`wdcc:rl:${scope}:${window}:${ip}`;
  const response=await fetch(`${url}/pipeline`,{
    method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify([["INCR",key],["PTTL",key]]),cache:"no-store",signal:AbortSignal.timeout(1500)
  });
  if(!response.ok)throw Error(`rate_store_${response.status}`);
  const rows:any[]=await response.json();const count=Number(rows?.[0]?.result||0);let ttl=Number(rows?.[1]?.result||-1);
  if(ttl<0){
    const expire=await fetch(`${url}/pipeline`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify([["PEXPIRE",key,windowMs]]),cache:"no-store",signal:AbortSignal.timeout(1500)});
    if(!expire.ok)throw Error(`rate_expire_${expire.status}`);ttl=windowMs;
  }
  return {allowed:count<=limit,remaining:Math.max(0,limit-count),retryAfterSeconds:Math.max(1,Math.ceil(ttl/1000)),ip,mode:"distributed" as const,count};
}

export async function rateLimitShared(request:Request,scope:string,limit:number,windowMs:number){
  try{const distributed=await distributedRateLimit(request,scope,limit,windowMs);if(distributed)return distributed;}catch(error){console.warn("WDCC_RATE_STORE_DEGRADED",error instanceof Error?error.message:"unknown")}
  return localRateLimit(request,scope,limit,windowMs);
}

export function rateLimit(request:Request,scope:string,limit:number,windowMs:number){return localRateLimit(request,scope,limit,windowMs)}

export function honeypotTriggered(body:any){
  return Boolean(String(body?.website??body?.companyWebsite??body?.fax??"").trim());
}
