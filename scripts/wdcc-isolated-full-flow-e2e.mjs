import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const SOURCE_SHA=process.env.SOURCE_SHA||'';
const BASE='http://localhost:3100';
const AUTH='isolated-wdcc-e2e-token';
const SERVICE='http://127.0.0.1:4010';
const OUT='/tmp/wdcc-full-flow-e2e';
const SCREENS=`${OUT}/screens`;
fs.mkdirSync(SCREENS,{recursive:true});
const run=String(process.env.GITHUB_RUN_ID||Date.now());
const attempt=String(process.env.GITHUB_RUN_ATTEMPT||'1');
const tag=`${run}-${attempt}`;
const suppliedPassword=String(process.env.WDCC_DEALER_E2E_PASSWORD||'').trim();
const password=suppliedPassword||`Isolated-${crypto.randomBytes(18).toString('base64url')}!`;
const salt=crypto.randomBytes(24);
const digest=crypto.scryptSync(password,salt,64);
const passwordHash=`scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;

let state={
  revision:0,
  tenants:[{id:'wdcc',name:'WDCC'}],
  users:[{id:'isolated-admin',email:'isolated-admin@wdcc-e2e.test',username:'admin',loginAlias:'admin',aliases:['Admin'],displayName:'Isolated WDCC Admin',role:'platform_admin',tenantId:'wdcc',status:'active',disabled:false,passwordHash}],
  vehicles:[],leads:[],audit:[],updatedAt:new Date().toISOString()
};
const media=new Map();
const upstream=[];
const webhooks=[];
const crmRequests=[];
const result={ok:false,sourceSha:SOURCE_SHA,runnerSha:process.env.GITHUB_SHA||null,credentialSource:suppliedPassword?'repository-secret':'generated-isolated',leads:{},routing:{},vehicle:{},dashboard:{},pages:{},externalWrites:false,error:null};

function json(res,status,body,headers={}){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...headers});res.end(JSON.stringify(body));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks);}
function countKinds(kind){return state.leads.filter(l=>String(l.kind||'')===kind).length;}

const service=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/',SERVICE);
    if(u.pathname==='/state'){
      if(req.headers.authorization!==`Bearer ${AUTH}`)return json(res,401,{ok:false,error:'unauthorized'});
      if(req.method==='GET')return json(res,200,state);
      if(req.method==='PUT'){
        state=JSON.parse((await body(req)).toString('utf8'));
        return json(res,200,{ok:true,revision:state.revision});
      }
      return json(res,405,{ok:false,error:'method'});
    }
    if(u.pathname==='/media'){
      if(req.headers.authorization!==`Bearer ${AUTH}`)return json(res,401,{ok:false,error:'unauthorized'});
      const p=u.searchParams.get('p')||'';
      if(!p.startsWith('media/wdcc/'))return json(res,400,{ok:false,error:'path'});
      if(req.method==='PUT'){
        const raw=await body(req);media.set(p,{raw,type:String(req.headers['content-type']||'application/octet-stream')});
        return json(res,200,{ok:true,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
      }
      if(req.method==='GET'){
        const item=media.get(p);if(!item){res.writeHead(404);return res.end('not found');}
        res.writeHead(200,{'content-type':item.type,'cache-control':'no-store','etag':crypto.createHash('sha1').update(item.raw).digest('hex')});return res.end(item.raw);
      }
      return json(res,405,{ok:false,error:'method'});
    }
    if(u.pathname==='/api/lead'&&req.method==='POST'){
      const payload=JSON.parse((await body(req)).toString('utf8'));upstream.push(payload);
      return json(res,200,{ok:true,leadId:`up_${crypto.randomUUID()}`,emailStatus:'captured_local',smsStatus:'captured_local'});
    }
    if(u.pathname==='/webhook'&&req.method==='POST'){
      const payload=JSON.parse((await body(req)).toString('utf8'));webhooks.push(payload);
      return json(res,200,{ok:true});
    }
    if(u.pathname==='/api/crm/dashboard'&&req.method==='GET'){
      const cookie=String(req.headers.cookie||'');crmRequests.push({hasSession:cookie.includes('__Host-wdcc_session=')});
      if(!cookie.includes('__Host-wdcc_session='))return json(res,401,{ok:false,error:'Unauthorized'});
      return json(res,200,{ok:true,summary:{newToday:state.leads.length,appointments:countKinds('schedule'),applications:countKinds('approval'),messages:countKinds('contact')},leads:state.leads,inventory:state.vehicles});
    }
    if(u.pathname==='/api/health')return json(res,200,{ok:true,degraded:false,service:'isolated-e2e-authority'});
    return json(res,404,{ok:false,error:'not_found',path:u.pathname});
  }catch(e){json(res,500,{ok:false,error:e instanceof Error?e.message:String(e)});}
});

function fail(message,extra){const e=new Error(message);e.extra=extra;throw e;}
async function waitHttp(url,timeout=60000){const start=Date.now();let last='';while(Date.now()-start<timeout){try{const r=await fetch(url,{redirect:'manual'});if(r.status<500)return;}catch(e){last=e instanceof Error?e.message:String(e);}await new Promise(r=>setTimeout(r,300));}fail('NEXT_START_TIMEOUT',last);}
async function visible(locator){try{return await locator.isVisible({timeout:500});}catch{return false;}}

let next=null;let browser=null;
const nextTail=[];
try{
  await new Promise((resolve,reject)=>{service.once('error',reject);service.listen(4010,'127.0.0.1',resolve);});
  const env={...process.env,PORT:'3100',HOSTNAME:'127.0.0.1',NODE_ENV:'production',VERCEL_PROJECT_ID:'prj_a3oclCcy4sbA2tge4BX7VAKXE4KR',WDCC_RUNTIME_ROLE:'backend',WDCC_STATE_SERVICE_URL:SERVICE,WDCC_STATE_SERVICE_TOKEN:AUTH,WDCC_MEDIA_SERVICE_URL:SERVICE,WDCC_MEDIA_SERVICE_TOKEN:AUTH,WDCC_DEALER_BACKEND_URL:SERVICE,WDCC_LEAD_UPSTREAM_URL:`${SERVICE}/api/lead`,WDCC_LEAD_WEBHOOK_URL:`${SERVICE}/webhook`,SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
  for(const key of ['BLOB_READ_WRITE_TOKEN','BLOB_STORE_ID','VERCEL_OIDC_TOKEN','RESEND_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','WDCC_LEAD_NOTIFICATION_PHONE'])delete env[key];
  next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [next.stdout,next.stderr])stream.on('data',d=>{for(const line of String(d).split(/\r?\n/)){if(line){nextTail.push(line);if(nextTail.length>120)nextTail.shift();}}});
  await waitHttp(`${BASE}/dealer`);

  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});

  async function submitLead(kind,path,source,buttonName){
    const page=await context.newPage();
    const name=`Flow ${kind} ${tag}`;
    await page.goto(`${BASE}${path}?source=${encodeURIComponent(source)}`,{waitUntil:'networkidle'});
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Phone').fill('813-555-0147');
    await page.getByLabel('Email').fill(`${kind}-${tag}@wdcc-e2e.test`);
    if(kind!=='contact')await page.getByLabel('Vehicle of interest').fill('2021 Toyota Camry');
    if(kind==='schedule')await page.getByLabel('Preferred date or time').fill('Tomorrow 10:30 AM');
    await page.getByLabel('Message').fill(`Isolated ${kind} routing flow ${tag}`);
    await page.locator('input[name="consent"]').check();
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/leads')&&r.request().method()==='POST');
    await page.getByRole('button',{name:buttonName}).click();
    const response=await responsePromise;const payload=await response.json();
    if(response.status()!==201||payload?.ok!==true||payload?.persisted!==true)fail(`LEAD_${kind.toUpperCase()}_SUBMIT`,{status:response.status(),payload});
    if(payload?.item?.kind!==kind||payload?.item?.source!==source)fail(`LEAD_${kind.toUpperCase()}_ROUTING`,payload?.item);
    if(payload?.sync?.upstream!=='synced')fail(`LEAD_${kind.toUpperCase()}_UPSTREAM`,payload?.sync);
    if(payload?.notifications?.webhook!=='sent')fail(`LEAD_${kind.toUpperCase()}_WEBHOOK`,payload?.notifications);
    await page.getByRole('status').waitFor({state:'visible'});
    await page.screenshot({path:`${SCREENS}/lead-${kind}.png`,fullPage:true});
    await page.close();
    return {id:payload.item.id,name,source,kind,upstream:payload.sync.upstream,webhook:payload.notifications.webhook};
  }

  result.leads.schedule=await submitLead('schedule','/schedule-test-drive','flow-schedule','SCHEDULE TEST DRIVE');
  result.leads.approval=await submitLead('approval','/get-approved','flow-approval','GET APPROVED');
  result.leads.contact=await submitLead('contact','/contact','flow-contact','CONTACT SEAN');

  if(upstream.length!==3||webhooks.length!==3)fail('LEAD_ROUTING_COUNTS',{upstream:upstream.length,webhooks:webhooks.length});
  const expectedTypes={schedule:'test-drive',approval:'pre-approval',contact:'contact'};
  for(const [kind,requestType] of Object.entries(expectedTypes)){
    const row=upstream.find(x=>String(x.requestType)===requestType);if(!row)fail(`UPSTREAM_TYPE_${kind}`,upstream);
  }
  if(state.leads.length!==3)fail('LEAD_LEDGER_COUNT',state.leads.map(l=>({id:l.id,kind:l.kind,source:l.source})));
  result.routing={ledgerCount:state.leads.length,upstreamCount:upstream.length,webhookCount:webhooks.length,requestTypes:upstream.map(x=>x.requestType),sources:state.leads.map(l=>l.source)};

  const dealer=await context.newPage();
  await dealer.goto(`${BASE}/dealer`,{waitUntil:'networkidle'});
  if(!(await visible(dealer.getByLabel('USERNAME'))))fail('DEALER_LOGIN_FORM_MISSING',dealer.url());
  await dealer.getByLabel('USERNAME').fill('admin');
  await dealer.getByLabel('PASSWORD').fill(password);
  await dealer.getByRole('button',{name:'SIGN IN'}).click();
  await dealer.getByRole('heading',{name:'Dashboard'}).waitFor({state:'visible',timeout:30000});
  if(!crmRequests.some(x=>x.hasSession))fail('CRM_SESSION_NOT_FORWARDED',crmRequests);
  await dealer.screenshot({path:`${SCREENS}/dashboard-before-vehicle.png`,fullPage:true});

  const pngPath=`${OUT}/vehicle.png`;
  fs.writeFileSync(pngPath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlV1GQAAAAASUVORK5CYII=','base64'));
  const stock=`FLOW-${tag}`;
  await dealer.goto(`${BASE}/dealer/inventory/new`,{waitUntil:'networkidle'});
  await dealer.locator('[data-wizard-stage="info"]').waitFor({state:'visible',timeout:30000});
  await dealer.getByLabel('YEAR').fill('2021');
  await dealer.getByLabel('MAKE').fill('Toyota');
  await dealer.getByLabel('MODEL').fill('Camry');
  await dealer.getByLabel('TRIM').fill('SE');
  await dealer.getByLabel('VIN').fill('4T1G11AK0MU000001');

  async function stage(key,label){
    const panel=dealer.locator(`[data-wizard-stage="${key}"]`);if(await panel.isVisible().catch(()=>false))return;
    const exact=dealer.getByRole('button',{name:new RegExp(`^${label}$`,'i')});
    const loose=dealer.locator('button').filter({hasText:new RegExp(label,'i')});
    if(await exact.count())await exact.first().click();else if(await loose.count())await loose.first().click();else{
      for(let i=0;i<5&&!await panel.isVisible().catch(()=>false);i++){
        const nextButton=dealer.locator('button:visible').filter({hasText:/next|continue/i});
        if(!await nextButton.count())break;await nextButton.first().click();await dealer.waitForTimeout(150);
      }
    }
    await panel.waitFor({state:'visible',timeout:10000});
  }

  await stage('pricing','Pricing');
  await dealer.getByLabel('PRICE').fill('18995');
  await dealer.getByLabel('DOWN PAYMENT').fill('1500');
  await dealer.getByLabel('MILEAGE').fill('52000');
  await dealer.getByLabel('STOCK #').fill(stock);

  await stage('photos','Photos');
  const multi=dealer.locator('input[type="file"][multiple]');if(!await multi.count())fail('PHOTO_INPUT_MISSING');
  await multi.first().setInputFiles(pngPath);
  await dealer.locator('.thumbGrid img').first().waitFor({state:'visible',timeout:10000});
  await dealer.screenshot({path:`${SCREENS}/vehicle-photos-step.png`,fullPage:true});

  await stage('details','Details');
  const description=dealer.getByLabel(/DESCRIPTION/i);if(await description.count())await description.first().fill(`Isolated flow vehicle ${tag}. Ephemeral end-to-end validation only.`);

  await stage('review','Review');
  await dealer.screenshot({path:`${SCREENS}/vehicle-review-step.png`,fullPage:true});
  const publish=dealer.locator('button[name="intent"][value="published"]:visible');
  if(!await publish.count())fail('PUBLISH_BUTTON_MISSING');
  await publish.first().click();
  await dealer.waitForURL(/\/dealer\/inventory\?saved=published/,{timeout:90000});

  const sessionInventory=await context.request.get(`${BASE}/api/inventory`);const dealerInv=await sessionInventory.json();
  const vehicle=(dealerInv.items||[]).find(v=>v.stock===stock);
  if(!vehicle)fail('VEHICLE_NOT_IN_DEALER_INVENTORY',dealerInv);
  if(String(vehicle.status)!=='published')fail('VEHICLE_NOT_PUBLISHED',vehicle);
  if(!Array.isArray(vehicle.photoPathnames)||vehicle.photoPathnames.length<1)fail('VEHICLE_PHOTO_NOT_CHECKPOINTED',vehicle);
  if(media.size<1)fail('MEDIA_NOT_ROUTED',Array.from(media.keys()));

  await dealer.goto(`${BASE}/dealer/inventory`,{waitUntil:'networkidle'});
  await dealer.getByText('2021 Toyota Camry',{exact:false}).first().waitFor({state:'visible',timeout:30000});
  await dealer.screenshot({path:`${SCREENS}/dealer-inventory.png`,fullPage:true});

  await dealer.goto(`${BASE}/dealer/leads`,{waitUntil:'networkidle'});
  for(const lead of Object.values(result.leads))await dealer.getByText(lead.name,{exact:false}).first().waitFor({state:'visible',timeout:20000});
  await dealer.screenshot({path:`${SCREENS}/dealer-leads.png`,fullPage:true});

  await dealer.goto(`${BASE}/dealer`,{waitUntil:'networkidle'});
  await dealer.getByText('2021 Toyota Camry',{exact:false}).first().waitFor({state:'visible',timeout:30000});
  for(const lead of Object.values(result.leads))await dealer.getByText(lead.name,{exact:false}).first().waitFor({state:'visible',timeout:20000});
  const dashText=await dealer.locator('body').innerText();
  for(const token of ['Total Vehicles','Published','Leads','Appointments'])if(!dashText.includes(token))fail(`DASHBOARD_TOKEN_${token}`);
  await dealer.screenshot({path:`${SCREENS}/dashboard-final.png`,fullPage:true});

  const publicContext=await browser.newContext({viewport:{width:1440,height:1000}});
  const pubApi=await publicContext.request.get(`${BASE}/api/inventory`);const pubJson=await pubApi.json();
  const publicVehicle=(pubJson.items||[]).find(v=>v.stock===stock);
  if(pubApi.status()!==200||!publicVehicle)fail('VEHICLE_NOT_IN_PUBLIC_INVENTORY',{status:pubApi.status(),pubJson});
  const publicPage=await publicContext.newPage();
  await publicPage.goto(`${BASE}/inventory`,{waitUntil:'networkidle'});
  await publicPage.getByText('2021 Toyota Camry',{exact:false}).first().waitFor({state:'visible',timeout:30000});
  await publicPage.screenshot({path:`${SCREENS}/public-inventory.png`,fullPage:true});

  result.vehicle={id:vehicle.id,stock,status:vehicle.status,photoCount:vehicle.photoPathnames.length,mediaObjects:media.size,dealerVisible:true,publicApiVisible:true,publicPageVisible:true};
  result.dashboard={crmAuthenticated:crmRequests.some(x=>x.hasSession),leadCount:state.leads.length,vehicleCount:state.vehicles.length,publishedCount:state.vehicles.filter(v=>v.status==='published').length,scheduleCount:countKinds('schedule'),approvalCount:countKinds('approval'),contactCount:countKinds('contact')};
  result.pages={leadForms:true,dealerLogin:true,dealerLeads:true,dealerInventory:true,dealerDashboard:true,vehicleWizard:true,photoUpload:true,publicInventory:true};
  result.ok=true;
  await publicContext.close();await context.close();
}catch(e){
  result.error={message:e instanceof Error?e.message:String(e),extra:e?.extra??null,stack:e instanceof Error?e.stack:null,nextTail};
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(next){next.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));if(!next.killed)next.kill('SIGKILL');}
  await new Promise(r=>service.close(()=>r()));
  fs.writeFileSync(`${OUT}/result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
if(!result.ok)process.exit(1);
