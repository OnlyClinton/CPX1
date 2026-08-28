import assert from "node:assert/strict";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";
import {neon} from "@neondatabase/serverless";
import {chromium} from "playwright";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT=path.resolve(HERE,"../..");
const RUN_ID=crypto.randomUUID();
const SHORT_ID=RUN_ID.replaceAll("-","").slice(0,10);
const STOCK=`E2E-${SHORT_ID.toUpperCase()}`;
const MODEL=`Launch ${SHORT_ID}`;
const ARTIFACT_DIR=path.resolve(process.env.WDCC_E2E_ARTIFACT_DIR||path.join("/tmp",`wdcc-launch-readiness-${SHORT_ID}`));
const DATABASE_URL=required("WDCC_DATABASE_URL");
const EXPECTED_BRANCH=required("WDCC_EXPECTED_NEON_BRANCH_ID");
const EXPECTED_PROJECT=required("WDCC_EXPECTED_NEON_PROJECT_ID");
const EXPECTED_ENDPOINT=required("WDCC_EXPECTED_NEON_ENDPOINT_ID");
const PRODUCTION_BRANCH=required("WDCC_PRODUCTION_NEON_BRANCH_ID");
const AUTH_BASE=required("WDCC_NEON_AUTH_URL");
const AUTH_ORIGIN=String(process.env.WDCC_E2E_AUTH_ORIGIN||"https://wdcc-cpx-launch-cpxagency.vercel.app").trim();
const AUTH_IDENTITIES={
  dealer:{alias:"dealer",email:`wdcc-e2e-dealer-${SHORT_ID}@example.com`,password:`WDCC!d9${crypto.randomBytes(30).toString("base64url")}`,name:`WDCC E2E Dealer ${SHORT_ID}`,role:"dealer_agent"},
  admin:{alias:"admin",email:`wdcc-e2e-admin-${SHORT_ID}@example.com`,password:`WDCC!a9${crypto.randomBytes(30).toString("base64url")}`,name:`WDCC E2E Admin ${SHORT_ID}`,role:"platform_admin"}
};
const APP_MODE=process.env.WDCC_E2E_APP_MODE||"dev";
const EMAIL_RECIPIENT="dealer-launch-proof@example.test";
const MEDIA_DIR=path.join("/tmp",`wdcc-e2e-media-${SHORT_ID}`);
const APP_SANDBOX_DIR=path.join("/tmp",`wdcc-e2e-app-${SHORT_ID}`);
const CRON_SECRET=crypto.randomBytes(48).toString("base64url");
const TRANSPORT_TIMEOUT_MS=60_000;
const MUTATION_BUDGET_MS=20_000;
const READ_BUDGET_MS=15_000;
const IDEMPOTENCY={
  schedule:`launch-schedule-${RUN_ID}`,
  approval:`launch-approval-${RUN_ID}`,
  contact:`launch-contact-${RUN_ID}`
};
const LEAD_EMAILS={
  schedule:`schedule-${SHORT_ID}@example.com`,
  approval:`approval-${SHORT_ID}@example.com`,
  contact:`contact-${SHORT_ID}@example.com`
};

const sql=neon(DATABASE_URL);
const captures=[];
const created={vehicleId:null,leadIds:[],authSessionIds:[],authUserIds:[],dealerMembershipIds:[]};
const report={
  runId:RUN_ID,
  startedAt:new Date().toISOString(),
  projectId:EXPECTED_PROJECT,
  branchId:EXPECTED_BRANCH,
  endpointId:EXPECTED_ENDPOINT,
  productionBranchId:PRODUCTION_BRANCH,
  safety:{branchVerified:false,authEndpointVerified:false,productionWritesAllowed:false,mockupFlags:false,recoveryFlags:false,cleanupVerified:false},
  proofs:[],
  timings:[],
  synthetic:{stock:STOCK,model:MODEL,authEmails:Object.values(AUTH_IDENTITIES).map(identity=>identity.email)},
  email:{captured:0,recipient:EMAIL_RECIPIENT},
  artifacts:{},
  ok:false
};

let appProcess=null;
let mockServer=null;
let browser=null;
let appLogs="";
let branchVerified=false;
let authBaselineIds=new Set();

function required(name){
  const value=String(process.env[name]||"").trim();
  if(!value)throw Error(`REQUIRED_ENV_MISSING:${name}`);
  return value;
}

function record(name,evidence){
  report.proofs.push({name,status:"passed",evidence});
  console.log(`[pass] ${name}`);
}

function flagEnabled(name){
  const value=String(process.env[name]||"").trim().toLowerCase();
  return value!==""&&!['0','false','off','no'].includes(value);
}

function recursiveItem(value,id,seen=new Set()){
  if(!value||typeof value!=="object"||seen.has(value))return null;
  seen.add(value);
  if(String(value.id||value.vehicleId||value.leadId||"")===String(id))return value;
  for(const child of Array.isArray(value)?value:Object.values(value)){
    const match=recursiveItem(child,id,seen);
    if(match)return match;
  }
  return null;
}

function dashboardLeadEvidence(body,expectedIds){
  const leads=Array.isArray(body?.leads)?body.leads:[];
  const states=leads.reduce((counts,lead)=>{
    const key=`${String(lead?.kind||"unknown")}:${String(lead?.status||lead?.pipelineStage||"unknown")}:${lead?.qa===true?"qa":"operational"}`;
    counts[key]=(counts[key]||0)+1;
    return counts;
  },{});
  return {
    parsed:Boolean(body&&typeof body==="object"),
    ok:body?.ok===true,
    source:String(body?.source||"missing"),
    bodyKeys:body&&typeof body==="object"?Object.keys(body).sort():[],
    returnedCount:leads.length,
    expected:expectedIds.map(id=>{
      const lead=leads.find(candidate=>String(candidate?.id||"")===String(id));
      return {id:String(id),present:Boolean(lead),kind:String(lead?.kind||"missing"),status:String(lead?.status||lead?.pipelineStage||"missing"),qa:lead?.qa===true};
    }),
    states,
    visibility:body?.leadVisibility||null
  };
}

function authority(response,label){
  const headers=response.headers();
  assert.equal(headers["x-wdcc-data-authority"],"neon",`${label} must declare Neon authority`);
  assert.equal(headers["x-wdcc-mockup-preview"],undefined,`${label} used mockup inventory`);
  assert.equal(headers["x-wdcc-visual-proof-mode"],undefined,`${label} used visual fallback`);
  assert.notEqual(headers["x-wdcc-inventory-source"],"verified-recovery-readonly",`${label} used recovery inventory`);
}

async function api(context,method,pathname,{data,headers={},expected,label=pathname,requireAuthority=false}={}){
  const started=performance.now();
  const response=await context.request.fetch(new URL(pathname,appBase).toString(),{
    method,
    data,
    headers:{"cache-control":"no-store",...headers},
    failOnStatusCode:false,
    timeout:TRANSPORT_TIMEOUT_MS
  });
  const durationMs=Math.round(performance.now()-started);
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  const expectedStatuses=Array.isArray(expected)?expected:[expected];
  assert.ok(expectedStatuses.includes(response.status()),`${label}: expected HTTP ${expectedStatuses.join("/")}, received ${response.status()} (${text.slice(0,300)})`);
  if(requireAuthority)authority(response,label);
  return {response,body,text,durationMs};
}

function launchBudget(label,result,budgetMs){
  const durationMs=Number(result?.durationMs);
  assert.ok(Number.isFinite(durationMs),`${label} timing missing`);
  report.timings.push({label,durationMs,budgetMs});
  assert.ok(durationMs<=budgetMs,`${label} exceeded launch budget: ${durationMs}ms > ${budgetMs}ms`);
  return durationMs;
}

async function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.unref();
    server.on("error",reject);
    server.listen(0,"127.0.0.1",()=>{
      const address=server.address();
      server.close(error=>error?reject(error):resolve(address.port));
    });
  });
}

async function listen(server){
  return new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",()=>resolve(server.address().port));
  });
}

async function closeServer(server){
  if(!server)return;
  await new Promise(resolve=>server.close(()=>resolve()));
}

async function waitForApp(url,timeoutMs=60_000){
  const deadline=Date.now()+timeoutMs;
  let lastError="not started";
  while(Date.now()<deadline){
    if(appProcess?.exitCode!==null)throw Error(`APP_EXITED_EARLY:${appProcess.exitCode}\n${appLogs.slice(-4_000)}`);
    try{
      const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(2_500)});
      const text=await response.text();
      if(response.status===200)return {status:response.status,text};
      lastError=`HTTP ${response.status}: ${text.slice(0,500)}`;
    }catch(error){lastError=error instanceof Error?error.message:String(error);}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  throw Error(`APP_START_TIMEOUT:${lastError}\n${appLogs.slice(-4_000)}`);
}

