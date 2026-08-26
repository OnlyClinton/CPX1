import crypto from "node:crypto";
import {neon} from "@neondatabase/serverless";

type SqlClient=ReturnType<typeof neon>;

let sqlClient:SqlClient|undefined;
let dealerIdCache:Promise<string>|undefined;

const text=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const numberOrNull=(value:unknown)=>value===null||value===undefined||value===""?null:Number(value);
const isHttpUrl=(value:string)=>/^https?:\/\//i.test(value);
const isUuid=(value:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));

function connectionString(){
  const value=(process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim();
  if(!value)throw Error("WDCC_DATABASE_URL_MISSING");
  return value;
}

export function databaseConfigured(){
  return Boolean((process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim());
}

export function db(){
  if(!sqlClient)sqlClient=neon(connectionString(),{fetchOptions:{cache:"no-store"}});
  return sqlClient;
}

export async function canonicalDealerId(){
  if(!dealerIdCache){
    dealerIdCache=(async()=>{
      const slug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
      const rows=await db().query("select id::text as id from public.dealers where slug=$1 and status='active' order by created_at asc limit 1",[slug]) as any[];
      const id=text(rows?.[0]?.id,80);
      if(!id)throw Error("WDCC_ACTIVE_DEALER_NOT_FOUND");
      return id;
    })();
  }
  return dealerIdCache;
}

export function vehicleFromRow(row:any){
  const media=Array.isArray(row?.media)?row.media:[];
  const pathnames=media.map((item:any)=>text(item?.pathname,500)).filter(Boolean);
  const primary=text(row?.primary_image_url,1000);
  const status=String(row?.status||"").toLowerCase()==="available"?"published":String(row?.status||"draft").toLowerCase();
  return {
    id:String(row.id),
    tenantId:String(row.dealer_id||"wdcc"),
    dealerId:String(row.dealer_id||""),
    stock:text(row.stock_id,80),
    stock_id:text(row.stock_id,80),
    vin:text(row.vin,40),
    year:numberOrNull(row.year),
    make:text(row.make,80),
    model:text(row.model,80),
    trim:text(row.trim,80),
    mileage:numberOrNull(row.mileage)??0,
    price:numberOrNull(row.price)??0,
    downPayment:numberOrNull(row.down_payment)??0,
    down_payment:numberOrNull(row.down_payment)??0,
    bodyStyle:text(row.body_style,60),
    fuelType:text(row.fuel_type,60),
    transmission:text(row.transmission,60),
    condition:text(row.condition,60),
    exteriorColor:text(row.exterior_color,60),
    interiorColor:text(row.interior_color,60),
    drivetrain:text(row.drivetrain,60),
    description:text(row.description,5000),
    visibility:text(row.visibility,30)||"public",
    internalOnly:Boolean(row.internal_only),
    status,
    primaryPhotoPathname:primary&&!isHttpUrl(primary)?primary:null,
    primary_image_url:primary&&isHttpUrl(primary)?primary:null,
    primaryImageUrl:primary||null,
    photoPathnames:pathnames,
    media,
    tags:Array.isArray(row.tags)?row.tags:[],
    createdBy:text(row.created_by,160)||null,
    uploadSource:text(row.upload_source,80)||null,
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,
    updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export function leadFromRow(row:any){
  return {
    id:String(row.id),
    tenantId:String(row.dealer_id||"wdcc"),
    dealerId:String(row.dealer_id||""),
    kind:text(row.lead_kind,40)||"contact",
    name:text(row.name,120),
    phone:text(row.phone,40),
    email:text(row.email,160).toLowerCase(),
    vehicleId:row.vehicle_id?String(row.vehicle_id):"",
    vehicleInterest:text(row.vehicle_need,240),
    message:text(row.message,2000),
    preferredTime:text(row.preferred_time,120),
    source:text(row.source_label,120),
    consent:Boolean(row.consent),
    status:text(row.status,40)||"new",
    idempotencyKey:text(row.idempotency_key,160),
    requestId:row.request_id?String(row.request_id):"",
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,
    updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export async function listVehicles(options:{includeNonPublic?:boolean}={}){
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic?"dealer_id=$1":"dealer_id=$1 and status in ('available','published') and coalesce(internal_only,false)=false and coalesce(visibility,'public')='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} order by created_at desc`,[dealerId]) as any[];
  return rows.map(vehicleFromRow);
}

export async function getVehicle(id:string,options:{includeNonPublic?:boolean}={}){
  if(!isUuid(id))return null;
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic?"id=$1::uuid and dealer_id=$2::uuid":"id=$1::uuid and dealer_id=$2::uuid and status in ('available','published') and coalesce(internal_only,false)=false and coalesce(visibility,'public')='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} limit 1`,[id,dealerId]) as any[];
  return rows[0]?vehicleFromRow(rows[0]):null;
}

export type LeadCreateInput={
  kind:"schedule"|"contact"|"approval";
  name:string;
  phone?:string;
  email?:string;
  vehicleId?:string;
  vehicleInterest?:string;
  message?:string;
  preferredTime?:string;
  source?:string;
  idempotencyKey:string;
  requestId?:string;
  pagePath?:string;
  referrer?:string;
  utmSource?:string;
  utmMedium?:string;
  utmCampaign?:string;
  utmContent?:string;
  clickId?:string;
};

export async function createLead(input:LeadCreateInput){
  const dealerId=await canonicalDealerId();
  const leadId=crypto.randomUUID();
  const requestId=isUuid(input.requestId)?String(input.requestId):crypto.randomUUID();
  const vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  const outboxKey=`lead:${input.idempotencyKey}:created`;
  const metadata=JSON.stringify({
    kind:input.kind,
    source:text(input.source,120),
    pagePath:text(input.pagePath,240),
    referrer:text(input.referrer,500),
    utmSource:text(input.utmSource,120),
    utmMedium:text(input.utmMedium,120),
    utmCampaign:text(input.utmCampaign,160),
    utmContent:text(input.utmContent,160),
    clickId:text(input.clickId,220)
  });
  const rows=await db().query(`
    with chosen as (
      insert into public.leads (
        id,dealer_id,vehicle_id,name,phone,email,vehicle_need,status,message,preferred_time,
        source_label,consent,idempotency_key,lead_kind,request_id
      ) values (
        $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,'new',$8,$9,$10,true,$11,$12,$13::uuid
      )
      on conflict (idempotency_key)
        where idempotency_key is not null and btrim(idempotency_key) <> ''
      do update set idempotency_key=excluded.idempotency_key
      returning *
    ), outbox as (
      insert into public.wdcc_outbox_events (
        dealer_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload
      )
      select dealer_id,'lead',id,'lead.created',$14,
        jsonb_build_object('leadId',id,'kind',lead_kind)
      from chosen
      on conflict (idempotency_key) do nothing
      returning id
    ), event_insert as (
      insert into public.events (
        occurred_at,dealer_id,lead_id,vehicle_id,event_name,page_path,referrer,
        utm_source,utm_medium,utm_campaign,utm_content,metadata
      )
      select now(),chosen.dealer_id,chosen.id,chosen.vehicle_id,'lead_created',$15,$16,$17,$18,$19,$20,$21::jsonb
      from chosen where exists(select 1 from outbox)
      returning id
    ), consent_insert as (
      insert into public.consent_log (
        lead_id,consent_version,analytics_consent,marketing_consent,sms_consent,dealer_sharing_consent,recorded_at
      )
      select id,'wdcc-request-v2',false,false,true,true,now()
      from chosen where exists(select 1 from outbox)
      returning id
    )
    select chosen.*,
      (select id::text from outbox limit 1) as outbox_id,
      exists(select 1 from outbox) as created
    from chosen limit 1
  `,[
    leadId,dealerId,vehicleId,text(input.name,120),text(input.phone,40)||null,text(input.email,160).toLowerCase()||null,
    text(input.vehicleInterest,240)||null,text(input.message,2000)||null,text(input.preferredTime,120)||null,
    text(input.source,120)||"wedontcarecars.com",text(input.idempotencyKey,160),input.kind,requestId,outboxKey,
    text(input.pagePath,240)||null,text(input.referrer,500)||null,text(input.utmSource,120)||null,text(input.utmMedium,120)||null,
    text(input.utmCampaign,160)||null,text(input.utmContent,160)||null,metadata
  ]) as any[];
  const row=rows[0];
  if(!row)throw Error("WDCC_LEAD_CREATE_FAILED");
  return {item:leadFromRow(row),created:Boolean(row.created),outboxId:row.outbox_id?String(row.outbox_id):null};
}

export async function listLeads(){
  const dealerId=await canonicalDealerId();
  const rows=await db().query("select * from public.leads where dealer_id=$1::uuid order by created_at desc",[dealerId]) as any[];
  return rows.map(leadFromRow);
}

function notificationText(lead:any){
  return [
    `New WDCC ${lead.kind} lead`,
    `Name: ${lead.name}`,
    `Phone: ${lead.phone||"Not provided"}`,
    `Email: ${lead.email||"Not provided"}`,
    `Vehicle: ${lead.vehicleInterest||lead.vehicleId||"Not specified"}`,
    `Source: ${lead.source||"Unknown"}`,
    `Message: ${lead.message||"None"}`,
    `Lead ID: ${lead.id}`
  ].join("\n");
}

export async function processLeadOutbox(outboxId:string){
  if(!isUuid(outboxId))return {processed:false,status:"invalid_outbox_id",notifications:{}};
  const claimed=await db().query(`
    update public.wdcc_outbox_events
    set status='processing',attempts=attempts+1,updated_at=now()
    where id=$1::uuid and aggregate_type='lead'
      and (status in ('pending','failed') or (status='processing' and updated_at < now()-interval '5 minutes'))
      and available_at<=now()
    returning *
  `,[outboxId]) as any[];
  if(!claimed[0]){
    const current=await db().query("select status,attempts,last_error from public.wdcc_outbox_events where id=$1::uuid",[outboxId]) as any[];
    return {processed:false,status:current?.[0]?.status||"not_found",attempts:Number(current?.[0]?.attempts||0),notifications:{}};
  }

  const event=claimed[0];
  const rows=await db().query("select * from public.leads where id=$1::uuid limit 1",[String(event.aggregate_id)]) as any[];
  if(!rows[0]){
    await db().query("update public.wdcc_outbox_events set status='dead_letter',last_error='lead_not_found',processed_at=now(),updated_at=now() where id=$1::uuid",[outboxId]);
    return {processed:true,status:"dead_letter",notifications:{},error:"lead_not_found"};
  }

  const lead=leadFromRow(rows[0]);
  const notifications:{email:string;sms:string;webhook:string}={email:"not_configured",sms:"not_configured",webhook:"not_configured"};
  const errors:string[]=[];
  let configured=0;

  const resendKey=(process.env.RESEND_API_KEY||"").trim();
  const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"").split(",").map(value=>value.trim()).filter(Boolean);
  if(resendKey&&recipients.length){
    configured++;
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.WDCC_LEAD_FROM_EMAIL||"WDCC Leads <leads@wedontcarecars.com>",to:recipients,subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:notificationText(lead)}),signal:AbortSignal.timeout(8000)});
      notifications.email=response.ok?"sent":`failed_${response.status}`;
      if(!response.ok)errors.push(`email_${response.status}`);
    }catch(error){notifications.email="failed";errors.push(`email_${error instanceof Error?error.name:"error"}`);}
  }

  const twilioSid=(process.env.TWILIO_ACCOUNT_SID||"").trim();
  const twilioToken=(process.env.TWILIO_AUTH_TOKEN||"").trim();
  const twilioFrom=(process.env.TWILIO_FROM_NUMBER||"").trim();
  const smsTo=(process.env.WDCC_LEAD_NOTIFICATION_PHONE||"").trim();
  if(twilioSid&&twilioToken&&twilioFrom&&smsTo){
    configured++;
    try{
      const form=new URLSearchParams({From:twilioFrom,To:smsTo,Body:notificationText(lead).slice(0,1400)});
      const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),signal:AbortSignal.timeout(8000)});
      notifications.sms=response.ok?"sent":`failed_${response.status}`;
      if(!response.ok)errors.push(`sms_${response.status}`);
    }catch(error){notifications.sms="failed";errors.push(`sms_${error instanceof Error?error.name:"error"}`);}
  }

  const webhook=(process.env.WDCC_LEAD_WEBHOOK_URL||"").trim();
  if(webhook){
    configured++;
    try{
      const response=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"lead.created",lead}),signal:AbortSignal.timeout(8000)});
      notifications.webhook=response.ok?"sent":`failed_${response.status}`;
      if(!response.ok)errors.push(`webhook_${response.status}`);
    }catch(error){notifications.webhook="failed";errors.push(`webhook_${error instanceof Error?error.name:"error"}`);}
  }

  if(configured===0)errors.push("notifications_not_configured");
  const attempts=Number(event.attempts||1);
  const delivered=errors.length===0;
  const status=delivered?"delivered":attempts>=8?"dead_letter":"failed";
  const deliveryJson=JSON.stringify({delivery:notifications,lastAttemptAt:new Date().toISOString()});
  await db().query(`
    update public.wdcc_outbox_events
    set status=$2,payload=payload||$3::jsonb,last_error=$4,
        processed_at=case when $2 in ('delivered','dead_letter') then now() else processed_at end,
        available_at=case when $2='failed' then now()+make_interval(secs=>least(3600,greatest(30,attempts*60))) else available_at end,
        updated_at=now()
    where id=$1::uuid
  `,[outboxId,status,deliveryJson,errors.join(",")||null]);
  if(status==="dead_letter"){
    await db().query("insert into public.wdcc_dead_letters(tenant_id,source,reference_id,reason,payload) values(null,'lead-outbox',$1,$2,$3::jsonb)",[outboxId,errors.join(",")||"delivery_failed",JSON.stringify({leadId:lead.id,notifications})]);
  }
  return {processed:true,status,attempts,notifications,error:errors.join(",")||null};
}

