import crypto from "node:crypto";
import {neon} from "@neondatabase/serverless";

type SqlClient=ReturnType<typeof neon>;
let sqlClient:SqlClient|undefined;
let dealerIdCache:Promise<string>|undefined;

const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const num=(value:unknown)=>value===null||value===undefined||value===""?null:Number(value);
const http=(value:string)=>/^https?:\/\//i.test(value);
export const isUuid=(value:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));

function connectionString(){
  const value=(process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim();
  if(!value)throw Error("WDCC_DATABASE_URL_MISSING");
  return value;
}

export function databaseConfigured(){return Boolean((process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim());}
export function db(){if(!sqlClient)sqlClient=neon(connectionString());return sqlClient;}

export async function canonicalDealerId(){
  if(!dealerIdCache)dealerIdCache=(async()=>{
    const slug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
    const rows=await db().query("select id::text as id from public.dealers where slug=$1 and status='active' order by created_at asc limit 1",[slug]) as any[];
    const id=clean(rows?.[0]?.id,80);if(!id)throw Error("WDCC_ACTIVE_DEALER_NOT_FOUND");return id;
  })();
  return dealerIdCache;
}

export function vehicleFromRow(row:any){
  const media=Array.isArray(row?.media)?row.media:[];
  const pathnames=media.map((item:any)=>clean(item?.pathname,1000)).filter(Boolean);
  const primary=clean(row?.primary_image_url,1000);
  const rawStatus=String(row?.status||"draft").toLowerCase();
  const status=rawStatus==="available"?"published":rawStatus;
  return {
    id:String(row.id),tenantId:String(row.dealer_id||"wdcc"),dealerId:String(row.dealer_id||""),
    stock:clean(row.stock_id,80),stock_id:clean(row.stock_id,80),vin:clean(row.vin,40),
    year:num(row.year),make:clean(row.make,80),model:clean(row.model,80),trim:clean(row.trim,80),
    mileage:num(row.mileage)??0,price:num(row.price)??0,downPayment:num(row.down_payment)??0,down_payment:num(row.down_payment)??0,
    bodyStyle:clean(row.body_style,60),fuelType:clean(row.fuel_type,60),transmission:clean(row.transmission,60),
    condition:clean(row.condition,60),exteriorColor:clean(row.exterior_color,60),interiorColor:clean(row.interior_color,60),
    drivetrain:clean(row.drivetrain,60),description:clean(row.description,5000),visibility:clean(row.visibility,30)||"public",
    internalOnly:Boolean(row.internal_only),status,
    primaryPhotoPathname:primary&&!http(primary)?primary:null,primary_image_url:primary&&http(primary)?primary:null,primaryImageUrl:primary||null,
    photoPathnames:pathnames,media,tags:Array.isArray(row.tags)?row.tags:[],badges:Array.isArray(row.tags)?row.tags:[],
    createdBy:clean(row.created_by,160)||null,uploadSource:clean(row.upload_source,80)||null,
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export function leadFromRow(row:any){
  return {
    id:String(row.id),tenantId:String(row.dealer_id||"wdcc"),dealerId:String(row.dealer_id||""),kind:clean(row.lead_kind,40)||"contact",
    name:clean(row.name,120),phone:clean(row.phone,40),email:clean(row.email,160).toLowerCase(),vehicleId:row.vehicle_id?String(row.vehicle_id):"",
    vehicleInterest:clean(row.vehicle_need,240),message:clean(row.message,2000),preferredTime:clean(row.preferred_time,120),source:clean(row.source_label,120),
    consent:Boolean(row.consent),status:clean(row.status,40)||"new",idempotencyKey:clean(row.idempotency_key,160),requestId:row.request_id?String(row.request_id):"",
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export async function listVehicles(options:{includeNonPublic?:boolean}={}){
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic
    ?"dealer_id=$1::uuid"
    :"dealer_id=$1::uuid and status in ('available','published') and coalesce(internal_only,false)=false and coalesce(visibility,'public')='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} order by created_at desc`,[dealerId]) as any[];
  return rows.map(vehicleFromRow);
}

export async function getVehicle(id:string,options:{includeNonPublic?:boolean}={}){
  if(!isUuid(id))return null;
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic
    ?"id=$1::uuid and dealer_id=$2::uuid"
    :"id=$1::uuid and dealer_id=$2::uuid and status in ('available','published') and coalesce(internal_only,false)=false and coalesce(visibility,'public')='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} limit 1`,[id,dealerId]) as any[];
  return rows[0]?vehicleFromRow(rows[0]):null;
}

export type LeadCreateInput={
  kind:"schedule"|"contact"|"approval";name:string;phone?:string;email?:string;vehicleId?:string;vehicleInterest?:string;message?:string;
  preferredTime?:string;source?:string;idempotencyKey:string;requestId?:string;pagePath?:string;referrer?:string;utmSource?:string;utmMedium?:string;
  utmCampaign?:string;utmContent?:string;clickId?:string;suppressNotifications?:boolean;
};

export async function createLead(input:LeadCreateInput){
  const dealerId=await canonicalDealerId();
  const leadId=crypto.randomUUID();
  const requestId=isUuid(input.requestId)?String(input.requestId):crypto.randomUUID();
  const vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  const outboxKey=`lead:${clean(input.idempotencyKey,160)}:created`;
  const suppressed=Boolean(input.suppressNotifications);
  const metadata=JSON.stringify({kind:input.kind,source:clean(input.source,120),pagePath:clean(input.pagePath,240),referrer:clean(input.referrer,500),utmSource:clean(input.utmSource,120),utmMedium:clean(input.utmMedium,120),utmCampaign:clean(input.utmCampaign,160),utmContent:clean(input.utmContent,160),clickId:clean(input.clickId,220),suppressed});
  const rows=await db().query(`
    with chosen as (
      insert into public.leads(id,dealer_id,vehicle_id,name,phone,email,vehicle_need,status,message,preferred_time,source_label,consent,idempotency_key,lead_kind,request_id)
      values($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,'new',$8,$9,$10,true,$11,$12,$13::uuid)
      on conflict (idempotency_key) where idempotency_key is not null and btrim(idempotency_key)<>''
      do update set idempotency_key=excluded.idempotency_key returning *
    ), outbox as (
      insert into public.wdcc_outbox_events(dealer_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload,status,processed_at)
      select dealer_id,'lead',id,'lead.created',$14,jsonb_build_object('leadId',id,'kind',lead_kind,'suppressed',$15::boolean),
             case when $15::boolean then 'delivered' else 'pending' end,
             case when $15::boolean then now() else null end
      from chosen on conflict(idempotency_key) do nothing returning id
    ), event_insert as (
      insert into public.events(occurred_at,dealer_id,lead_id,vehicle_id,event_name,page_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,metadata)
      select now(),chosen.dealer_id,chosen.id,chosen.vehicle_id,'lead_created',$16,$17,$18,$19,$20,$21,$22::jsonb from chosen
      where exists(select 1 from outbox) returning id
    ), consent_insert as (
      insert into public.consent_log(lead_id,consent_version,analytics_consent,marketing_consent,sms_consent,dealer_sharing_consent,recorded_at)
      select id,'wdcc-request-v2',false,false,true,true,now() from chosen where exists(select 1 from outbox) returning id
    )
    select chosen.*,(select id::text from outbox limit 1) as outbox_id,exists(select 1 from outbox) as created from chosen limit 1
  `,[leadId,dealerId,vehicleId,clean(input.name,120),clean(input.phone,40)||null,clean(input.email,160).toLowerCase()||null,clean(input.vehicleInterest,240)||null,clean(input.message,2000)||null,clean(input.preferredTime,120)||null,clean(input.source,120)||"wedontcarecars.com",clean(input.idempotencyKey,160),input.kind,requestId,outboxKey,suppressed,clean(input.pagePath,240)||null,clean(input.referrer,500)||null,clean(input.utmSource,120)||null,clean(input.utmMedium,120)||null,clean(input.utmCampaign,160)||null,clean(input.utmContent,160)||null,metadata]) as any[];
  const row=rows[0];if(!row)throw Error("WDCC_LEAD_CREATE_FAILED");
  return {item:leadFromRow(row),created:Boolean(row.created),outboxId:row.outbox_id?String(row.outbox_id):null,suppressed};
}

export async function listLeads(){
  const dealerId=await canonicalDealerId();
  const rows=await db().query("select * from public.leads where dealer_id=$1::uuid order by created_at desc",[dealerId]) as any[];
  return rows.map(leadFromRow);
}

function notificationText(lead:any){return [`New WDCC ${lead.kind} lead`,`Name: ${lead.name}`,`Phone: ${lead.phone||"Not provided"}`,`Email: ${lead.email||"Not provided"}`,`Vehicle: ${lead.vehicleInterest||lead.vehicleId||"Not specified"}`,`Source: ${lead.source||"Unknown"}`,`Message: ${lead.message||"None"}`,`Lead ID: ${lead.id}`].join("\n");}

export async function processLeadOutbox(outboxId:string){
  if(!isUuid(outboxId))return {processed:false,status:"invalid_outbox_id",attempts:0,notifications:{email:"not_configured",sms:"not_configured",webhook:"not_configured"}};
  const claimed=await db().query(`update public.wdcc_outbox_events set status='processing',attempts=attempts+1,updated_at=now() where id=$1::uuid and aggregate_type='lead' and (status in ('pending','failed') or (status='processing' and updated_at<now()-interval '5 minutes')) and available_at<=now() returning *`,[outboxId]) as any[];
  if(!claimed[0]){
    const current=await db().query("select status,attempts,last_error,payload from public.wdcc_outbox_events where id=$1::uuid",[outboxId]) as any[];
    const delivery=current?.[0]?.payload?.delivery||{};
    return {processed:false,status:current?.[0]?.status||"not_found",attempts:Number(current?.[0]?.attempts||0),notifications:delivery,error:current?.[0]?.last_error||null};
  }
  const event=claimed[0];
  const leadRows=await db().query("select * from public.leads where id=$1::uuid limit 1",[String(event.aggregate_id)]) as any[];
  if(!leadRows[0]){
    await db().query("update public.wdcc_outbox_events set status='dead_letter',last_error='lead_not_found',processed_at=now(),updated_at=now() where id=$1::uuid",[outboxId]);
    return {processed:true,status:"dead_letter",attempts:Number(event.attempts||1),notifications:{email:"not_configured",sms:"not_configured",webhook:"not_configured"},error:"lead_not_found"};
  }
  const lead=leadFromRow(leadRows[0]);
  const notifications:{email:string;sms:string;webhook:string}={email:"not_configured",sms:"not_configured",webhook:"not_configured"};
  const errors:string[]=[];let configured=0;
  const resendKey=(process.env.RESEND_API_KEY||"").trim();const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(resendKey&&recipients.length){configured++;try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.WDCC_LEAD_FROM_EMAIL||"WDCC Leads <leads@wedontcarecars.com>",to:recipients,subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:notificationText(lead)}),signal:AbortSignal.timeout(8000)});notifications.email=r.ok?"sent":`failed_${r.status}`;if(!r.ok)errors.push(`email_${r.status}`);}catch(error){notifications.email="failed";errors.push(`email_${error instanceof Error?error.name:"error"}`);}}
  const sid=(process.env.TWILIO_ACCOUNT_SID||"").trim(),token=(process.env.TWILIO_AUTH_TOKEN||"").trim(),from=(process.env.TWILIO_FROM_NUMBER||"").trim(),to=(process.env.WDCC_LEAD_NOTIFICATION_PHONE||"").trim();
  if(sid&&token&&from&&to){configured++;try{const form=new URLSearchParams({From:from,To:to,Body:notificationText(lead).slice(0,1400)});const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),signal:AbortSignal.timeout(8000)});notifications.sms=r.ok?"sent":`failed_${r.status}`;if(!r.ok)errors.push(`sms_${r.status}`);}catch(error){notifications.sms="failed";errors.push(`sms_${error instanceof Error?error.name:"error"}`);}}
  const webhook=(process.env.WDCC_LEAD_WEBHOOK_URL||"").trim();
  if(webhook){configured++;try{const r=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"lead.created",lead}),signal:AbortSignal.timeout(8000)});notifications.webhook=r.ok?"sent":`failed_${r.status}`;if(!r.ok)errors.push(`webhook_${r.status}`);}catch(error){notifications.webhook="failed";errors.push(`webhook_${error instanceof Error?error.name:"error"}`);}}
  if(configured===0)errors.push("notifications_not_configured");
  const attempts=Number(event.attempts||1),delivered=errors.length===0,status=delivered?"delivered":attempts>=8?"dead_letter":"failed";
  await db().query(`update public.wdcc_outbox_events set status=$2,payload=payload||$3::jsonb,last_error=$4,processed_at=case when $2 in ('delivered','dead_letter') then now() else processed_at end,available_at=case when $2='failed' then now()+make_interval(secs=>least(3600,greatest(30,attempts*60))) else available_at end,updated_at=now() where id=$1::uuid`,[outboxId,status,JSON.stringify({delivery:notifications,lastAttemptAt:new Date().toISOString()}),errors.join(",")||null]);
  if(status==="dead_letter")await db().query("insert into public.wdcc_dead_letters(tenant_id,source,reference_id,reason,payload) values(null,'lead-outbox',$1,$2,$3::jsonb)",[outboxId,errors.join(",")||"delivery_failed",JSON.stringify({leadId:lead.id,notifications})]);
  return {processed:true,status,attempts,notifications,error:errors.join(",")||null};
}