async function waitFor(predicate,timeoutMs=5_000){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}
  throw Error("WAIT_CONDITION_TIMEOUT");
}

async function verifySafety(){
  for(const name of ["WDCC_MOCKUP_PREVIEW","WDCC_VISUAL_PROOF_FALLBACK"]){
    assert.equal(flagEnabled(name),false,`${name} must be disabled for launch proof`);
  }
  for(const name of ["WDCC_RECOVERY_INVENTORY","WDCC_RECOVERY_MODE","WDCC_ALLOW_RECOVERY_WRITES"]){
    assert.equal(flagEnabled(name),false,`${name} must be disabled for launch proof`);
  }
  assert.match(EXPECTED_BRANCH,/^br-[a-z0-9-]+$/,"Expected branch ID is malformed");
  assert.notEqual(EXPECTED_BRANCH,PRODUCTION_BRANCH,"E2E branch must not be the production branch");
  assert.match(EXPECTED_ENDPOINT,/^ep-[a-z0-9-]+$/,"Expected endpoint ID is malformed");

  const [identity]=await sql.query("select current_setting('neon.branch_id',true) as branch_id,current_setting('neon.project_id',true) as project_id,current_setting('neon.endpoint_id',true) as endpoint_id,current_database() as database_name");
  assert.equal(identity?.branch_id,EXPECTED_BRANCH,"Database URL does not point to the expected isolated branch");
  assert.equal(identity?.project_id,EXPECTED_PROJECT,"Database URL does not point to the expected project");
  assert.equal(identity?.endpoint_id,EXPECTED_ENDPOINT,"Database URL does not point to the expected isolated endpoint");
  branchVerified=true;
  report.safety.branchVerified=true;

  const authUrl=new URL(AUTH_BASE);
  assert.equal(authUrl.protocol,"https:","Neon Auth URL must use HTTPS");
  assert.ok(authUrl.hostname.startsWith(`${EXPECTED_ENDPOINT}.neonauth.`),"Neon Auth URL is not owned by the isolated branch endpoint");
  assert.ok(authUrl.hostname.endsWith(".neon.tech"),"Neon Auth URL must be an official Neon hostname");
  assert.equal(authUrl.pathname,`/${identity.database_name}/auth`,"Neon Auth URL database/path mismatch");
  report.safety.authEndpointVerified=true;

  const authOrigin=new URL(AUTH_ORIGIN);
  const localOrigin=authOrigin.protocol==="http:"&&["localhost","127.0.0.1"].includes(authOrigin.hostname);
  const trustedDeploymentOrigin=authOrigin.origin==="https://wdcc-cpx-launch-cpxagency.vercel.app";
  assert.ok(localOrigin||trustedDeploymentOrigin,"Auth signup Origin must be the configured trusted deployment or localhost");

  const requiredColumns=await sql.query(`select table_name,column_name from information_schema.columns where table_schema='public' and ((table_name='vehicles' and column_name=any($1::text[])) or (table_name='leads' and column_name=any($2::text[])))`,[
    ["condition","exterior_color","interior_color","drivetrain","description","visibility","internal_only","created_by","upload_source"],
    ["monthly_income","down_payment","referral_source","metadata"]
  ]);
  const found=new Set(requiredColumns.map(row=>`${row.table_name}.${row.column_name}`));
  for(const column of ["condition","exterior_color","interior_color","drivetrain","description","visibility","internal_only","created_by","upload_source"]){
    assert.ok(found.has(`vehicles.${column}`),`Required migration missing vehicles.${column}`);
  }
  for(const column of ["monthly_income","down_payment","referral_source","metadata"]){
    assert.ok(found.has(`leads.${column}`),`Required migration missing leads.${column}`);
  }

  const [schemaContract]=await sql.query(`
    with required_outbox_columns(column_name,udt_name,not_null) as (
      values
        ('id','uuid',true),('dealer_id','uuid',true),('aggregate_type','text',true),
        ('aggregate_id','uuid',true),('event_type','text',true),('idempotency_key','text',true),
        ('payload','jsonb',true),('status','text',true),('attempts','int4',true),
        ('available_at','timestamptz',true),('created_at','timestamptz',true),
        ('updated_at','timestamptz',true),('processed_at','timestamptz',false),('last_error','text',false)
    )
    select
      (select count(*)::int from required_outbox_columns required
       join information_schema.columns actual
         on actual.table_schema='public' and actual.table_name='wdcc_outbox_events'
        and actual.column_name=required.column_name and actual.udt_name=required.udt_name
        and (not required.not_null or actual.is_nullable='NO'))
        =(select count(*) from required_outbox_columns) as outbox_columns,
      (select count(*)::int from information_schema.columns
       where table_schema='public' and table_name='wdcc_outbox_events'
         and column_name=any(array['id','payload','status','attempts','available_at','created_at','updated_at']::text[])
         and column_default is not null)=7 as outbox_defaults,
      (select count(*)::int
       from pg_class index_relation
       join pg_namespace index_namespace on index_namespace.oid=index_relation.relnamespace
       join pg_index index_state on index_state.indexrelid=index_relation.oid
       where index_namespace.nspname='public' and index_state.indisvalid and index_state.indisready
         and ((index_relation.relname='wdcc_leads_dealer_idempotency_uidx' and index_state.indisunique)
           or (index_relation.relname='wdcc_outbox_events_idempotency_uidx' and index_state.indisunique)
           or index_relation.relname='wdcc_outbox_events_aggregate_created_idx'))=3 as required_indexes,
      (select count(*)::int from pg_constraint constraint_state
       join pg_namespace constraint_namespace on constraint_namespace.oid=constraint_state.connamespace
       where constraint_namespace.nspname='public' and constraint_state.convalidated
         and constraint_state.conname=any(array['wdcc_vehicles_visibility_check','wdcc_leads_monthly_income_check','wdcc_leads_down_payment_check','wdcc_outbox_status_check_v1']::text[]))=4
        as validated_checks,
      exists(select 1 from pg_constraint where conrelid='public.wdcc_outbox_events'::regclass and contype='p' and convalidated)
        as outbox_primary_key,
      exists(
        select 1 from pg_constraint constraint_state
        join pg_attribute local_column
          on local_column.attrelid=constraint_state.conrelid and local_column.attname='dealer_id'
         and local_column.attnum=any(constraint_state.conkey)
        join pg_attribute foreign_column
          on foreign_column.attrelid=constraint_state.confrelid and foreign_column.attname='id'
         and foreign_column.attnum=any(constraint_state.confkey)
        where constraint_state.conrelid='public.wdcc_outbox_events'::regclass
          and constraint_state.confrelid='public.dealers'::regclass
          and constraint_state.contype='f' and constraint_state.convalidated
      ) as outbox_dealer_fk,
      exists(
        select 1 from pg_trigger trigger_state
        join pg_proc trigger_function on trigger_function.oid=trigger_state.tgfoid
        join pg_namespace function_namespace on function_namespace.oid=trigger_function.pronamespace
        where trigger_state.tgrelid='public.leads'::regclass
          and not trigger_state.tgisinternal and trigger_state.tgenabled<>'D'
          and function_namespace.nspname='public' and trigger_function.proname='wdcc_bind_lead_defaults'
          and position('tenant_bound_app_qa' in pg_get_functiondef(trigger_function.oid))>0
      ) as lead_defaults_trigger
  `);
  assert.deepEqual(schemaContract,{
    outbox_columns:true,outbox_defaults:true,required_indexes:true,validated_checks:true,
    outbox_primary_key:true,outbox_dealer_fk:true,lead_defaults_trigger:true
  },"Required WDCC schema/index/constraint/trigger contract is incomplete");

  const dirty=await sql.query("select (select count(*)::int from public.vehicles where stock_id=$1) as vehicles,(select count(*)::int from public.leads where idempotency_key=any($2::text[])) as leads",[STOCK,Object.values(IDEMPOTENCY)]);
  assert.deepEqual(dirty?.[0],{vehicles:0,leads:0},"Synthetic identifiers already exist on isolated branch");
  const syntheticEmails=Object.values(AUTH_IDENTITIES).map(candidate=>candidate.email);
  const authDirty=await sql.query(`select count(*)::int as count from neon_auth."user" where lower(email)=any($1::text[])`,[syntheticEmails]);
  assert.equal(authDirty?.[0]?.count,0,"Synthetic Auth identities already exist on isolated branch");
  record("isolated Neon branch and Auth endpoint",{branchId:EXPECTED_BRANCH,projectId:EXPECTED_PROJECT,endpointId:EXPECTED_ENDPOINT,productionBranchId:PRODUCTION_BRANCH});
}

