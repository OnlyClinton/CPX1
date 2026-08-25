import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {readState,writeState} from "../../../lib/store";
import {canonicalDealerBackend,WDCC_DEALER_PROJECT_ID,WDCC_PHOENIX_PROJECT_ID} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const supportedKinds=new Set(["schedule","contact","approval"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const LEAD_UPSTREAM=(process.env.WDCC_LEAD_UPSTREAM_URL||"https://wdcc-lead-email-stage.vercel.app/api/lead").trim();
const DEALER_BACKEND=canonicalDealerBackend();

function leadKind(body:any){const raw=text(body?.kind??body?.type??body?.requestType,40).toLowerCase();if(["schedule","test-drive","test_drive","schedule-test-drive"].includes(raw))return "schedule";if(["contact","call","call-or-contact","general"].includes(raw))return "contact";if(["approval","get-approved","get_approved","finance","financing"].includes(raw))return "approval";return raw;}
function upstreamRequestType(kind:string){if(kind==="schedule")return "test-drive";if(kind==="approval")return "pre-approval";return "contact";}
function notificationText(lead:any){return [`New WDCC ${lead.kind} lead`,`Name: ${lead.name}`,`Phone: ${lead.phone||"Not provided"}`,`Email: ${lead.email||"Not provided"}`,`Vehicle: ${lead.vehicleInterest||"Not specified"}`,`Source: ${lead.source||"Unknown"}`,`Message: ${lead.message||"None"}`,`Lead ID: ${lead.id}`,lead.upstreamLeadId?`Upstream ID: ${lead.upstreamLeadId}`:""].filter(Boolean).join("\n");}
function isQaLead(body:any,lead:any,idempotencyKey:string){
  const name=String(lead?.name||"").trim().toUpperCase();
  const email=String(lead?.email||"").trim().toLowerCase();
  const message=String(lead?.message||"").toLowerCase();
  return body?.qa===true||String(body?.qa||"").toLowerCase()==="true"||idempotencyKey.toLowerCase().startsWith("wdcc-qa-")||email.endsWith("@invalid.example")||name.startsWith("WDCC QA ")||name.startsWith("WDCC MATRIX")||name.startsWith("WDCC ISOLATED")||message.includes("automated wdcc contract verification");
}

async function sendNotifications(lead:any){
  const notifications:{email:string;sms:string;webhook:string}={email:"not_configured",sms:"not_configured",webhook:"not_configured"};
  const resendKey=process.env.RESEND_API_KEY;const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"bigcatscrap@gmail.com").split(",").map(value=>value.trim()).filter(Boolean);
  if(resendKey&&recipients.length){try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.WDCC_LEAD_FROM_EMAIL||"WDCC Leads <leads@wedontcarecars.com>",to:recipients,subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:notificationText(lead)}),signal:AbortSignal.timeout(8000)});notifications.email=response.ok?"sent":`failed_${response.status}`;}catch{notifications.email="failed";}}
  const twilioSid=process.env.TWILIO_ACCOUNT_SID;const twilioToken=process.env.TWILIO_AUTH_TOKEN;const twilioFrom=process.env.TWILIO_FROM_NUMBER;const smsTo=process.env.WDCC_LEAD_NOTIFICATION_PHONE;
  if(twilioSid&&twilioToken&&twilioFrom&&smsTo){try{const form=new URLSearchParams({From:twilioFrom,To:smsTo,Body:notificationText(lead).slice(0,1400)});const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),signal:AbortSignal.timeout(8000)});notifications.sms=response.ok?"sent":`failed_${response.status}`;}catch{notifications.sms="failed";}}
  if(process.env.WDCC_LEAD_WEBHOOK_URL){try{const response=await fetch(process.env.WDCC_LEAD_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"lead.created",lead}),signal:AbortSignal.timeout(8000)});notifications.webhook=response.ok?"sent":`failed_${response.status}`;}catch{notifications.webhook="failed";}}
  return notifications;
}

