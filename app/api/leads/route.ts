import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {createLead,listLeads,processLeadOutbox} from "../../../lib/wdccDb";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const supportedKinds=new Set(["schedule","contact","approval"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function leadKind(body:any){
  const raw=text(body?.kind??body?.type??body?.requestType,40).toLowerCase();
  if(["schedule","test-drive","test_drive","schedule-test-drive"].includes(raw))return "schedule";
  if(["contact","call","call-or-contact","general"].includes(raw))return "contact";
  if(["approval","get-approved","get_approved","finance","financing","pre-approval"].includes(raw))return "approval";
  return raw;
}

function isQaLead(body:any,idempotencyKey:string){
  const name=text(body?.name??`${text(body?.firstName,60)} ${text(body?.lastName,60)}`,120).toUpperCase();
  const email=text(body?.email,160).toLowerCase();
  const message=text(body?.message??body?.notes,2000).toLowerCase();
  return body?.qa===true||String(body?.qa||"").toLowerCase()==="true"||idempotencyKey.toLowerCase().startsWith("wdcc-qa-")||email.endsWith("@invalid.example")||name.startsWith("WDCC QA ")||name.startsWith("WDCC MATRIX")||name.startsWith("WDCC ISOLATED")||message.includes("automated wdcc contract verification");
}

export async function GET(){
  const user=await currentUser().catch(()=>null);
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  try{
    const items=await listLeads();
    return NextResponse.json({ok:true,count:items.length,items,source:"neon-canonical"},{headers:{"Cache-Control":"private, no-store","X-WDCC-Data-Authority":"neon"}});
  }catch(error){
    return NextResponse.json({ok:false,items:[],error:error instanceof Error?error.message:"read_failed"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const kind=leadKind(body);
    const name=text(body?.name??`${text(body?.firstName,60)} ${text(body?.lastName,60)}`,120);
    const phone=text(body?.phone,40);
    const email=text(body?.email,160).toLowerCase();
    const consent=body?.consent===true||String(body?.consent||"").toLowerCase()==="true"||body?.consent==="on";
    if(!supportedKinds.has(kind))return NextResponse.json({ok:false,error:"valid_lead_type_required"},{status:400});
    if(!name)return NextResponse.json({ok:false,error:"name_required"},{status:400});
    if(!phone&&!email)return NextResponse.json({ok:false,error:"phone_or_email_required"},{status:400});
    if(!consent)return NextResponse.json({ok:false,error:"consent_required"},{status:400});

    const idempotencyKey=text(request.headers.get("idempotency-key")??body?.idempotencyKey,160)||crypto.randomUUID();
    const qa=isQaLead(body,idempotencyKey);
    const created=await createLead({
      kind:kind as "schedule"|"contact"|"approval",name,phone,email,
      vehicleId:text(body?.vehicleId,160),vehicleInterest:text(body?.vehicleInterest??body?.vehicle??body?.vehicleId,240),
      message:text(body?.message??body?.notes,2000),preferredTime:text(body?.preferredTime??body?.appointmentTime,120),
      source:text(body?.source??body?.utmSource,120)||`cta-${kind}`,idempotencyKey,requestId:text(body?.requestId,160),
      pagePath:text(body?.pagePath,240),referrer:text(body?.referrer,500),utmSource:text(body?.utmSource,120),utmMedium:text(body?.utmMedium,120),
      utmCampaign:text(body?.utmCampaign,160),utmContent:text(body?.utmContent,160),clickId:text(body?.clickId,220),suppressNotifications:qa
    });

    let delivery:any=qa
      ?{processed:false,status:"suppressed_qa",notifications:{email:"suppressed_qa",sms:"suppressed_qa",webhook:"suppressed_qa"}}
      :{processed:false,status:created.created?"queued":"deduplicated",notifications:{email:"queued",sms:"queued",webhook:"queued"}};
    if(!qa&&created.created&&created.outboxId){
      try{delivery=await processLeadOutbox(created.outboxId);}catch(error){delivery={processed:false,status:"queued",notifications:{email:"queued",sms:"queued",webhook:"queued"},error:error instanceof Error?error.message:"delivery_deferred"};}
    }

    return NextResponse.json({
      ok:true,persisted:true,deduplicated:!created.created,qa,item:created.item,
      leadId:created.item.id,source:"neon-canonical",outboxId:created.outboxId,
      sync:{database:"saved",notifications:delivery.status},notifications:delivery.notifications,delivery
    },{status:created.created?201:200,headers:{"Cache-Control":"no-store","X-WDCC-Data-Authority":"neon"}});
  }catch(error){
    return NextResponse.json({ok:false,persisted:false,error:error instanceof Error?error.message:"create_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