async function signUpIdentity(identity){
  const response=await fetch(`${AUTH_BASE.replace(/\/$/,"")}/sign-up/email`,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","origin":AUTH_ORIGIN,"referer":`${AUTH_ORIGIN}/`},
    body:JSON.stringify({name:identity.name,email:identity.email,password:identity.password}),
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12_000)
  });
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  assert.ok(response.ok,`Neon Auth signup failed for ${identity.alias}: HTTP ${response.status} (${text.slice(0,300)})`);
  const userId=String(body?.user?.id||"");
  const email=String(body?.user?.email||"").trim().toLowerCase();
  assert.match(userId,/^[0-9a-f-]{36}$/i,`${identity.alias} signup did not return a user ID`);
  assert.equal(email,identity.email,`${identity.alias} signup returned the wrong email`);
  created.authUserIds.push(userId);
  return userId;
}

async function provisionAuthIdentities(){
  const dealerId=await signUpIdentity(AUTH_IDENTITIES.dealer);
  const adminId=await signUpIdentity(AUTH_IDENTITIES.admin);

  const users=await sql.query(`
    select u.id::text as id,lower(u.email) as email,u.banned,
           count(distinct a.id)::int as accounts,count(distinct s.id)::int as sessions
    from neon_auth."user" u
    left join neon_auth.account a on a."userId"=u.id
    left join neon_auth.session s on s."userId"=u.id
    where u.id=any($1::uuid[])
    group by u.id,u.email,u.banned
    order by lower(u.email)
  `,[[dealerId,adminId]]);
  assert.equal(users.length,2,"Both synthetic Auth identities must persist on the isolated branch");
  for(const identity of Object.values(AUTH_IDENTITIES)){
    const row=users.find(candidate=>candidate.email===identity.email);
    assert.ok(row,`${identity.alias} Auth user missing from isolated branch`);
    assert.equal(Boolean(row.banned),false,`${identity.alias} Auth user unexpectedly banned`);
    assert.equal(row.accounts,1,`${identity.alias} must have exactly one credential account`);
    assert.ok(row.sessions>=1,`${identity.alias} signup session missing`);
  }

  const adminAccess=await sql.query(`
    insert into public.user_access(user_id,platform_role_id,is_platform_admin,status,must_change_password,mfa_required)
    select $1::uuid,r.id,true,'active',false,false
    from public.platform_roles r
    where r.role_key='platform_admin' and r.scope='platform'
    returning user_id::text as user_id,platform_role_id::text as role_id,is_platform_admin,status
  `,[adminId]);
  assert.equal(adminAccess.length,1,"platform_admin role is missing or admin access insert failed");
  assert.equal(adminAccess[0].is_platform_admin,true,"Admin access must be platform-admin enabled");
  assert.equal(adminAccess[0].status,"active","Admin access must be active");

  const membership=await sql.query(`
    insert into public.dealer_memberships(dealer_id,user_id,role_id,status,can_create_subusers,permission_overrides)
    select d.id,$1::uuid,r.id,'active',false,'{}'::jsonb
    from public.dealers d
    cross join public.platform_roles r
    where d.slug='wedontcarecars' and d.status='active'
      and r.role_key='dealer_manager' and r.scope='dealer'
    returning id::text as id,dealer_id::text as dealer_id,user_id::text as user_id,role_id::text as role_id,status
  `,[dealerId]);
  assert.equal(membership.length,1,"Active WDCC dealer/dealer_manager role is missing or membership insert failed");
  assert.equal(membership[0].status,"active","Dealer membership must be active");
  created.dealerMembershipIds.push(membership[0].id);

  const signupSessions=await sql.query(`select id::text as id from neon_auth.session where "userId"=any($1::uuid[])`,[[dealerId,adminId]]);
  authBaselineIds=new Set(signupSessions.map(row=>row.id));
  assert.ok(authBaselineIds.size>=2,"Auth signup session baseline is incomplete");
  record("self-provisioned isolated Auth identities and portal access",{authUsers:created.authUserIds.length,signupSessions:authBaselineIds.size,dealerRole:"dealer_manager",adminRole:"platform_admin"});
}

function createMockResend(){
  return http.createServer(async(request,response)=>{
    const url=new URL(request.url||"/","http://127.0.0.1");
    if(request.method==="POST"&&url.pathname==="/emails"){
      const chunks=[];
      for await(const chunk of request)chunks.push(chunk);
      const raw=Buffer.concat(chunks).toString("utf8");
      let body=null;
      try{body=JSON.parse(raw);}catch{}
      captures.push({at:new Date().toISOString(),authorization:request.headers.authorization||null,idempotencyKey:request.headers["idempotency-key"]||null,body});
      response.writeHead(200,{"content-type":"application/json"});
      response.end(JSON.stringify({id:`mock-email-${captures.length}`}));
      return;
    }
    if(request.method==="GET"&&url.pathname==="/media/proof.svg"){
      response.writeHead(200,{"content-type":"image/svg+xml","cache-control":"no-store"});
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#061521"/><text x="600" y="338" fill="#fff" text-anchor="middle" font-family="sans-serif" font-size="58">WDCC launch proof</text></svg>');
      return;
    }
    response.writeHead(404,{"content-type":"application/json"});
    response.end('{"error":"not_found"}');
  });
}

let appBase="";
let mockBase="";

async function prepareAppSandbox(){
  assert.equal(APP_MODE,"dev","Launch proof must use Next dev so isolated filesystem media capture cannot be mistaken for production storage");
  assert.ok(APP_SANDBOX_DIR.startsWith("/tmp/wdcc-e2e-app-"),"Unsafe E2E app sandbox path");
  await fs.rm(APP_SANDBOX_DIR,{recursive:true,force:true});
  await fs.cp(PROJECT_ROOT,APP_SANDBOX_DIR,{
    recursive:true,
    filter(source){
      const relative=path.relative(PROJECT_ROOT,source);
      if(!relative)return true;
      const [top]=relative.split(path.sep);
      if([".git",".next",".vercel","node_modules"].includes(top))return false;
      if(path.basename(source).startsWith(".env"))return false;
      return true;
    }
  });
  await fs.symlink(path.join(PROJECT_ROOT,"node_modules"),path.join(APP_SANDBOX_DIR,"node_modules"),"dir");
}