async function persistViaDealer(body:any,kind:string,idempotencyKey:string,qa=false){const payload={...body,kind,consent:true,idempotencyKey:idempotencyKey||undefined,...(qa?{qa:true}:{})};const response=await fetch(`${DEALER_BACKEND}/api/leads`,{method:"POST",headers:{"Content-Type":"application/json",...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),cache:"no-store"});const json=await response.json().catch(()=>({}));if(!response.ok||!json?.ok||!json?.item?.id)throw Error(json?.error||`DEALER_LEAD_${response.status}`);return json;}
async function persistViaUpstream(body:any,kind:string,idempotencyKey:string){
  const payload={name:body.name,phone:body.phone,email:body.email,vehicle:body.vehicleInterest,message:[body.preferredTime?`Preferred time: ${body.preferredTime}`:"",body.message||""].filter(Boolean).join(" | "),requestType:upstreamRequestType(kind),consent:true,source:body.utmSource||body.source||"wedontcarecars.com",idempotencyKey:idempotencyKey||undefined,vehicleId:body.vehicleId||undefined,pagePath:body.pagePath||undefined,referrer:body.referrer||undefined,utmSource:body.utmSource||undefined,utmMedium:body.utmMedium||undefined,utmCampaign:body.utmCampaign||undefined,utmContent:body.utmContent||undefined,clickId:body.clickId||undefined};
  const response=await fetch(LEAD_UPSTREAM,{method:"POST",headers:{"Content-Type":"application/json",...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),cache:"no-store"});
  const json=await response.json().catch(()=>({}));if(!response.ok||!json?.ok||!json?.leadId)throw Error(json?.error||`LEAD_UPSTREAM_${response.status}`);
  return {leadId:String(json.leadId),emailStatus:json.emailStatus||json.email||"upstream",smsStatus:json.smsStatus||json.sms||"upstream",mailto:json.mailto||null};
}

function canonicalHost(req:Request){const host=new URL(req.url).host.toLowerCase();const project=process.env.VERCEL_PROJECT_ID||"";return project===WDCC_DEALER_PROJECT_ID||project===WDCC_PHOENIX_PROJECT_ID||host==="dealer.wedontcarecars.com"||host.includes("wdcc-dealer-portal")||host.includes("wdcc-cpx-launch");}

export async function GET(){const user=await currentUser();if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});try{const state=await readState();const tenantId=String(user.tenantId||"wdcc");const items=(String(user.role).toLowerCase()==="platform_admin"?state.leads:state.leads.filter(lead=>String(lead.tenantId||"wdcc")===tenantId)).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return NextResponse.json({ok:true,count:items.length,items},{headers:{"Cache-Control":"private, no-store"}});}catch(error){return NextResponse.json({ok:false,items:[],error:error instanceof Error?error.message:"read_failed"},{status:500});}}

