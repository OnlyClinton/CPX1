#!/usr/bin/env bash
set -euo pipefail
git fetch origin qa/wdcc-canonical-hardening release/8ar-on-exact-2vfd recovered-2vfd-source wdcc-auth-live-fix wdcc-admin-dealer-final-candidate
git checkout -B qa/wdcc-full-candidate-v1 origin/main

git show origin/qa/wdcc-canonical-hardening:app/Exact2vfDHome.tsx > app/Exact2vfDHome.tsx
mkdir -p app/privacy app/terms
git show origin/qa/wdcc-canonical-hardening:app/privacy/page.tsx > app/privacy/page.tsx
git show origin/qa/wdcc-canonical-hardening:app/terms/page.tsx > app/terms/page.tsx
git show origin/release/8ar-on-exact-2vfd:app/exact2vfd.css > app/exact2vfd.css
# Use exact recovered 2vfD source CSS, not a runtime _next URL.
git show origin/recovered-2vfd-source:src/app/globals.css > app/exact2vfd-base.css
test "$(wc -c < app/exact2vfd-base.css)" -gt 90000
sed -i '1{/^@import url(/d;}' app/exact2vfd.css
cat > app/page.tsx <<'EOF'
import Exact2vfDHome from "./Exact2vfDHome";
export default function Home(){return <Exact2vfDHome/>}
EOF
python3 <<'PY'
from pathlib import Path
p=Path('app/layout.tsx');s=p.read_text()
if 'exact2vfd-base.css' not in s:
    s=s.replace('import"./composite.css";','import"./composite.css";import"./exact2vfd-base.css";import"./exact2vfd.css";')
p.write_text(s)
PY

git show origin/wdcc-auth-live-fix:app/api/auth/login/route.ts > /tmp/login.ts
git show origin/wdcc-auth-live-fix:app/api/auth/session/route.ts > /tmp/session.ts
git show origin/wdcc-auth-live-fix:app/api/auth/logout/route.ts > /tmp/logout.ts
git show origin/wdcc-admin-dealer-final-candidate:app/api/admin/users/route.ts > /tmp/adminusers.ts
git show origin/wdcc-admin-dealer-final-candidate:app/api/crm/dashboard/route.ts > /tmp/crm.ts
git show 'origin/wdcc-admin-dealer-final-candidate:app/api/leads/[id]/route.ts' > /tmp/leadid.ts

cat > lib/dealerRuntime.ts <<'EOF'
import crypto from "node:crypto";
const AUTHORITY_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export function isDealerRuntime(request?:Request){
  if(process.env.VERCEL_PROJECT_ID===AUTHORITY_PROJECT_ID)return true;
  if(!request)return false;
  try{const host=new URL(request.url).host.toLowerCase();return host==="wdcc-cpx-launch.vercel.app"||host.startsWith("wdcc-cpx-launch-")}catch{return false}
}
export function requestId(request:Request){const supplied=String(request.headers.get("x-wdcc-request-id")||request.headers.get("x-request-id")||"").trim().slice(0,160);return supplied||crypto.randomUUID()}
EOF

python3 <<'PY'
from pathlib import Path
base='import {isDealerRuntime} from "../../../../lib/dealerRuntime";\nimport {proxyDealer} from "../../../../lib/dealerProxy";\n'
for src,dst,kind in [('/tmp/login.ts','app/api/auth/login/route.ts','login'),('/tmp/session.ts','app/api/auth/session/route.ts','session'),('/tmp/logout.ts','app/api/auth/logout/route.ts','logout')]:
    s=Path(src).read_text()
    if kind=='login': s=s.replace('export async function POST(request:Request){','export async function POST(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/login");')
    elif kind=='session': s=s.replace('export async function GET(){','export async function GET(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/session");')
    else: s=s.replace('export async function POST(){','export async function POST(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/logout");')
    Path(dst).write_text(base+s)

s=Path('/tmp/adminusers.ts').read_text();s=base+s
s=s.replace('export async function GET(){','export async function GET(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/users");')
s=s.replace('export async function POST(req:Request){','export async function POST(req:Request){\n  if(!isDealerRuntime(req))return proxyDealer(req,"/api/admin/users");')
s=s.replace('export async function PATCH(req:Request){','export async function PATCH(req:Request){\n  if(!isDealerRuntime(req))return proxyDealer(req,"/api/admin/users");')
Path('app/api/admin/users/route.ts').write_text(s)

s=Path('/tmp/crm.ts').read_text();s=base+s
s=s.replace('export async function GET(){','export async function GET(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/crm/dashboard");')
Path('app/api/crm/dashboard/route.ts').write_text(s)

p=Path('app/api/leads/route.ts');s=p.read_text()
s=s.replace('import {readState,writeState} from "../../../lib/store";','import {readState,writeState} from "../../../lib/store";\nimport {isDealerRuntime} from "../../../lib/dealerRuntime";\nimport {proxyDealer} from "../../../lib/dealerProxy";')
start=s.index('function canonicalHost(');end=s.index('\n\nexport async function GET',start)
s=s[:start]+'function canonicalHost(req:Request){return isDealerRuntime(req);}' + s[end:]
s=s.replace('export async function GET(){','export async function GET(request:Request){if(!isDealerRuntime(request))return proxyDealer(request,"/api/leads");')
s=s.replace('https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app','https://wdcc-cpx-launch.vercel.app')
p.write_text(s)