export type VehicleCreateInput={year:number;make:string;model:string;trim?:string;price:number;downPayment:number;mileage:number;stock?:string;vin?:string;bodyStyle?:string;condition?:string;transmission?:string;exteriorColor?:string;interiorColor?:string;drivetrain?:string;fuelType?:string;description?:string;internalOnly?:boolean;createdBy?:string;uploadSource?:string;};

export async function createVehicle(input:VehicleCreateInput){
  const dealerId=await canonicalDealerId();const id=crypto.randomUUID();const stock=clean(input.stock,80)||`WDCC-${Date.now().toString(36).toUpperCase()}`;
  const rows=await db().query(`insert into public.vehicles(id,dealer_id,stock_id,vin,year,make,model,trim,mileage,price,down_payment,body_style,fuel_type,transmission,status,media,tags,condition,exterior_color,interior_color,drivetrain,description,visibility,internal_only,created_by,upload_source) values($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft','[]'::jsonb,array[]::text[],$15,$16,$17,$18,$19,$20,$21,$22,$23) returning *`,[id,dealerId,stock,clean(input.vin,40)||null,input.year,clean(input.make,80),clean(input.model,80),clean(input.trim,80)||null,input.mileage,input.price,input.downPayment,clean(input.bodyStyle,60)||null,clean(input.fuelType,60)||null,clean(input.transmission,60)||null,clean(input.condition,60)||null,clean(input.exteriorColor,60)||null,clean(input.interiorColor,60)||null,clean(input.drivetrain,60)||null,clean(input.description,5000)||null,input.internalOnly?"internal":"public",Boolean(input.internalOnly),clean(input.createdBy,160)||null,clean(input.uploadSource,80)||"dealer-ui"]) as any[];
  if(!rows[0])throw Error("WDCC_VEHICLE_CREATE_FAILED");return vehicleFromRow(rows[0]);
}

