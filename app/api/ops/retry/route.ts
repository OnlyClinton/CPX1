import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {recordAnalyticsEvent} from "../../../../lib/analyticsAudit";
import {recordDeadLetter} from "../../../../lib/deadLetter";
import {readState,writeState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const roles=new Set(["tenant_admin","platform_admin"]);
const UPSTREAM=(process.env.WDCC_LEAD_UPSTREAM_URL||"https://wdcc-lead-email-stage.vercel.app/api/lead").trim();
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);

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
async function runWorker(){
  const state=await readState();let changed=false;let attempted=0;let recovered=0;let failed=0;
  for(const lead of state.leads as any[]){
    if(lead?.qa===true||String(lead?.status||"").toLowerCase()==="test")continue;
    const needsSync=String(lead?.sync?.upstream||"")!=="synced";
    const needsNotify=Object.values(lead?.notifications||{}).some(v=>String(v||"").startsWith("failed"));
    if(!needsSync&&!needsNotify)continue;attempted++;
    try{
      if(needsSync){const upstreamLeadId=await retryUpstream(lead);lead.upstreamLeadId=upstreamLeadId;lead.sync={...(lead.sync||{}),upstream:"synced",upstreamLeadId,syncedAt:new Date().toISOString(),lastError:null};changed=true;}
      if(needsNotify){lead.notifications=await retryNotifications(lead);changed=true;}
      const stillBroken=String(lead?.sync?.upstream||"")!=="synced"||Object.values(lead?.notifications||{}).some(v=>String(v||"").startsWith("failed"));
      if(stillBroken)throw Error("delivery_still_degraded");
      recovered++;lead.updatedAt=new Date().toISOString();
      await recordAnalyticsEvent({event:"lead.retry.recovered",tenantId:String(lead.tenantId||"wdcc"),leadId:lead.id,channel:"ops",metadata:{upstream:lead?.sync?.upstream,notifications:lead.notifications}}).catch(()=>{});
    }catch(error){failed++;lead.updatedAt=new Date().toISOString();changed=true;await recordDeadLetter({category:"lead_delivery",stage:"retry",entityType:"lead",entityId:text(lead.id,180),tenantId:text(lead.tenantId||"wdcc",180),requestId:text(lead.requestId,180),retryable:true,attempts:Number(lead?.sync?.retryAttempts||0)+1,error:error instanceof Error?error.message:"retry_failed",nextAttemptAt:new Date(Date.now()+60*60*1000).toISOString(),context:{upstream:lead?.sync?.upstream||null,notifications:lead?.notifications||null}}).catch(()=>{});lead.sync={...(lead.sync||{}),retryAttempts:Number(lead?.sync?.retryAttempts||0)+1,lastRetryAt:new Date().toISOString()};}
  }
  if(changed)await writeState(state);return {attempted,recovered,failed};
}
export async function GET(request:Request){if(!authorizedCron(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});try{return NextResponse.json({ok:true,...await runWorker()},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"retry_worker_failed"},{status:500})}}
export async function POST(){const user=await currentUser().catch(()=>null);if(!user||!roles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});try{return NextResponse.json({ok:true,...await runWorker()},{headers:{"Cache-Control":"private, no-store"}})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"retry_worker_failed"},{status:500})}}
