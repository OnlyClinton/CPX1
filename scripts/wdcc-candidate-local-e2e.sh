#!/usr/bin/env bash
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN required}"
TEAM="cpxagency"
ORG_ID="team_G6jmETRRl8fV3KfivPOdj8JM"
PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR"
RUNTIME_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB"
STORE_ID="store_cNUyQRVlXtyvZQ5N"
BASE="http://127.0.0.1:3200"
RUN_ID="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
export BASE RUN_ID PROJECT_ID RUNTIME_PROJECT_ID STORE_ID

npm ci
npm install --global vercel@59.3.0 >/dev/null
npm install --no-save playwright@1.55.0 >/dev/null
npx playwright install --with-deps chromium >/dev/null
npm run build

mkdir -p .vercel
printf '{"orgId":"%s","projectId":"%s"}\n' "$ORG_ID" "$PROJECT_ID" > .vercel/project.json

LOCAL_SESSION_SECRET="$(openssl rand -base64 72 | tr -d '\n')"
export LOCAL_SESSION_SECRET
printf '::add-mask::%s\n' "$LOCAL_SESSION_SECRET"

cat > .wdcc-local-sign.cjs <<'NODE'
const crypto=require('crypto');const{get}=require('@vercel/blob');
(async()=>{const r=await get('private/state/platform-v3.json',{access:'private',useCache:false});if(!r||r.statusCode!==200||!r.stream)throw Error('STATE_READ_FAILED');const c=[];for await(const x of r.stream)c.push(x);const s=JSON.parse(Buffer.concat(c).toString('utf8'));const roles=new Set(['dealer_agent','tenant_admin','platform_admin']);const u=(s.users||[]).find(x=>roles.has(String(x.role||'').toLowerCase())&&x.status!=='disabled'&&!x.disabled);if(!u)throw Error('NO_ACTIVE_USER');const raw=Buffer.from(JSON.stringify({id:u.id,role:u.role,exp:Date.now()+30*60*1000})).toString('base64url');const sig=crypto.createHmac('sha256',process.env.LOCAL_SESSION_SECRET).update(raw).digest('base64url');console.log(`QA_COOKIE=${raw}.${sig}`)})().catch(e=>{console.error(e);process.exit(1)})
NODE

env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel env run --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" -- node .wdcc-local-sign.cjs | grep '^QA_COOKIE=' > /tmp/wdcc-session.env
set -a; . /tmp/wdcc-session.env; set +a
export QA_COOKIE
printf '::add-mask::%s\n' "$QA_COOKIE"