export async function updateVehicle(id:string,changes:Record<string,unknown>){
  if(!isUuid(id))return null;const current=await getVehicle(id,{includeNonPublic:true});if(!current)return null;
  const sets:string[]=[],values:any[]=[];const add=(column:string,value:any)=>{values.push(value);sets.push(`${column}=$${values.length}`);};
  const addNum=(column:string,value:unknown)=>{if(value!==undefined)add(column,Number(value));};const addText=(column:string,value:unknown,max:number)=>{if(value!==undefined)add(column,clean(value,max)||null);};
  addNum("year",changes.year);addText("make",changes.make,80);addText("model",changes.model,80);addText("trim",changes.trim,80);addNum("price",changes.price);addNum("down_payment",changes.downPayment);addNum("mileage",changes.mileage);addText("stock_id",changes.stock,80);addText("vin",changes.vin,40);addText("body_style",changes.bodyStyle,60);addText("condition",changes.condition,60);addText("transmission",changes.transmission,60);addText("exterior_color",changes.exteriorColor,60);addText("interior_color",changes.interiorColor,60);addText("drivetrain",changes.drivetrain,60);addText("fuel_type",changes.fuelType,60);addText("description",changes.description,5000);
  if(changes.internalOnly!==undefined||changes.visibility!==undefined){const internal=changes.internalOnly===true||String(changes.visibility||"").toLowerCase()==="internal";add("internal_only",internal);add("visibility",internal?"internal":"public");}
  if(changes.status!==undefined){const status=String(changes.status||"").toLowerCase();if(!["draft","published","available","archived","quarantined"].includes(status))throw Error("invalid_status");add("status",status);}
  if(Array.isArray(changes.photoPathnames)){
    const existing=Array.isArray(current.media)?current.media:[],requested=changes.photoPathnames.map(v=>clean(v,1000)).filter(Boolean),seen=new Set<string>();
    const media=[...existing,...requested.map(pathname=>http(pathname)?{url:pathname,source:"dealer"}:{pathname,source:"dealer"})].filter((item:any)=>{const key=clean(item?.pathname||item?.url,1000);if(!key||seen.has(key))return false;seen.add(key);return true;}).slice(0,50);add("media",JSON.stringify(media));
  }
  if(changes.primaryPhotoPathname!==undefined)add("primary_image_url",clean(changes.primaryPhotoPathname,1000)||null);
  if(!sets.length)return current;sets.push("updated_at=now()");values.push(id);const idP=values.length;const dealerId=await canonicalDealerId();values.push(dealerId);const dealerP=values.length;
  const rows=await db().query(`update public.vehicles set ${sets.join(",")} where id=$${idP}::uuid and dealer_id=$${dealerP}::uuid returning *`,values) as any[];return rows[0]?vehicleFromRow(rows[0]):null;
}

export async function recordVehicleEvent(input:{action:string;outcome:string;requestId:string;vehicleId?:string|null;actorId?:string|null;actorRole?:string|null;detail?:string|null;[key:string]:unknown}){
  const dealerId=await canonicalDealerId().catch(()=>null),vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  await db().query("insert into public.events(occurred_at,dealer_id,vehicle_id,event_name,metadata) values(now(),$1::uuid,$2::uuid,$3,$4::jsonb)",[dealerId,vehicleId,clean(input.action,100)||"vehicle.event",JSON.stringify({...input,vehicleId})]);
  return {id:crypto.randomUUID(),at:new Date().toISOString(),...input};
}

export async function recentVehicleEvents(max=100){
  const dealerId=await canonicalDealerId(),limit=Math.max(1,Math.min(Number(max)||100,200));
  const rows=await db().query("select occurred_at,event_name,metadata from public.events where dealer_id=$1::uuid and event_name like 'vehicle.%' order by occurred_at desc limit $2",[dealerId,limit]) as any[];
  return rows.map(row=>({at:new Date(row.occurred_at).toISOString(),action:row.event_name,...(row.metadata||{})}));
}
