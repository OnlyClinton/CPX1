import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const base = process.env.R31_BASE_URL || 'http://127.0.0.1:3000';
const out = process.env.R31_QA_OUT || 'artifacts/r31-local-visual';
await fs.mkdir(out,{recursive:true});

const browser = await chromium.launch({headless:true});
const report = {base,generatedAt:new Date().toISOString(),viewports:{},assetChecks:{},inventory:null,flows:{},failureStates:{},errors:[]};

async function bytes(path){
  const r=await fetch(base+path,{redirect:'manual'});
  const b=Buffer.from(await r.arrayBuffer());
  return {status:r.status,bytes:b.length,magic:b.subarray(0,4).toString('ascii'),sha256:crypto.createHash('sha256').update(b).digest('hex')};
}
report.assetChecks.logo=await bytes('/wdcc-logo-transparent.webp');
report.assetChecks.headerLogo=await bytes('/wdcc-official-logo.webp');
report.assetChecks.hero=await bytes('/wdcc-hero-v2.webp');
report.assetChecks.vehicleImages={};
for(const file of ['2004-nissan-350z-1.webp','2016-ford-f150-limited-1.webp','2019-honda-pilot-1.webp','2019-kia-sportage-1.webp','2019-toyota-rav4-1.webp']){
  report.assetChecks.vehicleImages[file]=await bytes(`/assets/cars/${file}`);
}
if(report.assetChecks.logo.status!==200||report.assetChecks.logo.magic!=='RIFF') throw new Error('canonical_logo_not_served');
if(report.assetChecks.headerLogo.status!==200||report.assetChecks.headerLogo.magic!=='RIFF') throw new Error('r31_header_logo_not_served');
if(report.assetChecks.hero.status!==200||report.assetChecks.hero.magic!=='RIFF') throw new Error('canonical_hero_not_served');
const vehicleHashes=[];
for(const [file,check] of Object.entries(report.assetChecks.vehicleImages)){
  if(check.status!==200||check.magic!=='RIFF'||check.bytes<1000)throw new Error(`vehicle_image_not_served:${file}`);
  if(check.sha256===report.assetChecks.hero.sha256)throw new Error(`vehicle_image_is_hero_fallback:${file}`);
  vehicleHashes.push(check.sha256);
}
if(new Set(vehicleHashes).size!==vehicleHashes.length)throw new Error('vehicle_images_not_distinct');
report.assetChecks.vehicleImagesDistinct=true;

const invResp=await fetch(base+'/api/inventory',{headers:{accept:'application/json'}});
const invJson=await invResp.json().catch(()=>({}));
report.inventory={status:invResp.status,count:Array.isArray(invJson.items)?invJson.items.length:null,error:invJson.error||null};
if(invResp.status!==200)throw new Error(`inventory_api_${invResp.status}`);