p=Path('lib/dealerProxy.ts');p.write_text(p.read_text().replace('https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app','https://wdcc-cpx-launch.vercel.app'))
p=Path('app/api/media/route.ts');s=p.read_text();s='import {isDealerRuntime} from "../../../lib/dealerRuntime";import {proxyDealer} from "../../../lib/dealerProxy";'+s;s=s.replace('export async function GET(req:Request){','export async function GET(req:Request){if(!isDealerRuntime(req))return proxyDealer(req,"/api/media");');p.write_text(s)

s=Path('/tmp/leadid.ts').read_text();s=base+s
s=s.replace('export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){','export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){\n  if(!isDealerRuntime(req)){const {id}=await params;return proxyDealer(req,`/api/leads/${encodeURIComponent(id)}`);}')
Path('app/api/leads/[id]/route.ts').write_text(s)

p=Path('app/api/admin/export/route.ts');s=p.read_text();s=base+s;s=s.replace('export async function GET(){','export async function GET(request:Request){\n  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/export");');p.write_text(s)
PY

cat > app/api/health/route.ts <<'EOF'
import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {readState} from "../../../lib/store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(isDealerRuntime(request)){
    try{const state=await readState();return NextResponse.json({ok:true,degraded:false,service:"wdcc-canonical-authority",release:"WDCC-V53-CANONICAL",revision:state.revision,storage:{counts:{users:state.users.length,vehicles:state.vehicles.length,leads:state.leads.length,audit:state.audit.length}},commit:process.env.VERCEL_GIT_COMMIT_SHA||null},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({ok:false,degraded:true,error:error instanceof Error?error.message:"state_failed"},{status:503})}
  }
  try{const {response,json}=await backendHealth();const ok=response.ok&&json?.ok===true;return NextResponse.json({...json,ok,degraded:!ok,service:"wdcc-facade",commit:process.env.VERCEL_GIT_COMMIT_SHA||null},{status:ok?200:503,headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({ok:false,degraded:true,backend:"unreachable"},{status:503})}
}
EOF
cat > app/api/events/route.ts <<'EOF'
import crypto from "node:crypto";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState,writeState} from "../../../lib/store";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/events");
  try{const b=await request.json();const now=new Date().toISOString();const state=await readState();state.audit.push({id:crypto.randomUUID(),at:now,action:String(b?.event||"event").slice(0,100),actor:"public",source:String(b?.source||"").slice(0,100),channel:String(b?.channel||"").slice(0,40),path:String(b?.path||"").slice(0,240)});await writeState(state);return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({ok:false,error:"event_failed"},{status:500})}
}
EOF

# High-impact lint/a11y fixes only; no broad formatter rewrite.
python3 <<'PY'
from pathlib import Path
p=Path('app/LeadForm.tsx')
if p.exists():
    s=p.read_text().replace('const body:any=Object.fromEntries(form.entries());','const body:Record<string,FormDataEntryValue>=Object.fromEntries(form.entries());')
    s=s.replace('{message&&<div className="leadMessage" role="status" aria-live="polite">{message}</div>}','{message&&<output className="leadMessage" aria-live="polite">{message}</output>}')
    p.write_text(s)
p=Path('app/admin/login/page.tsx')
if p.exists():
    s=p.read_text().replace('import { FormEvent, useState } from "react";','import { type FormEvent, useState } from "react";')
    s=s.replace('}catch(x:any){setMsg(x?.message||"Sign-in failed"); setBusy(false)}','}catch(x:unknown){setMsg(x instanceof Error?x.message:"Sign-in failed"); setBusy(false)}')
    s=s.replace('<label style={lab}>Username</label>\n      <input autoComplete="username"','<label htmlFor="admin-username" style={lab}>Username</label>\n      <input id="admin-username" autoComplete="username"')
    s=s.replace('<label style={lab}>Password</label>\n      <input type="password"','<label htmlFor="admin-password" style={lab}>Password</label>\n      <input id="admin-password" type="password"')
    s=s.replace('<button disabled={busy} style={btn}>','<button type="submit" disabled={busy} style={btn}>')
    p.write_text(s)
PY

npm ci
npx tsc --noEmit
npm run build
set +e
npx --yes @biomejs/biome@1.9.4 lint --max-diagnostics=1000 app lib scripts 2>&1 | tee /tmp/wdcc-candidate-lint.txt
set -e

grep -q 'Exact2vfDHome' app/page.tsx
grep -q 'TrackedCallLink' app/Exact2vfDHome.tsx
grep -q 'exact2vfd-base.css' app/layout.tsx
! grep -Eq 'href="/(financing|reviews|about)"' app/Exact2vfDHome.tsx
grep -q 'wdcc-cpx-launch.vercel.app' lib/dealerProxy.ts
! grep -Rqs 'wdcc-cpx-launch-b01un0onc' app lib

git config user.name 'WDCC QA Bot'
git config user.email 'wdcc-qa@users.noreply.github.com'
git add app lib scripts
git commit -m 'Build full WDCC canonical candidate from latest main' || true
git push --force-with-lease origin HEAD:qa/wdcc-full-candidate-v1
