import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {recordAnalyticsEvent} from "../../../../../lib/analyticsAudit";
import {readRecentCallIntents} from "../../../../../lib/callIntent";
import {recordDeadLetter} from "../../../../../lib/deadLetter";
import {readState} from "../../../../../lib/store";

export const dynamic="force-dynamic";
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
const phoneKey=(v:unknown)=>String(v??"").replace(/\D/g,"").slice(-10);

function validSignature(request:Request,params:URLSearchParams){
  const token=process.env.TWILIO_AUTH_TOKEN;if(!token)return process.env.NODE_ENV!=="production";
  const signature=request.headers.get("x-twilio-signature")||"";if(!signature)return false;
  const configured=process.env.WDCC_TWILIO_CALL_WEBHOOK_URL||request.url;
  const keys=[...new Set([...params.keys()])].sort();let payload=configured;
  for(const key of keys)for(const value of params.getAll(key))payload+=key+value;
  const expected=crypto.createHmac("sha1",token).update(payload).digest("base64");
  const a=Buffer.from(signature);const b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

async function correlate(from:string){
  const intents=await readRecentCallIntents(10,100).catch(()=>[] as any[]);
  let lead:any=null;
  try{
    const state=await readState();const key=phoneKey(from);
    const matches=(state.leads as any[]).filter(x=>x?.qa!==true&&String(x?.status||"").toLowerCase()!=="test"&&key&&phoneKey(x?.phone)===key).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    lead=matches[0]||null;
  }catch{}
  if(lead?.sessionId){const intent=intents.find((x:any)=>String(x?.sessionId||"")===String(lead.sessionId));if(intent)return {confidence:"exact_lead_session",lead,intent}}
  if(lead&&intents.length===1)return {confidence:"lead_phone_plus_time",lead,intent:intents[0]};
  const recent=intents.filter((x:any)=>Date.now()-Date.parse(String(x?.at||""))<=3*60_000);
  if(recent.length===1)return {confidence:"single_recent_intent",lead:null,intent:recent[0]};
  return {confidence:recent.length>1?"ambiguous":"unmatched",lead,intent:null};
}

export async function POST(request:Request){
  let callSid="";
  try{
    const raw=await request.text();const params=new URLSearchParams(raw);
    if(!validSignature(request,params))return NextResponse.json({ok:false,error:"invalid_signature"},{status:401,headers:{"Cache-Control":"no-store"}});
    callSid=text(params.get("CallSid"),160);const status=text(params.get("CallStatus"),80).toLowerCase()||"unknown";
    const duration=Math.max(0,Number(params.get("CallDuration")||params.get("Duration")||0)||0);
    const from=text(params.get("From"),80);const to=text(params.get("To"),80);const direction=text(params.get("Direction"),80);
    const outcome=["completed","busy","no-answer","failed","canceled"].includes(status)?status:"progress";
    const match=await correlate(from);const intent:any=match.intent;const lead:any=match.lead;
    await recordAnalyticsEvent({
      tenantId:String(lead?.tenantId||intent?.tenantId||"wdcc"),dedupeKey:callSid?`twilio-call:${callSid}:${status}:${duration}`:null,
      event:`call.${outcome}`,channel:"phone",cta:intent?.cta||"call-sean",
      sessionId:intent?.sessionId||lead?.sessionId||null,anonymousUserId:intent?.anonymousUserId||lead?.anonymousUserId||null,
      leadId:lead?.id||null,vehicleId:intent?.vehicleId||lead?.vehicleId||null,
      source:intent?.source||lead?.source||null,medium:intent?.medium||lead?.utmMedium||null,campaign:intent?.campaign||lead?.utmCampaign||null,content:intent?.content||lead?.utmContent||null,term:intent?.term||lead?.utmTerm||null,clickId:intent?.clickId||lead?.clickId||null,referralCode:intent?.referralCode||lead?.referralCode||null,
      pagePath:intent?.pagePath||lead?.pagePath||null,landingPath:intent?.landingPath||lead?.landingPath||null,referrer:intent?.referrer||lead?.referrer||null,
      metadata:{provider:"twilio",callSid,status,durationSeconds:duration,direction,fromLast4:from.slice(-4)||null,toLast4:to.slice(-4)||null,correlation:{confidence:match.confidence,intentId:intent?.id||null,leadId:lead?.id||null}}
    });
    return NextResponse.json({ok:true,correlation:match.confidence},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    try{await recordDeadLetter({category:"call",stage:"twilio_callback",entityType:"call",entityId:callSid||null,tenantId:"wdcc",retryable:false,error:error instanceof Error?error.message:"call_callback_failed"})}catch{}
    return NextResponse.json({ok:false,error:"call_callback_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
