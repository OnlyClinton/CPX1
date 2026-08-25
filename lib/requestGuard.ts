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

export function rateLimit(request:Request,scope:string,limit:number,windowMs:number){
  const now=Date.now();const ip=requestIp(request);const key=`${scope}:${ip}`;
  let bucket=buckets.get(key);
  if(!bucket||bucket.resetAt<=now){bucket={count:0,resetAt:now+windowMs};buckets.set(key,bucket)}
  bucket.count++;
  if(buckets.size>5000){for(const [k,v] of buckets)if(v.resetAt<=now)buckets.delete(k)}
  return {allowed:bucket.count<=limit,remaining:Math.max(0,limit-bucket.count),retryAfterSeconds:Math.max(1,Math.ceil((bucket.resetAt-now)/1000)),ip};
}

export function honeypotTriggered(body:any){
  return Boolean(String(body?.website??body?.companyWebsite??body?.fax??"").trim());
}
