import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {recordAnalyticsEvent} from "../../../../lib/analyticsAudit";
import {recordDeadLetter,resolveDeadLettersForEntity} from "../../../../lib/deadLetter";
import {readState,writeState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const roles=new Set(["tenant_admin","platform_admin"]);
const UPSTREAM=(process.env.WDCC_LEAD_UPSTREAM_URL||"https://wdcc-lead-email-stage.vercel.app/api/lead").trim();
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
const nowIso=()=>new Date().toISOString();
const backoffMs=(attempt:number)=>Math.min(24*60*60_000,15*60_000*Math.pow(2,Math.max(0,Math.min(attempt-1,8))));

function notificationText(lead:any){return [`New WDCC ${lead.kind||"lead"} lead`,`Name: ${lead.name}`,`Phone: ${lead.phone||"Not provided"}`,`Email: ${lead.email||"Not provided"}`,`Vehicle: ${lead.vehicleInterest||"Not specified"}`,`Source: ${lead.source||"Unknown"}`,`Message: ${lead.message||"None"}`,`Lead ID: ${lead.id}`].join("\n")}
async function retryUpstream(lead:any){
  const payload={name:lead.name,phone:lead.phone,email:lead.email,vehicle:lead.vehicleInterest,message:lead.message,requestType:lead.kind==="schedule"?"test-drive":lead.kind==="approval"?"pre-approval":"contact",consent:true,source:lead.utmSource||lead.source||"wedontcarecars.com",idempotencyKey:lead.idempotencyKey,vehicleId:lead.vehicleId||undefined,pagePath:lead.pagePath||undefined,referrer:lead.referrer||undefined,utmSource:lead.utmSource||undefined,utmMedium:lead.utmMedium||undefined,utmCampaign:lead.utmCampaign||undefined,utmContent:lead.utmContent||undefined,utmTerm:lead.utmTerm||undefined,clickId:lead.clickId||undefined,sessionId:lead.sessionId||undefined,anonymousUserId:lead.anonymousUserId||undefined,referralCode:lead.referralCode||undefined};
  const response=await fetch(UPSTREAM,{method:"POST",headers:{"Content-Type":"application/json",...(lead.idempotencyKey?{"Idempotency-Key":String(lead.idempotencyKey)}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),cache:"no-store"});
  const json=await response.json().catch(()=>({}));if(!response.ok||!json?.ok||!json?.leadId)throw Error(json?.error||`LEAD_UPSTREAM_${response.status}`);return String(json.leadId);
}
async function retryNotifications(lead:any){
  const current={...(lead.notifications||{})};const body=notificationText(lead);
  if(String(current.email||"").startsWith("failed")&&process.env.RESEND_API_KEY){try{const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"").split(",").map(x=>x.trim()).filter(Boolean);if(recipients.length){const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.WDCC_LEAD_FROM_EMAIL||"WDCC Leads <leads@wedontcarecars.com>",to:recipients,subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:body}),signal:AbortSignal.timeout(8000)});current.email=r.ok?"sent":`failed_${r.status}`}}catch{current.email="failed"}}
  if(String(current.sms||"").startsWith("failed")&&process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER&&process.env.WDCC_LEAD_NOTIFICATION_PHONE){try{const form=new URLSearchParams({From:process.env.TWILIO_FROM_NUMBER,To:process.env.WDCC_LEAD_NOTIFICATION_PHONE,Body:body.slice(0,1400)});const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),signal:AbortSignal.timeout(8000)});current.sms=r.ok?"sent":`failed_${r.status}`}catch{current.sms="failed"}}
  if(String(current.webhook||"").startsWith("failed")&&process.env.WDCC_LEAD_WEBHOOK_URL){try{const r=await fetch(process.env.WDCC_LEAD_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"lead.created",lead}),signal:AbortSignal.timeout(8000)});current.webhook=r.ok?"sent":`failed_${r.status}`}catch{current.webhook="failed"}}
  return current;
}
function authorizedCron(request:Request){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`)}
function ensureCircuit(state:any){state.ops=state.ops&&typeof state.ops==="object"?state.ops:{};state.ops.circuits=state.ops.circuits&&typeof state.ops.circuits==="object"?state.ops.circuits:{};state.ops.circuits.leadUpstream=state.ops.circuits.leadUpstream&&typeof state.ops.circuits.leadUpstream==="object"?state.ops.circuits.leadUpstream:{failures:0,state:"closed",openUntil:null};return state.ops.circuits.leadUpstream}
function circuitOpen(c:any){return c?.state==="open"&&c?.openUntil&&Date.parse(c.openUntil)>Date.now()}
function circuitSuccess(c:any){c.failures=0;c.state="closed";c.openUntil=null;c.lastSuccessAt=nowIso();c.lastError=null}
function circuitFailure(c:any,error:string){c.failures=Number(c.failures||0)+1;c.lastFailureAt=nowIso();c.lastError=text(error,500);if(c.failures>=3){const cool=Math.min(6*60*60_000,30*60_000*Math.pow(2,Math.min(c.failures-3,4)));c.state="open";c.openUntil=new Date(Date.now()+cool).toISOString()}}

async function runWorker(){
  const state:any=await readState();const circuit=ensureCircuit(state);let changed=false;let attempted=0;let recovered=0;let failed=0;let skippedBackoff=0;let skippedCircuit=0;
  if(circuit?.state==="open"&&circuit?.openUntil&&Date.parse(circuit.openUntil)<=Date.now()){circuit.state="half_open";changed=true}
  for(const lead of state.leads as any[]){
    if(lead?.qa===true||String(lead?.status||"").toLowerCase()==="test")continue;
    const needsSync=String(lead?.sync?.upstream||"")!=="synced";
    const needsNotify=Object.values(lead?.notifications||{}).some(v=>String(v||"").startsWith("failed"));
    if(!needsSync&&!needsNotify)continue;
    const nextRetryAt=String(lead?.sync?.nextRetryAt||"");if(nextRetryAt&&Date.parse(nextRetryAt)>Date.now()){skippedBackoff++;continue}
    attempted++;let upstreamFailed=false;let upstreamError="";
    try{
      if(needsSync){
        if(circuitOpen(circuit)){skippedCircuit++;throw Error("lead_upstream_circuit_open")}
        try{const upstreamLeadId=await retryUpstream(lead);lead.upstreamLeadId=upstreamLeadId;lead.sync={...(lead.sync||{}),upstream:"synced",upstreamLeadId,syncedAt:nowIso(),lastError:null};circuitSuccess(circuit);changed=true;}catch(error){upstreamFailed=true;upstreamError=error instanceof Error?error.message:"upstream_retry_failed";circuitFailure(circuit,upstreamError);changed=true;throw error}
      }
      if(needsNotify){lead.notifications=await retryNotifications(lead);changed=true;}
      const stillBroken=String(lead?.sync?.upstream||"")!=="synced"||Object.values(lead?.notifications||{}).some(v=>String(v||"").startsWith("failed"));
      if(stillBroken)throw Error("delivery_still_degraded");
      recovered++;lead.updatedAt=nowIso();lead.sync={...(lead.sync||{}),retryAttempts:0,nextRetryAt:null,lastRetryAt:nowIso()};
      await resolveDeadLettersForEntity("lead",lead.id,lead.tenantId||"wdcc","lead delivery recovered").catch(()=>{});
      await recordAnalyticsEvent({event:"lead.retry.recovered",tenantId:String(lead.tenantId||"wdcc"),leadId:lead.id,channel:"ops",metadata:{upstream:lead?.sync?.upstream,notifications:lead.notifications,circuitState:circuit.state}}).catch(()=>{});
    }catch(error){
      failed++;const attempts=Number(lead?.sync?.retryAttempts||0)+1;const delay=backoffMs(attempts);lead.updatedAt=nowIso();changed=true;
      const reason=error instanceof Error?error.message:"retry_failed";const nextAttemptAt=new Date(Date.now()+delay).toISOString();
      await recordDeadLetter({category:"lead_delivery",stage:"retry",entityType:"lead",entityId:text(lead.id,180),tenantId:text(lead.tenantId||"wdcc",180),requestId:text(lead.requestId,180),retryable:true,attempts,error:reason,nextAttemptAt,context:{upstream:lead?.sync?.upstream||null,notifications:lead?.notifications||null,circuitState:circuit.state,circuitOpenUntil:circuit.openUntil||null,upstreamFailed,upstreamError:upstreamError||null}}).catch(()=>{});
      lead.sync={...(lead.sync||{}),retryAttempts:attempts,lastRetryAt:nowIso(),nextRetryAt,lastError:reason};
    }
  }
  if(changed)await writeState(state);return {attempted,recovered,failed,skippedBackoff,skippedCircuit,circuit:{state:circuit.state,failures:Number(circuit.failures||0),openUntil:circuit.openUntil||null,lastError:circuit.lastError||null}};
}
export async function GET(request:Request){if(!authorizedCron(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});try{return NextResponse.json({ok:true,...await runWorker()},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"retry_worker_failed"},{status:500})}}
export async function POST(){const user=await currentUser().catch(()=>null);if(!user||!roles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});try{return NextResponse.json({ok:true,...await runWorker()},{headers:{"Cache-Control":"private, no-store"}})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"retry_worker_failed"},{status:500})}}
