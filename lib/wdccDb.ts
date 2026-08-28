import crypto from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {isVehicleMediaPathname} from "./vehicleMedia";
import {resolveWdccVehiclePrimaryMedia} from "./wdccRecoveredMediaPaths";

type SqlClient=ReturnType<typeof neon>;
let sqlClient:SqlClient|undefined;
let dealerIdCache:Promise<string>|undefined;
let schemaReadyCache:Promise<void>|undefined;

const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const numberOrNull=(value:unknown)=>{
  if(value===null||value===undefined||value==="")return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
};
const object=(value:unknown):Record<string,any>=>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,any>;
  if(typeof value==="string")try{const parsed=JSON.parse(value);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}catch{}
  return {};
};
const array=(value:unknown):any[]=>{
  if(Array.isArray(value))return value;
  if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{}
  return [];
};
const http=(value:string)=>/^https?:\/\//i.test(value);
export const isUuid=(value:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));

function connectionValue(){
  const choices:[string,string|undefined][]=[
    ["WDCC_DATABASE_URL",process.env.WDCC_DATABASE_URL],
    ["DATABASE_URL",process.env.DATABASE_URL],
    ["POSTGRES_URL",process.env.POSTGRES_URL]
  ];
  const selected=choices.find(([,value])=>Boolean(String(value||"").trim()));
  if(!selected)throw Error("WDCC_DATABASE_URL_MISSING");
  return {source:selected[0],value:String(selected[1]).trim()};
}

