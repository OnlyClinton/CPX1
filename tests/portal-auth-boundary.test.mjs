import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {isDealerRuntime} from "../lib/dealerRuntime.ts";
import {WDCC_PHOENIX_PROJECT_ID} from "../lib/wdccAuthority.ts";

const source=relative=>readFile(new URL(`../${relative}`,import.meta.url),"utf8");

function restore(name,value){
  if(value===undefined)delete process.env[name];
  else process.env[name]=value;
}

test("Cloudflare auth routes proxy once and the canonical Vercel runtime owns auth",async()=>{
  const routes=[
    ["app/api/auth/login/route.ts","POST","/api/auth/login"],
    ["app/api/auth/session/route.ts","GET","/api/auth/session"],
    ["app/api/auth/logout/route.ts","POST","/api/auth/logout"]
  ];
  for(const[path,method,upstream]of routes){
    const text=await source(path);
    assert.match(text,/import \{isDealerRuntime\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/dealerRuntime";/);
    assert.match(text,/import \{proxyDealer\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/dealerProxy";/);
    assert.match(text,new RegExp(`export async function ${method}\\(request:Request\\)\\{\\n  if\\(!isDealerRuntime\\(request\\)\\)return proxyDealer\\(request,"${upstream.replaceAll("/","\\/")}"\\);`));
  }
  const dealerProxy=await source("lib/dealerProxy.ts");
  assert.match(dealerProxy,/"content-type","accept","cookie","user-agent","idempotency-key"/,"the browser session cookie must reach the canonical backend");
  assert.match(dealerProxy,/getSetCookie/);
  assert.match(dealerProxy,/headers\.append\("set-cookie",cookie\)/,"the canonical session cookie must reach the Cloudflare browser");

  const previousRole=process.env.WDCC_RUNTIME_ROLE;
  const previousProject=process.env.VERCEL_PROJECT_ID;
  try{
    process.env.WDCC_RUNTIME_ROLE="frontend";
    delete process.env.VERCEL_PROJECT_ID;
    assert.equal(isDealerRuntime(new Request("https://preview.workers.dev/api/auth/session")),false,"an explicit Cloudflare/frontend role without Vercel identity must proxy");

    process.env.VERCEL_PROJECT_ID=WDCC_PHOENIX_PROJECT_ID;
    assert.equal(isDealerRuntime(new Request("https://preview.workers.dev/api/auth/session")),true,"known canonical Vercel identity must override a stale frontend role and prevent a self-proxy loop");

    process.env.WDCC_RUNTIME_ROLE="backend";
    assert.equal(isDealerRuntime(new Request("https://wdcc-cpx-launch.vercel.app/api/auth/session")),true,"the canonical backend must terminate auth locally");

    delete process.env.WDCC_RUNTIME_ROLE;
    process.env.VERCEL_PROJECT_ID=WDCC_PHOENIX_PROJECT_ID;
    assert.equal(isDealerRuntime(new Request("https://unexpected-preview.vercel.app/api/auth/session")),true,"the canonical project-id fallback must prevent proxy loops");
  }finally{
    restore("WDCC_RUNTIME_ROLE",previousRole);
    restore("VERCEL_PROJECT_ID",previousProject);
  }
});

test("server-guarded portal clients do not repeat the auth-session request",async()=>{
  const[adminLayout,authContext,portal,inventory,vehicleEditor,vehicleImport,inventoryRoute,vehicleRoute]=await Promise.all([
    source("app/admin/layout.tsx"),
    source("app/PortalAuthContext.tsx"),
    source("app/PortalExperience.tsx"),
    source("app/dealer/inventory/InventoryManager.tsx"),
    source("app/dealer/inventory/VehicleEditor.tsx"),
    source("app/dealer/inventory/import/page.tsx"),
    source("app/api/inventory/route.ts"),
    source("app/api/inventory/[id]/route.ts")
  ]);

  assert.match(adminLayout,/if\(!user\)redirect\("\/login\?next=%2Fadmin"\)/);
  assert.match(adminLayout,/if\(user\.role!=="platform_admin"\)redirect/);
  assert.match(adminLayout,/PortalAuthProvider value=\{value\}/);
  assert.match(authContext,/role:"platform_admin"\|"dealer_agent";\n  displayName:string;/);
  assert.doesNotMatch(authContext,/email|tenantId|session|cookie|password/i,"the client auth context must stay identity-minimal");

  assert.doesNotMatch(portal,/\/api\/auth\/session/);
  assert.match(portal,/fetch\("\/api\/crm\/dashboard"/);
  assert.match(portal,/location\.replace\(`\/login\?next=/);
  assert.doesNotMatch(portal,/portalLoginPage">/,"authenticated admin content must not first-paint a login form");

  assert.doesNotMatch(inventory,/\/api\/auth\/session/);
  assert.match(inventory,/fetch\("\/api\/inventory\?scope=dealer"/);
  assert.doesNotMatch(vehicleEditor,/\/api\/auth\/session/);
  assert.match(vehicleEditor,/\/api\/inventory\/\$\{encodeURIComponent\(editId\)\}\?scope=dealer/);
  assert.doesNotMatch(vehicleImport,/\/api\/auth\/session/);
  assert.match(inventoryRoute,/dealerScope=new URL\(request\.url\)\.searchParams\.get\("scope"\)==="dealer"/);
  assert.match(inventoryRoute,/if\(dealerScope&&\(!user\|\|!editor\)\)return response\(/);
  assert.match(vehicleRoute,/if\(dealerScope&&\(!user\|\|!includeNonPublic\)\)return json\(/);
});