export type VehicleCreateInput={
  year:number;make:string;model:string;trim?:string;price:number;downPayment:number;mileage:number;
  stock?:string;vin?:string;bodyStyle?:string;condition?:string;transmission?:string;exteriorColor?:string;
  interiorColor?:string;drivetrain?:string;fuelType?:string;description?:string;internalOnly?:boolean;
  createdBy?:string;uploadSource?:string;
};

export async function createVehicle(input:VehicleCreateInput){
  const dealerId=await canonicalDealerId();
  const id=crypto.randomUUID();
  const stock=text(input.stock,80)||`WDCC-${Date.now().toString(36).toUpperCase()}`;
  const rows=await db().query(`
    insert into public.vehicles (
      id,dealer_id,stock_id,vin,year,make,model,trim,mileage,price,down_payment,
      body_style,fuel_type,transmission,status,media,tags,condition,exterior_color,
      interior_color,drivetrain,description,visibility,internal_only,created_by,upload_source
    ) values (
      $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft','[]'::jsonb,array[]::text[],
      $15,$16,$17,$18,$19,$20,$21,$22,$23
    ) returning *
  `,[id,dealerId,stock,text(input.vin,40)||null,input.year,text(input.make,80),text(input.model,80),text(input.trim,80)||null,input.mileage,input.price,input.downPayment,text(input.bodyStyle,60)||null,text(input.fuelType,60)||null,text(input.transmission,60)||null,text(input.condition,60)||null,text(input.exteriorColor,60)||null,text(input.interiorColor,60)||null,text(input.drivetrain,60)||null,text(input.description,5000)||null,input.internalOnly?"internal":"public",Boolean(input.internalOnly),text(input.createdBy,160)||null,text(input.uploadSource,80)||"dealer-ui"]) as any[];
  if(!rows[0])throw Error("WDCC_VEHICLE_CREATE_FAILED");
  return vehicleFromRow(rows[0]);
}

