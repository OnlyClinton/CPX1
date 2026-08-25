import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

type Bucket={count:number;resetAt:number};
declare global{var __wdccEdgeBuckets:Map<string,Bucket>|undefined}
const buckets=globalThis.__wdccEdgeBuckets||(globalThis.__wdccEdgeBuckets=new Map<string,Bucket>());

function isBackendHost(host:string){const h=host.toLowerCase();return h==="dealer.wedontcarecars.com"||h.includes("wdcc-dealer-portal")||h.includes("wdcc-cpx-launch")}
function ip(req:NextRequest){return String(req.headers.get("x-vercel-forwarded-for")||req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim().slice(0,100)}
function gate(req:NextRequest,scope:string,limit:number,windowMs:number){const now=Date.now();const key=`${scope}:${ip(req)}`;let b=buckets.get(key);if(!b||b.resetAt<=now){b={count:0,resetAt:now+windowMs};buckets.set(key,b)}b.count++;return {ok:b.count<=limit,retry:Math.max(1,Math.ceil((b.resetAt-now)/1000))}}

export function proxy(request:NextRequest){
  if(request.method!=="POST")return NextResponse.next();
  const host=request.headers.get("host")||"";if(isBackendHost(host))return NextResponse.next();
  const path=request.nextUrl.pathname;
  const g=path==="/api/leads"?gate(request,"leads",24,5*60_000):path==="/api/events"?gate(request,"events",240,60_000):{ok:true,retry:0};
  if(!g.ok)return NextResponse.json({ok:false,error:"rate_limited"},{status:429,headers:{"Retry-After":String(g.retry),"Cache-Control":"no-store"}});
  return NextResponse.next();
}

export const config={matcher:["/api/leads","/api/events"]};