for(const cfg of [
  {name:'desktop',width:1440,height:1000},
  {name:'tablet',width:820,height:1180},
  {name:'mobile',width:390,height:844},
]){
  const context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1});
  const page=await context.newPage();
  const consoleErrors=[]; const pageErrors=[]; const failed=[];
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('requestfailed',r=>failed.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'failed'}`));

  const response=await page.goto(base+'/r31-preview',{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()>=400) throw new Error(`${cfg.name}_route_${response?.status()||'no_response'}`);

  await page.waitForTimeout(650);
  await page.screenshot({path:`${out}/${cfg.name}-intro-reveal.png`,fullPage:false});
  const revealBadge=await page.locator('.intro-badge').boundingBox().catch(()=>null);

  await page.waitForTimeout(1350);
  await page.screenshot({path:`${out}/${cfg.name}-intro-dock.png`,fullPage:false});
  const dockBadge=await page.locator('.intro-badge').boundingBox().catch(()=>null);
  const headerLogo=await page.locator('.logoBrand img').boundingBox().catch(()=>null);

  await page.waitForTimeout(1150);
  await page.getByRole('heading',{name:/BAD CREDIT/i}).waitFor({state:'visible',timeout:10000});
  await page.screenshot({path:`${out}/${cfg.name}-hero.png`,fullPage:false});
  await page.screenshot({path:`${out}/${cfg.name}-full.png`,fullPage:true});

  const featuredPhotos=await page.locator('main img').evaluateAll(imgs=>imgs.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight})));
  const cards=await page.locator('main article').count();
  const headerLogoLoaded=await page.locator('.logoBrand img').evaluate((el)=>el.complete&&el.naturalWidth>0).catch(()=>false);
  const hasHero=await page.locator('main').getByText("WE DON'T CARE.",{exact:false}).count();
  const stickyVisible=cfg.width<=900?await page.locator('.stickyCtaBar').isVisible().catch(()=>false):null;

  report.viewports[cfg.name]={viewport:{width:cfg.width,height:cfg.height},revealBadge,dockBadge,headerLogo,cards,featuredPhotos,headerLogoLoaded,hasHero:Boolean(hasHero),stickyVisible,consoleErrors,pageErrors,failedRequests:failed};
  if(pageErrors.length) report.errors.push(...pageErrors.map(x=>`${cfg.name}: ${x}`));
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  const response=await page.goto(base+'/r31-preview/inventory',{waitUntil:'networkidle',timeout:30000});
  if(!response||response.status()>=400) throw new Error(`inventory_preview_${response?.status()||'no_response'}`);
  const initialCards=await page.locator('article').filter({has:page.getByText('AVAILABLE',{exact:true})}).count();
  await page.getByPlaceholder('Year, make, model…').fill('Nissan');
  await page.waitForTimeout(150);
  const filteredText=await page.locator('body').innerText();
  if(!filteredText.includes('Nissan')) throw new Error('inventory_filter_failed');
  await page.getByPlaceholder('Year, make, model…').fill('');
  await page.screenshot({path:`${out}/desktop-inventory.png`,fullPage:true});
  report.flows.inventory={status:response.status(),initialCards,filterWorked:true};
  await context.close();
}
{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(base+'/r31-preview/inventory',{waitUntil:'networkidle',timeout:30000});
  await page.screenshot({path:`${out}/mobile-inventory.png`,fullPage:true});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:1000,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  let leadPosts=0;
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/leads')leadPosts++});
  const response=await page.goto(base+'/r31-preview/get-approved?vehicle=qa-preview-vehicle',{waitUntil:'networkidle',timeout:30000});
  if(!response||response.status()>=400) throw new Error(`approval_preview_${response?.status()||'no_response'}`);
  await page.getByPlaceholder('Your name').fill('QA Preview');
  await page.getByPlaceholder('(813) 555-0123').fill('(813) 555-0199');
  await page.getByRole('button',{name:/CONTINUE/}).click();
  await page.getByPlaceholder('$4,000').fill('$4,000');
  await page.getByPlaceholder('$2,000').fill('$2,000');
  await page.getByRole('button',{name:/CONTINUE/}).click();
  await page.screenshot({path:`${out}/desktop-approval-review.png`,fullPage:true});
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:/COMPLETE SAFE PREVIEW/}).click();
  await page.getByRole('heading',{name:/PREVIEW FLOW COMPLETE/}).waitFor();
  if(leadPosts!==0)throw new Error(`approval_preview_posted_real_lead:${leadPosts}`);
  await page.screenshot({path:`${out}/desktop-approval-complete.png`,fullPage:true});
  report.flows.approval={status:response.status(),leadPosts,completed:true};
  await context.close();
}
{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(base+'/r31-preview/get-approved',{waitUntil:'networkidle',timeout:30000});
  await page.screenshot({path:`${out}/mobile-approval.png`,fullPage:true});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  let inventoryWrites=0;
  page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&new URL(r.url()).pathname.startsWith('/api/inventory'))inventoryWrites++});
  const response=await page.goto(base+'/r31-preview/dealer-editor',{waitUntil:'networkidle',timeout:30000});
  if(!response||response.status()>=400) throw new Error(`dealer_editor_preview_${response?.status()||'no_response'}`);
  await page.getByPlaceholder('2020').fill('2020');
  await page.getByPlaceholder('Dodge').fill('Dodge');
  await page.getByPlaceholder('Challenger').fill('Challenger');
  await page.getByPlaceholder('62,500').fill('62500');
  await page.getByRole('button',{name:/CONTINUE/}).click();
  await page.getByPlaceholder('$24,995').fill('24995');
  await page.getByPlaceholder('$2,000').fill('2000');
  await page.getByRole('button',{name:/CONTINUE/}).click();
  const upload=page.locator('input[type=file]').nth(1);
  await upload.setInputFiles({name:'qa-car.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')});
  await page.getByRole('button',{name:/CONTINUE/}).click();
  await page.getByPlaceholder(/Condition, equipment/).fill('Clean QA preview vehicle with service history and customer-facing notes.');
  await page.getByRole('button',{name:/CONTINUE/}).click();
  await page.screenshot({path:`${out}/desktop-dealer-editor-review.png`,fullPage:true});
  const publish=page.getByRole('button',{name:'PUBLISH PREVIEW'});
  if(await publish.isDisabled()) throw new Error('dealer_editor_readiness_not_100');
  await publish.click();
  await page.getByRole('heading',{name:/PUBLISH PREVIEW PASSED/}).waitFor();
  if(inventoryWrites!==0)throw new Error(`dealer_editor_preview_wrote_inventory:${inventoryWrites}`);
  report.flows.dealerEditor={status:response.status(),inventoryWrites,completed:true};
  await context.close();
}
{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(base+'/r31-preview/dealer-editor',{waitUntil:'networkidle',timeout:30000});
  await page.screenshot({path:`${out}/mobile-dealer-editor.png`,fullPage:true});
  await context.close();
}

// Failure-state: inventory API unavailable must render an explicit customer-safe message.
{
  const context=await browser.newContext({viewport:{width:1000,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.route('**/api/inventory',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'qa_inventory_unavailable'})}));
  await page.goto(base+'/r31-preview/inventory',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('Inventory is temporarily unavailable.',{exact:true}).waitFor({timeout:10000});
  await page.screenshot({path:`${out}/failure-inventory-unavailable.png`,fullPage:true});
  report.failureStates.inventoryUnavailable=true;
  await context.close();
}

// Failure-state: empty inventory must not invent or leak fake vehicles.
{
  const context=await browser.newContext({viewport:{width:1000,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.route('**/api/inventory',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,count:0,items:[]})}));
  await page.goto(base+'/r31-preview',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByRole('button',{name:/SKIP INTRO/i}).click().catch(()=>{});
  await page.getByText('INVENTORY IS BEING UPDATED.',{exact:true}).waitFor({timeout:10000});
  report.failureStates.emptyInventory=true;
  await context.close();
}

// Failure-state: a real record with no media must say PHOTO NEEDED, never use the hero car.
{
  const context=await browser.newContext({viewport:{width:1000,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  const noPhoto={id:'qa-no-photo',year:2022,make:'QA',model:'No Photo Vehicle',price:9999,downPayment:1500,mileage:25000,status:'published'};
  await page.route('**/api/inventory',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,count:1,items:[noPhoto]})}));
  await page.goto(base+'/r31-preview/inventory',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('PHOTO NEEDED',{exact:true}).waitFor({timeout:10000});
  const imgCount=await page.locator('article img').count();
  if(imgCount!==0)throw new Error(`no_photo_record_rendered_image:${imgCount}`);
  report.failureStates.noPhotoHonest=true;
  await context.close();
}

await browser.close();
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));

if(!report.viewports.desktop.headerLogoLoaded) throw new Error('desktop_logo_not_loaded');
if(!report.viewports.desktop.hasHero) throw new Error('desktop_hero_copy_missing');
if(!report.viewports.mobile.stickyVisible) throw new Error('mobile_sticky_cta_missing');
if(report.errors.length) throw new Error(`page_errors:${report.errors.join('|')}`);
console.log(JSON.stringify(report,null,2));