async function startServices(){
  await prepareAppSandbox();
  mockServer=createMockResend();
  const mockPort=await listen(mockServer);
  mockBase=`http://127.0.0.1:${mockPort}`;
  const appPort=await freePort();
  appBase=`http://localhost:${appPort}`;

  const childEnv={...process.env,
    WDCC_DATABASE_URL:DATABASE_URL,
    WDCC_DATABASE_BRANCH_ID:EXPECTED_BRANCH,
    NEON_BRANCH_ID:EXPECTED_BRANCH,
    WDCC_EXPECTED_NEON_BRANCH_ID:EXPECTED_BRANCH,
    WDCC_EXPECTED_NEON_PROJECT_ID:EXPECTED_PROJECT,
    WDCC_EXPECTED_NEON_ENDPOINT_ID:EXPECTED_ENDPOINT,
    WDCC_PRODUCTION_NEON_BRANCH_ID:PRODUCTION_BRANCH,
    WDCC_NEON_AUTH_URL:AUTH_BASE,
    WDCC_NEON_AUTH_ORIGIN:AUTH_ORIGIN,
    WDCC_RUNTIME_ROLE:"canonical",
    WDCC_ENVIRONMENT:"e2e",
    WDCC_E2E_DEALER_EMAIL:AUTH_IDENTITIES.dealer.email,
    WDCC_E2E_ADMIN_EMAIL:AUTH_IDENTITIES.admin.email,
    WDCC_E2E_DEALER_PASSWORD:AUTH_IDENTITIES.dealer.password,
    WDCC_E2E_ADMIN_PASSWORD:AUTH_IDENTITIES.admin.password,
    WDCC_STOREFRONT_ORIGIN:appBase,
    WDCC_E2E_MEDIA_DIR:MEDIA_DIR,
    SESSION_SECRET:crypto.randomBytes(48).toString("base64url"),
    CRON_SECRET,
    RESEND_API_KEY:"wdcc-local-proof-not-a-real-key",
    RESEND_API_BASE_URL:mockBase,
    WDCC_LEAD_NOTIFICATION_EMAILS:EMAIL_RECIPIENT,
    WDCC_LEAD_FROM_EMAIL:"WDCC Launch Proof <proof@example.test>",
    WDCC_MOCKUP_PREVIEW:"0",
    WDCC_VISUAL_PROOF_FALLBACK:"0",
    WDCC_RECOVERY_INVENTORY:"0",
    WDCC_RECOVERY_MODE:"0",
    PORT:String(appPort),
    HOSTNAME:"127.0.0.1"
  };
  for(const name of ["DATABASE_URL","POSTGRES_URL","BLOB_READ_WRITE_TOKEN","VERCEL_OIDC_TOKEN","BLOB_STORE_ID","WDCC_STATE_SERVICE_URL","WDCC_STATE_SERVICE_TOKEN","TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_FROM_NUMBER","WDCC_LEAD_NOTIFICATION_PHONE","WDCC_LEAD_WEBHOOK_URL","VERCEL_ENV","RAILWAY_ENVIRONMENT_NAME"]){
    delete childEnv[name];
  }
  appProcess=spawn(process.execPath,[path.join(PROJECT_ROOT,"node_modules/next/dist/bin/next"),APP_MODE,"--webpack","-p",String(appPort),"-H","127.0.0.1"],{
    cwd:APP_SANDBOX_DIR,env:{...childEnv,NEXT_TELEMETRY_DISABLED:"1"},stdio:["ignore","pipe","pipe"]
  });
  const collect=chunk=>{appLogs=(appLogs+chunk.toString()).slice(-80_000);};
  appProcess.stdout.on("data",collect);
  appProcess.stderr.on("data",collect);

  const ready=await waitForApp(`${appBase}/api/health`);
  let health=null;
  try{health=JSON.parse(ready.text);}catch{}
  assert.equal(ready.status,200,`Health must be ready, got ${ready.status}: ${ready.text.slice(0,500)}`);
  assert.equal(health?.ok,true,"Health contract must report ok:true");
  assert.equal(health?.degraded,false,"Health contract must report degraded:false");
  assert.equal(health?.integrations?.email?.configured,true,"Health must report email configured");
  assert.equal(health?.integrations?.dashboard?.configured,true,"Health must report dashboard configured");
  assert.equal(health?.integrations?.auth?.ready,true,"Health must report the explicit Neon Auth endpoint ready");
  assert.equal(health?.integrations?.auth?.databaseMatched,true,"Health must bind Neon Auth to the same database as the business flow");
  assert.equal(health?.integrations?.auth?.sessionLifecycle,"upstream-revoked-before-app-session","Health must report the fail-closed upstream session lifecycle");
  assert.equal(health?.integrations?.media?.configured,true,"Health must report vehicle media configured");
  assert.equal(health?.integrations?.media?.provider,"e2e-local-capture","Health must report isolated E2E media authority");
  assert.equal(health?.integrations?.outboxRetry?.configured,true,"Health must report durable outbox retry configured");
  assert.equal(health?.database?.branchId,EXPECTED_BRANCH,"Health branch identity mismatch");
  assert.equal(health?.database?.projectId,EXPECTED_PROJECT,"Health project identity mismatch");
  assert.equal(health?.database?.endpointId,EXPECTED_ENDPOINT,"Health endpoint identity mismatch");
  for(const metric of ["pendingOutbox","staleOutbox","deadLetterOutbox"]){
    assert.ok(Number.isInteger(health?.counts?.[metric]),`Health must expose integer ${metric}`);
  }
  record("launch health gate",{status:ready.status,emailConfigured:true,dashboardConfigured:true,mediaProvider:"e2e-local-capture",outboxRetryConfigured:true,databaseIdentity:"exact",outboxMetrics:true});
}

