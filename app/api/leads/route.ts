import crypto from "node:crypto";
import {after,NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {canonicalDealerId,createLead,listLeads,processLeadOutbox} from "../../../lib/wdccDb";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const supportedKinds=new Set(["schedule","contact","approval"]);
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const headers={"Cache-Control":"no-store","X-WDCC-Data-Authority":"neon"};

function leadKind(body:any){
  const raw=text(body?.kind??body?.type??body?.requestType,40).toLowerCase();
  if(["schedule","test-drive","test_drive","schedule-test-drive"].includes(raw))return "schedule";
  if(["contact","call","call-or-contact","general"].includes(raw))return "contact";
  if(["approval","get-approved","get_approved","finance","financing","pre-approval"].includes(raw))return "approval";
  return raw;
}

function qaRequested(body:any){
  return body?.qa===true||String(body?.qa||"").toLowerCase()==="true";
}

function validQaSignature(request:Request,idempotencyKey:string){
  if(String(process.env.WDCC_ENVIRONMENT||"").toLowerCase()==="e2e")return true;
  const secret=text(process.env.WDCC_QA_SECRET,500);
  const supplied=text(request.headers.get("x-wdcc-qa-signature"),128).toLowerCase();
  if(secret.length<32||!/^sha256=[0-9a-f]{64}$/.test(supplied))return false;
  const expected=`sha256=${crypto.createHmac("sha256",secret).update(`wdcc-qa:${idempotencyKey}`).digest("hex")}`;
  const left=Buffer.from(supplied),right=Buffer.from(expected);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

function clientIpHash(request:Request){
  const forwarded=text(
    request.headers.get("x-vercel-forwarded-for")||request.headers.get("cf-connecting-ip")||
    request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip"),500
  ).split(",")[0].trim();
  const fallback=`ua:${text(request.headers.get("user-agent"),300)}:${text(request.headers.get("accept-language"),120)}`;
  const secret=text(process.env.WDCC_LEAD_RATE_LIMIT_SECRET||process.env.SESSION_SECRET,500)||"wdcc-public-lead-rate-v1";
  return crypto.createHmac("sha256",secret).update(forwarded||fallback).digest("hex");
}

async function authorizedEditor(user:any){
  if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return false;
  if(String(user.role||"").toLowerCase()==="platform_admin")return true;
  return String(user.tenantId||"")===await canonicalDealerId();
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/leads");
  let user:any;
  try{user=await currentUser();}
  catch{return NextResponse.json({ok:false,error:"auth_backend_unavailable"},{status:503,headers});}
  let permitted=false;
  if(user){try{permitted=await authorizedEditor(user);}catch{return NextResponse.json({ok:false,error:"auth_backend_unavailable"},{status:503,headers});}}
  if(!user||!permitted)return NextResponse.json({ok:false,error:user?"Forbidden":"Unauthorized"},{status:user?403:401,headers});
  try{
    const items=await listLeads();
    return NextResponse.json({ok:true,count:items.length,items,source:"neon-canonical"},{headers});
  }catch{
    return NextResponse.json({ok:false,items:[],error:"lead_read_failed"},{status:503,headers});
  }
}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/leads");
  try{
    const body=await request.json();
    if(text(body?.website??body?.companyWebsite,240)){
      return NextResponse.json({ok:true,accepted:true,persisted:false},{status:202,headers});
    }
    const kind=leadKind(body);
    const name=text(body?.name??`${text(body?.firstName,60)} ${text(body?.lastName,60)}`,120);
    const phone=text(body?.phone,40);
    const email=text(body?.email,160).toLowerCase();
    const vehicleInterest=text(body?.vehicleInterest??body?.desiredVehicle??body?.vehicle??body?.vehicleId,240);
    const consent=body?.consent===true||String(body?.consent||"").toLowerCase()==="true"||body?.consent==="on";
    const monthlyIncome=body?.monthlyIncome===undefined||body?.monthlyIncome===""?null:Number(body.monthlyIncome);
    const downPayment=body?.downPayment===undefined||body?.downPayment===""?null:Number(body.downPayment);
    const referralSource=text(body?.referralSource,160);
    if(!supportedKinds.has(kind))return NextResponse.json({ok:false,error:"valid_lead_type_required"},{status:400,headers});
    if(!name)return NextResponse.json({ok:false,error:"name_required"},{status:400,headers});
    if(!phone&&!email)return NextResponse.json({ok:false,error:"phone_or_email_required"},{status:400,headers});
    if(!consent)return NextResponse.json({ok:false,error:"consent_required"},{status:400,headers});
    if(monthlyIncome!==null&&(!Number.isFinite(monthlyIncome)||monthlyIncome<0))return NextResponse.json({ok:false,error:"invalid_monthly_income"},{status:400,headers});
    if(downPayment!==null&&(!Number.isFinite(downPayment)||downPayment<0))return NextResponse.json({ok:false,error:"invalid_down_payment"},{status:400,headers});

    const idempotencyKey=text(request.headers.get("idempotency-key")??body?.idempotencyKey,160)||crypto.randomUUID();
    const qa=qaRequested(body);
    if(qa&&!validQaSignature(request,idempotencyKey))return NextResponse.json({ok:false,error:"qa_signature_required"},{status:403,headers});
    const ipHash=clientIpHash(request);
    const created=await createLead({
      kind:kind as "schedule"|"contact"|"approval",name,phone,email,
      vehicleId:text(body?.vehicleId,160),vehicleInterest,message:text(body?.message??body?.notes,2000),
      preferredTime:text(body?.preferredTime??body?.appointmentTime,120),source:text(body?.source??body?.utmSource,120)||`cta-${kind}`,
      idempotencyKey,requestId:text(body?.requestId,160),pagePath:text(body?.pagePath,240),referrer:text(body?.referrer,500),
      utmSource:text(body?.utmSource,120),utmMedium:text(body?.utmMedium,120),utmCampaign:text(body?.utmCampaign,160),
      utmContent:text(body?.utmContent,160),clickId:text(body?.clickId,220),suppressNotifications:qa,
      monthlyIncome,downPayment,referralSource,clientIpHash:ipHash
    });

    if(!created.created){
      return NextResponse.json({
        ok:true,persisted:true,deduplicated:true,source:"neon-canonical",
        sync:{database:"saved",notifications:"unchanged",upstream:"unchanged"}
      },{status:200,headers});
    }

    let delivery:any=qa
      ?{processed:false,status:"suppressed_qa",notifications:{email:"suppressed_qa",sms:"not_configured",webhook:"not_configured"}}
      :{processed:false,status:"queued",notifications:created.item.notifications};
    if(!qa&&created.outboxId){
      const outboxId=created.outboxId;
      after(async()=>{
        try{await processLeadOutbox(outboxId);}
        catch{console.error("WDCC_LEAD_DELIVERY_DEFERRED",JSON.stringify({outboxId}));}
      });
    }
    const notificationStatus=delivery.status==="delivered"?"synced":delivery.status==="suppressed_qa"?"suppressed_qa":"pending";
    return NextResponse.json({
      ok:true,persisted:true,deduplicated:false,qa,item:{...created.item,notifications:delivery.notifications},leadId:created.item.id,
      source:"neon-canonical",outboxId:created.outboxId,
      sync:{database:"saved",notifications:delivery.status,upstream:notificationStatus},notifications:delivery.notifications,delivery
    },{status:201,headers});
  }catch(error){
    const code=error instanceof Error?error.message:"";
    if(code==="WDCC_IDEMPOTENCY_FINGERPRINT_MISMATCH")return NextResponse.json({ok:false,persisted:false,error:"idempotency_key_reused"},{status:409,headers});
    if(code==="WDCC_LEAD_RATE_LIMITED")return NextResponse.json({ok:false,persisted:false,error:"lead_rate_limited"},{status:429,headers:{...headers,"Retry-After":"600"}});
    return NextResponse.json({ok:false,persisted:false,error:"lead_create_failed"},{status:503,headers});
  }
}
