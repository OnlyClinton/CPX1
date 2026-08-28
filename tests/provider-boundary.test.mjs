import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import test from "node:test";

import {isDealerRuntime} from "../lib/dealerRuntime.ts";
import {WDCC_PHOENIX_PROJECT_ID} from "../lib/wdccAuthority.ts";

const source=relative=>readFile(new URL(`../${relative}`,import.meta.url),"utf8");

let proxyModulePromise;
function proxyModule(){
  return proxyModulePromise??=(async()=>{
    const typescript=(await source("lib/dealerProxy.ts")).replace(
      'import {canonicalDealerBackend} from "./wdccAuthority";',
      'const canonicalDealerBackend=()=>String(process.env.WDCC_DEALER_BACKEND_URL||"https://wdcc-cpx-launch-cpxagency.vercel.app").trim().replace(/\\/$/,"");'
    );
    const javascript=stripTypeScriptTypes(typescript,{mode:"transform"});
    return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
  })();
}

function restore(name,value){
  if(value===undefined)delete process.env[name];
  else process.env[name]=value;
}

function firstAfter(text,start,needle){
  const offset=text.indexOf(start);
  assert.notEqual(offset,-1,`missing source marker: ${start}`);
  return text.indexOf(needle,offset);
}

function assertGuardBefore(text,start,guard,providerCall){
  const guardAt=firstAfter(text,start,guard);
  const providerAt=firstAfter(text,start,providerCall);
  assert.notEqual(guardAt,-1,`missing frontend proxy guard after ${start}`);
  assert.notEqual(providerAt,-1,`missing canonical provider operation after ${start}`);
  assert.ok(guardAt<providerAt,`${start} can touch the canonical provider before its frontend guard`);
}

