import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const SOURCE_SHA=process.env.SOURCE_SHA||'';
const BASE='http://localhost:3100';
const SERVICE='http://127.0.0.1:4010';
const AUTH='isolated-wdcc-e2e-token-v2';
const OUT='/tmp/wdcc-full-flow-e2e-v2';
const SCREENS=`${OUT}/screens`;
fs.mkdirSync(SCREENS,{recursive:true});
const tag=`${process.env.GITHUB_RUN_ID||Date.now()}-${process.env.GITHUB_RUN_ATTEMPT||1}`;
const suppliedPassword=String(process.env.WDCC_DEALER_E2E_PASSWORD||'').trim();
const password=suppliedPassword||`Isolated-${crypto.randomBytes(18).toString('base64url')}!`;
const salt=crypto.randomBytes(24);
const digest=crypto.scryptSync(password,salt,64);
const passwordHash=`scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;

let state={revision:0,tenants:[{id:'wdcc',name:'WDCC'}],users:[{id:'isolated-admin',email:'isolated-admin@wdcc-e2e.test',username:'admin',loginAlias:'admin',aliases:['Admin'],displayName:'Isolated WDCC Admin',role:'platform_admin',tenantId:'wdcc',status:'active',disabled:false,passwordHash}],vehicles:[],leads:[],audit:[],updatedAt:new Date().toISOString()};
const media=new Map();
const upstream=[];
const webhooks=[];
const crmRequests=[];
const result={ok:false,sourceSha:SOURCE_SHA,runnerSha:process.env.GITHUB_SHA||null,credentialSource:suppliedPassword?'repository-secret':'generated-isolated',leads:{},routing:{},vehicle:{},dashboard:{},pages:{},productionWrites:0,error:null};

function sendJson(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(value));}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks);}
function countKind(kind){return state.leads.filter(l=>String(l.kind||'')===kind).length;}
const localService=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/',SERVICE);
    if(u.pathname==='/state'){
      if(req.headers.authorization!==`Bearer ${AUTH}`)return sendJson(res,401,{ok:false,error:'unauthorized'});
      if(req.method==='GET')return sendJson(res,200,state);
      if(req.method==='PUT'){state=JSON.parse((await readBody(req)).toString('utf8'));return sendJson(res,200,{ok:true,revision:state.revision});}
      return sendJson(res,405,{ok:false,error:'method'});
    }
    if(u.pathname==='/media'){
      if(req.headers.authorization!==`Bearer ${AUTH}`)return sendJson(res,401,{ok:false,error:'unauthorized'});
      const pathname=u.searchParams.get('p')||'';
      if(!pathname.startsWith('media/wdcc/'))return sendJson(res,400,{ok:false,error:'path'});
      if(req.method==='PUT'){
        const raw=await readBody(req);media.set(pathname,{raw,type:String(req.headers['content-type']||'application/octet-stream')});
        return sendJson(res,200,{ok:true,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
      }
      if(req.method==='GET'){
        const item=media.get(pathname);if(!item){res.writeHead(404);return res.end('not found');}
        res.writeHead(200,{'content-type':item.type,'cache-control':'no-store'});return res.end(item.raw);
      }
      return sendJson(res,405,{ok:false,error:'method'});
    }
    if(u.pathname==='/api/lead'&&req.method==='POST'){
      const payload=JSON.parse((await readBody(req)).toString('utf8'));upstream.push(payload);
      return sendJson(res,200,{ok:true,leadId:`up_${crypto.randomUUID()}`,emailStatus:'captured_local',smsStatus:'captured_local'});
    }
    if(u.pathname==='/webhook'&&req.method==='POST'){
      webhooks.push(JSON.parse((await readBody(req)).toString('utf8')));return sendJson(res,200,{ok:true});
    }
    if(u.pathname==='/api/crm/dashboard'&&req.method==='GET'){
      const hasSession=String(req.headers.cookie||'').includes('__Host-wdcc_session=');crmRequests.push({hasSession});
      if(!hasSession)return sendJson(res,401,{ok:false,error:'Unauthorized'});
      return sendJson(res,200,{ok:true,summary:{newToday:state.leads.length,appointments:countKind('schedule'),applications:countKind('approval'),messages:countKind('contact')},leads:state.leads,inventory:state.vehicles});
    }
    if(u.pathname==='/api/health')return sendJson(res,200,{ok:true,degraded:false,service:'isolated-e2e-authority'});
    return sendJson(res,404,{ok:false,error:'not_found',path:u.pathname});
  }catch(error){return sendJson(res,500,{ok:false,error:error instanceof Error?error.message:String(error)});}
});

function fail(message,extra=null){const e=new Error(message);e.extra=extra;throw e;}
async function waitForServer(timeout=60000){const start=Date.now();while(Date.now()-start<timeout){try{const r=await fetch(`${BASE}/dealer`,{redirect:'manual'});if(r.status<500)return;}catch{}await new Promise(r=>setTimeout(r,250));}fail('NEXT_START_TIMEOUT');}
async function openReady(page,path,locator){await page.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded',timeout:30000});await locator.waitFor({state:'visible',timeout:30000});}

let next=null;let browser=null;
const nextTail=[];
try{
  await new Promise((resolve,reject)=>{localService.once('error',reject);localService.listen(4010,'127.0.0.1',resolve);});
  const env={...process.env,PORT:'3100',HOSTNAME:'127.0.0.1',NODE_ENV:'production',VERCEL_PROJECT_ID:'prj_a3oclCcy4sbA2tge4BX7VAKXE4KR',WDCC_RUNTIME_ROLE:'backend',WDCC_STATE_SERVICE_URL:SERVICE,WDCC_STATE_SERVICE_TOKEN:AUTH,WDCC_MEDIA_SERVICE_URL:SERVICE,WDCC_MEDIA_SERVICE_TOKEN:AUTH,WDCC_DEALER_BACKEND_URL:SERVICE,WDCC_LEAD_UPSTREAM_URL:`${SERVICE}/api/lead`,WDCC_LEAD_WEBHOOK_URL:`${SERVICE}/webhook`,SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
  for(const key of ['BLOB_READ_WRITE_TOKEN','BLOB_STORE_ID','VERCEL_OIDC_TOKEN','RESEND_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','WDCC_LEAD_NOTIFICATION_PHONE'])delete env[key];
  next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [next.stdout,next.stderr])stream.on('data',chunk=>{for(const line of String(chunk).split(/\r?\n/)){if(line){nextTail.push(line);if(nextTail.length>160)nextTail.shift();}}});
  await waitForServer();

  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});

  async function leadFlow(kind,path,source,button){
    const page=await context.newPage();const name=`Flow ${kind} ${tag}`;
    await openReady(page,`${path}?source=${encodeURIComponent(source)}`,page.getByLabel('Name'));
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Phone').fill('813-555-0147');
    await page.getByLabel('Email').fill(`${kind}-${tag}@wdcc-e2e.test`);
    if(kind!=='contact')await page.getByLabel('Vehicle of interest').fill('2021 Toyota Camry');
    if(kind==='schedule')await page.getByLabel('Preferred date or time').fill('Tomorrow 10:30 AM');
    await page.getByLabel('Message').fill(`Isolated ${kind} routing flow ${tag}`);
    await page.locator('input[name="consent"]').check();
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/leads')&&r.request().method()==='POST',{timeout:30000});
    await page.getByRole('button',{name:button}).click();
    const response=await responsePromise;const payload=await response.json();
    if(response.status()!==201||payload?.ok!==true||payload?.persisted!==true)fail(`LEAD_${kind}_SUBMIT`,{status:response.status(),payload});
    if(payload?.item?.kind!==kind||payload?.item?.source!==source)fail(`LEAD_${kind}_ROUTE`,payload?.item);
    if(payload?.sync?.upstream!=='synced')fail(`LEAD_${kind}_UPSTREAM`,payload?.sync);
    if(payload?.notifications?.webhook!=='sent')fail(`LEAD_${kind}_WEBHOOK`,payload?.notifications);
    await page.getByRole('status').waitFor({state:'visible',timeout:10000});
    await page.screenshot({path:`${SCREENS}/lead-${kind}.png`,fullPage:true});await page.close();
    return {id:payload.item.id,name,kind,source,upstream:payload.sync.upstream,webhook:payload.notifications.webhook};
  }

  result.leads.schedule=await leadFlow('schedule','/schedule-test-drive','flow-schedule','SCHEDULE TEST DRIVE');
  result.leads.approval=await leadFlow('approval','/get-approved','flow-approval','GET APPROVED');
  result.leads.contact=await leadFlow('contact','/contact','flow-contact','CONTACT SEAN');
  if(state.leads.length!==3||upstream.length!==3||webhooks.length!==3)fail('LEAD_PIPELINE_COUNTS',{ledger:state.leads.length,upstream:upstream.length,webhooks:webhooks.length});
  const expectedTypes=['test-drive','pre-approval','contact'];for(const type of expectedTypes)if(!upstream.some(x=>x.requestType===type))fail(`UPSTREAM_REQUEST_TYPE_${type}`,upstream);
  result.routing={ledgerCount:state.leads.length,upstreamCount:upstream.length,webhookCount:webhooks.length,requestTypes:upstream.map(x=>x.requestType),sources:state.leads.map(x=>x.source)};

  const dealer=await context.newPage();
  await openReady(dealer,'/dealer',dealer.getByLabel('USERNAME'));
  await dealer.getByLabel('USERNAME').fill('admin');await dealer.getByLabel('PASSWORD').fill(password);
  await dealer.getByRole('button',{name:'SIGN IN'}).click();
  await dealer.getByRole('heading',{name:'Dashboard'}).waitFor({state:'visible',timeout:30000});
  if(!crmRequests.some(x=>x.hasSession))fail('DASHBOARD_SESSION_NOT_FORWARDED',crmRequests);
  await dealer.screenshot({path:`${SCREENS}/dashboard-before-vehicle.png`,fullPage:true});

  const png=`${OUT}/vehicle.png`;fs.writeFileSync(png,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlV1GQAAAAASUVORK5CYII=','base64'));
  const stock=`FLOW-${tag}`;
  await openReady(dealer,'/dealer/inventory/new',dealer.locator('[data-wizard-stage="info"]'));
  await dealer.getByLabel('YEAR').fill('2021');await dealer.getByLabel('MAKE').fill('Toyota');await dealer.getByLabel('MODEL').fill('Camry');await dealer.getByLabel('TRIM').fill('SE');await dealer.getByLabel('VIN').fill('4T1G11AK0MU000001');
  await dealer.getByRole('button',{name:'Continue'}).click();await dealer.locator('[data-wizard-stage="pricing"]').waitFor({state:'visible'});
  await dealer.getByLabel('PRICE').fill('18995');await dealer.getByLabel('DOWN PAYMENT').fill('1500');await dealer.getByLabel('MILEAGE').fill('52000');await dealer.getByLabel('STOCK #').fill(stock);
  await dealer.getByRole('button',{name:'Continue'}).click();await dealer.locator('[data-wizard-stage="photos"]').waitFor({state:'visible'});
  const fileInput=dealer.locator('input[type="file"][multiple]').first();await fileInput.setInputFiles(png);await dealer.locator('.thumbGrid img').first().waitFor({state:'visible',timeout:10000});
  await dealer.screenshot({path:`${SCREENS}/vehicle-photos-step.png`,fullPage:true});
  await dealer.getByRole('button',{name:'Continue'}).click();await dealer.locator('[data-wizard-stage="details"]').waitFor({state:'visible'});
  await dealer.getByLabel('DESCRIPTION').fill(`Isolated functional flow ${tag}; ephemeral end-to-end validation.`);
  await dealer.getByRole('button',{name:'Continue'}).click();await dealer.locator('[data-wizard-stage="review"]').waitFor({state:'visible'});
  await dealer.screenshot({path:`${SCREENS}/vehicle-review-step.png`,fullPage:true});
  const publish=dealer.locator('button[name="intent"][value="published"]:visible').first();await publish.click();await dealer.waitForURL(/\/dealer\/inventory\?saved=published/,{timeout:90000});

  const inventoryResponse=await context.request.get(`${BASE}/api/inventory`);const inventoryJson=await inventoryResponse.json();const vehicle=(inventoryJson.items||[]).find(v=>v.stock===stock);
  if(!vehicle)fail('VEHICLE_MISSING_DEALER_INVENTORY',inventoryJson);if(vehicle.status!=='published')fail('VEHICLE_NOT_PUBLISHED',vehicle);if(!(vehicle.photoPathnames||[]).length)fail('VEHICLE_PHOTO_MISSING',vehicle);if(!media.size)fail('MEDIA_UPLOAD_NOT_ROUTED');

  await openReady(dealer,'/dealer/inventory',dealer.getByText('2021 Toyota Camry',{exact:false}).first());await dealer.screenshot({path:`${SCREENS}/dealer-inventory.png`,fullPage:true});
  await openReady(dealer,'/dealer/leads',dealer.getByText(result.leads.schedule.name,{exact:false}).first());for(const lead of Object.values(result.leads))await dealer.getByText(lead.name,{exact:false}).first().waitFor({state:'visible',timeout:20000});await dealer.screenshot({path:`${SCREENS}/dealer-leads.png`,fullPage:true});
  await openReady(dealer,'/dealer',dealer.getByRole('heading',{name:'Dashboard'}));await dealer.getByText('2021 Toyota Camry',{exact:false}).first().waitFor({state:'visible',timeout:30000});for(const lead of Object.values(result.leads))await dealer.getByText(lead.name,{exact:false}).first().waitFor({state:'visible',timeout:20000});await dealer.screenshot({path:`${SCREENS}/dashboard-final.png`,fullPage:true});

  const publicContext=await browser.newContext({viewport:{width:1440,height:1000}});const publicApi=await publicContext.request.get(`${BASE}/api/inventory`);const publicJson=await publicApi.json();if(publicApi.status()!==200||!(publicJson.items||[]).some(v=>v.stock===stock))fail('PUBLIC_INVENTORY_API_MISSING',{status:publicApi.status(),publicJson});
  const publicPage=await publicContext.newPage();await openReady(publicPage,'/inventory',publicPage.getByText('2021 Toyota Camry',{exact:false}).first());await publicPage.screenshot({path:`${SCREENS}/public-inventory.png`,fullPage:true});

  result.vehicle={id:vehicle.id,stock,status:vehicle.status,photoCount:vehicle.photoPathnames.length,mediaObjects:media.size,dealerApiVisible:true,dealerPageVisible:true,publicApiVisible:true,publicPageVisible:true};
  result.dashboard={authenticatedCrmRequest:crmRequests.some(x=>x.hasSession),leadCount:state.leads.length,vehicleCount:state.vehicles.length,publishedCount:state.vehicles.filter(v=>v.status==='published').length,appointments:countKind('schedule'),applications:countKind('approval'),messages:countKind('contact')};
  result.pages={scheduleForm:true,approvalForm:true,contactForm:true,dealerLogin:true,vehicleWizard:true,photoUpload:true,dealerInventory:true,dealerLeads:true,dealerDashboard:true,publicInventory:true};
  result.ok=true;await publicContext.close();await context.close();
}catch(error){result.error={message:error instanceof Error?error.message:String(error),extra:error?.extra??null,stack:error instanceof Error?error.stack:null,nextTail};}
finally{
  if(browser)await browser.close().catch(()=>{});if(next){next.kill('SIGTERM');await new Promise(r=>setTimeout(r,400));if(!next.killed)next.kill('SIGKILL');}
  await new Promise(resolve=>localService.close(()=>resolve()));fs.writeFileSync(`${OUT}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
if(!result.ok)process.exit(1);
