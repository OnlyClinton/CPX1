import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {recordAnalyticsEvent} from "../../../../../lib/analyticsAudit";
import {recordDeadLetter} from "../../../../../lib/deadLetter";

export const dynamic="force-dynamic";
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);

function validSignature(request:Request,params:URLSearchParams){
  const token=process.env.TWILIO_AUTH_TOKEN;if(!token)return process.env.NODE_ENV!=="production";
  const signature=request.headers.get("x-twilio-signature")||"";if(!signature)return false;
  const configured=process.env.WDCC_TWILIO_CALL_WEBHOOK_URL||request.url;
  const keys=[...new Set([...params.keys()])].sort();let payload=configured;
  for(const key of keys)for(const value of params.getAll(key))payload+=key+value;
  const expected=crypto.createHmac("sha1",token).update(payload).digest("base64");
  const a=Buffer.from(signature);const b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);
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
    await recordAnalyticsEvent({
      tenantId:"wdcc",dedupeKey:callSid?`twilio-call:${callSid}:${status}:${duration}`:null,
      event:`call.${outcome}`,channel:"phone",cta:"call-sean",
      metadata:{provider:"twilio",callSid,status,durationSeconds:duration,direction,fromLast4:from.slice(-4)||null,toLast4:to.slice(-4)||null}
    });
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    try{await recordDeadLetter({category:"call",stage:"twilio_callback",entityType:"call",entityId:callSid||null,tenantId:"wdcc",retryable:false,error:error instanceof Error?error.message:"call_callback_failed"})}catch{}
    return NextResponse.json({ok:false,error:"call_callback_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