export async function updateVehicle(id:string,changes:Record<string,unknown>){
  if(!isUuid(id))return null;
  const current=await getVehicle(id,{includeNonPublic:true});
  if(!current)return null;
  const assignments:string[]=[];
  const values:any[]=[];
  const add=(column:string,value:any)=>{values.push(value);assignments.push(`${column}=$${values.length}`);};
  const addNumber=(column:string,value:unknown)=>{if(value!==undefined)add(column,Number(value));};
  const addText=(column:string,value:unknown,max:number)=>{if(value!==undefined)add(column,text(value,max)||null);};

  addNumber("year",changes.year);addText("make",changes.make,80);addText("model",changes.model,80);addText("trim",changes.trim,80);
  addNumber("price",changes.price);addNumber("down_payment",changes.downPayment);addNumber("mileage",changes.mileage);
  addText("stock_id",changes.stock,80);addText("vin",changes.vin,40);addText("body_style",changes.bodyStyle,60);
  addText("condition",changes.condition,60);addText("transmission",changes.transmission,60);addText("exterior_color",changes.exteriorColor,60);
  addText("interior_color",changes.interiorColor,60);addText("drivetrain",changes.drivetrain,60);addText("fuel_type",changes.fuelType,60);
  addText("description",changes.description,5000);

  if(changes.internalOnly!==undefined||changes.visibility!==undefined){
    const internal=changes.internalOnly===true||String(changes.visibility||"").toLowerCase()==="internal";
    add("internal_only",internal);add("visibility",internal?"internal":"public");
  }
  if(changes.status!==undefined){
    const status=String(changes.status||"").toLowerCase();
    if(!["draft","published","available","archived","quarantined"].includes(status))throw Error("invalid_status");
    add("status",status);
  }

  if(Array.isArray(changes.photoPathnames)){
    const existing=Array.isArray(current.media)?current.media:[];
    const requested=changes.photoPathnames.map(value=>text(value,1000)).filter(Boolean);
    const seen=new Set<string>();
    const media=[...existing,...requested.map(pathname=>isHttpUrl(pathname)?{url:pathname,source:"dealer"}:{pathname,source:"dealer"})].filter((item:any)=>{
      const key=text(item?.pathname||item?.url,1000);if(!key||seen.has(key))return false;seen.add(key);return true;
    }).slice(0,50);
    add("media",JSON.stringify(media));
  }
  if(changes.primaryPhotoPathname!==undefined)add("primary_image_url",text(changes.primaryPhotoPathname,1000)||null);

  if(assignments.length===0)return current;
  assignments.push("updated_at=now()");
  values.push(id);const idParam=values.length;
  const dealerId=await canonicalDealerId();values.push(dealerId);const dealerParam=values.length;
  const rows=await db().query(`update public.vehicles set ${assignments.join(",")} where id=$${idParam}::uuid and dealer_id=$${dealerParam}::uuid returning *`,values) as any[];
  return rows[0]?vehicleFromRow(rows[0]):null;
}

export async function recordVehicleEvent(input:{action:string;outcome:string;requestId:string;vehicleId?:string|null;actorId?:string|null;actorRole?:string|null;detail?:string|null;[key:string]:unknown}){
  const dealerId=await canonicalDealerId().catch(()=>null);
  const vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  const metadata={...input,vehicleId};
  await db().query("insert into public.events(occurred_at,dealer_id,vehicle_id,event_name,metadata) values(now(),$1::uuid,$2::uuid,$3,$4::jsonb)",[dealerId,vehicleId,text(input.action,100)||"vehicle.event",JSON.stringify(metadata)]);
  return {id:crypto.randomUUID(),at:new Date().toISOString(),...input};
}

export async function recentVehicleEvents(max=100){
  const dealerId=await canonicalDealerId();
  const limit=Math.max(1,Math.min(Number(max)||100,200));
  const rows=await db().query("select occurred_at,event_name,metadata from public.events where dealer_id=$1::uuid and event_name like 'vehicle.%' order by occurred_at desc limit $2",[dealerId,limit]) as any[];
  return rows.map(row=>({at:new Date(row.occurred_at).toISOString(),action:row.event_name,...(row.metadata||{})}));
}