async function verifyFlow(){
  browser=await chromium.launch({headless:true});
  const unauth=await browser.newContext({baseURL:appBase,viewport:{width:1280,height:900}});
  const dealer=await browser.newContext({baseURL:appBase,viewport:{width:1280,height:900}});
  const admin=await browser.newContext({baseURL:appBase,viewport:{width:1280,height:900}});
  const contexts=[unauth,dealer,admin];
  const browserErrors=[];

  try{
    await api(unauth,"GET","/api/leads",{expected:401,label:"anonymous leads"});
    await api(unauth,"GET","/api/crm/dashboard",{expected:401,label:"anonymous dashboard",requireAuthority:true});
    await api(unauth,"POST","/api/inventory",{data:{year:2020,make:"Denied",model:"Denied",price:1},expected:401,label:"anonymous inventory mutation",requireAuthority:true});
    await api(unauth,"GET","/api/admin/users",{expected:[401,403],label:"anonymous admin boundary"});
    await api(unauth,"GET","/api/admin/export",{expected:401,label:"anonymous raw export boundary"});
    await api(unauth,"GET","/api/internal/lead-outbox",{expected:401,label:"outbox retry without bearer",requireAuthority:true});
    await api(unauth,"GET","/api/internal/lead-outbox",{expected:401,label:"outbox retry wrong bearer",requireAuthority:true,headers:{authorization:"Bearer definitely-wrong-proof-secret"}});
    const retry=await api(unauth,"GET","/api/internal/lead-outbox",{expected:200,label:"outbox retry correct bearer",requireAuthority:true,headers:{authorization:`Bearer ${CRON_SECRET}`}});
    assert.equal(retry.body?.ok,true,"Authorized outbox retry did not return ok:true");

    const unauthDealerPage=await unauth.newPage();
    await unauthDealerPage.goto(new URL("/dealer/inventory",appBase).toString(),{waitUntil:"domcontentloaded",timeout:30_000});
    assert.equal(new URL(unauthDealerPage.url()).pathname,"/login","Anonymous dealer inventory page must redirect to login");
    await unauthDealerPage.close();

    const dealerLogin=await api(dealer,"POST","/api/auth/login",{data:{username:AUTH_IDENTITIES.dealer.alias,email:AUTH_IDENTITIES.dealer.alias,password:AUTH_IDENTITIES.dealer.password},expected:200,label:"dealer login"});
    assert.equal(dealerLogin.body?.ok,true,"Dealer login did not return ok:true");
    assert.equal(dealerLogin.body?.role,"dealer_agent","Dealer login role mismatch");
    const dealerSession=await api(dealer,"GET","/api/auth/session",{expected:200,label:"dealer session"});
    assert.equal(dealerSession.body?.authenticated,true,"Dealer session missing");
    assert.equal(dealerSession.body?.user?.role,"dealer_agent","Dealer session role mismatch");
    assert.ok(dealerSession.body?.tenantId&&dealerSession.body?.tenantId===dealerSession.body?.user?.tenantId,"Dealer tenant mismatch");
    await api(dealer,"GET","/api/admin/users",{expected:403,label:"dealer blocked from admin"});
    await api(dealer,"GET","/api/admin/export",{expected:403,label:"dealer blocked from raw export"});

    for(const pathname of ["/admin/users","/admin/dashboard"]){
      const page=await dealer.newPage();
      await page.goto(new URL(pathname,appBase).toString(),{waitUntil:"domcontentloaded",timeout:30_000});
      assert.equal(new URL(page.url()).pathname,"/dealer",`Dealer ${pathname} must redirect to dealer portal`);
      await page.close();
    }

    const adminLogin=await api(admin,"POST","/api/auth/login",{data:{username:AUTH_IDENTITIES.admin.alias,email:AUTH_IDENTITIES.admin.alias,password:AUTH_IDENTITIES.admin.password},expected:200,label:"admin login"});
    assert.equal(adminLogin.body?.ok,true,"Admin login did not return ok:true");
    assert.equal(adminLogin.body?.role,"platform_admin","Admin login role mismatch");
    const adminSession=await api(admin,"GET","/api/auth/session",{expected:200,label:"admin session"});
    assert.equal(adminSession.body?.authenticated,true,"Admin session missing");
    assert.equal(adminSession.body?.user?.role,"platform_admin","Admin session role mismatch");
    assert.ok(adminSession.body?.tenantId&&adminSession.body?.tenantId===adminSession.body?.user?.tenantId,"Admin tenant mismatch");
    const adminUsers=await api(admin,"GET","/api/admin/users",{expected:200,label:"admin user boundary",requireAuthority:true});
    assert.ok(Array.isArray(adminUsers.body?.items||adminUsers.body?.users),"Admin users response must contain users/items");
    const retiredExport=await api(admin,"GET","/api/admin/export",{expected:410,label:"admin raw export retired",requireAuthority:true});
    assert.equal(retiredExport.body?.error,"legacy_raw_export_retired","Admin raw export must remain retired");

    const authCandidates=await sql.query(`select s.id::text as id,lower(u.email) as email from neon_auth.session s join neon_auth."user" u on u.id=s."userId" where u.id=any($1::uuid[]) order by s."createdAt"`,[created.authUserIds]);
    const authRows=authCandidates.filter(row=>!authBaselineIds.has(row.id));
    assert.equal(authRows.length,0,"Portal credential checks must revoke every temporary isolated branch Auth session before issuing the WDCC app session");
    assert.deepEqual(
      [...new Set(authCandidates.map(row=>row.id))].sort(),
      [...authBaselineIds].sort(),
      "Portal credential checks must preserve the signup baseline without retaining new upstream Auth sessions"
    );
    created.authSessionIds=authRows.map(row=>row.id);
    record("real dealer/admin role, page and session boundaries",{
      dealerRole:"dealer_agent",adminRole:"platform_admin",dealerAdminStatus:403,
      anonymousDealerRedirect:"/login",dealerAdminRedirect:"/dealer",rawExportStatus:410,
      appSessions:{dealer:true,admin:true},retainedCredentialCheckSessions:authRows.length,
      upstreamSessionLifecycle:"revoked-before-app-session"
    });

    const create=await api(dealer,"POST","/api/inventory",{
      expected:201,label:"dealer creates draft",requireAuthority:true,
      headers:{"x-wdcc-request-id":`vehicle-create-${RUN_ID}`},
      data:{year:2020,make:"Dodge",model:MODEL,trim:"SXT",price:24995,downPayment:2000,mileage:41000,stock:STOCK,vin:`E2E${SHORT_ID.toUpperCase()}`,bodyStyle:"Coupe",condition:"Used",transmission:"Automatic",exteriorColor:"Black",interiorColor:"Black",drivetrain:"RWD",fuelType:"Gasoline",description:`Isolated branch launch listing ${RUN_ID}`,visibility:"public"}
    });
    const createDurationMs=launchBudget("dealer draft create",create,MUTATION_BUDGET_MS);
    created.vehicleId=String(create.body?.item?.id||"");
    assert.match(created.vehicleId,/^[0-9a-f-]{36}$/i,"Vehicle ID missing");
    assert.equal(create.body?.item?.status,"draft","Created vehicle must start as draft");

    const publicBefore=await api(unauth,"GET",`/api/inventory?proof=${RUN_ID}-draft`,{expected:200,label:"anonymous inventory before publish",requireAuthority:true});
    assert.equal(recursiveItem(publicBefore.body,created.vehicleId),null,"Draft leaked to anonymous inventory");

    const uploadCapability=await api(dealer,"GET","/api/upload?capabilities=1",{expected:200,label:"upload capability"});
    assert.equal(uploadCapability.body?.mode,"e2e-local-capture","E2E upload authority is not isolated local capture");
    const photoBytes=await fs.readFile(path.join(PROJECT_ROOT,"public/wdcc-hero-v2.webp"));
    const photoHash=crypto.createHash("sha256").update(photoBytes).digest("hex");
    const photoPathname=`media/wdcc/${created.vehicleId}/${RUN_ID}.webp`;
    const uploadResponse=await dealer.request.post(new URL(`/api/upload?capture=1`,appBase).toString(),{
      failOnStatusCode:false,
      headers:{"x-wdcc-request-id":`vehicle-upload-${RUN_ID}`},
      multipart:{
        vehicleId:created.vehicleId,
        pathname:photoPathname,
        requestId:`vehicle-upload-${RUN_ID}`,
        file:{name:`${RUN_ID}.webp`,mimeType:"image/webp",buffer:photoBytes}
      }
    });
    const uploadText=await uploadResponse.text();
    let uploadBody=null;try{uploadBody=JSON.parse(uploadText);}catch{}
    assert.equal(uploadResponse.status(),200,`Vehicle media upload failed: ${uploadText.slice(0,300)}`);
    assert.equal(uploadBody?.ok,true,"Vehicle media upload did not return ok:true");
    assert.equal(uploadBody?.pathname,photoPathname,"Vehicle media pathname changed during upload");
    assert.equal(uploadBody?.provider,"e2e-local-capture","Vehicle media escaped isolated capture authority");
    assert.equal(uploadBody?.sha256,photoHash,"Vehicle media upload hash mismatch");
    const mediaResponse=await dealer.request.get(new URL(`/api/media?p=${encodeURIComponent(photoPathname)}`,appBase).toString(),{failOnStatusCode:false});
    assert.equal(mediaResponse.status(),200,"Captured vehicle media is not readable");
    assert.equal(mediaResponse.headers()["x-wdcc-media-provider"],"e2e-local-capture","Media read escaped isolated capture authority");
    assert.equal(mediaResponse.headers()["content-type"],"image/webp","Media read content type mismatch");
    const mediaBytes=await mediaResponse.body();
    assert.equal(crypto.createHash("sha256").update(mediaBytes).digest("hex"),photoHash,"Media read hash mismatch");
    const checkpoint=await api(dealer,"PATCH",`/api/inventory/${created.vehicleId}`,{
      expected:200,label:"photo checkpoint",requireAuthority:true,
      headers:{"x-wdcc-request-id":`vehicle-photo-${RUN_ID}`},
      data:{photoPathnames:[photoPathname],primaryPhotoPathname:photoPathname}
    });
    const checkpointDurationMs=launchBudget("vehicle photo checkpoint",checkpoint,MUTATION_BUDGET_MS);
    assert.equal(checkpoint.body?.item?.status,"draft","Photo checkpoint unexpectedly published vehicle");
    assert.ok(checkpoint.body?.item?.primaryImageUrl===photoPathname||checkpoint.body?.item?.primary_image_url===photoPathname||checkpoint.body?.item?.primaryPhotoPathname===photoPathname,"Primary photo checkpoint missing");

    const publish=await api(dealer,"PATCH",`/api/inventory/${created.vehicleId}`,{
      expected:200,label:"publish listing",requireAuthority:true,
      headers:{"x-wdcc-request-id":`vehicle-publish-${RUN_ID}`},
      data:{photoPathnames:[photoPathname],primaryPhotoPathname:photoPathname,status:"published",internalOnly:false,visibility:"public"}
    });
    const publishDurationMs=launchBudget("vehicle publish",publish,MUTATION_BUDGET_MS);
    assert.equal(publish.body?.item?.status,"published","Vehicle did not publish");
    assert.equal(publish.body?.storefront?.verification,"committed","Publish did not commit storefront visibility");

    const dealerInventory=await api(dealer,"GET",`/api/inventory?proof=${RUN_ID}-dealer`,{expected:200,label:"dealer inventory",requireAuthority:true});
    assert.ok(recursiveItem(dealerInventory.body,created.vehicleId),"Published vehicle missing from dealer inventory");
    const publicAfter=await api(unauth,"GET",`/api/inventory?proof=${RUN_ID}-public`,{expected:200,label:"anonymous inventory after publish",requireAuthority:true});
    assert.ok(recursiveItem(publicAfter.body,created.vehicleId),"Published vehicle missing from anonymous inventory");
    const firstDashboard=await api(dealer,"GET",`/api/crm/dashboard?proof=${RUN_ID}-vehicle`,{expected:200,label:"dealer dashboard vehicle",requireAuthority:true});
    const vehicleDashboardDurationMs=launchBudget("dealer dashboard after publish",firstDashboard,READ_BUDGET_MS);
    assert.ok(recursiveItem(firstDashboard.body,created.vehicleId),"Published vehicle missing from dealer dashboard payload");
    record("dealer draft, real photo upload/checkpoint, publish, dashboard and storefront",{vehicleId:created.vehicleId,stock:STOCK,status:"published",mediaProvider:"e2e-local-capture",mediaSha256:photoHash,storefrontVerification:"committed",durationMs:{create:createDurationMs,checkpoint:checkpointDurationMs,publish:publishDurationMs,dashboard:vehicleDashboardDurationMs}});

    const apiLeadPayloads=[
      {key:"schedule",data:{kind:"schedule",name:`Schedule Buyer ${SHORT_ID}`,phone:"813-555-0101",email:LEAD_EMAILS.schedule,vehicleId:created.vehicleId,vehicleInterest:`2020 Dodge ${MODEL}`,preferredTime:"Tomorrow 10:30 AM",source:"schedule-test-drive",consent:true}},
      {key:"approval",data:{kind:"approval",firstName:"Approval Buyer",lastName:SHORT_ID,phone:"813-555-0102",email:LEAD_EMAILS.approval,vehicleId:created.vehicleId,vehicleInterest:`2020 Dodge ${MODEL}`,monthlyIncome:6200,downPayment:2500,referralSource:"website-mockup",source:"get-pre-approved",consent:true}}
    ];
    const leadResults={};
    const leadDurationMs={};
    for(const spec of apiLeadPayloads){
      const result=await api(unauth,"POST","/api/leads",{
        expected:201,label:`${spec.key} lead`,requireAuthority:true,
        headers:{"idempotency-key":IDEMPOTENCY[spec.key]},data:spec.data
      });
      leadDurationMs[spec.key]=launchBudget(`${spec.key} lead create`,result,MUTATION_BUDGET_MS);
      const leadId=String(result.body?.item?.id||result.body?.leadId||"");
      assert.match(leadId,/^[0-9a-f-]{36}$/i,`${spec.key} lead ID missing`);
      assert.equal(result.body?.item?.kind,spec.key,`${spec.key} lead kind mismatch`);
      created.leadIds.push(leadId);
      leadResults[spec.key]={id:leadId,result};
    }

    const contactName=`Contact ${SHORT_ID}`;
    let contactRequestJson=null;
    let contactRequestCount=0;
    const contactDiagnostics={console:[],pageErrors:[],requestFailed:[]};
    const contactPage=await unauth.newPage();
    contactPage.on("console",message=>{if(message.type()==="error"){const detail=message.text().slice(0,1000);contactDiagnostics.console.push(detail);browserErrors.push(`contact-form:console:${detail}`);}});
    contactPage.on("pageerror",error=>{const detail=String(error).slice(0,1000);contactDiagnostics.pageErrors.push(detail);browserErrors.push(`contact-form:page:${detail}`);});
    contactPage.on("requestfailed",request=>{const parsed=new URL(request.url());contactDiagnostics.requestFailed.push({pathname:parsed.pathname,resourceType:request.resourceType(),error:request.failure()?.errorText||"failed"});});
    await contactPage.route("**/api/leads",async route=>{
      const request=route.request();
      const requestUrl=new URL(request.url());
      if(request.method()!=="POST"||requestUrl.pathname!=="/api/leads")return route.continue();
      contactRequestCount+=1;
      const raw=request.postData()||"";
      try{contactRequestJson=JSON.parse(raw);}catch{contactRequestJson=null;}
      return route.continue({headers:{...request.headers(),"idempotency-key":IDEMPOTENCY.contact}});
    });
    const contactNavigation=await contactPage.goto(new URL(`/contact?launch-proof=${RUN_ID}`,appBase).toString(),{waitUntil:"domcontentloaded",timeout:30_000});
    assert.equal(contactNavigation?.status(),200,"Public contact page did not load");
    await contactPage.locator('input[name="name"]').fill(contactName);
    await contactPage.locator('input[name="phone"]').fill("813-555-0103");
    await contactPage.locator('input[name="email"]').fill(LEAD_EMAILS.contact);
    await contactPage.locator('textarea[name="message"]').fill(`Please call about ${STOCK}`);
    await contactPage.locator('input[name="consent"]').check();
    const contactSubmit=contactPage.getByRole("button",{name:"CONTACT SEAN"});
    let contactResponse=null;
    let contactStarted=0;
    try{
      await contactPage.waitForFunction(()=>{
        const button=document.querySelector('.leadForm button[type="submit"]');
        return button instanceof HTMLButtonElement&&!button.disabled;
      },null,{timeout:15_000});
      const contactResponsePromise=contactPage.waitForResponse(response=>response.request().method()==="POST"&&new URL(response.url()).pathname==="/api/leads",{timeout:TRANSPORT_TIMEOUT_MS});
      contactStarted=performance.now();
      await contactSubmit.click();
      contactResponse=await contactResponsePromise;
    }catch(error){
      const failureScreenshot=path.join(ARTIFACT_DIR,"contact-form-failure.png");
      try{await contactPage.screenshot({path:failureScreenshot,fullPage:true});report.artifacts["contact-form-failure"]=failureScreenshot;}catch{}
      const formState=await contactPage.evaluate(()=>{
        const form=document.querySelector("form.leadForm");
        const button=form?.querySelector('button[type="submit"]');
        const current=new URL(window.location.href);
        return {pathname:current.pathname,searchPresent:Boolean(current.search),readyState:document.readyState,formMethod:form?.getAttribute("method")||"get",buttonDisabled:button instanceof HTMLButtonElement?button.disabled:null,buttonText:button?.textContent?.trim()||null};
      }).catch(()=>({state:"unavailable"}));
      report.contactFormFailure={...formState,...contactDiagnostics};
      throw error;
    }
    const contactDurationResult={durationMs:Math.round(performance.now()-contactStarted)};
    leadDurationMs.contact=launchBudget("public contact form lead create",contactDurationResult,MUTATION_BUDGET_MS);
    const contactText=await contactResponse.text();
    let contactBody=null;try{contactBody=contactText?JSON.parse(contactText):null;}catch{}
    assert.equal(contactResponse.status(),201,`Public contact form lead failed: ${contactText.slice(0,300)}`);
    authority(contactResponse,"public contact form lead");
    assert.equal(contactRequestCount,1,"Public contact form must submit exactly one lead request");
    assert.ok(contactRequestJson&&typeof contactRequestJson==="object","Public contact request JSON was not captured");
    assert.equal(contactRequestJson.kind,"contact","Public contact form submitted the wrong lead kind");
    assert.equal(contactRequestJson.name,contactName,"Public contact form changed the lead name");
    assert.equal(contactRequestJson.email,LEAD_EMAILS.contact,"Public contact form changed the lead email");
    const contactLeadId=String(contactBody?.item?.id||contactBody?.leadId||"");
    assert.match(contactLeadId,/^[0-9a-f-]{36}$/i,"Public contact lead ID missing");
    assert.equal(contactBody?.item?.kind,"contact","Public contact response kind mismatch");
    created.leadIds.push(contactLeadId);
    leadResults.contact={id:contactLeadId,result:{body:contactBody,durationMs:contactDurationResult.durationMs}};
    const successStatus=contactPage.getByRole("status");
    await successStatus.waitFor({state:"visible",timeout:15_000});
    const successText=await successStatus.innerText();
    assert.ok(successText.includes("Request received."),"Public contact form did not expose its accessible success confirmation");
    assert.ok(successText.includes("saved in the dealer dashboard"),"Public contact form did not confirm dashboard persistence");
    assert.equal(await successStatus.getAttribute("aria-live"),"polite","Public contact success confirmation must be announced accessibly");
    const contactScreenshot=path.join(ARTIFACT_DIR,"contact-form-success.png");
    await contactPage.screenshot({path:contactScreenshot,fullPage:true});
    report.artifacts["contact-form-success"]=contactScreenshot;
    await contactPage.close();
    record("public contact form to canonical lead",{leadId:contactLeadId,requestCount:contactRequestCount,successText,durationMs:leadDurationMs.contact,screenshot:contactScreenshot});

    const replay=await api(unauth,"POST","/api/leads",{
      expected:200,label:"contact idempotent replay",requireAuthority:true,
      headers:{"idempotency-key":IDEMPOTENCY.contact},data:contactRequestJson
    });
    leadDurationMs.contactReplay=launchBudget("contact lead idempotent replay",replay,MUTATION_BUDGET_MS);
    assert.equal(replay.body?.deduplicated,true,"Idempotent replay was not marked deduplicated");
    assert.equal(replay.body?.item,undefined,"Idempotent replay must not disclose the existing lead");
    assert.equal(replay.body?.leadId,undefined,"Idempotent replay must not disclose the existing lead ID");
    assert.equal(replay.body?.outboxId,undefined,"Idempotent replay must not disclose the existing outbox ID");
    const replayText=JSON.stringify(replay.body);
    for(const sensitive of [contactRequestJson.name,contactRequestJson.email,contactRequestJson.phone,leadResults.contact.id]){
      assert.equal(replayText.includes(String(sensitive)),false,"Idempotent replay leaked existing lead PII or identifiers");
    }
    const replayRows=await sql.query("select id::text from public.leads where idempotency_key=$1",[IDEMPOTENCY.contact]);
    assert.deepEqual(replayRows,[{id:leadResults.contact.id}],"Idempotent replay changed or duplicated the durable lead row");

    await waitFor(()=>captures.length===3,45_000);
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(captures.length,3,"Each non-QA lead kind must emit exactly one email after idempotent replay");
    const expectedEmailNames={schedule:`Schedule Buyer ${SHORT_ID}`,approval:`Approval Buyer ${SHORT_ID}`,contact:`Contact ${SHORT_ID}`};
    for(const key of ["schedule","approval","contact"]){
      const expectedIdempotencyKey=`lead:${IDEMPOTENCY[key]}:email:v1`;
      const matching=captures.filter(email=>email.idempotencyKey===expectedIdempotencyKey);
      assert.equal(matching.length,1,`${key} must emit exactly one idempotent email`);
      const email=matching[0];
      assert.equal(email.authorization,"Bearer wdcc-local-proof-not-a-real-key",`${key} mock Resend authorization mismatch`);
      assert.deepEqual(email.body?.to,[EMAIL_RECIPIENT],`${key} lead email recipient mismatch`);
      assert.ok(String(email.body?.subject||"").includes(expectedEmailNames[key]),`${key} lead email subject missing lead name`);
      assert.ok(String(email.body?.text||"").includes(leadResults[key].id),`${key} lead email body missing durable lead ID`);
    }
    report.email.captured=captures.length;

    const canonicalDealers=await sql.query("select id::text as id from public.dealers where slug='wedontcarecars' and status='active' order by created_at limit 2");
    assert.equal(canonicalDealers.length,1,"Canonical WDCC dealer partition is ambiguous or missing");
    const canonicalDealerId=canonicalDealers[0].id;
    const dbLeads=await sql.query("select id::text,dealer_id::text,lead_kind,status,monthly_income,down_payment,referral_source,metadata from public.leads where id=any($1::uuid[]) order by lead_kind",[created.leadIds]);
    assert.equal(dbLeads.length,3,"All three lead kinds must persist exactly once");
    report.leadPartitionEvidence={
      canonicalDealerId,
      rows:dbLeads.map(row=>({id:row.id,dealerId:row.dealer_id,kind:row.lead_kind,status:row.status,qa:row.metadata?.qa===true}))
    };
    for(const row of dbLeads){
      assert.equal(row.dealer_id,canonicalDealerId,`${row.lead_kind||"unknown"} lead escaped the canonical dealer partition`);
    }
    const approvalRow=dbLeads.find(row=>row.lead_kind==="approval");
    assert.equal(Number(approvalRow?.monthly_income),6200,"Approval monthly income was dropped");
    assert.equal(Number(approvalRow?.down_payment),2500,"Approval down payment was dropped");
    assert.equal(approvalRow?.referral_source,"website-mockup","Approval referral source was dropped");
    const outbox=await sql.query("select aggregate_id::text,dealer_id::text,status,attempts,payload from public.wdcc_outbox_events where aggregate_id=any($1::uuid[]) order by aggregate_id",[created.leadIds]);
    assert.equal(outbox.length,3,"Each lead must have one durable outbox event");
    for(const row of outbox){
      assert.equal(row.dealer_id,canonicalDealerId,"Lead outbox event escaped the canonical dealer partition");
      assert.equal(row.status,"delivered",`Lead ${row.aggregate_id} email outbox event was not delivered`);
      assert.equal(Number(row.attempts),1,`Lead ${row.aggregate_id} email must be attempted exactly once`);
      assert.equal(row.payload?.suppressed,false,`Lead ${row.aggregate_id} was unexpectedly notification-suppressed`);
    }
    assert.equal(outbox.filter(row=>row.aggregate_id===leadResults.contact.id).length,1,"Contact replay created a duplicate outbox event");
    for(const key of ["schedule","approval","contact"]){
      assert.equal(outbox.filter(row=>row.aggregate_id===leadResults[key].id).length,1,`${key} must have exactly one durable outbox event`);
    }
    record("contact, schedule and approval leads with durable exactly-once email",{leadIds:created.leadIds,emailCaptures:captures.length,outboxStatus:"delivered",attemptsPerLead:1,approvalFieldsPreserved:true,durationMs:leadDurationMs});

    const dashboard=await api(dealer,"GET",`/api/crm/dashboard?proof=${RUN_ID}-leads`,{expected:200,label:"dealer dashboard leads",requireAuthority:true});
    const leadDashboardDurationMs=launchBudget("dealer dashboard with leads",dashboard,READ_BUDGET_MS);
    const dashboardEvidence=dashboardLeadEvidence(dashboard.body,created.leadIds);
    report.dashboardLeadEvidence=dashboardEvidence;
    assert.equal(
      dashboardEvidence.parsed,
      true,
      `Dashboard returned a non-JSON body (${String(dashboard.response.headers()["content-type"]||"unknown")}, ${dashboard.text.length} bytes)`
    );
    assert.equal(dashboardEvidence.ok,true,`Dashboard response was not ok: ${JSON.stringify(dashboardEvidence)}`);
    assert.ok(Array.isArray(dashboard.body?.leads),`Dashboard omitted its lead records array: ${JSON.stringify(dashboardEvidence)}`);
    for(const id of created.leadIds){
      assert.ok(dashboard.body.leads.some(lead=>String(lead?.id||"")===String(id)),`Lead ${id} missing from dashboard records: ${JSON.stringify(dashboardEvidence)}`);
    }
    const update=await api(dealer,"PATCH",`/api/leads/${leadResults.contact.id}`,{
      expected:200,label:"dealer lead status update",requireAuthority:true,
      headers:{"x-wdcc-request-id":`lead-status-${RUN_ID}`},data:{status:"contacted"}
    });
    const statusUpdateDurationMs=launchBudget("dealer lead status update",update,MUTATION_BUDGET_MS);
    assert.equal(update.body?.item?.status,"contacted","Lead status update did not persist");
    const updatedDashboard=await api(dealer,"GET",`/api/crm/dashboard?proof=${RUN_ID}-updated`,{expected:200,label:"updated dashboard lead",requireAuthority:true});
    const updatedDashboardDurationMs=launchBudget("dealer dashboard after status update",updatedDashboard,READ_BUDGET_MS);
    assert.equal(recursiveItem(updatedDashboard.body,leadResults.contact.id)?.status,"contacted","Updated lead status missing from dashboard");
    record("dashboard lead visibility and status update",{leadId:leadResults.contact.id,status:"contacted",durationMs:{withLeads:leadDashboardDurationMs,statusUpdate:statusUpdateDurationMs,afterUpdate:updatedDashboardDurationMs}});

    const capturePage=async(context,label,pathname,needles)=>{
      const page=await context.newPage();
      page.on("console",message=>{if(message.type()==="error")browserErrors.push(`${label}:console:${message.text()}`);});
      page.on("pageerror",error=>browserErrors.push(`${label}:page:${String(error)}`));
      page.on("requestfailed",request=>{const why=request.failure()?.errorText||"failed";if(!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(why))browserErrors.push(`${label}:request:${request.url()}:${why}`);});
      const response=await page.goto(new URL(pathname,appBase).toString(),{waitUntil:"domcontentloaded",timeout:30_000});
      assert.equal(response?.status(),200,`${label} page did not load`);
      for(const needle of needles){
        await page.waitForFunction(value=>document.body.innerText.includes(value),needle,{timeout:TRANSPORT_TIMEOUT_MS});
      }
      const filename=path.join(ARTIFACT_DIR,`${label}.png`);
      await page.screenshot({path:filename,fullPage:true});
      report.artifacts[label]=filename;
      await page.close();
    };
    await capturePage(unauth,"storefront",`/?launch-proof=${RUN_ID}`,[MODEL]);
    await capturePage(dealer,"dealer-dashboard",`/dealer?launch-proof=${RUN_ID}`,["Dashboard",MODEL,`Contact ${SHORT_ID}`]);
    await capturePage(admin,"admin-dashboard",`/admin?launch-proof=${RUN_ID}`,["WDCC · ADMIN PORTAL","Dashboard",MODEL]);
    assert.deepEqual(browserErrors,[],`Browser errors detected: ${browserErrors.join(" | ")}`);
    record("browser storefront, dealer dashboard and admin dashboard",{screenshots:Object.keys(report.artifacts),browserErrors:0});

    await api(dealer,"POST","/api/auth/logout",{expected:200,label:"dealer logout"});
    const dealerAfterLogout=await api(dealer,"GET","/api/auth/session",{expected:200,label:"dealer session after logout"});
    assert.equal(dealerAfterLogout.body?.authenticated,false,"Dealer session survived logout");
    await api(admin,"POST","/api/auth/logout",{expected:200,label:"admin logout"});
    const adminAfterLogout=await api(admin,"GET","/api/auth/session",{expected:200,label:"admin session after logout"});
    assert.equal(adminAfterLogout.body?.authenticated,false,"Admin session survived logout");
    record("dealer/admin logout boundaries",{dealerAuthenticated:false,adminAuthenticated:false});
  }finally{
    await Promise.all(contexts.map(context=>context.close().catch(()=>{})));
  }
}