export function databaseConfigured(){
  return Boolean((process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim());
}

export function databaseIdentity(){
  if(!databaseConfigured())return {configured:false,authority:"neon",source:null,host:null,database:null,branchId:null};
  const {source,value}=connectionValue();
  try{
    const parsed=new URL(value);
    return {
      configured:true,
      authority:"neon",
      source,
      host:parsed.hostname||null,
      database:parsed.pathname.replace(/^\//,"")||null,
      branchId:clean(process.env.WDCC_DATABASE_BRANCH_ID||process.env.NEON_BRANCH_ID,160)||null
    };
  }catch{
    return {configured:true,authority:"neon",source,host:null,database:null,branchId:clean(process.env.WDCC_DATABASE_BRANCH_ID||process.env.NEON_BRANCH_ID,160)||null};
  }
}

export function db(){
  if(!sqlClient)sqlClient=neon(connectionValue().value);
  return sqlClient;
}

export async function assertWddcSchemaReady(){
  if(!schemaReadyCache){
    const check=(async()=>{
      const rows=await db().query(`
        with required_columns(table_name,column_name,udt_name,not_null) as (
          values
            ('vehicles','condition','text',false),('vehicles','exterior_color','text',false),
            ('vehicles','interior_color','text',false),('vehicles','drivetrain','text',false),
            ('vehicles','description','text',false),('vehicles','visibility','text',true),
            ('vehicles','internal_only','bool',true),('vehicles','created_by','uuid',false),
            ('vehicles','upload_source','text',false),
            ('leads','monthly_income','numeric',false),('leads','down_payment','numeric',false),
            ('leads','referral_source','text',false),('leads','metadata','jsonb',true),
            ('wdcc_outbox_events','id','uuid',true),('wdcc_outbox_events','dealer_id','uuid',true),
            ('wdcc_outbox_events','aggregate_type','text',true),('wdcc_outbox_events','aggregate_id','uuid',true),
            ('wdcc_outbox_events','event_type','text',true),('wdcc_outbox_events','idempotency_key','text',true),
            ('wdcc_outbox_events','payload','jsonb',true),('wdcc_outbox_events','status','text',true),
            ('wdcc_outbox_events','attempts','int4',true),('wdcc_outbox_events','available_at','timestamptz',true),
            ('wdcc_outbox_events','created_at','timestamptz',true),('wdcc_outbox_events','updated_at','timestamptz',true),
            ('wdcc_outbox_events','processed_at','timestamptz',false),('wdcc_outbox_events','last_error','text',false)
        ), column_contract as (
          select count(*)::int as matched
          from required_columns required
          join information_schema.columns actual
            on actual.table_schema='public' and actual.table_name=required.table_name and actual.column_name=required.column_name
           and actual.udt_name=required.udt_name
           and (not required.not_null or actual.is_nullable='NO')
        ), index_contract as (
          select count(*)::int as matched
          from pg_class index_relation
          join pg_namespace index_namespace on index_namespace.oid=index_relation.relnamespace
          join pg_index index_state on index_state.indexrelid=index_relation.oid
          where index_namespace.nspname='public'
            and index_state.indisvalid and index_state.indisready
            and (
              (index_relation.relname='wdcc_leads_dealer_idempotency_uidx' and index_state.indisunique) or
              (index_relation.relname='wdcc_outbox_events_idempotency_uidx' and index_state.indisunique) or
              index_relation.relname='wdcc_outbox_events_aggregate_created_idx'
            )
        ), constraint_contract as (
          select count(*)::int as matched
          from pg_constraint constraint_state
          join pg_namespace constraint_namespace on constraint_namespace.oid=constraint_state.connamespace
          where constraint_namespace.nspname='public' and constraint_state.convalidated
            and constraint_state.conname=any(array[
              'wdcc_vehicles_visibility_check','wdcc_leads_monthly_income_check',
              'wdcc_leads_down_payment_check','wdcc_outbox_status_check_v1'
            ]::text[])
        ), default_contract as (
          select count(*)::int as matched
          from information_schema.columns
          where table_schema='public' and table_name='wdcc_outbox_events'
            and column_name=any(array['id','payload','status','attempts','available_at','created_at','updated_at']::text[])
            and column_default is not null
        ), trigger_contract as (
          select exists(
            select 1
            from pg_trigger trigger_state
            join pg_proc trigger_function on trigger_function.oid=trigger_state.tgfoid
            join pg_namespace function_namespace on function_namespace.oid=trigger_function.pronamespace
            where trigger_state.tgrelid='public.leads'::regclass
              and not trigger_state.tgisinternal and trigger_state.tgenabled<>'D'
              and function_namespace.nspname='public' and trigger_function.proname='wdcc_bind_lead_defaults'
          ) as attached
        )
        select
          (select matched from column_contract) as columns_matched,
          (select count(*)::int from required_columns) as columns_required,
          (select matched from index_contract) as indexes_matched,
          (select matched from constraint_contract) as constraints_matched,
          (select matched from default_contract) as defaults_matched,
          (select attached from trigger_contract) as lead_trigger_attached,
          exists(
            select 1 from pg_constraint
            where conrelid='public.wdcc_outbox_events'::regclass and contype='p' and convalidated
          ) as outbox_primary_key,
          exists(
            select 1
            from pg_constraint constraint_state
            join pg_attribute local_column
              on local_column.attrelid=constraint_state.conrelid and local_column.attname='dealer_id'
             and local_column.attnum=any(constraint_state.conkey)
            join pg_attribute foreign_column
              on foreign_column.attrelid=constraint_state.confrelid and foreign_column.attname='id'
             and foreign_column.attnum=any(constraint_state.confkey)
            where constraint_state.conrelid='public.wdcc_outbox_events'::regclass
              and constraint_state.confrelid='public.dealers'::regclass
              and constraint_state.contype='f' and constraint_state.convalidated
          ) as outbox_dealer_fk
      `) as any[];
      const state=rows[0]||{};
      const missing:string[]=[];
      if(Number(state.columns_matched)!==Number(state.columns_required))missing.push("columns");
      if(Number(state.indexes_matched)!==3)missing.push("idempotency_indexes");
      if(Number(state.constraints_matched)!==4)missing.push("validated_constraints");
      if(Number(state.defaults_matched)!==7)missing.push("outbox_defaults");
      if(!state.lead_trigger_attached)missing.push("lead_defaults_trigger");
      if(!state.outbox_primary_key)missing.push("outbox_primary_key");
      if(!state.outbox_dealer_fk)missing.push("outbox_dealer_fk");
      if(missing.length)throw Error(`WDCC_SCHEMA_CONTRACT_INCOMPLETE:${missing.join(",")}`);
    })();
    schemaReadyCache=check.catch(error=>{
      schemaReadyCache=undefined;
      const message=error instanceof Error?error.message:"schema_check_failed";
      throw Error(`WDCC_SCHEMA_MIGRATION_REQUIRED:${message}`);
    });
  }
  return schemaReadyCache;
}

export async function canonicalDealerId(){
  if(!dealerIdCache){
    const lookup=(async()=>{
      const slug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
      const rows=await db().query("select id::text as id from public.dealers where slug=$1 and status='active' order by created_at asc limit 1",[slug]) as any[];
      const id=clean(rows?.[0]?.id,80);
      if(!id)throw Error("WDCC_ACTIVE_DEALER_NOT_FOUND");
      return id;
    })();
    dealerIdCache=lookup.catch(error=>{dealerIdCache=undefined;throw error;});
  }
  return dealerIdCache;
}

export type PortalAccess={
  id:string;
  email?:string;
  username?:string;
  displayName?:string;
  role:"platform_admin"|"dealer_agent";
  tenantId:string;
  status?:string;
  banned?:boolean;
};

export async function resolvePortalAccess(identity:{id?:string;email:string}):Promise<PortalAccess|null>{
  const userId=isUuid(identity.id)?String(identity.id):null;
  const email=clean(identity.email,320).toLowerCase();
  if(!userId&&!email)return null;
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await db().query(`
    with resolved_user as (
      select u.id,u.email,u.name,u.role,u.banned,u."banExpires"
      from neon_auth."user" u
      where ($1::uuid is not null and u.id=$1::uuid)
         or ($1::uuid is null and lower(u.email)=lower($2))
      limit 1
    )
    select u.id::text as id,u.email,u.name,u.role,u.banned,u."banExpires" as ban_expires,
           coalesce(a.is_platform_admin,false) as is_platform_admin,a.status as access_status,
           membership.dealer_id::text as membership_dealer_id,membership.membership_status,
           membership.dealer_status,membership.role_key
    from resolved_user u
    left join public.user_access a on a.user_id=u.id
    left join lateral (
      select m.dealer_id,m.status as membership_status,d.status as dealer_status,r.role_key
      from public.dealer_memberships m
      join public.dealers d on d.id=m.dealer_id
      join public.platform_roles r on r.id=m.role_id
      where m.user_id=u.id and m.status='active' and d.status='active' and d.slug=$3
      order by r.rank desc,m.created_at asc
      limit 1
    ) membership on true
  `,[userId,email,preferredSlug]) as any[];
  const row=rows[0];
  if(!row)return null;
  const banExpires=row.ban_expires?new Date(row.ban_expires).getTime():null;
  const activelyBanned=Boolean(row.banned)&&(banExpires===null||!Number.isFinite(banExpires)||banExpires>Date.now());
  if(activelyBanned)return null;

  const platformAdmin=Boolean(row.is_platform_admin)&&String(row.access_status||"").toLowerCase()==="active";
  let tenantId:string;
  if(platformAdmin)tenantId=await canonicalDealerId();
  else{
    if(row.access_status&&String(row.access_status).toLowerCase()!=="active")return null;
    tenantId=clean(row.membership_dealer_id,80);
    if(!tenantId||String(row.membership_status||"").toLowerCase()!=="active"||String(row.dealer_status||"").toLowerCase()!=="active")return null;
    if(!dealerIdCache)dealerIdCache=Promise.resolve(tenantId);
  }

  const resolvedEmail=clean(row.email,320).toLowerCase();
  const displayName=clean(row.name,160);
  return {
    id:String(row.id),
    email:resolvedEmail||undefined,
    username:resolvedEmail?resolvedEmail.split("@")[0]:undefined,
    displayName:displayName||undefined,
    role:platformAdmin?"platform_admin":"dealer_agent",
    tenantId,
    status:"active",
    banned:false
  };
}

export type PortalUserSummary={
  id:string;
  email:string;
  name:string;
  role:string;
  status:string;
  dealerId:string|null;
  dealerSlug:string|null;
};

export async function listPortalUsers():Promise<PortalUserSummary[]>{
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await db().query(`
    select u.id::text as id,u.email,u.name,
           case when coalesce(a.is_platform_admin,false) and a.status='active' then 'platform_admin'
                else coalesce(membership.role_key,'dealer_agent') end as resolved_role,
           case when coalesce(u.banned,false) and (u."banExpires" is null or u."banExpires">now()) then 'banned'
                when coalesce(a.is_platform_admin,false) then coalesce(a.status,'disabled')
                else coalesce(membership.membership_status,'disabled') end as resolved_status,
           case when coalesce(a.is_platform_admin,false) and a.status='active' then default_dealer.id::text
                else membership.dealer_id::text end as dealer_id,
           case when coalesce(a.is_platform_admin,false) and a.status='active' then default_dealer.slug
                else membership.dealer_slug end as dealer_slug
    from neon_auth."user" u
    left join public.user_access a on a.user_id=u.id
    left join lateral (
      select m.dealer_id,m.status as membership_status,d.slug as dealer_slug,r.role_key
      from public.dealer_memberships m
      join public.dealers d on d.id=m.dealer_id and d.status='active'
      join public.platform_roles r on r.id=m.role_id
      where m.user_id=u.id and m.status='active'
      order by (d.slug=$1) desc,r.rank desc,m.created_at asc
      limit 1
    ) membership on true
    left join lateral (
      select d.id,d.slug from public.dealers d
      where d.slug=$1 and d.status='active'
      order by d.created_at asc limit 1
    ) default_dealer on true
    where (coalesce(a.is_platform_admin,false) and a.status='active') or membership.dealer_id is not null
    order by lower(u.email),u.id
  `,[preferredSlug]) as any[];
  return rows.map(row=>({
    id:String(row.id),
    email:clean(row.email,320).toLowerCase(),
    name:clean(row.name,160),
    role:clean(row.resolved_role,80)||"dealer_agent",
    status:clean(row.resolved_status,40)||"disabled",
    dealerId:clean(row.dealer_id,80)||null,
    dealerSlug:clean(row.dealer_slug,120)||null
  }));
}

export function vehicleFromRow(row:any){
  const media=array(row?.media);
  const pathnames=media.map(item=>clean(item?.pathname,1000)).filter(Boolean);
  const storedPrimary=clean(row?.primary_image_url,1000);
  const primary=resolveWdccVehiclePrimaryMedia({
    id:row?.id,year:row?.year,make:row?.make,model:row?.model,primaryImageUrl:storedPrimary,mediaPathnames:pathnames
  });
  const rawStatus=String(row?.status||"draft").toLowerCase();
  const status=rawStatus==="available"?"published":rawStatus;
  return {
    id:String(row.id),tenantId:String(row.dealer_id||""),dealerId:String(row.dealer_id||""),
    stock:clean(row.stock_id,80),stock_id:clean(row.stock_id,80),vin:clean(row.vin,40),
    year:numberOrNull(row.year),make:clean(row.make,80),model:clean(row.model,80),trim:clean(row.trim,80),
    mileage:numberOrNull(row.mileage)??0,price:numberOrNull(row.price)??0,downPayment:numberOrNull(row.down_payment)??0,down_payment:numberOrNull(row.down_payment)??0,
    bodyStyle:clean(row.body_style,60),body_style:clean(row.body_style,60),fuelType:clean(row.fuel_type,60),fuel_type:clean(row.fuel_type,60),transmission:clean(row.transmission,60),
    condition:clean(row.condition,60),exteriorColor:clean(row.exterior_color,60),interiorColor:clean(row.interior_color,60),
    drivetrain:clean(row.drivetrain,60),description:clean(row.description,5000),visibility:clean(row.visibility,30)||"public",
    internalOnly:Boolean(row.internal_only),status,
    primaryPhotoPathname:primary.primaryPhotoPathname,primary_image_url:primary.directImageUrl,primaryImageUrl:primary.primaryImageUrl,
    photoPathnames:pathnames,media,tags:Array.isArray(row.tags)?row.tags:[],badges:Array.isArray(row.tags)?row.tags:[],
    createdBy:row.created_by?String(row.created_by):null,uploadSource:clean(row.upload_source,80)||null,
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export function publicVehicleDto(vehicle:any){
  return {
    id:String(vehicle.id),stock:clean(vehicle.stock,80),stock_id:clean(vehicle.stock_id??vehicle.stock,80),
    year:numberOrNull(vehicle.year),make:clean(vehicle.make,80),model:clean(vehicle.model,80),trim:clean(vehicle.trim,80),
    mileage:numberOrNull(vehicle.mileage)??0,price:numberOrNull(vehicle.price)??0,
    downPayment:numberOrNull(vehicle.downPayment??vehicle.down_payment)??0,down_payment:numberOrNull(vehicle.downPayment??vehicle.down_payment)??0,
    bodyStyle:clean(vehicle.bodyStyle??vehicle.body_style,60),body_style:clean(vehicle.bodyStyle??vehicle.body_style,60),
    fuelType:clean(vehicle.fuelType??vehicle.fuel_type,60),fuel_type:clean(vehicle.fuelType??vehicle.fuel_type,60),
    transmission:clean(vehicle.transmission,60),engine:clean(vehicle.engine,60),cylinders:clean(vehicle.cylinders,60),condition:clean(vehicle.condition,60),
    exteriorColor:clean(vehicle.exteriorColor,60),interiorColor:clean(vehicle.interiorColor,60),drivetrain:clean(vehicle.drivetrain,60),
    description:clean(vehicle.description,5000),visibility:clean(vehicle.visibility,30)||"public",internalOnly:Boolean(vehicle.internalOnly),
    status:clean(vehicle.status,30),primaryPhotoPathname:clean(vehicle.primaryPhotoPathname,1000)||null,
    primary_image_url:clean(vehicle.primary_image_url,1000)||null,primaryImageUrl:clean(vehicle.primaryImageUrl,1000)||null,
    tags:Array.isArray(vehicle.tags)?vehicle.tags.map((value:unknown)=>clean(value,80)).filter(Boolean):[],
    badges:Array.isArray(vehicle.badges)?vehicle.badges.map((value:unknown)=>clean(value,80)).filter(Boolean):[]
  };
}

function publicVehicleEligible(vehicle:any){
  const stock=clean(vehicle?.stock??vehicle?.stock_id,80).toUpperCase();
  const badges=[...array(vehicle?.tags),...array(vehicle?.badges)].map(value=>clean(value,80).toUpperCase());
  const qa=/^(R36TEST|WDCC[-_]?QA|QA|TEST)[-_]/.test(stock)||badges.some(value=>value==="QA"||value==="TEST"||value==="R36-TEST"||value.includes("CERTIFICATION"));
  return !qa&&["available","published"].includes(String(vehicle?.status||"").toLowerCase())&&vehicle?.internalOnly!==true&&clean(vehicle?.visibility,30)!=="internal"&&clean(vehicle?.visibility,30)!=="dealer_only";
}

export async function listVehicles(options:{includeNonPublic?:boolean}={}){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic
    ?"dealer_id=$1::uuid"
    :"dealer_id=$1::uuid and status in ('available','published') and internal_only=false and visibility='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} order by updated_at desc,created_at desc`,[dealerId]) as any[];
  const vehicles=rows.map(vehicleFromRow);
  return options.includeNonPublic?vehicles:vehicles.filter(publicVehicleEligible);
}

export async function getVehicle(id:string,options:{includeNonPublic?:boolean}={}){
  if(!isUuid(id))return null;
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const where=options.includeNonPublic
    ?"id=$1::uuid and dealer_id=$2::uuid"
    :"id=$1::uuid and dealer_id=$2::uuid and status in ('available','published') and internal_only=false and visibility='public'";
  const rows=await db().query(`select * from public.vehicles where ${where} limit 1`,[id,dealerId]) as any[];
  if(!rows[0])return null;
  const vehicle=vehicleFromRow(rows[0]);
  return options.includeNonPublic||publicVehicleEligible(vehicle)?vehicle:null;
}

export async function getVehicleById(id:string){
  return getVehicle(id,{includeNonPublic:true});
}

export async function vehicleStockExists(stock:string,exceptId?:string){
  const value=clean(stock,80);
  if(!value)return false;
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const rows=await db().query(`
    select exists(
      select 1 from public.vehicles
      where dealer_id=$1::uuid and lower(stock_id)=lower($2) and status<>'archived'
        and ($3::uuid is null or id<>$3::uuid)
    ) as found
  `,[dealerId,value,isUuid(exceptId)?exceptId:null]) as any[];
  return Boolean(rows?.[0]?.found);
}

export type VehicleCreateInput={
  year:number;make:string;model:string;trim?:string;price:number;downPayment:number;mileage:number;stock?:string;vin?:string;
  bodyStyle?:string;condition?:string;transmission?:string;exteriorColor?:string;interiorColor?:string;drivetrain?:string;
  fuelType?:string;description?:string;internalOnly?:boolean;createdBy?:string;uploadSource?:string;
};

export type SignedDraftVehicleCreateResult=
  |{outcome:"created";actor:PortalAccess;vehicle:any}
  |{outcome:"unauthorized"}
  |{outcome:"stock_conflict"};

export async function createDraftVehicleForSignedSession(input:{
  subject:{id:string;email:string;role:string;tenantId:string};
  vehicle:VehicleCreateInput;
}):Promise<SignedDraftVehicleCreateResult>{
  if(!isUuid(input.subject.id)||!isUuid(input.subject.tenantId))return {outcome:"unauthorized"};
  const role=clean(input.subject.role,40).toLowerCase();
  const email=clean(input.subject.email,320).toLowerCase();
  if(!email||(role!=="platform_admin"&&role!=="dealer_agent"))return {outcome:"unauthorized"};
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const vehicleId=crypto.randomUUID();
  const stock=clean(input.vehicle.stock,80).toUpperCase()||`WDCC-${Date.now().toString(36).toUpperCase()}`;
  const rows=await db().query(`
    with default_dealer as (
      select d.id,d.slug
      from public.dealers d
      where d.id=$4::uuid and d.slug=$5 and d.status='active'
      order by d.created_at asc
      limit 1
    ), resolved_user as (
      select u.id,u.email,u.name
      from neon_auth."user" u
      where u.id=$1::uuid
        and lower(u.email)=lower($2)
        and (
          not coalesce(u.banned,false)
          or (u."banExpires" is not null and u."banExpires"<=now())
        )
      limit 1
    ), actor as (
      select candidates.id,candidates.email,candidates.name,candidates.role,candidates.tenant_id
      from (
        select u.id,u.email,u.name,'platform_admin'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        join public.user_access a
          on a.user_id=u.id and a.is_platform_admin=true and a.status='active'
        where $3='platform_admin'
        union all
        select u.id,u.email,u.name,'dealer_agent'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        left join public.user_access a on a.user_id=u.id
        where $3='dealer_agent'
          and (a.status is null or a.status='active')
          and not (coalesce(a.is_platform_admin,false) and a.status='active')
          and exists (
            select 1
            from public.dealer_memberships m
            join public.platform_roles r on r.id=m.role_id
            where m.user_id=u.id and m.dealer_id=d.id and m.status='active'
          )
      ) candidates
      limit 1
    ), stock_lock as materialized (
      select pg_advisory_xact_lock(
        hashtextextended(a.tenant_id::text||':'||lower($7::text),0)
      ) as acquired
      from actor a
    ), inserted as (
      insert into public.vehicles(
        id,dealer_id,stock_id,vin,year,make,model,trim,mileage,price,down_payment,body_style,fuel_type,transmission,
        status,media,tags,condition,exterior_color,interior_color,drivetrain,description,visibility,internal_only,created_by,upload_source
      )
      select
        $6::uuid,a.tenant_id,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        'draft','[]'::jsonb,array[]::text[],$19,$20,$21,$22,$23,$24,$25,a.id,$26
      from actor a
      cross join stock_lock
      where not exists(
        select 1
        from public.vehicles existing
        where existing.dealer_id=a.tenant_id
          and lower(existing.stock_id)=lower($7)
          and existing.status<>'archived'
      )
      returning *
    )
    select
      exists(select 1 from actor) as access_ok,
      exists(
        select 1
        from public.vehicles existing
        join actor a on a.tenant_id=existing.dealer_id
        where lower(existing.stock_id)=lower($7) and existing.status<>'archived'
      ) as stock_conflict,
      (select jsonb_build_object(
        'id',a.id::text,'email',a.email,'displayName',a.name,'role',a.role,
        'tenantId',a.tenant_id::text,'status','active','banned',false
      ) from actor a limit 1) as actor,
      (select to_jsonb(saved) from inserted saved limit 1) as vehicle
  `,[
    input.subject.id,email,role,input.subject.tenantId,preferredSlug,vehicleId,stock,clean(input.vehicle.vin,40)||null,
    input.vehicle.year,clean(input.vehicle.make,80),clean(input.vehicle.model,80),clean(input.vehicle.trim,80)||null,
    input.vehicle.mileage,input.vehicle.price,input.vehicle.downPayment,clean(input.vehicle.bodyStyle,60)||null,
    clean(input.vehicle.fuelType,60)||null,clean(input.vehicle.transmission,60)||null,clean(input.vehicle.condition,60)||null,
    clean(input.vehicle.exteriorColor,60)||null,clean(input.vehicle.interiorColor,60)||null,clean(input.vehicle.drivetrain,60)||null,
    clean(input.vehicle.description,5000)||null,input.vehicle.internalOnly?"internal":"public",Boolean(input.vehicle.internalOnly),
    clean(input.vehicle.uploadSource,80)||"dealer-ui"
  ]) as any[];
  const row=rows[0]||{};
  if(!row.access_ok)return {outcome:"unauthorized"};
  if(!row.vehicle){
    if(row.stock_conflict)return {outcome:"stock_conflict"};
    throw Error("WDCC_VEHICLE_CREATE_FAILED");
  }
  const actorRow=object(row.actor);
  const actor:PortalAccess={
    id:clean(actorRow.id,80),email:clean(actorRow.email,320).toLowerCase()||undefined,
    displayName:clean(actorRow.displayName,160)||undefined,role:actorRow.role==="platform_admin"?"platform_admin":"dealer_agent",
    tenantId:clean(actorRow.tenantId,80),status:"active",banned:false
  };
  return {outcome:"created",actor,vehicle:vehicleFromRow(row.vehicle)};
}

export async function createVehicle(input:VehicleCreateInput){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const id=crypto.randomUUID();
  const stock=clean(input.stock,80).toUpperCase()||`WDCC-${Date.now().toString(36).toUpperCase()}`;
  const createdBy=isUuid(input.createdBy)?String(input.createdBy):null;
  const rows=await db().query(`
    insert into public.vehicles(
      id,dealer_id,stock_id,vin,year,make,model,trim,mileage,price,down_payment,body_style,fuel_type,transmission,
      status,media,tags,condition,exterior_color,interior_color,drivetrain,description,visibility,internal_only,created_by,upload_source
    ) values(
      $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
      'draft','[]'::jsonb,array[]::text[],$15,$16,$17,$18,$19,$20,$21,$22::uuid,$23
    ) returning *
  `,[
    id,dealerId,stock,clean(input.vin,40)||null,input.year,clean(input.make,80),clean(input.model,80),clean(input.trim,80)||null,
    input.mileage,input.price,input.downPayment,clean(input.bodyStyle,60)||null,clean(input.fuelType,60)||null,clean(input.transmission,60)||null,
    clean(input.condition,60)||null,clean(input.exteriorColor,60)||null,clean(input.interiorColor,60)||null,clean(input.drivetrain,60)||null,
    clean(input.description,5000)||null,input.internalOnly?"internal":"public",Boolean(input.internalOnly),createdBy,clean(input.uploadSource,80)||"dealer-ui"
  ]) as any[];
  if(!rows[0])throw Error("WDCC_VEHICLE_CREATE_FAILED");
  return vehicleFromRow(rows[0]);
}

export type DraftVehiclePhotoCheckpointResult=
  |{outcome:"updated";actor:PortalAccess;vehicle:any}
  |{outcome:"unauthorized"}
  |{outcome:"not_found"}
  |{outcome:"requires_full_update"};

export async function updateDraftVehiclePhotoCheckpoint(input:{
  vehicleId:string;
  subject:{id:string;email:string;role:string;tenantId:string};
  photoPathnames:string[];
  primaryPhotoPathname:string|null;
  primarySupplied:boolean;
}):Promise<DraftVehiclePhotoCheckpointResult>{
  if(!isUuid(input.vehicleId)||!isUuid(input.subject.id)||!isUuid(input.subject.tenantId))return {outcome:"unauthorized"};
  const role=clean(input.subject.role,40).toLowerCase();
  const email=clean(input.subject.email,320).toLowerCase();
  if(!email||(role!=="platform_admin"&&role!=="dealer_agent"))return {outcome:"unauthorized"};
  const pathnames=[...new Set(input.photoPathnames.map(value=>clean(value,1000)).filter(Boolean))];
  if(pathnames.length>10)throw Error("invalid_photo_count");
  const primary=clean(input.primaryPhotoPathname,1000)||null;
  if(primary&&!pathnames.includes(primary))throw Error("primary_photo_must_be_uploaded");
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await db().query(`
    with default_dealer as (
      select d.id,d.slug
      from public.dealers d
      where d.id=$4::uuid and d.slug=$5 and d.status='active'
      order by d.created_at asc
      limit 1
    ), resolved_user as (
      select u.id,u.email,u.name
      from neon_auth."user" u
      where u.id=$1::uuid
        and lower(u.email)=lower($2)
        and (
          not coalesce(u.banned,false)
          or (u."banExpires" is not null and u."banExpires"<=now())
        )
      limit 1
    ), actor as (
      select candidates.id,candidates.email,candidates.name,candidates.role,candidates.tenant_id
      from (
        select u.id,u.email,u.name,'platform_admin'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        join public.user_access a
          on a.user_id=u.id and a.is_platform_admin=true and a.status='active'
        where $3='platform_admin'
        union all
        select u.id,u.email,u.name,'dealer_agent'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        left join public.user_access a on a.user_id=u.id
        where $3='dealer_agent'
          and (a.status is null or a.status='active')
          and not (coalesce(a.is_platform_admin,false) and a.status='active')
          and exists (
            select 1
            from public.dealer_memberships m
            join public.platform_roles r on r.id=m.role_id
            where m.user_id=u.id and m.dealer_id=d.id and m.status='active'
          )
      ) candidates
      limit 1
    ), scoped_vehicle as (
      select v.*
      from public.vehicles v
      join actor a on a.tenant_id=v.dealer_id
      where v.id=$6::uuid
      limit 1
    ), media_set as (
      select coalesce(
        jsonb_agg(
          coalesce(existing.item,jsonb_build_object('pathname',requested.pathname,'source','dealer'))
          order by requested.ordinality
        ),
        '[]'::jsonb
      ) as media
      from scoped_vehicle sv
      cross join lateral jsonb_array_elements_text($7::jsonb) with ordinality requested(pathname,ordinality)
      left join lateral (
        select element.item
        from jsonb_array_elements(coalesce(sv.media,'[]'::jsonb)) element(item)
        where coalesce(element.item->>'pathname',element.item->>'url')=requested.pathname
        limit 1
      ) existing on true
    ), updated as (
      update public.vehicles v
      set media=media_set.media,
          primary_image_url=case
            when $8::boolean then nullif($9::text,'')
            when exists(
              select 1 from jsonb_array_elements_text($7::jsonb) current_path(pathname)
              where current_path.pathname=sv.primary_image_url
            ) then sv.primary_image_url
            else (
              select first_path
              from jsonb_array_elements_text($7::jsonb) with ordinality first(first_path,ordinality)
              order by ordinality
              limit 1
            )
          end,
          updated_at=now()
      from actor a,scoped_vehicle sv,media_set
      where v.id=sv.id and v.id=$6::uuid and v.dealer_id=a.tenant_id and v.status='draft'
      returning v.*
    )
    select
      exists(select 1 from actor) as access_ok,
      exists(select 1 from scoped_vehicle) as vehicle_exists,
      (select status from scoped_vehicle limit 1) as current_status,
      (select jsonb_build_object(
        'id',a.id::text,'email',a.email,'displayName',a.name,'role',a.role,
        'tenantId',a.tenant_id::text,'status','active','banned',false
      ) from actor a limit 1) as actor,
      (select to_jsonb(saved) from updated saved limit 1) as vehicle
  `,[input.subject.id,email,role,input.subject.tenantId,preferredSlug,input.vehicleId,JSON.stringify(pathnames),input.primarySupplied,primary]) as any[];
  const row=rows[0]||{};
  if(!row.access_ok)return {outcome:"unauthorized"};
  if(!row.vehicle_exists)return {outcome:"not_found"};
  if(!row.vehicle)return {outcome:"requires_full_update"};
  const actorRow=object(row.actor);
  const actor:PortalAccess={
    id:clean(actorRow.id,80),email:clean(actorRow.email,320).toLowerCase()||undefined,
    displayName:clean(actorRow.displayName,160)||undefined,role:actorRow.role==="platform_admin"?"platform_admin":"dealer_agent",
    tenantId:clean(actorRow.tenantId,80),status:"active",banned:false
  };
  return {outcome:"updated",actor,vehicle:vehicleFromRow(row.vehicle)};
}

export type SignedVehiclePublishResult=
  |{outcome:"published";actor:PortalAccess;vehicle:any}
  |{outcome:"unauthorized"}
  |{outcome:"not_found"}
  |{outcome:"status_conflict";status:string}
  |{outcome:"media_unverified"};

export async function publishVehicleForSignedSession(input:{
  vehicleId:string;
  subject:{id:string;email:string;role:string;tenantId:string};
  photoPathnames:string[];
  primaryPhotoPathname:string;
  internalOnly:boolean;
  visibility:"internal"|"public";
  mediaVerified:boolean;
}):Promise<SignedVehiclePublishResult>{
  if(!isUuid(input.vehicleId)||!isUuid(input.subject.id)||!isUuid(input.subject.tenantId))return {outcome:"unauthorized"};
  const role=clean(input.subject.role,40).toLowerCase();
  const email=clean(input.subject.email,320).toLowerCase();
  if(!email||(role!=="platform_admin"&&role!=="dealer_agent"))return {outcome:"unauthorized"};
  const pathnames=input.photoPathnames;
  if(pathnames.length<1||pathnames.length>10||new Set(pathnames).size!==pathnames.length)throw Error("WDCC_VEHICLE_PUBLISH_MEDIA_INVALID");
  if(pathnames.some(pathname=>!isVehicleMediaPathname(input.vehicleId,pathname)))throw Error("WDCC_VEHICLE_PUBLISH_MEDIA_INVALID");
  if(!pathnames.includes(input.primaryPhotoPathname))throw Error("WDCC_VEHICLE_PUBLISH_PRIMARY_INVALID");
  if(typeof input.internalOnly!=="boolean"||typeof input.mediaVerified!=="boolean"||input.visibility!==(input.internalOnly?"internal":"public"))throw Error("WDCC_VEHICLE_PUBLISH_VISIBILITY_INVALID");
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await db().query(`
    with default_dealer as (
      select d.id,d.slug
      from public.dealers d
      where d.id=$4::uuid and d.slug=$5 and d.status='active'
      order by d.created_at asc
      limit 1
    ), resolved_user as (
      select u.id,u.email,u.name
      from neon_auth."user" u
      where u.id=$1::uuid
        and lower(u.email)=lower($2)
        and (
          not coalesce(u.banned,false)
          or (u."banExpires" is not null and u."banExpires"<=now())
        )
      limit 1
    ), actor as (
      select candidates.id,candidates.email,candidates.name,candidates.role,candidates.tenant_id
      from (
        select u.id,u.email,u.name,'platform_admin'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        join public.user_access a
          on a.user_id=u.id and a.is_platform_admin=true and a.status='active'
        where $3='platform_admin'
        union all
        select u.id,u.email,u.name,'dealer_agent'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        left join public.user_access a on a.user_id=u.id
        where $3='dealer_agent'
          and (a.status is null or a.status='active')
          and not (coalesce(a.is_platform_admin,false) and a.status='active')
          and exists (
            select 1
            from public.dealer_memberships m
            join public.platform_roles r on r.id=m.role_id
            where m.user_id=u.id and m.dealer_id=d.id and m.status='active' and r.scope='dealer'
          )
      ) candidates
      limit 1
    ), scoped_vehicle as materialized (
      select v.*
      from public.vehicles v
      join actor a on a.tenant_id=v.dealer_id
      where v.id=$6::uuid
      limit 1
    ), media_set as materialized (
      select coalesce(
        jsonb_agg(
          coalesce(existing.item,jsonb_build_object('pathname',requested.pathname,'source','dealer'))
          order by requested.ordinality
        ),
        '[]'::jsonb
      ) as media
      from scoped_vehicle sv
      cross join lateral jsonb_array_elements_text($7::jsonb) with ordinality requested(pathname,ordinality)
      left join lateral (
        select element.item
        from jsonb_array_elements(case when jsonb_typeof(sv.media)='array' then sv.media else '[]'::jsonb end) element(item)
        where coalesce(element.item->>'pathname',element.item->>'url')=requested.pathname
        limit 1
      ) existing on true
    ), updated as (
      update public.vehicles v
      set media=media_set.media,
          primary_image_url=$8,
          internal_only=$9,
          visibility=$10,
          status='published',
          updated_at=now()
      from actor a,scoped_vehicle sv,media_set
      where v.id=sv.id and v.id=$6::uuid and v.dealer_id=a.tenant_id
        and v.status=sv.status and v.status in ('draft','published') and $11::boolean
      returning v.*
    )
    select
      exists(select 1 from actor) as access_ok,
      exists(select 1 from scoped_vehicle) as vehicle_exists,
      (select status from scoped_vehicle limit 1) as current_status,
      (select jsonb_build_object(
        'id',a.id::text,'email',a.email,'displayName',a.name,'role',a.role,
        'tenantId',a.tenant_id::text,'status','active','banned',false
      ) from actor a limit 1) as actor,
      (select to_jsonb(saved) from updated saved limit 1) as vehicle
  `,[
    input.subject.id,email,role,input.subject.tenantId,preferredSlug,input.vehicleId,JSON.stringify(pathnames),
    input.primaryPhotoPathname,input.internalOnly,input.visibility,input.mediaVerified
  ]) as any[];
  if(rows.length!==1||!rows[0]||typeof rows[0]!=="object"||Array.isArray(rows[0]))throw Error("WDCC_VEHICLE_PUBLISH_RESULT_INVALID");
  const row=rows[0];
  if(typeof row.access_ok!=="boolean"||typeof row.vehicle_exists!=="boolean")throw Error("WDCC_VEHICLE_PUBLISH_RESULT_INVALID");
  if(!row.access_ok)return {outcome:"unauthorized"};
  if(!row.actor||typeof row.actor!=="object"||Array.isArray(row.actor))throw Error("WDCC_VEHICLE_PUBLISH_ACTOR_INVALID");
  const actorRow=row.actor as Record<string,unknown>;
  const actorId=clean(actorRow.id,80),actorEmail=clean(actorRow.email,320).toLowerCase();
  const actorRole=clean(actorRow.role,40).toLowerCase(),actorTenantId=clean(actorRow.tenantId,80);
  if(actorId!==input.subject.id||actorEmail!==email||actorRole!==role||actorTenantId!==input.subject.tenantId)return {outcome:"unauthorized"};
  if(!row.vehicle_exists)return {outcome:"not_found"};
  if(typeof row.current_status!=="string")throw Error("WDCC_VEHICLE_PUBLISH_RESULT_INVALID");
  const currentStatus=clean(row.current_status,40).toLowerCase();
  if(!["draft","published"].includes(currentStatus))return {outcome:"status_conflict",status:currentStatus||"unknown"};
  if(!input.mediaVerified)return {outcome:"media_unverified"};
  if(!row.vehicle)return {outcome:"status_conflict",status:"concurrent_change"};
  if(!row.vehicle||typeof row.vehicle!=="object"||Array.isArray(row.vehicle)||!Array.isArray(row.vehicle.media))throw Error("WDCC_VEHICLE_PUBLISH_VEHICLE_INVALID");
  const actor:PortalAccess={
    id:actorId,email:actorEmail||undefined,displayName:clean(actorRow.displayName,160)||undefined,
    role:actorRole as PortalAccess["role"],tenantId:actorTenantId,status:"active",banned:false
  };
  return {outcome:"published",actor,vehicle:vehicleFromRow(row.vehicle)};
}

export async function updateVehicle(id:string,changes:Record<string,unknown>,suppliedCurrent?:any){
  if(!isUuid(id))return null;
  await assertWddcSchemaReady();
  const current:any=suppliedCurrent&&String(suppliedCurrent.id)===id
    ?suppliedCurrent
    :await getVehicle(id,{includeNonPublic:true});
  if(!current)return null;
  const sets:string[]=[],values:any[]=[];
  const add=(column:string,value:any,cast="")=>{values.push(value);sets.push(`${column}=$${values.length}${cast}`);};
  const addNum=(column:string,value:unknown)=>{if(value!==undefined)add(column,Number(value));};
  const addText=(column:string,value:unknown,max:number)=>{if(value!==undefined)add(column,clean(value,max)||null);};

  addNum("year",changes.year);addText("make",changes.make,80);addText("model",changes.model,80);addText("trim",changes.trim,80);
  addNum("price",changes.price);addNum("down_payment",changes.downPayment);addNum("mileage",changes.mileage);
  if(changes.stock!==undefined){const stock=clean(changes.stock,80).toUpperCase();if(stock)add("stock_id",stock);}
  addText("vin",changes.vin,40);addText("body_style",changes.bodyStyle,60);addText("condition",changes.condition,60);
  addText("transmission",changes.transmission,60);addText("exterior_color",changes.exteriorColor,60);addText("interior_color",changes.interiorColor,60);
  addText("drivetrain",changes.drivetrain,60);addText("fuel_type",changes.fuelType,60);addText("description",changes.description,5000);
  if(changes.internalOnly!==undefined||changes.visibility!==undefined){
    const requestedVisibility=String(changes.visibility||"").toLowerCase();
    const internal=changes.internalOnly===true||requestedVisibility==="internal"||requestedVisibility==="dealer_only";
    add("internal_only",internal);add("visibility",internal?"internal":"public");
  }
  if(changes.status!==undefined){
    const status=String(changes.status||"").toLowerCase();
    if(!["draft","published","available","archived","quarantined","sold"].includes(status))throw Error("invalid_status");
    add("status",status);
  }
  if(Array.isArray(changes.photoPathnames)){
    const existing=array(current.media),requested=changes.photoPathnames.map(value=>clean(value,1000)).filter(Boolean),seen=new Set<string>();
    if(requested.length>10)throw Error("invalid_photo_count");
    const existingByPath=new Map(existing.map((item:any)=>[clean(item?.pathname||item?.url,1000),item]).filter(([key])=>Boolean(key)) as [string,any][]);
    const media=requested.filter(pathname=>{if(seen.has(pathname))return false;seen.add(pathname);return true;})
      .map(pathname=>existingByPath.get(pathname)||(http(pathname)?{url:pathname,source:"dealer"}:{pathname,source:"dealer"}));
    if(media.length>10)throw Error("invalid_photo_count");
    add("media",JSON.stringify(media),"::jsonb");
  }
  if(changes.primaryPhotoPathname!==undefined)add("primary_image_url",clean(changes.primaryPhotoPathname,1000)||null);
  if(!sets.length)return current;
  sets.push("updated_at=now()");
  values.push(id);const idParam=values.length;
  const dealerId=await canonicalDealerId();values.push(dealerId);const dealerParam=values.length;
  const rows=await db().query(`update public.vehicles set ${sets.join(",")} where id=$${idParam}::uuid and dealer_id=$${dealerParam}::uuid returning *`,values) as any[];
  return rows[0]?vehicleFromRow(rows[0]):null;
}

export async function recordVehicleEvent(input:{action:string;outcome:string;requestId:string;vehicleId?:string|null;actorId?:string|null;actorRole?:string|null;detail?:string|null;[key:string]:unknown}){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  const rows=await db().query(`
    insert into public.events(occurred_at,dealer_id,vehicle_id,event_name,metadata)
    values(now(),$1::uuid,$2::uuid,$3,$4::jsonb) returning id::text,occurred_at
  `,[dealerId,vehicleId,clean(input.action,100)||"vehicle.event",JSON.stringify({...input,vehicleId})]) as any[];
  return {id:rows?.[0]?.id||crypto.randomUUID(),at:rows?.[0]?.occurred_at?new Date(rows[0].occurred_at).toISOString():new Date().toISOString(),...input,vehicleId};
}

export async function recentVehicleEvents(max=100){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId(),limit=Math.max(1,Math.min(Number(max)||100,200));
  const rows=await db().query("select occurred_at,event_name,metadata from public.events where dealer_id=$1::uuid and event_name like 'vehicle.%' order by occurred_at desc limit $2",[dealerId,limit]) as any[];
  return rows.map(row=>({at:new Date(row.occurred_at).toISOString(),action:row.event_name,...object(row.metadata)}));
}

function outboxEmailState(status:string,payload:Record<string,any>,suppressed:boolean){
  const explicit=clean(object(payload.delivery).email,80);
  if(explicit)return explicit;
  if(suppressed)return "suppressed_qa";
  if(status==="delivered")return "sent";
  if(status==="processing")return "processing";
  if(status==="failed")return "failed";
  if(status==="dead_letter")return "dead_letter";
  return "queued";
}

export function leadFromRow(row:any){
  const metadata=object(row?.metadata);
  const outboxPayload=object(row?.outbox_payload);
  const outboxStatus=clean(row?.outbox_status,40)||null;
  const suppressed=Boolean(metadata.suppressed||metadata.qa||outboxPayload.suppressed);
  const email=outboxEmailState(outboxStatus||"pending",outboxPayload,suppressed);
  const status=clean(row.status,40)||"new";
  return {
    id:String(row.id),tenantId:String(row.dealer_id||""),dealerId:String(row.dealer_id||""),kind:clean(row.lead_kind,40)||"contact",
    name:clean(row.name,120),phone:clean(row.phone,40),email:clean(row.email,160).toLowerCase(),vehicleId:row.vehicle_id?String(row.vehicle_id):"",
    vehicleInterest:clean(row.vehicle_need,240),desiredVehicle:clean(row.vehicle_need,240),message:clean(row.message,2000),
    preferredTime:clean(row.preferred_time,120),source:clean(row.source_label,120),consent:Boolean(row.consent),status,pipelineStage:status,stage:status,
    monthlyIncome:numberOrNull(row.monthly_income),downPayment:numberOrNull(row.down_payment),referralSource:clean(row.referral_source,160),
    idempotencyKey:clean(row.idempotency_key,160),requestId:row.request_id?String(row.request_id):"",qa:suppressed,
    pagePath:clean(metadata.pagePath,240),referrer:clean(metadata.referrer,500),utmSource:clean(metadata.utmSource,120),
    utmMedium:clean(metadata.utmMedium,120),utmCampaign:clean(metadata.utmCampaign,160),utmContent:clean(metadata.utmContent,160),clickId:clean(metadata.clickId,220),
    metadata,outboxId:row.outbox_id?String(row.outbox_id):null,outboxStatus,
    notifications:{email,sms:"not_configured",webhook:"not_configured"},
    sync:{database:"saved",notifications:suppressed?"suppressed_qa":outboxStatus||"pending"},
    createdAt:row.created_at?new Date(row.created_at).toISOString():null,updatedAt:row.updated_at?new Date(row.updated_at).toISOString():null
  };
}

export type LeadCreateInput={
  kind:"schedule"|"contact"|"approval";name:string;phone?:string;email?:string;vehicleId?:string;vehicleInterest?:string;
  message?:string;preferredTime?:string;source?:string;idempotencyKey:string;requestId?:string;pagePath?:string;referrer?:string;
  utmSource?:string;utmMedium?:string;utmCampaign?:string;utmContent?:string;clickId?:string;suppressNotifications?:boolean;
  monthlyIncome?:number|null;downPayment?:number|null;referralSource?:string;clientIpHash?:string;
};

function leadIdempotencyFingerprint(input:LeadCreateInput){
  return crypto.createHash("sha256").update(JSON.stringify({
    kind:input.kind,name:clean(input.name,120),phone:clean(input.phone,40),email:clean(input.email,160).toLowerCase(),
    vehicleId:isUuid(input.vehicleId)?String(input.vehicleId):null,vehicleInterest:clean(input.vehicleInterest,240),
    message:clean(input.message,2000),preferredTime:clean(input.preferredTime,120),source:clean(input.source,120),
    pagePath:clean(input.pagePath,240),referrer:clean(input.referrer,500),utmSource:clean(input.utmSource,120),
    utmMedium:clean(input.utmMedium,120),utmCampaign:clean(input.utmCampaign,160),utmContent:clean(input.utmContent,160),
    clickId:clean(input.clickId,220),monthlyIncome:numberOrNull(input.monthlyIncome),downPayment:numberOrNull(input.downPayment),
    referralSource:clean(input.referralSource,160),suppressed:Boolean(input.suppressNotifications)
  })).digest("hex");
}

export async function createLead(input:LeadCreateInput){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const leadId=crypto.randomUUID();
  const requestId=isUuid(input.requestId)?String(input.requestId):crypto.randomUUID();
  const vehicleId=isUuid(input.vehicleId)?String(input.vehicleId):null;
  const key=clean(input.idempotencyKey,160);
  if(!key)throw Error("WDCC_IDEMPOTENCY_KEY_REQUIRED");
  const outboxKey=`lead:${key}:email:v1`;
  const suppressed=Boolean(input.suppressNotifications);
  const clientIpHash=clean(input.clientIpHash,128);
  if(!clientIpHash)throw Error("WDCC_LEAD_RATE_LIMITED");
  const fingerprint=leadIdempotencyFingerprint(input);
  const metadata=JSON.stringify({
    schemaVersion:"wdcc-lead-v3",kind:input.kind,source:clean(input.source,120),pagePath:clean(input.pagePath,240),
    referrer:clean(input.referrer,500),utmSource:clean(input.utmSource,120),utmMedium:clean(input.utmMedium,120),
    utmCampaign:clean(input.utmCampaign,160),utmContent:clean(input.utmContent,160),clickId:clean(input.clickId,220),
    desiredVehicle:clean(input.vehicleInterest,240),referralSource:clean(input.referralSource,160),qa:suppressed,suppressed,
    clientIpHash,idempotencyFingerprint:fingerprint
  });
  const rows=await db().query(`
    with rate_lock as (
      select pg_advisory_xact_lock(hashtextextended($27,0))
    ), rate_gate as (
      select
        exists(
          select 1 from public.leads
          where dealer_id=$2::uuid and idempotency_key=$12
        ) as duplicate,
        (
          select count(*) from public.leads
          where dealer_id=$2::uuid and metadata->>'clientIpHash'=$27
            and created_at>=now()-make_interval(mins=>$28::int)
        )<$29::int as under_limit
      from rate_lock
    ), persisted as (
      insert into public.leads(
        id,dealer_id,vehicle_id,name,phone,email,vehicle_need,status,message,preferred_time,source_label,consent,
        idempotency_key,lead_kind,request_id,monthly_income,down_payment,referral_source,metadata
      ) select
        $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,true,
        $12,$13,$14::uuid,$15,$16,$17,$18::jsonb
      from rate_gate where duplicate or under_limit
      on conflict (dealer_id,idempotency_key)
        where idempotency_key is not null and btrim(idempotency_key)<>''
      do update set idempotency_key=excluded.idempotency_key
      returning *,(id=$1::uuid) as was_created
    ), outbox as (
      insert into public.wdcc_outbox_events(
        dealer_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload,status,processed_at
      )
      select dealer_id,'lead',id,'lead.email.requested',$19,
             jsonb_build_object(
               'leadId',id,'kind',lead_kind,'suppressed',$20::boolean,
               'delivery',jsonb_build_object('email',case when $20::boolean then 'suppressed_qa' else 'queued' end)
             ),
             case when $20::boolean then 'delivered' else 'pending' end,
             case when $20::boolean then now() else null end
      from persisted where was_created
      on conflict(idempotency_key) do nothing
      returning id,status,payload
    ), event_insert as (
      insert into public.events(
        occurred_at,dealer_id,lead_id,vehicle_id,event_name,page_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,metadata
      )
      select now(),dealer_id,id,vehicle_id,'lead_created',$21,$22,$23,$24,$25,$26,$18::jsonb
      from persisted where was_created returning id
    ), consent_insert as (
      insert into public.consent_log(
        lead_id,consent_version,analytics_consent,marketing_consent,sms_consent,dealer_sharing_consent,recorded_at
      )
      select id,'wdcc-request-v3',false,false,true,true,now() from persisted where was_created returning id
    )
    select persisted.*,
      coalesce((select id::text from outbox limit 1),(select id::text from public.wdcc_outbox_events where idempotency_key=$19 limit 1)) as outbox_id,
      coalesce((select status from outbox limit 1),(select status from public.wdcc_outbox_events where idempotency_key=$19 limit 1)) as outbox_status,
      coalesce((select payload from outbox limit 1),(select payload from public.wdcc_outbox_events where idempotency_key=$19 limit 1)) as outbox_payload
    from persisted limit 1
  `,[
    leadId,dealerId,vehicleId,clean(input.name,120),clean(input.phone,40)||null,clean(input.email,160).toLowerCase()||null,
    clean(input.vehicleInterest,240)||null,suppressed?"test":"new",clean(input.message,2000)||null,clean(input.preferredTime,120)||null,
    clean(input.source,120)||"wedontcarecars.com",key,input.kind,requestId,numberOrNull(input.monthlyIncome),numberOrNull(input.downPayment),
    clean(input.referralSource,160)||null,metadata,outboxKey,suppressed,clean(input.pagePath,240)||null,clean(input.referrer,500)||null,
    clean(input.utmSource,120)||null,clean(input.utmMedium,120)||null,clean(input.utmCampaign,160)||null,clean(input.utmContent,160)||null,
    clientIpHash,10,10
  ]) as any[];
  const row=rows[0];
  if(!row)throw Error("WDCC_LEAD_RATE_LIMITED");
  const existingFingerprint=clean(object(row.metadata).idempotencyFingerprint,128);
  if(!Boolean(row.was_created)&&existingFingerprint!==fingerprint)throw Error("WDCC_IDEMPOTENCY_FINGERPRINT_MISMATCH");
  return {item:leadFromRow(row),created:Boolean(row.was_created),outboxId:row.outbox_id?String(row.outbox_id):null,suppressed};
}

const leadSelect=`
  select l.*,o.id::text as outbox_id,o.status as outbox_status,o.payload as outbox_payload
  from public.leads l
  left join lateral (
    select id,status,payload from public.wdcc_outbox_events
    where aggregate_type='lead' and aggregate_id=l.id
    order by created_at desc limit 1
  ) o on true
`;

export async function listLeads(options:{includeSuppressed?:boolean}={}){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const rows=await db().query(`${leadSelect} where l.dealer_id=$1::uuid order by l.updated_at desc,l.created_at desc`,[dealerId]) as any[];
  const leads=rows.map(leadFromRow);
  return options.includeSuppressed===false?leads.filter(lead=>!lead.qa):leads;
}

export type SignedDashboardBundleResult=
  |{outcome:"authorized";actor:PortalAccess;leads:any[];inventory:any[]}
  |{outcome:"unauthorized"};

const DASHBOARD_QUERY_TIMEOUTS_MS=Object.freeze([8_500,4_500] as const);
const DASHBOARD_RETRY_DELAY_MS=100;

function transientDashboardRead(error:unknown){
  const candidate=error as {name?:unknown;message?:unknown;sourceError?:{name?:unknown;message?:unknown}}|null;
  const source=candidate?.sourceError;
  const sourceName=String(source?.name||"");
  const errorName=String(candidate?.name||"");
  if([sourceName,errorName].some(name=>name==="AbortError"||name==="TimeoutError"))return true;
  if(source&&(sourceName==="TypeError"||/(?:fetch|network|socket|connect|econn|enotfound|timed?\s*out)/i.test(String(source.message||""))))return true;
  const status=Number(String(candidate?.message||"").match(/HTTP status (\d{3})/i)?.[1]||0);
  return status===429||(status>=500&&status<=599);
}

async function dashboardReadQuery(query:string,params:any[]){
  let lastError:unknown;
  for(let attempt=0;attempt<DASHBOARD_QUERY_TIMEOUTS_MS.length;attempt++){
    try{
      return await db().query(query,params,{fetchOptions:{signal:AbortSignal.timeout(DASHBOARD_QUERY_TIMEOUTS_MS[attempt])}}) as any[];
    }catch(error){
      lastError=error;
      if(attempt===DASHBOARD_QUERY_TIMEOUTS_MS.length-1||!transientDashboardRead(error))throw error;
      await new Promise(resolve=>setTimeout(resolve,DASHBOARD_RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

function dashboardAggregate(value:unknown,label:"leads"|"inventory"){
  if(!Array.isArray(value))throw Error(`WDCC_DASHBOARD_INVALID_${label.toUpperCase()}_AGGREGATE`);
  return value as any[];
}

export async function dashboardBundleForSignedSession(subject:{
  id:string;email:string;role:string;tenantId:string;
}):Promise<SignedDashboardBundleResult>{
  if(!isUuid(subject.id)||!isUuid(subject.tenantId))return {outcome:"unauthorized"};
  const role=clean(subject.role,40).toLowerCase();
  const email=clean(subject.email,320).toLowerCase();
  if(!email||(role!=="platform_admin"&&role!=="dealer_agent"))return {outcome:"unauthorized"};
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await dashboardReadQuery(`
    with default_dealer as (
      select d.id,d.slug
      from public.dealers d
      where d.id=$4::uuid and d.slug=$5 and d.status='active'
      order by d.created_at asc
      limit 1
    ), resolved_user as (
      select u.id,u.email,u.name
      from neon_auth."user" u
      where u.id=$1::uuid
        and lower(u.email)=lower($2)
        and (
          not coalesce(u.banned,false)
          or (u."banExpires" is not null and u."banExpires"<=now())
        )
      limit 1
    ), actor as (
      select candidates.id,candidates.email,candidates.name,candidates.role,candidates.tenant_id
      from (
        select u.id,u.email,u.name,'platform_admin'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        join public.user_access a
          on a.user_id=u.id and a.is_platform_admin=true and a.status='active'
        where $3='platform_admin'
        union all
        select u.id,u.email,u.name,'dealer_agent'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        left join public.user_access a on a.user_id=u.id
        where $3='dealer_agent'
          and (a.status is null or a.status='active')
          and not (coalesce(a.is_platform_admin,false) and a.status='active')
          and exists (
            select 1
            from public.dealer_memberships m
            join public.platform_roles r on r.id=m.role_id
            where m.user_id=u.id and m.dealer_id=d.id and m.status='active' and r.scope='dealer'
          )
      ) candidates
      limit 1
    ), lead_rows as materialized (
      select l.*,o.id::text as outbox_id,o.status as outbox_status,o.payload as outbox_payload
      from public.leads l
      join actor a on a.tenant_id=l.dealer_id
      left join lateral (
        select id,status,payload
        from public.wdcc_outbox_events
        where dealer_id=l.dealer_id and aggregate_type='lead' and aggregate_id=l.id
        order by created_at desc,id desc
        limit 1
      ) o on true
    ), vehicle_rows as materialized (
      select v.*
      from public.vehicles v
      join actor a on a.tenant_id=v.dealer_id
    )
    select
      exists(select 1 from actor) as access_ok,
      (select jsonb_build_object(
        'id',a.id::text,'email',a.email,'displayName',a.name,'role',a.role,
        'tenantId',a.tenant_id::text,'status','active','banned',false
      ) from actor a limit 1) as actor,
      coalesce((
        select jsonb_agg(to_jsonb(item) order by item.updated_at desc,item.created_at desc)
        from lead_rows item
      ),'[]'::jsonb) as leads,
      coalesce((
        select jsonb_agg(to_jsonb(item) order by item.updated_at desc,item.created_at desc)
        from vehicle_rows item
      ),'[]'::jsonb) as inventory
  `,[subject.id,email,role,subject.tenantId,preferredSlug]) as any[];
  const row=rows[0]||{};
  if(!row.access_ok)return {outcome:"unauthorized"};
  const actorRow=object(row.actor);
  const actorId=clean(actorRow.id,80),actorEmail=clean(actorRow.email,320).toLowerCase();
  const actorRole=actorRow.role==="platform_admin"?"platform_admin":"dealer_agent";
  const actorTenantId=clean(actorRow.tenantId,80);
  if(actorId!==subject.id||actorEmail!==email||actorRole!==role||actorTenantId!==subject.tenantId)return {outcome:"unauthorized"};
  const actor:PortalAccess={
    id:actorId,email:actorEmail||undefined,displayName:clean(actorRow.displayName,160)||undefined,
    role:actorRole,tenantId:actorTenantId,status:"active",banned:false
  };
  return {
    outcome:"authorized",actor,
    leads:dashboardAggregate(row.leads,"leads").map(leadFromRow),
    inventory:dashboardAggregate(row.inventory,"inventory").map(vehicleFromRow)
  };
}

export async function getLead(id:string){
  if(!isUuid(id))return null;
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const rows=await db().query(`${leadSelect} where l.id=$1::uuid and l.dealer_id=$2::uuid limit 1`,[id,dealerId]) as any[];
  return rows[0]?leadFromRow(rows[0]):null;
}

export const leadStages=["new","contacted","engaged","qualified","appointment","showed","deal_working","approved","sold","lost","nurture"] as const;
export type LeadStage=(typeof leadStages)[number];

export type SignedLeadStatusUpdateResult=
  |{outcome:"updated";actor:PortalAccess;lead:any}
  |{outcome:"unauthorized"}
  |{outcome:"not_found"};

export async function updateLeadStatusForSignedSession(input:{
  leadId:string;
  status:LeadStage;
  subject:{id:string;email:string;role:string;tenantId:string};
}):Promise<SignedLeadStatusUpdateResult>{
  if(!isUuid(input.leadId)||!isUuid(input.subject.id)||!isUuid(input.subject.tenantId))return {outcome:"unauthorized"};
  if(!(leadStages as readonly string[]).includes(input.status))throw Error("invalid_lead_status");
  const role=clean(input.subject.role,40).toLowerCase();
  const email=clean(input.subject.email,320).toLowerCase();
  if(!email||(role!=="platform_admin"&&role!=="dealer_agent"))return {outcome:"unauthorized"};
  const preferredSlug=(process.env.WDCC_DEALER_SLUG||"wedontcarecars").trim();
  const rows=await db().query(`
    with default_dealer as (
      select d.id,d.slug
      from public.dealers d
      where d.id=$4::uuid and d.slug=$5 and d.status='active'
      order by d.created_at asc
      limit 1
    ), resolved_user as (
      select u.id,u.email,u.name
      from neon_auth."user" u
      where u.id=$1::uuid
        and lower(u.email)=lower($2)
        and (
          not coalesce(u.banned,false)
          or (u."banExpires" is not null and u."banExpires"<=now())
        )
      limit 1
    ), actor as (
      select candidates.id,candidates.email,candidates.name,candidates.role,candidates.tenant_id
      from (
        select u.id,u.email,u.name,'platform_admin'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        join public.user_access a
          on a.user_id=u.id and a.is_platform_admin=true and a.status='active'
        where $3='platform_admin'
        union all
        select u.id,u.email,u.name,'dealer_agent'::text as role,d.id as tenant_id
        from resolved_user u
        join default_dealer d on true
        left join public.user_access a on a.user_id=u.id
        where $3='dealer_agent'
          and (a.status is null or a.status='active')
          and not (coalesce(a.is_platform_admin,false) and a.status='active')
          and exists (
            select 1
            from public.dealer_memberships m
            join public.platform_roles r on r.id=m.role_id
            where m.user_id=u.id and m.dealer_id=d.id and m.status='active'
          )
      ) candidates
      limit 1
    ), prior as (
      select l.id,l.status
      from public.leads l
      join actor a on a.tenant_id=l.dealer_id
      where l.id=$6::uuid
      for update of l
    ), updated as (
      update public.leads l set
        status=$7,
        dealer_first_response_at=case when prior.status='new' and $7<>'new' then coalesce(l.dealer_first_response_at,now()) else l.dealer_first_response_at end,
        appointment_status=case when $7='appointment' then 'scheduled' else l.appointment_status end,
        sale_status=case when $7='sold' then 'sold' when $7='lost' then 'lost' else l.sale_status end,
        updated_at=now()
      from prior
      where l.id=prior.id
      returning l.*,prior.status as previous_status
    ), event_insert as (
      insert into public.events(occurred_at,dealer_id,lead_id,event_name,metadata)
      select now(),updated.dealer_id,updated.id,'lead_status_changed',jsonb_build_object(
        'actorId',actor.id::text,'actorRole',actor.role,'to',$7,'from',updated.previous_status
      )
      from updated
      cross join actor
      returning id
    ), enriched as (
      select updated.*,o.id::text as outbox_id,o.status as outbox_status,o.payload as outbox_payload
      from updated
      left join lateral (
        select id,status,payload
        from public.wdcc_outbox_events
        where aggregate_type='lead' and aggregate_id=updated.id
        order by created_at desc
        limit 1
      ) o on true
    )
    select
      exists(select 1 from actor) as access_ok,
      exists(select 1 from prior) as lead_exists,
      (select jsonb_build_object(
        'id',a.id::text,'email',a.email,'displayName',a.name,'role',a.role,
        'tenantId',a.tenant_id::text,'status','active','banned',false
      ) from actor a limit 1) as actor,
      (select to_jsonb(saved) from enriched saved limit 1) as lead
  `,[input.subject.id,email,role,input.subject.tenantId,preferredSlug,input.leadId,input.status]) as any[];
  const row=rows[0]||{};
  if(!row.access_ok)return {outcome:"unauthorized"};
  if(!row.lead_exists||!row.lead)return {outcome:"not_found"};
  const actorRow=object(row.actor);
  const actor:PortalAccess={
    id:clean(actorRow.id,80),email:clean(actorRow.email,320).toLowerCase()||undefined,
    displayName:clean(actorRow.displayName,160)||undefined,role:actorRow.role==="platform_admin"?"platform_admin":"dealer_agent",
    tenantId:clean(actorRow.tenantId,80),status:"active",banned:false
  };
  return {outcome:"updated",actor,lead:leadFromRow(row.lead)};
}

export async function updateLeadStatus(id:string,status:LeadStage,actor:{id?:string;role?:string}={}){
  if(!isUuid(id))return null;
  if(!(leadStages as readonly string[]).includes(status))throw Error("invalid_lead_status");
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const metadata=JSON.stringify({actorId:clean(actor.id,160)||null,actorRole:clean(actor.role,80)||null,to:status});
  const rows=await db().query(`
    with prior as (
      select id,status from public.leads where id=$1::uuid and dealer_id=$2::uuid for update
    ), updated as (
      update public.leads l set
        status=$3,
        dealer_first_response_at=case when prior.status='new' and $3<>'new' then coalesce(l.dealer_first_response_at,now()) else l.dealer_first_response_at end,
        appointment_status=case when $3='appointment' then 'scheduled' else l.appointment_status end,
        sale_status=case when $3='sold' then 'sold' when $3='lost' then 'lost' else l.sale_status end,
        updated_at=now()
      from prior where l.id=prior.id
      returning l.id,prior.status as previous_status
    ), event_insert as (
      insert into public.events(occurred_at,dealer_id,lead_id,event_name,metadata)
      select now(),$2::uuid,id,'lead_status_changed',$4::jsonb||jsonb_build_object('from',previous_status)
      from updated returning id
    )
    select id::text from updated
  `,[id,dealerId,status,metadata]) as any[];
  if(!rows[0])return null;
  return getLead(id);
}

export function isProductionRuntime(){
  const wdcc=String(process.env.WDCC_ENVIRONMENT||"").toLowerCase();
  if(["e2e","test","development"].includes(wdcc))return false;
  const vercel=String(process.env.VERCEL_ENV||"").toLowerCase();
  if(vercel)return vercel==="production";
  const railway=String(process.env.RAILWAY_ENVIRONMENT_NAME||"").toLowerCase();
  if(railway)return railway==="production";
  return wdcc==="production"||String(process.env.NODE_ENV||"").toLowerCase()==="production";
}

function resendBaseUrl(){
  const canonical="https://api.resend.com";
  const configured=clean(process.env.RESEND_API_BASE_URL,500).replace(/\/$/,"")||canonical;
  if(configured===canonical)return canonical;
  if(isProductionRuntime())throw Error("RESEND_API_BASE_URL_OVERRIDE_FORBIDDEN");
  let parsed:URL;
  try{parsed=new URL(configured);}catch{throw Error("RESEND_API_BASE_URL_INVALID");}
  const loopback=parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1"||parsed.hostname==="::1";
  if(!loopback||!["http:","https:"].includes(parsed.protocol))throw Error("RESEND_API_BASE_URL_OVERRIDE_NOT_LOOPBACK");
  return parsed.origin+parsed.pathname.replace(/\/$/,"");
}

export function leadEmailReadiness(){
  const apiKey=clean(process.env.RESEND_API_KEY,500);
  const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"").split(",").map(value=>value.trim()).filter(Boolean);
  const from=clean(process.env.WDCC_LEAD_FROM_EMAIL,320);
  try{
    const baseUrl=resendBaseUrl();
    const configured=Boolean(apiKey&&recipients.length&&from);
    return {configured,apiKey:Boolean(apiKey),recipients:recipients.length,from:Boolean(from),baseUrl,override:baseUrl!=="https://api.resend.com",reason:configured?null:"email_configuration_incomplete"};
  }catch(error){
    return {configured:false,apiKey:Boolean(apiKey),recipients:recipients.length,from:Boolean(from),baseUrl:null,override:true,reason:error instanceof Error?error.message:"email_base_url_invalid"};
  }
}

function notificationText(lead:any){
  return [
    `New WDCC ${lead.kind} lead`,`Name: ${lead.name}`,`Phone: ${lead.phone||"Not provided"}`,`Email: ${lead.email||"Not provided"}`,
    `Vehicle: ${lead.vehicleInterest||lead.vehicleId||"Not specified"}`,
    lead.monthlyIncome!=null?`Monthly income: $${Number(lead.monthlyIncome).toLocaleString()}`:"",
    lead.downPayment!=null?`Down payment: $${Number(lead.downPayment).toLocaleString()}`:"",
    lead.referralSource?`Referral source: ${lead.referralSource}`:"",
    `Source: ${lead.source||"Unknown"}`,`Preferred time: ${lead.preferredTime||"Not provided"}`,`Message: ${lead.message||"None"}`,`Lead ID: ${lead.id}`
  ].filter(Boolean).join("\n");
}

export async function processLeadOutbox(outboxId:string){
  if(!isUuid(outboxId))return {processed:false,status:"invalid_outbox_id",attempts:0,notifications:{email:"not_configured",sms:"not_configured",webhook:"not_configured"}};
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const readiness=leadEmailReadiness();
  if(!readiness.configured){
    await db().query(`
      update public.wdcc_outbox_events set
        status='pending',payload=payload||$3::jsonb,last_error=$4,available_at=now()+interval '5 minutes',updated_at=now()
      where id=$1::uuid and dealer_id=$2::uuid and aggregate_type='lead'
        and (status in ('pending','failed') or (status='processing' and updated_at<now()-interval '5 minutes'))
    `,[outboxId,dealerId,JSON.stringify({delivery:{email:"not_configured"}}),readiness.reason||"email_not_configured"]);
    return {processed:false,status:"pending",attempts:0,notifications:{email:"not_configured",sms:"not_configured",webhook:"not_configured"},error:readiness.reason};
  }

  const claimed=await db().query(`
    update public.wdcc_outbox_events set status='processing',attempts=attempts+1,updated_at=now()
    where id=$1::uuid and dealer_id=$2::uuid and aggregate_type='lead' and event_type='lead.email.requested'
      and (status in ('pending','failed') or (status='processing' and updated_at<now()-interval '5 minutes'))
      and available_at<=now()
    returning *
  `,[outboxId,dealerId]) as any[];
  if(!claimed[0]){
    const current=await db().query("select status,attempts,last_error,payload from public.wdcc_outbox_events where id=$1::uuid and dealer_id=$2::uuid",[outboxId,dealerId]) as any[];
    const row=current[0],delivery=object(object(row?.payload).delivery);
    return {processed:false,status:row?.status||"not_found",attempts:Number(row?.attempts||0),notifications:{email:clean(delivery.email,80)||"queued",sms:"not_configured",webhook:"not_configured"},error:row?.last_error||null};
  }

  const event=claimed[0];
  const lead=await getLead(String(event.aggregate_id));
  if(!lead){
    await db().query("update public.wdcc_outbox_events set status='dead_letter',last_error='lead_not_found',processed_at=now(),updated_at=now() where id=$1::uuid and dealer_id=$2::uuid",[outboxId,dealerId]);
    return {processed:true,status:"dead_letter",attempts:Number(event.attempts||1),notifications:{email:"dead_letter",sms:"not_configured",webhook:"not_configured"},error:"lead_not_found"};
  }

  const recipients=(process.env.WDCC_LEAD_NOTIFICATION_EMAILS||"").split(",").map(value=>value.trim()).filter(Boolean);
  const attempts=Number(event.attempts||1);
  let email="failed",providerId:string|null=null,errorMessage:string|null=null;
  try{
    const response=await fetch(`${resendBaseUrl()}/emails`,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${String(process.env.RESEND_API_KEY)}`,
        "Content-Type":"application/json",
        "Idempotency-Key":String(event.idempotency_key)
      },
      body:JSON.stringify({
        from:String(process.env.WDCC_LEAD_FROM_EMAIL),to:recipients,
        subject:`New WDCC ${lead.kind} lead: ${lead.name}`,text:notificationText(lead)
      }),
      signal:AbortSignal.timeout(8000)
    });
    const result=await response.json().catch(()=>({}));
    if(response.ok){email="sent";providerId=clean(result?.id,160)||null;}
    else{email=`failed_${response.status}`;errorMessage=`email_${response.status}`;}
  }catch(error){
    email="failed";errorMessage=`email_${error instanceof Error?error.name:"error"}`;
  }

  const delivered=email==="sent",status=delivered?"delivered":attempts>=8?"dead_letter":"failed";
  await db().query(`
    update public.wdcc_outbox_events set
      status=$2,payload=payload||$3::jsonb,last_error=$4,
      processed_at=case when $2 in ('delivered','dead_letter') then now() else processed_at end,
      available_at=case when $2='failed' then now()+make_interval(secs=>least(3600,greatest(30,attempts*60))) else available_at end,
      updated_at=now()
    where id=$1::uuid and dealer_id=$5::uuid
  `,[outboxId,status,JSON.stringify({delivery:{email},providerId,lastAttemptAt:new Date().toISOString()}),errorMessage,dealerId]);
  return {processed:true,status,attempts,notifications:{email,sms:"not_configured",webhook:"not_configured"},providerId,error:errorMessage};
}

export async function processDueLeadOutbox(limit=5){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const wanted=Math.max(1,Math.min(Number(limit)||5,20));
  const rows=await db().query(`
    select id::text from public.wdcc_outbox_events
    where dealer_id=$1::uuid and aggregate_type='lead' and event_type='lead.email.requested'
      and (status in ('pending','failed') or (status='processing' and updated_at<now()-interval '5 minutes'))
      and available_at<=now()
    order by available_at,created_at limit $2
  `,[dealerId,wanted]) as any[];
  const results=[];
  for(const row of rows)results.push(await processLeadOutbox(String(row.id)));
  return results;
}

export async function databaseHealth(){
  await assertWddcSchemaReady();
  const dealerId=await canonicalDealerId();
  const rows=await db().query(`
    select
      (select count(*)::int from public.vehicles where dealer_id=$1::uuid) as vehicles,
      (select count(*)::int from public.leads where dealer_id=$1::uuid) as leads,
      (select count(*)::int from public.wdcc_outbox_events where dealer_id=$1::uuid and status in ('pending','failed')) as pending_outbox,
      (select count(*)::int from public.wdcc_outbox_events where dealer_id=$1::uuid and status='processing' and updated_at<now()-interval '5 minutes') as stale_outbox,
      (select count(*)::int from public.wdcc_outbox_events where dealer_id=$1::uuid and status='dead_letter') as dead_letter_outbox,
      current_setting('neon.branch_id',true) as branch_id,
      current_setting('neon.project_id',true) as project_id,
      current_setting('neon.endpoint_id',true) as endpoint_id,
      current_database() as database_name
  `,[dealerId]) as any[];
  const row=rows?.[0]||{};
  return {
    dealerId,vehicles:Number(row.vehicles||0),leads:Number(row.leads||0),pendingOutbox:Number(row.pending_outbox||0),
    staleOutbox:Number(row.stale_outbox||0),deadLetterOutbox:Number(row.dead_letter_outbox||0),
    identity:{...databaseIdentity(),branchId:clean(row.branch_id,160)||databaseIdentity().branchId,projectId:clean(row.project_id,160)||null,endpointId:clean(row.endpoint_id,160)||null,database:clean(row.database_name,160)||databaseIdentity().database}
  };
}
