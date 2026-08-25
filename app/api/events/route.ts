import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {readRecentAnalyticsEvents,recordAnalyticsEvent} from "../../../lib/analyticsAudit";
import {recordDeadLetter} from "../../../lib/deadLetter";
import {proxyDealer} from "../../../lib/dealerProxy";
import {isLikelyBot,rateLimit} from "../../../lib/requestGuard";
import {resolveSource} from "../../../lib/sourceRegistry";

export const dynamic="force-dynamic";
const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const CPX_BACKEND_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
const readerRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
const allowedEvent=/^(page_view|cta\.[a-z0-9._-]+|inventory\.[a-z0-9._-]+|vehicle\.[a-z0-9._-]+|lead\.[a-z0-9._-]+)$/i;

function canonicalRuntime(request:Request){
  const project=process.env.VERCEL_PROJECT_ID||"";
  if(project===DEALER_PROJECT_ID||project===CPX_BACKEND_PROJECT_ID)return true;
  const host=new URL(request.url).host.toLowerCase();
  return host==="dealer.wedontcarecars.com"||host.includes("wdcc-dealer-portal")||host.includes("wdcc-cpx-launch");
}

export async function GET(request:Request){
  if(!canonicalRuntime(request))return proxyDealer(request,"/api/events");
  const user=await currentUser().catch(()=>null);
  if(!user||!readerRoles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  try{
    const url=new URL(request.url);const limit=Math.max(1,Math.min(Number(url.searchParams.get("limit"))||200,500));
    const role=String(user.role||"").toLowerCase();
    const tenantId=role==="platform_admin"?null:String(user.tenantId||"wdcc");
    const items=await readRecentAnalyticsEvents(limit,tenantId);
    return NextResponse.json({ok:true,count:items.length,items},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"analytics_read_failed",items:[]},{status:500,headers:{"Cache-Control":"private, no-store"}});}
}

export async function POST(request:Request){
  if(!canonicalRuntime(request))return proxyDealer(request,"/api/events");
  const gate=rateLimit(request,"events",180,60_000);
  if(!gate.allowed)return NextResponse.json({ok:false,error:"rate_limited"},{status:429,headers:{"Retry-After":String(gate.retryAfterSeconds),"Cache-Control":"no-store"}});
  let body:any={};
  let event="";
  let eventId="";
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>32768)return NextResponse.json({ok:false,error:"event_payload_too_large"},{status:413});
    body=await request.json().catch(()=>({}));
    event=text(body?.event??body?.name,100);
    if(!event||!allowedEvent.test(event))return NextResponse.json({ok:false,error:"invalid_event"},{status:400});
    const metadata=body?.metadata&&typeof body.metadata==="object"?body.metadata:null;
    if(metadata&&JSON.stringify(metadata).length>8192)return NextResponse.json({ok:false,error:"metadata_too_large"},{status:413});
    eventId=text(body?.eventId??request.headers.get("x-wdcc-event-id"),160);
    const sourceResolution=resolveSource(body?.source,body?.referralCode);
    const record=await recordAnalyticsEvent({
      tenantId:"wdcc",dedupeKey:eventId?`client:${eventId}`:null,
      event,at:text(body?.at,80)||undefined,
      sessionId:text(body?.sessionId,160)||null,anonymousUserId:text(body?.anonymousUserId,160)||null,
      leadId:text(body?.leadId,160)||null,vehicleId:text(body?.vehicleId,160)||null,
      source:sourceResolution.canonical||null,medium:text(body?.medium,120)||null,
      campaign:text(body?.campaign,160)||null,content:text(body?.content,160)||null,
      term:text(body?.term,160)||null,clickId:text(body?.clickId,220)||null,
      referralCode:text(body?.referralCode,160)||null,pagePath:text(body?.pagePath??body?.path,300)||null,
      landingPath:text(body?.landingPath,300)||null,referrer:text(body?.referrer,700)||null,
      channel:text(body?.channel,80)||null,cta:text(body?.cta,100)||null,
      metadata:{...(metadata||{}),...(eventId?{eventId}:{}),botLikely:isLikelyBot(request),sourceResolution:{raw:sourceResolution.raw,label:sourceResolution.label,confidence:sourceResolution.confidence,referralName:sourceResolution.referralName||null}}
    });
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store","X-WDCC-Event-ID":record.id}});
  }catch(error){
    console.error("WDCC_ANALYTICS_PERSIST_FAILED",error);
    try{await recordDeadLetter({category:"analytics",stage:"persist",entityType:"event",entityId:eventId||null,tenantId:"wdcc",retryable:true,error:error instanceof Error?error.message:"analytics_persist_failed",context:{event:event||null,sessionId:text(body?.sessionId,160)||null,leadId:text(body?.leadId,160)||null,vehicleId:text(body?.vehicleId,160)||null}})}catch(deadError){console.error("WDCC_ANALYTICS_DEAD_LETTER_FAILED",deadError)}
    return NextResponse.json({ok:false,error:"analytics_persist_failed"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
