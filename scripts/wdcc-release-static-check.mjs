/**
 * WDCC static acceptance regression — zero network, zero credentials, zero writes.
 * Run from CPX1 repository root; validates code presence, not deployed behavior.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const checks=[];
function check(name,fn){
  try{fn();checks.push({name,pass:true});}
  catch(error){checks.push({name,pass:false,error:String(error.message||error)});}
}
const required=[
  "app/about/page.tsx","app/sitemap.ts","app/robots.ts",
  "app/forgot-password/page.tsx","app/reset-password/page.tsx",
  "app/api/auth/password-reset/request/route.ts",
  "app/api/auth/password-reset/confirm/route.ts",
  "app/inventory/layout.tsx","app/contact/layout.tsx",
  "app/get-approved/layout.tsx","app/schedule-test-drive/layout.tsx",
  "app/privacy/layout.tsx","app/terms/layout.tsx","app/login/layout.tsx"
];
for(const file of required)check("file "+file,()=>assert.equal(fs.existsSync(path.join(root,file)),true));
check("about page is distinct",()=>assert.match(read("app/about/page.tsx"),/export default function About/));
check("sitemap canonical production host",()=>assert.match(read("app/sitemap.ts"),/https:\/\/wedontcarecars\.com/));
check("robots references sitemap",()=>assert.match(read("app/robots.ts"),/sitemap\.xml/));
check("login recovery discovery",()=>assert.match(read("app/login/page.tsx"),/href="\/forgot-password"/));
check("reset request uses account-generic reply",()=>assert.match(read("app/api/auth/password-reset/request/route.ts"),/const GENERIC/));
check("reset token is handled by server",()=>assert.match(read("app/api/auth/password-reset/confirm/route.ts"),/export async function POST/));
check("public inventory default scoped",()=>assert.match(read("app/api/inventory/route.ts"),/scope==="dealer"\?proxyDealer\(request,"\/api\/inventory"\):proxyPublicInventory\(request\)/));
check("privileged dealer inventory explicitly scoped",()=>assert.match(read("app/dealer/inventory/page.tsx"),/api\/inventory\?scope=dealer/));
check("vehicle editor explicitly scoped",()=>assert.match(read("app/dealer/inventory/VehicleEditor.tsx"),/api\/inventory\?scope=dealer/));
check("five verified recovery photo IDs",()=>assert.equal((read("lib/recoveryVehicleImage.ts").match(/^  "[0-9]{4}-/gm)||[]).length,5));
check("dealer image source points at verified public media",()=>assert.match(read("lib/recoveryVehicleImage.ts"),/https:\/\/wedontcarecars\.com\/assets\/cars/));
check("public metadata has explicit canonical",()=>assert.match(read("app/inventory/layout.tsx"),/canonical/));
check("admin/dealer marked noindex",()=>assert.match(read("app/dealer/layout.tsx"),/index:false/));
const failures=checks.filter(x=>!x.pass);
console.log(JSON.stringify({kind:"WDCC_STATIC_RELEASE_GATE",tests:checks.length,pass:checks.length-failures.length,fail:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