export async function POST(req:Request){
  try{
    const actor=await currentUser().catch(()=>null);const body=await req.json();const kind=leadKind(body);
    const normalized={name:text(body?.name??`${text(body?.firstName,60)} ${text(body?.lastName,60)}`,120),phone:text(body?.phone,40),email:text(body?.email,160).toLowerCase(),vehicleInterest:text(body?.vehicleInterest??body?.vehicle??body?.vehicleId,240),vehicleId:text(body?.vehicleId,160),message:text(body?.message??body?.notes,2000),preferredTime:text(body?.preferredTime??body?.appointmentTime,120),source:text(body?.source,80)||`cta-${kind||"unknown"}`,pagePath:text(body?.pagePath,240),referrer:text(body?.referrer,500),utmSource:text(body?.utmSource,120),utmMedium:text(body?.utmMedium,120),utmCampaign:text(body?.utmCampaign,160),utmContent:text(body?.utmContent,160),clickId:text(body?.clickId,220)};
    const consent=body?.consent===true||String(body?.consent||"").toLowerCase()==="true"||body?.consent==="on";
    if(!supportedKinds.has(kind))return NextResponse.json({ok:false,error:"valid_lead_type_required"},{status:400});if(!normalized.name)return NextResponse.json({ok:false,error:"name_required"},{status:400});if(!normalized.phone&&!normalized.email)return NextResponse.json({ok:false,error:"phone_or_email_required"},{status:400});if(!consent)return NextResponse.json({ok:false,error:"consent_required"},{status:400});
    const idempotencyKey=text(req.headers.get("idempotency-key")??body?.idempotencyKey,160)||crypto.randomUUID();
    const qa=isQaLead(body,normalized,idempotencyKey);

    if(!canonicalHost(req)){
      try{const dealer=await persistViaDealer(normalized,kind,idempotencyKey,qa);return NextResponse.json({...dealer,source:"dealer-ledger"},{status:dealer?.deduplicated?200:201,headers:{"Cache-Control":"no-store"}});}catch(dealerError){
        if(qa)return NextResponse.json({ok:false,persisted:false,qa:true,error:"qa_dealer_persistence_failed",dealerError:dealerError instanceof Error?dealerError.message:"dealer_persistence_failed"},{status:503,headers:{"Cache-Control":"no-store"}});
        const upstream=await persistViaUpstream(normalized,kind,idempotencyKey);
        return NextResponse.json({ok:true,persisted:true,item:{id:upstream.leadId,kind,...normalized,consent:true,status:"new",idempotencyKey,transport:"lead-upstream"},sync:{dealer:"failed",upstream:"synced",upstreamLeadId:upstream.leadId},notifications:{email:upstream.emailStatus,sms:upstream.smsStatus,webhook:"upstream"},source:"lead-upstream",dealerError:dealerError instanceof Error?dealerError.message:"dealer_persistence_failed"},{status:201,headers:{"Cache-Control":"no-store"}});
      }
    }

    const state=await readState();
    if(idempotencyKey){const existing:any=state.leads.find((lead:any)=>lead.idempotencyKey===idempotencyKey);if(existing){const existingQa=existing.qa===true||existing.status==="test"||isQaLead(existing,existing,idempotencyKey);if(!existingQa&&existing?.sync?.upstream!=="synced"){try{const up=await persistViaUpstream(existing,existing.kind||kind,idempotencyKey);existing.upstreamLeadId=up.leadId;existing.sync={...(existing.sync||{}),upstream:"synced",upstreamLeadId:up.leadId,syncedAt:new Date().toISOString()};existing.updatedAt=new Date().toISOString();await writeState(state);}catch{}}return NextResponse.json({ok:true,persisted:true,deduplicated:true,qa:existingQa,item:existing,sync:existing.sync||{},notifications:existing.notifications||{},source:"local-ledger"},{status:200});}}

    const now=new Date().toISOString();const createdBy=actor?.id||"public";const createdByRole=actor?.role||"public";const tenantId=actor?.tenantId||"wdcc";
    const lead:any={id:`lead_${crypto.randomUUID()}`,tenantId:String(tenantId),kind,...normalized,consent:true,consentVersion:"wdcc-request-v1",qa,status:qa?"test":"new",idempotencyKey,requestId:crypto.randomUUID(),createdBy,createdByRole,createdAt:now,updatedAt:now,sync:{dealer:"saved",upstream:qa?"suppressed_qa":"pending"}};
    state.leads.push(lead);state.audit.push({id:crypto.randomUUID(),at:now,action:`lead.create.${qa?"qa.":""}${kind}`,actor:createdBy,actorRole:createdByRole,leadId:lead.id,requestId:lead.requestId,source:lead.source,idempotencyKey,qa});
    let saved=await writeState(state);

    if(qa){lead.notifications={email:"suppressed_qa",sms:"suppressed_qa",webhook:"suppressed_qa"};lead.updatedAt=new Date().toISOString();saved=await writeState(state);return NextResponse.json({ok:true,persisted:true,qa:true,revision:saved.revision,item:lead,sync:lead.sync,notifications:lead.notifications,source:"local-ledger"},{status:201,headers:{"Cache-Control":"no-store"}});}

    try{const up=await persistViaUpstream(normalized,kind,idempotencyKey);lead.upstreamLeadId=up.leadId;lead.sync={dealer:"saved",upstream:"synced",upstreamLeadId:up.leadId,syncedAt:new Date().toISOString()};}catch(error){lead.sync={dealer:"saved",upstream:"pending",lastError:error instanceof Error?error.message:"upstream_sync_failed"};}
    const notifications=await sendNotifications(lead);lead.notifications=notifications;lead.updatedAt=new Date().toISOString();saved=await writeState(state);
    return NextResponse.json({ok:true,persisted:true,revision:saved.revision,item:lead,sync:lead.sync,notifications,source:"local-ledger"},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({ok:false,persisted:false,error:error instanceof Error?error.message:"create_failed"},{status:500});}
}