test("every Neon/Auth/Blob route terminates on Vercel and proxies from Cloudflare",async()=>{
  const files=Object.fromEntries(await Promise.all([
    "app/api/health/route.ts","app/api/inventory/route.ts","app/api/inventory/[id]/route.ts",
    "app/api/leads/route.ts","app/api/leads/[id]/route.ts","app/api/crm/dashboard/route.ts",
    "app/api/admin/export/route.ts","app/api/admin/users/route.ts","app/api/media/route.ts",
    "app/api/upload/route.ts","app/api/media-upload/route.ts","app/api/dealer/vehicle-logs/route.ts",
    "app/api/internal/lead-outbox/route.ts","app/api/lead/route.ts","app/api/events/route.ts","app/api/qa-proof/route.ts"
  ].map(async path=>[path,await source(path)])));

  assertGuardBefore(files["app/api/health/route.ts"],"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/health\")","databaseIdentity()");

  const inventory=files["app/api/inventory/route.ts"];
  assert.match(inventory,/isIsolatedWorkersDevRequest\(request\)&&process\.env\.WDCC_MOCKUP_PREVIEW===\"1\"/,"the explicitly gated workers.dev design fixture must remain available");
  assertGuardBefore(inventory,"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/inventory\")","currentUser()");
  assertGuardBefore(inventory,"export async function POST(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/inventory\")","signedSessionSubject()");

  const vehicle=files["app/api/inventory/[id]/route.ts"];
  assertGuardBefore(vehicle,"export async function GET(request:Request","if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`)","currentUser()");
  assertGuardBefore(vehicle,"export async function PATCH(request:Request","if(!isDealerRuntime(request))return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`)","request.json()");

  const leads=files["app/api/leads/route.ts"];
  assertGuardBefore(leads,"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/leads\")","currentUser()");
  assertGuardBefore(leads,"export async function POST(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/leads\")","request.json()");
  assertGuardBefore(files["app/api/leads/[id]/route.ts"],"export async function PATCH(request:Request","if(!isDealerRuntime(request))return proxyDealer(request,`/api/leads/${encodeURIComponent(id)}`)","signedSessionSubject()");
  assertGuardBefore(files["app/api/crm/dashboard/route.ts"],"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/crm/dashboard\")","signedSessionSubject()");
  assertGuardBefore(files["app/api/admin/export/route.ts"],"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/admin/export\")","currentUser()");

  const users=files["app/api/admin/users/route.ts"];
  assertGuardBefore(users,"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/admin/users\")","requireAdmin()");
  assertGuardBefore(users,"async function unsupported(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/admin/users\")","requireAdmin()");

  const media=files["app/api/media/route.ts"];
  assertGuardBefore(media,"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/media\")","getVehicle(");
  assert.match(media,/if\(!publicListing\)[\s\S]*currentUser\(\)[\s\S]*canStaffReadVehicleMedia/,"private media must retain canonical staff authorization");

  const upload=files["app/api/upload/route.ts"];
  assertGuardBefore(upload,"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/upload\")","currentUser()");
  assertGuardBefore(upload,"export async function POST(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/upload\")","vehicleBlobClientUploadToken()");
  assert.match(files["app/api/media-upload/route.ts"],/export \{GET,POST\} from "\.\.\/upload\/route"/,"the compatibility upload route must reuse the guarded canonical implementation");

  assertGuardBefore(files["app/api/dealer/vehicle-logs/route.ts"],"export async function GET(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/dealer/vehicle-logs\")","currentUser()");
  assertGuardBefore(files["app/api/internal/lead-outbox/route.ts"],"async function run(request:Request)","if(!isDealerRuntime(request))return proxyDealer(request,\"/api/internal/lead-outbox\")","processDueLeadOutbox(");

  const legacyLead=files["app/api/lead/route.ts"];
  assert.match(legacyLead,/isDealerRuntime\(request\)\?canonicalPOST\(request\):proxyDealer\(request,"\/api\/leads"\)/,"the legacy singular lead route must converge on the canonical plural endpoint");
  assert.match(files["app/api/events/route.ts"],/if\(!isDealerRuntime\(request\)\)return proxyDealer\(request,"\/api\/events"\)[\s\S]*analytics_ingest_unavailable/,"canonical events must not proxy-loop");
  assert.doesNotMatch(files["app/api/qa-proof/route.ts"],/proxyDealer|wdccDb|vehicleMedia/,"the retired QA endpoint must stay local and opaque");
});

test("proxy preserves GET query, identity headers, cookies, status and public cache semantics",async()=>{
  const {proxyDealer}=await proxyModule();
  const previous={role:process.env.WDCC_RUNTIME_ROLE,project:process.env.VERCEL_PROJECT_ID,backend:process.env.WDCC_DEALER_BACKEND_URL};
  const priorFetch=globalThis.fetch;
  let capture;
  try{
    process.env.WDCC_RUNTIME_ROLE="frontend";
    delete process.env.VERCEL_PROJECT_ID;
    process.env.WDCC_DEALER_BACKEND_URL="https://canonical.example.test";
    globalThis.fetch=async(input,init)=>{
      capture={url:String(input),init};
      return new Response(JSON.stringify({ok:true}),{status:206,headers:{
        "content-type":"application/json","cache-control":"public, max-age=0, must-revalidate","x-wdcc-data-authority":"neon"
      }});
    };
    const request=new Request("https://preview.workers.dev/api/inventory?scope=dealer&page=2",{headers:{
      accept:"application/json",authorization:"Bearer cron-proof",cookie:"__Host-wdcc_session=opaque",
      "x-wdcc-request-id":"request-proof","x-wdcc-qa-signature":"sha256=proof"
    }});
    assert.equal(isDealerRuntime(request),false);
    const response=await proxyDealer(request,"/api/inventory");
    assert.equal(capture.url,"https://canonical.example.test/api/inventory?scope=dealer&page=2");
    assert.equal(capture.init.method,"GET");
    assert.equal(capture.init.body,undefined);
    assert.equal(capture.init.headers.get("cookie"),"__Host-wdcc_session=opaque");
    assert.equal(capture.init.headers.get("authorization"),"Bearer cron-proof");
    assert.equal(capture.init.headers.get("x-wdcc-request-id"),"request-proof");
    assert.equal(capture.init.headers.get("x-wdcc-qa-signature"),"sha256=proof");
    assert.equal(capture.init.headers.get("x-wdcc-proxy-hop"),"1");
    assert.equal(response.status,206);
    assert.equal(response.headers.get("cache-control"),"public, max-age=0, must-revalidate");
    assert.equal(response.headers.get("x-wdcc-data-authority"),"neon");
    assert.equal(response.headers.get("x-wdcc-backend"),"canonical-vercel");
    assert.deepEqual(await response.json(),{ok:true});
  }finally{
    globalThis.fetch=priorFetch;
    restore("WDCC_RUNTIME_ROLE",previous.role);restore("VERCEL_PROJECT_ID",previous.project);restore("WDCC_DEALER_BACKEND_URL",previous.backend);
  }
});

test("proxy preserves POST/PATCH bodies, idempotency and every canonical set-cookie",async()=>{
  const {proxyDealer}=await proxyModule();
  const previous={role:process.env.WDCC_RUNTIME_ROLE,project:process.env.VERCEL_PROJECT_ID,backend:process.env.WDCC_DEALER_BACKEND_URL};
  const priorFetch=globalThis.fetch;
  const captures=[];
  try{
    process.env.WDCC_RUNTIME_ROLE="frontend";delete process.env.VERCEL_PROJECT_ID;
    process.env.WDCC_DEALER_BACKEND_URL="https://canonical.example.test";
    globalThis.fetch=async(input,init)=>{
      captures.push({url:String(input),init,body:init.body?Buffer.from(init.body).toString("utf8"):""});
      const headers=new Headers({"content-type":"application/json","cache-control":"public, max-age=60"});
      headers.append("set-cookie","__Host-wdcc_session=new; Path=/; Secure; HttpOnly; SameSite=Lax");
      headers.append("set-cookie","wdcc_aux=1; Path=/; Secure; HttpOnly; SameSite=Lax");
      return new Response(JSON.stringify({ok:true}),{status:201,headers});
    };
    const postBody=JSON.stringify({year:2020,make:"Dodge",model:"Challenger"});
    const post=await proxyDealer(new Request("https://preview.workers.dev/api/inventory?scope=dealer",{method:"POST",headers:{
      "content-type":"application/json",origin:"https://preview.workers.dev","idempotency-key":"vehicle-once",cookie:"__Host-wdcc_session=old"
    },body:postBody}),"/api/inventory");
    assert.equal(captures[0].url,"https://canonical.example.test/api/inventory?scope=dealer");
    assert.equal(captures[0].init.method,"POST");
    assert.equal(captures[0].body,postBody);
    assert.equal(captures[0].init.headers.get("idempotency-key"),"vehicle-once");
    assert.equal(post.headers.get("cache-control"),"private, no-store, max-age=0, must-revalidate");
    assert.equal(post.headers.get("access-control-allow-origin"),"https://preview.workers.dev");
    assert.equal(post.headers.getSetCookie().length,2);

    const patchBody=JSON.stringify({status:"published"});
    const patch=await proxyDealer(new Request("https://preview.workers.dev/api/inventory/id-1?verify=1",{method:"PATCH",headers:{
      "content-type":"application/json",origin:"https://preview.workers.dev","x-wdcc-request-id":"publish-once"
    },body:patchBody}),"/api/inventory/id-1");
    assert.equal(captures[1].url,"https://canonical.example.test/api/inventory/id-1?verify=1");
    assert.equal(captures[1].init.method,"PATCH");
    assert.equal(captures[1].body,patchBody);
    assert.equal(patch.status,201);
  }finally{
    globalThis.fetch=priorFetch;
    restore("WDCC_RUNTIME_ROLE",previous.role);restore("VERCEL_PROJECT_ID",previous.project);restore("WDCC_DEALER_BACKEND_URL",previous.backend);
  }
});

test("provider boundary rejects hostile browser origins and blocks both loop modes",async()=>{
  const {proxyDealer}=await proxyModule();
  const previous={role:process.env.WDCC_RUNTIME_ROLE,project:process.env.VERCEL_PROJECT_ID,backend:process.env.WDCC_DEALER_BACKEND_URL};
  const priorFetch=globalThis.fetch;
  let calls=0;
  try{
    process.env.WDCC_RUNTIME_ROLE="frontend";delete process.env.VERCEL_PROJECT_ID;
    process.env.WDCC_DEALER_BACKEND_URL="https://canonical.example.test";
    globalThis.fetch=async()=>{calls++;return new Response(null,{status:204});};
    const hostile=await proxyDealer(new Request("https://preview.workers.dev/api/leads",{method:"POST",headers:{origin:"https://evil.example","content-type":"application/json"},body:"{}"}),"/api/leads");
    assert.equal(hostile.status,403);assert.equal(calls,0);

    const hopped=await proxyDealer(new Request("https://preview.workers.dev/api/leads",{headers:{"x-wdcc-proxy-hop":"1"}}),"/api/leads");
    assert.equal(hopped.status,508);assert.equal(calls,0);

    process.env.WDCC_DEALER_BACKEND_URL="https://preview.workers.dev";
    const priorError=console.error;
    console.error=()=>{};
    const sameOrigin=await proxyDealer(new Request("https://preview.workers.dev/api/health"),"/api/health").finally(()=>{console.error=priorError;});
    assert.equal(sameOrigin.status,503);assert.equal(calls,0);

    process.env.WDCC_RUNTIME_ROLE="frontend";
    process.env.VERCEL_PROJECT_ID=WDCC_PHOENIX_PROJECT_ID;
    assert.equal(isDealerRuntime(new Request("https://canonical.example.test/api/health")),true,"known Vercel canonical identity must override a stale frontend role");
  }finally{
    globalThis.fetch=priorFetch;
    restore("WDCC_RUNTIME_ROLE",previous.role);restore("VERCEL_PROJECT_ID",previous.project);restore("WDCC_DEALER_BACKEND_URL",previous.backend);
  }
});