async function cleanup(){
  if(!branchVerified)return {skipped:"branch_not_verified"};
  const syntheticAuthEmails=Object.values(AUTH_IDENTITIES).map(identity=>identity.email);
  const leadRows=await sql.query("select id::text from public.leads where idempotency_key=any($1::text[])",[Object.values(IDEMPOTENCY)]).catch(()=>[]);
  const leadIds=[...new Set([...created.leadIds,...leadRows.map(row=>row.id)])].filter(Boolean);
  const vehicleRows=await sql.query("select id::text from public.vehicles where stock_id=$1",[STOCK]).catch(()=>[]);
  const vehicleIds=[...new Set([created.vehicleId,...vehicleRows.map(row=>row.id)])].filter(Boolean);
  const authRows=await sql.query(`select id::text as id from neon_auth."user" where lower(email)=any($1::text[])`,[syntheticAuthEmails]).catch(()=>[]);
  const authUserIds=[...new Set([...created.authUserIds,...authRows.map(row=>row.id)])].filter(Boolean);
  const authIds=authUserIds.length?authUserIds:["00000000-0000-0000-0000-000000000000"];

  if(leadIds.length){
    await sql.query("delete from public.wdcc_candidate_actions where action_payload->>'lead_id'=any($1::text[])",[leadIds]);
    await sql.query("delete from public.wdcc_touchpoints where metadata->>'lead_id'=any($1::text[])",[leadIds]);
    await sql.query("delete from public.sessions where metadata->>'lead_id'=any($1::text[])",[leadIds]);
    await sql.query("delete from public.wdcc_dead_letters where source='lead-outbox' and reference_id::text in (select id::text from public.wdcc_outbox_events where aggregate_id=any($1::uuid[]))",[leadIds]);
    await sql.query("delete from public.wdcc_outbox_events where aggregate_id=any($1::uuid[])",[leadIds]);
    await sql.query("delete from public.consent_log where lead_id=any($1::uuid[])",[leadIds]);
    await sql.query("delete from public.events where lead_id=any($1::uuid[])",[leadIds]);
    await sql.query("delete from public.leads where id=any($1::uuid[])",[leadIds]);
    await sql.query("delete from public.wdcc_customers where lower(email)=any($1::text[])",[Object.values(LEAD_EMAILS)]);
  }
  if(vehicleIds.length){
    await sql.query("delete from public.events where vehicle_id=any($1::uuid[])",[vehicleIds]);
    await sql.query("delete from public.vehicles where id=any($1::uuid[])",[vehicleIds]);
  }

  if(authUserIds.length){
    await sql.query("delete from public.dealer_memberships where user_id=any($1::uuid[])",[authUserIds]);
    await sql.query("delete from public.user_access where user_id=any($1::uuid[])",[authUserIds]);
    await sql.query('delete from neon_auth.member where "userId"=any($1::uuid[])',[authUserIds]);
    await sql.query('delete from neon_auth.invitation where "inviterId"=any($1::uuid[]) or lower(email)=any($2::text[])',[authUserIds,syntheticAuthEmails]);
    await sql.query("delete from neon_auth.verification where lower(identifier)=any($1::text[])",[syntheticAuthEmails]);
    await sql.query('delete from neon_auth.session where "userId"=any($1::uuid[])',[authUserIds]);
    await sql.query('delete from neon_auth.account where "userId"=any($1::uuid[])',[authUserIds]);
    await sql.query('delete from neon_auth."user" where id=any($1::uuid[])',[authUserIds]);
  }

  const remaining=await sql.query("select (select count(*)::int from public.vehicles where stock_id=$1) as vehicles,(select count(*)::int from public.leads where idempotency_key=any($2::text[])) as leads,(select count(*)::int from public.wdcc_outbox_events where aggregate_id=any($3::uuid[])) as outbox,(select count(*)::int from public.sessions where metadata->>'lead_id'=any($4::text[])) as sessions,(select count(*)::int from public.wdcc_touchpoints where metadata->>'lead_id'=any($4::text[])) as touchpoints,(select count(*)::int from public.wdcc_candidate_actions where action_payload->>'lead_id'=any($4::text[])) as candidate_actions,(select count(*)::int from public.wdcc_customers where lower(email)=any($5::text[])) as customers",[STOCK,Object.values(IDEMPOTENCY),leadIds.length?leadIds:["00000000-0000-0000-0000-000000000000"],leadIds.length?leadIds:["00000000-0000-0000-0000-000000000000"],Object.values(LEAD_EMAILS)]);
  assert.deepEqual(remaining?.[0],{vehicles:0,leads:0,outbox:0,sessions:0,touchpoints:0,candidate_actions:0,customers:0},"Exact synthetic row cleanup failed");
  const authRemaining=await sql.query(`
    select
      (select count(*)::int from neon_auth."user" where id=any($1::uuid[]) or lower(email)=any($2::text[])) as users,
      (select count(*)::int from neon_auth.account where "userId"=any($1::uuid[])) as accounts,
      (select count(*)::int from neon_auth.session where "userId"=any($1::uuid[])) as auth_sessions,
      (select count(*)::int from neon_auth.member where "userId"=any($1::uuid[])) as auth_members,
      (select count(*)::int from neon_auth.verification where lower(identifier)=any($2::text[])) as verifications,
      (select count(*)::int from public.user_access where user_id=any($1::uuid[])) as user_access,
      (select count(*)::int from public.dealer_memberships where user_id=any($1::uuid[])) as dealer_memberships
  `,[authIds,syntheticAuthEmails]);
  assert.deepEqual(authRemaining?.[0],{users:0,accounts:0,auth_sessions:0,auth_members:0,verifications:0,user_access:0,dealer_memberships:0},"Exact synthetic Auth/account/session/membership cleanup failed");
  report.safety.cleanupVerified=true;
  return {leadIds,vehicleIds,authUserIds,authSessionIds:created.authSessionIds,remaining:{...remaining[0],...authRemaining[0]}};
}

