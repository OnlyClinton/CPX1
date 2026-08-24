import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {readState,writeState} from "../../../lib/store";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const supportedKinds=new Set(["schedule","contact","approval"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function leadKind(body:any){
  const raw=text(body?.kind??body?.type??body?.requestType,40).toLowerCase();
  if(["schedule","test-drive","test_drive","schedule-test-drive"].includes(raw))return "schedule";
  if(["contact","call","call-or-contact","general"].includes(raw))return "contact";
  if(["approval","get-approved","get_approved","finance","financing"].includes(raw))return "approval";
  return raw;
}

async function sendNotifications(lead:any){
  const notifications:{email:string;webhook:string}={email:"not_configured",webhook:"not_configured"};
  const resendKey=process.env.RESEND_API_KEY;
  const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"bigcatscrap@gmail.com").split(",").map(value=>value.trim()).filter(Boolean);
  if(resendKey&&recipients.length){
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.WDCC_LEAD_FROM_EMAIL||"WDCC Leads <leads@wedontcarecars.com>",to:recipients,subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:[`Lead type: ${lead.kind}`,`Name: ${lead.name}`,`Phone: ${lead.phone}`,`Email: ${lead.email||"Not provided"}`,`Vehicle: ${lead.vehicleInterest||"Not specified"}`,`Source: ${lead.source||"Unknown"}`,`Created by: ${lead.createdBy||"public"}`,`Message: ${lead.message||"None"}`,`Lead ID: ${lead.id}`].join("\n")}),signal:AbortSignal.timeout(8000)});
      notifications.email=response.ok?"sent":`failed_${response.status}`;
    }catch{notifications.email="failed";}
  }
  if(process.env.WDCC_LEAD_WEBHOOK_URL){
    try{
      const response=await fetch(process.env.WDCC_LEAD_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"lead.created",lead}),signal:AbortSignal.timeout(8000)});
      notifications.webhook=response.ok?"sent":`failed_${response.status}`;
    }catch{notifications.webhook="failed";}
  }
  return notifications;
}

export async function GET(){
  const user=await currentUser();
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  try{
    const state=await readState();
    const tenantId=String(user.tenantId||"wdcc");
    const items=(String(user.role).toLowerCase()==="platform_admin"?state.leads:state.leads.filter(lead=>String(lead.tenantId||"wdcc")===tenantId)).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return NextResponse.json({ok:true,count:items.length,items},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return NextResponse.json({ok:false,items:[],error:error instanceof Error?error.message:"read_failed"},{status:500});}
}

export async function POST(req:Request){
  try{
    const actor=await currentUser().catch(()=>null);
    const body=await req.json();
    const kind=leadKind(body);
    const name=text(body?.name??`${text(body?.firstName,60)} ${text(body?.lastName,60)}`,120);
    const phone=text(body?.phone,40);
    const email=text(body?.email,160).toLowerCase();
    const vehicleInterest=text(body?.vehicleInterest??body?.vehicle??body?.vehicleId,240);
    const message=text(body?.message??body?.notes,2000);
    const preferredTime=text(body?.preferredTime??body?.appointmentTime,120);
    const consent=body?.consent===true||String(body?.consent||"").toLowerCase()==="true"||body?.consent==="on";
    if(!supportedKinds.has(kind))return NextResponse.json({ok:false,error:"valid_lead_type_required"},{status:400});
    if(!name)return NextResponse.json({ok:false,error:"name_required"},{status:400});
    if(!phone&&!email)return NextResponse.json({ok:false,error:"phone_or_email_required"},{status:400});
    if(!consent)return NextResponse.json({ok:false,error:"consent_required"},{status:400});

    const state=await readState();
    const idempotencyKey=text(req.headers.get("idempotency-key")??body?.idempotencyKey,160);
    if(idempotencyKey){const existing=state.leads.find(lead=>lead.idempotencyKey===idempotencyKey);if(existing)return NextResponse.json({ok:true,persisted:true,deduplicated:true,item:existing,notifications:existing.notifications||{}},{status:200});}

    const now=new Date().toISOString();
    const createdBy=actor?.id||"public";
    const createdByRole=actor?.role||"public";
    const tenantId=actor?.tenantId||"wdcc";
    const lead:any={id:`lead_${crypto.randomUUID()}`,tenantId:String(tenantId),kind,name,phone,email,vehicleInterest,message,preferredTime,consent:true,status:"new",source:text(body?.source,80)||"website",idempotencyKey:idempotencyKey||null,requestId:crypto.randomUUID(),createdBy,createdByRole,createdAt:now,updatedAt:now};
    state.leads.push(lead);
    state.audit.push({id:crypto.randomUUID(),at:now,action:`lead.create.${kind}`,actor:createdBy,actorRole:createdByRole,leadId:lead.id,requestId:lead.requestId,source:lead.source});
    const saved=await writeState(state);
    const notifications=await sendNotifications(lead);
    lead.notifications=notifications;
    return NextResponse.json({ok:true,persisted:true,revision:saved.revision,item:lead,notifications},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({ok:false,persisted:false,error:error instanceof Error?error.message:"create_failed"},{status:500});}
}
