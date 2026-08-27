import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const out='dealer-isolated-e2e';
fs.mkdirSync(out,{recursive:true});
const email=process.env.QA_EMAIL,password=process.env.QA_PASSWORD,token=process.env.STATE_TOKEN,stock=process.env.LOCAL_STOCK;
if(!email||!password||!token||!stock)throw Error('missing isolated E2E environment');
const salt=crypto.randomBytes(24),digest=crypto.scryptSync(password,salt,64);
const passwordHash=`scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
let state={revision:1,tenants:[{id:'wdcc',name:'WDCC'}],users:[{id:'local-dealer',email,username:email,displayName:'WDCC Isolated Dealer',role:'dealer_agent',tenantId:'wdcc',status:'active',disabled:false,passwordHash}],vehicles:[],leads:[],audit:[],updatedAt:new Date().toISOString()};
const media=new Map();
const readBody=async req=>{const p=[];for await(const x of req)p.push(x);return Buffer.concat(p)};
const authority=http.createServer(async(req,res)=>{
  try{
    if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401,{'content-type':'application/json'});res.end('{"ok":false}');return}
    const u=new URL(req.url,'http://127.0.0.1:4311');
    if(u.pathname==='/state'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(state));return}
    if(u.pathname==='/state'&&req.method==='PUT'){state=JSON.parse((await readBody(req)).toString());fs.writeFileSync(`${out}/final-isolated-state.json`,JSON.stringify(state,null,2));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,revision:state.revision}));return}
    if(u.pathname==='/media'&&req.method==='PUT'){
      const pathname=u.searchParams.get('p')||'',body=await readBody(req),contentType=String(req.headers['content-type']||'application/octet-stream'),sha256=crypto.createHash('sha256').update(body).digest('hex');
      if(!pathname.startsWith('media/wdcc/')){res.writeHead(400);res.end();return}
      media.set(pathname,{body,contentType,sha256});
      fs.writeFileSync(`${out}/final-isolated-media.json`,JSON.stringify({count:media.size,paths:[...media.keys()],sha256},null,2));
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,sha256}));return
    }
    if(u.pathname==='/media'&&req.method==='GET'){
      const item=media.get(u.searchParams.get('p')||'');if(!item){res.writeHead(404);res.end();return}
      res.writeHead(200,{'content-type':item.contentType,'content-length':String(item.body.length),'etag':`"${item.sha256}"`,'cache-control':'no-store'});res.end(item.body);return
    }
    res.writeHead(404);res.end();
  }catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:String(e)}))}
});
await new Promise((resolve,reject)=>authority.once('error',reject).listen(4311,'127.0.0.1',resolve));

// The shipping publish route verifies the storefront at wedontcarecars.com. In this isolated
// certification process only, redirect that read back to the exact local build. Reject all
// other fetches to WDCC/Vercel production hosts so the proof cannot mutate or depend on them.
fs.writeFileSync('/tmp/wdcc-e2e-fetch-guard.cjs',String.raw`
const real=globalThis.fetch;
globalThis.fetch=async function(input,init){
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
  if(raw){
    const u=new URL(raw);
    if(u.hostname==='wedontcarecars.com'&&u.pathname==='/api/inventory')return real('http://127.0.0.1:3100'+u.pathname+u.search,init);
    if(u.hostname==='wedontcarecars.com'||u.hostname==='dealer.wedontcarecars.com'||/wdcc-cpx-launch.*\.vercel\.app$/i.test(u.hostname))throw new Error('WDCC_E2E_EXTERNAL_FETCH_BLOCKED '+u.hostname+u.pathname);
  }
  return real(input,init);
};
`);
const appLog=fs.createWriteStream(`${out}/app.log`);
const app=spawn('npm',['run','start','--','-p','3100'],{env:{...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS||''} --require=/tmp/wdcc-e2e-fetch-guard.cjs`.trim()},stdio:['ignore','pipe','pipe']});
app.stdout.pipe(appLog);app.stderr.pipe(appLog);
async function ready(){for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3100/login')).status===200)return}catch{}await new Promise(r=>setTimeout(r,500))}throw Error('local app did not start')}
await ready();

const metrics={sha:process.env.GITHUB_SHA,login:false,session:false,create:false,upload:false,checkpoint:false,publish:false,edit:false,publicInventory:false,publicListing:false,externalWrites:[],consoleErrors:[],serverErrors:[]};
const browser=await chromium.launch({headless:true});
const guard=page=>{
  page.on('request',r=>{const u=new URL(r.url());if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&!['localhost','127.0.0.1'].includes(u.hostname))metrics.externalWrites.push({method:r.method(),url:r.url()})});
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))metrics.consoleErrors.push(m.text())});
  page.on('pageerror',e=>metrics.consoleErrors.push(String(e)));
};
const dashboardStub=page=>page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:[],leads:[]})}));
const visiblePublish=async page=>{const b=page.locator('form button[type="submit"]').filter({hasText:/publish/i});for(let i=0;i<await b.count();i++)if(await b.nth(i).isVisible()){await b.nth(i).click();return}throw Error('visible publish missing')};
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await ctx.newPage();guard(page);await dashboardStub(page);
  let r=await page.goto('http://127.0.0.1:3100/login',{waitUntil:'domcontentloaded'});if(!r||r.status()!==200)throw Error('login page failed');
  await page.locator('input[autocomplete="username"]').fill(email);await page.locator('input[autocomplete="current-password"]').fill(password);await page.screenshot({path:`${out}/01-login.png`,fullPage:true});
  await page.getByRole('button',{name:/sign in/i}).click();await page.waitForURL(/\/dealer(?:\/|\?|$)/,{timeout:12000});metrics.login=true;
  const session=await page.evaluate(async()=>{const r=await fetch('/api/auth/session',{credentials:'include',cache:'no-store'});return{status:r.status,body:await r.json()}});if(session.status!==200||!session.body?.authenticated||session.body?.user?.role!=='dealer_agent')throw Error('session failed');metrics.session=true;
  await page.goto('http://127.0.0.1:3100/dealer/inventory/new',{waitUntil:'domcontentloaded'});await page.locator('input[name="year"]').waitFor({state:'visible'});
  await page.locator('input[name="year"]').fill('2022');await page.locator('input[name="make"]').fill('Dodge');await page.locator('input[name="model"]').fill('Challenger');await page.locator('input[name="trim"]').fill('R/T');await page.locator('input[name="vin"]').fill('1LOCAL514E2E000001');
  await page.locator('.stepper > button').nth(1).click();await page.locator('input[name="price"]').fill('28995');await page.locator('input[name="downPayment"]').fill('2500');await page.locator('input[name="mileage"]').fill('42110');await page.locator('input[name="stock"]').fill(stock);
  await page.locator('.stepper > button').nth(2).click();const file=page.locator('input[type="file"][multiple]');await file.setInputFiles('public/wdcc-hero-v2.webp');await page.waitForFunction(()=>document.querySelectorAll('.thumb img').length>0);await page.screenshot({path:`${out}/02-photo-step.png`,fullPage:true});
  await page.locator('.stepper > button').nth(3).click();await page.locator('textarea').fill('Exact-head isolated dealer upload proof.');await page.locator('.stepper > button').nth(4).click();await page.screenshot({path:`${out}/03-review.png`,fullPage:true});await visiblePublish(page);await page.waitForURL(/\/dealer\/inventory(?:\?|$)/,{timeout:20000});
  const inv=await page.evaluate(async()=>{const r=await fetch('/api/inventory',{credentials:'include',cache:'no-store'});return{status:r.status,body:await r.json()}});const item=(inv.body?.items||[]).find(v=>v.stock===stock);if(inv.status!==200||!item)throw Error('created car missing');metrics.create=true;metrics.vehicleId=item.id;if(item.status!=='published')throw Error('publish failed');metrics.publish=true;
  if(!item.primaryPhotoPathname||item.photoPathnames?.length!==1)throw Error('photo checkpoint failed');metrics.checkpoint=true;metrics.mediaPath=item.primaryPhotoPathname;
  const mr=await page.evaluate(async p=>{const r=await fetch('/api/media?p='+encodeURIComponent(p),{cache:'no-store'});return{status:r.status,size:(await r.arrayBuffer()).byteLength,provider:r.headers.get('x-wdcc-media-provider')}},item.primaryPhotoPathname);if(mr.status!==200||mr.size<1000||mr.provider!=='cloudflare')throw Error('media readback failed');metrics.upload=true;metrics.media=mr;await page.screenshot({path:`${out}/04-dealer-inventory.png`,fullPage:true});
  await page.goto(`http://127.0.0.1:3100/dealer/inventory/new?edit=${encodeURIComponent(item.id)}`,{waitUntil:'domcontentloaded'});await page.locator('input[name="trim"]').waitFor({state:'visible'});await page.locator('input[name="trim"]').fill('R/T Plus');await page.locator('.stepper > button').nth(4).click();await visiblePublish(page);await page.waitForURL(/\/dealer\/inventory(?:\?|$)/,{timeout:20000});
  const edited=await page.evaluate(async id=>{const r=await fetch('/api/inventory/'+encodeURIComponent(id),{credentials:'include',cache:'no-store'});return{status:r.status,body:await r.json()}},item.id);if(edited.status!==200||edited.body?.item?.trim!=='R/T Plus')throw Error('edit failed');metrics.edit=true;
  const pubCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const pub=await pubCtx.newPage();guard(pub);
  await pub.goto('http://127.0.0.1:3100/inventory',{waitUntil:'domcontentloaded'});await pub.locator('.inventoryGrid').waitFor({state:'visible'});await pub.waitForTimeout(400);if(!(await pub.locator('body').innerText()).includes('Challenger'))throw Error('public inventory missing');metrics.publicInventory=true;await pub.screenshot({path:`${out}/05-public-inventory.png`,fullPage:true});
  await pub.goto(`http://127.0.0.1:3100/vehicle/${item.id}`,{waitUntil:'domcontentloaded'});await pub.waitForTimeout(500);const text=await pub.locator('body').innerText();if(!text.includes('Challenger')||!text.includes('R/T Plus'))throw Error('public listing missing');const image=await pub.locator('img[src*="/api/media?"]').evaluateAll(xs=>xs.some(x=>x.complete&&x.naturalWidth>0));if(!image)throw Error('listing media missing');metrics.publicListing=true;await pub.screenshot({path:`${out}/06-public-listing.png`,fullPage:true});await pubCtx.close();await ctx.close();
  if(metrics.externalWrites.length)throw Error('external browser writes '+JSON.stringify(metrics.externalWrites));
  metrics.isolatedStateRevision=state.revision;metrics.isolatedMediaCount=media.size;metrics.pass=true;fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2)+'\n');console.log(`WDCC ISOLATED DEALER E2E PASS vehicle=${item.id} media=${item.primaryPhotoPathname}`);
}catch(e){metrics.failure=String(e);fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2)+'\n');throw e}finally{await browser.close();app.kill('SIGTERM');authority.close()}