cat > .wdcc-local-cleanup.mjs <<'NODE'
import crypto from 'node:crypto';import {del,get,head,put,BlobPreconditionFailedError} from '@vercel/blob';
const path='private/state/platform-v3.json';
async function readStable(){for(let i=0;i<3;i++){const m1=await head(path);const r=await get(path,{access:'private',useCache:false});if(!r||r.statusCode!==200||!r.stream)throw Error('STATE_READ_FAILED');const c=[];for await(const x of r.stream)c.push(x);const raw=Buffer.concat(c);const m2=await head(path);if(m1.etag===m2.etag)return{raw,etag:m2.etag,state:JSON.parse(raw.toString('utf8'))}}throw Error('STATE_TOO_HOT')}
const qLead=l=>String(l?.name||'').toUpperCase().startsWith('WDCC QA LOCAL ')||String(l?.email||'').toLowerCase().includes('qa-local-');
const qVehicle=v=>String(v?.stock||'').toUpperCase().startsWith('WDCC-QA-LOCAL-')||String(v?.stock||'').toUpperCase().startsWith('R36TEST-WDCC-QA-LOCAL-');
let result=null;
for(let attempt=1;attempt<=2;attempt++){
 const before=await readStable(),s=before.state,lids=(s.leads||[]).filter(qLead).map(x=>x.id),vids=(s.vehicles||[]).filter(qVehicle).map(x=>x.id),now=new Date().toISOString();
 if(!lids.length&&!vids.length){result={ok:true,noOp:true,revision:Number(s.revision||0),leadsRemoved:0,vehiclesArchived:0};break}
 const backup=`private/state/backups/platform-v3-pre-local-e2e-clean-r${Number(s.revision||0)}-${now.replace(/[:.]/g,'-')}-${crypto.randomUUID()}.json`;
 await put(backup,before.raw,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
 s.leads=(s.leads||[]).filter(x=>!lids.includes(x.id));s.vehicles=(s.vehicles||[]).map(v=>vids.includes(v.id)?{...v,status:'archived',updatedAt:now,qaCleanupAt:now}:v);s.audit=Array.isArray(s.audit)?s.audit:[];s.audit.push({id:crypto.randomUUID(),at:now,action:'qa.local_e2e.cleanup',actor:'wdcc-candidate-local-e2e',qaLeadsRemoved:lids.length,vehiclesArchived:vids.length,backup});s.revision=Number(s.revision||0)+1;s.updatedAt=now;
 try{await put(path,JSON.stringify(s,null,2)+'\n',{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',ifMatch:before.etag});result={ok:true,noOp:false,revision:s.revision,leadsRemoved:lids.length,vehiclesArchived:vids.length,backup};break}catch(e){if(e instanceof BlobPreconditionFailedError&&attempt<2)continue;throw e}
}
try{const p=process.env.QA_MEDIA_PATH;if(p)await del(p)}catch{}
console.log('LOCAL_CLEANUP='+JSON.stringify(result||{ok:false,error:'missing_result'}));
NODE

cleanup(){
 set +e
 if [ -f /tmp/wdcc-result.json ]; then export QA_MEDIA_PATH="$(jq -r '.mediaPath // ""' /tmp/wdcc-result.json 2>/dev/null)"; else export QA_MEDIA_PATH=""; fi
 env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel env run --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" -- node .wdcc-local-cleanup.mjs > /tmp/wdcc-cleanup.log 2>&1
 if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel env run --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" -- bash -c 'export SESSION_SECRET="$LOCAL_SESSION_SECRET"; export VERCEL_PROJECT_ID="$RUNTIME_PROJECT_ID"; export BLOB_STORE_ID="$STORE_ID"; export PORT=3200; npm start' > /tmp/wdcc-server.log 2>&1 &
SERVER_PID=$!
export SERVER_PID

ready=0
for i in $(seq 1 60); do
 if curl -fsS "$BASE/api/health?local=$RUN_ID" -o /tmp/wdcc-health.json 2>/dev/null; then
  if jq -e '.ok==true and .degraded==false and (.service=="wdcc-canonical-authority" or .service=="wdcc-hardened-dealer-facade")' /tmp/wdcc-health.json >/dev/null 2>&1; then ready=1;break;fi
 fi
 sleep 1
done
if [ "$ready" != 1 ]; then
 python3 - <<'PY'
import json,pathlib
p=pathlib.Path('/tmp/wdcc-health.json');h=json.loads(p.read_text()) if p.exists() else None
s=pathlib.Path('/tmp/wdcc-server.log');tail=s.read_text(errors='replace')[-12000:] if s.exists() else None
pathlib.Path('/tmp/wdcc-result.json').write_text(json.dumps({'ok':False,'failedStage':'health_readiness','health':h,'serverLogTail':tail},indent=2))
PY
 exit 1
fi

cat > .wdcc-local-browser.cjs <<'NODE'
const fs=require('fs');const{chromium}=require('playwright');const{put}=require('@vercel/blob');
const base=process.env.BASE,run=process.env.RUN_ID,cookie=process.env.QA_COOKIE;
function assert(v,m){if(!v)throw Error(m)}
async function json(response,label){const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw Error(`${label}_NON_JSON status=${response.status()} contentType=${response.headers()['content-type']||''} body=${text.slice(0,180)}`)}return data}
(async()=>{
 const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await ctx.newPage();const consoleErrors=[],notFound=[];
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>consoleErrors.push(String(e)));page.on('response',r=>{if(r.status()===404)notFound.push(r.url())});
 await page.goto(base,{waitUntil:'networkidle'});assert((await page.locator('body').innerText()).toUpperCase().includes('BAD CREDIT'),'HOME_COPY_MISSING');assert(await page.locator('img[src*="wdcc-logo-transparent.webp"]').count()>0,'LOGO_MISSING');
 const routes=['/','/inventory','/schedule-test-drive?source=qa-local','/get-approved?source=qa-local','/contact?source=qa-local','/dealer','/dealer/login','/dealer/leads','/dealer/inventory','/dealer/inventory/new','/dealer/inventory/logs','/dealer/crm','/admin','/admin/login','/admin/users','/privacy','/terms'];
 const routeResults=[];for(const path of routes){const r=await ctx.request.get(base+path);routeResults.push({path,status:r.status()});assert(r.status()!==404&&r.status()<500,`ROUTE_${path}_${r.status()}`)}
 const invResp=await ctx.request.get(base+'/api/inventory?before='+Date.now());const inv0=await json(invResp,'INVENTORY');assert(inv0.ok&&Array.isArray(inv0.items),'INVENTORY_CONTRACT');assert(inv0.items.every(v=>Number(v.year)>1900&&String(v.make||'').trim()&&String(v.model||'').trim()&&Number(v.price)>0&&!String(v.stock||'').toUpperCase().startsWith('R36TEST-')),'INVENTORY_PUBLIC_FILTER');
 async function lead(kind,path,source,phone){await page.goto(base+path+'?source='+encodeURIComponent(source),{waitUntil:'networkidle'});await page.locator('input[name="name"]').fill(`WDCC QA LOCAL ${kind} ${run}`);await page.locator('input[name="phone"]').fill(phone);await page.locator('input[name="email"]').fill(`qa-local-${kind}-${run}@invalid.example`);const vi=page.locator('input[name="vehicleInterest"],textarea[name="vehicleInterest"]');if(await vi.count())await vi.first().fill('Local candidate QA vehicle');await page.locator('input[name="consent"]').check();const pending=page.waitForResponse(r=>r.url().includes('/api/leads')&&r.request().method()==='POST');await page.getByRole('button',{name:'SEND REQUEST'}).click();const response=await pending;const j=await json(response,`LEAD_${kind}`);if(!(response.ok()&&j.ok&&j.persisted)){throw Error(`LEAD_${kind}_FAILED status=${response.status()} body=${JSON.stringify(j)}`)}assert(j.item.kind===kind&&j.item.source===source,`LEAD_${kind}_ATTRIBUTION`);return j.item}
 const schedule=await lead('schedule','/schedule-test-drive','schedule-test-drive','813-555-0181');const approval=await lead('approval','/get-approved','get-approved','813-555-0182');const contact=await lead('contact','/contact','call-sean','813-555-0183');
 const dedupe=await ctx.request.post(base+'/api/leads',{headers:{'Content-Type':'application/json','Idempotency-Key':schedule.idempotencyKey},data:{qa:true,kind:'schedule',name:schedule.name,phone:schedule.phone,email:schedule.email,vehicleInterest:schedule.vehicleInterest||'Local candidate QA vehicle',message:'duplicate contract check',consent:true,source:'schedule-test-drive',idempotencyKey:schedule.idempotencyKey}});const dj=await json(dedupe,'LEAD_DEDUPE');assert(dedupe.ok()&&dj.deduplicated===true,'LEAD_IDEMPOTENCY');
 const feed=await ctx.request.get(base+'/api/leads',{headers:{Cookie:`__Host-wdcc_session=${cookie}`}});const fj=await json(feed,'DEALER_LEAD_FEED');assert(feed.ok()&&fj.ok,'DEALER_LEAD_FEED');for(const [id,source] of [[schedule.id,'schedule-test-drive'],[approval.id,'get-approved'],[contact.id,'call-sean']])assert((fj.items||[]).some(x=>x.id===id&&x.source===source),'LEAD_NOT_IN_FEED_'+source);
 const create=await ctx.request.post(base+'/api/inventory',{headers:{Cookie:`__Host-wdcc_session=${cookie}`,'Content-Type':'application/json'},data:{year:2019,make:'Toyota',model:`LOCAL-E2E-${run}`,trim:'QA',price:12345,downPayment:1500,mileage:54321,stock:`WDCC-QA-LOCAL-${run}`,description:'WDCC local candidate synthetic upload acceptance'}});const cj=await json(create,'VEHICLE_CREATE');assert(create.status()===201&&cj.ok&&cj.item.id,'VEHICLE_CREATE');const vehicle=cj.item;
 const mediaPath=`media/wdcc/${vehicle.id}/qa-${run}.png`;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlV1GQAAAAASUVORK5CYII=','base64');await put(mediaPath,png,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'image/png'});
 const photo=await ctx.request.patch(base+'/api/inventory/'+encodeURIComponent(vehicle.id),{headers:{Cookie:`__Host-wdcc_session=${cookie}`,'Content-Type':'application/json'},data:{photoPathnames:[mediaPath],primaryPhotoPathname:mediaPath}});const phj=await json(photo,'VEHICLE_PHOTO');assert(photo.ok()&&phj.ok&&(phj.item.photoPathnames||[]).includes(mediaPath),'VEHICLE_PHOTO_CHECKPOINT');
 const media=await ctx.request.get(base+'/api/media?p='+encodeURIComponent(mediaPath));assert(media.ok()&&(await media.body()).length>0,'MEDIA_READ');
 const publish=await ctx.request.patch(base+'/api/inventory/'+encodeURIComponent(vehicle.id),{headers:{Cookie:`__Host-wdcc_session=${cookie}`,'Content-Type':'application/json'},data:{status:'published'}});const pu=await json(publish,'VEHICLE_PUBLISH');assert(publish.ok()&&pu.ok&&pu.item.status==='published','VEHICLE_PUBLISH');
 const dealerInv=await ctx.request.get(base+'/api/inventory',{headers:{Cookie:`__Host-wdcc_session=${cookie}`}});const dij=await json(dealerInv,'DEALER_INVENTORY');assert((dij.items||[]).some(x=>x.id===vehicle.id&&x.status==='published'&&(x.photoPathnames||[]).length>0),'PUBLISHED_NOT_IN_DEALER_INVENTORY');
 const publicInv=await ctx.request.get(base+'/api/inventory?public='+Date.now());const pub=await json(publicInv,'PUBLIC_INVENTORY');assert(!(pub.items||[]).some(x=>x.id===vehicle.id),'QA_VEHICLE_LEAKED_PUBLICLY');
 const hide=await ctx.request.patch(base+'/api/inventory/'+encodeURIComponent(vehicle.id),{headers:{Cookie:`__Host-wdcc_session=${cookie}`,'Content-Type':'application/json'},data:{status:'draft',stock:`R36TEST-WDCC-QA-LOCAL-${run}`}});assert(hide.ok(),'VEHICLE_HIDE');
 const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await mobile.goto(base,{waitUntil:'networkidle'});assert(await mobile.locator('.mobile-action-bar').count()>0,'MOBILE_ACTION_BAR_MISSING');assert(await mobile.locator('a[href^="/schedule-test-drive"]').count()>0,'MOBILE_TEST_DRIVE_MISSING');assert(await mobile.locator('a[href^="/get-approved"]').count()>0,'MOBILE_APPROVAL_MISSING');
 assert(notFound.length===0,'BROWSER_404S:'+notFound.join(','));
 fs.writeFileSync('/tmp/wdcc-result.json',JSON.stringify({ok:true,routeResults,inventoryCount:inv0.items.length,leadIds:{schedule:schedule.id,approval:approval.id,contact:contact.id},vehicleId:vehicle.id,mediaPath,vehiclePublished:true,qaHiddenPublic:true,consoleErrors,browser404s:notFound},null,2));await browser.close();
})().catch(e=>{fs.writeFileSync('/tmp/wdcc-result.json',JSON.stringify({ok:false,error:String(e?.message||e)},null,2));console.error(e);process.exit(1)})
NODE

env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel env run --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" -- node .wdcc-local-browser.cjs
cat /tmp/wdcc-result.json
jq -e '.ok==true and .vehiclePublished==true and .qaHiddenPublic==true and (.browser404s|length)==0' /tmp/wdcc-result.json >/dev/null

cleanup
trap - EXIT
cat /tmp/wdcc-cleanup.log || true