async function stopApp(){
  if(!appProcess||appProcess.exitCode!==null)return;
  appProcess.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve=>appProcess.once("exit",resolve)),
    new Promise(resolve=>setTimeout(resolve,4_000))
  ]);
  if(appProcess.exitCode===null)appProcess.kill("SIGKILL");
}

async function writeReport(){
  await fs.mkdir(ARTIFACT_DIR,{recursive:true});
  const reportPath=path.join(ARTIFACT_DIR,"report.json");
  report.artifacts.report=reportPath;
  await fs.writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`,"utf8");
  let redactedLogs=appLogs;
  for(const [secret,replacement] of [[DATABASE_URL,"[REDACTED_DATABASE_URL]"],[AUTH_IDENTITIES.dealer.password,"[REDACTED_DEALER_PASSWORD]"],[AUTH_IDENTITIES.admin.password,"[REDACTED_ADMIN_PASSWORD]"],[CRON_SECRET,"[REDACTED_CRON_SECRET]"]]){
    redactedLogs=redactedLogs.replaceAll(secret,replacement);
  }
  await fs.writeFile(path.join(ARTIFACT_DIR,"app.log"),redactedLogs,"utf8");
  console.log(JSON.stringify({ok:report.ok,runId:RUN_ID,branchId:EXPECTED_BRANCH,emailCaptures:report.email.captured,cleanupVerified:report.safety.cleanupVerified,report:reportPath}));
}

let failure=null;
try{
  await fs.mkdir(ARTIFACT_DIR,{recursive:true});
  await verifySafety();
  await provisionAuthIdentities();
  await startServices();
  await verifyFlow();
  report.ok=true;
}catch(error){
  failure=error;
  report.failure=error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error);
  console.error(error);
}finally{
  if(browser)await browser.close().catch(()=>{});
  await stopApp().catch(error=>{report.stopError=String(error);});
  await closeServer(mockServer).catch(error=>{report.mockStopError=String(error);});
  try{report.cleanup=await cleanup();}catch(error){report.cleanupError=error instanceof Error?error.message:String(error);failure=failure||error;}
  await fs.rm(MEDIA_DIR,{recursive:true,force:true}).catch(error=>{report.mediaCleanupError=String(error);failure=failure||error;});
  await fs.rm(APP_SANDBOX_DIR,{recursive:true,force:true}).catch(error=>{report.appSandboxCleanupError=String(error);failure=failure||error;});
  report.finishedAt=new Date().toISOString();
  report.ok=report.ok&&!failure&&report.safety.cleanupVerified;
  await writeReport();
}

if(failure)throw failure;
assert.equal(report.ok,true,"Launch readiness proof did not complete");
