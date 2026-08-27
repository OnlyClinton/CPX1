import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const base=process.env.URL;
if(!base)throw new Error('IMMUTABLE_PREVIEW_URL_MISSING');
const sourcePath=new URL('./wdcc-immutable-visual-proof-base.mjs',import.meta.url);
const alignedPath=new URL('./.wdcc-immutable-visual-proof-aligned.mjs',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
// The base proof is the controlling newest-owner contract: horizontal public
// wordmark, five wide Featured Inventory cards, tablet reflow and mobile swipe.
fs.writeFileSync(alignedPath,source);
try{await import(`${pathToFileURL(alignedPath.pathname).href}?aligned=${Date.now()}`)}finally{fs.rmSync(alignedPath,{force:true})}

const pointerChecks=[];
const surfaceChecks=[];
const assertHits=async(page,name,selectors)=>{
  const failures=await page.evaluate(selectors=>{
    const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>1&&r.height>1&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth};
    const out=[];
    for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
      if(!visible(el))continue;
      const r=el.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
      const hit=document.elementFromPoint(x,y);
      if(!hit||!(hit===el||el.contains(hit)||hit.contains(el)))out.push({selector,tag:el.tagName,cls:String(el.className||''),hit:hit?`${hit.tagName}.${String(hit.className||'')}`:'none',x,y});
    }
    return out;
  },selectors);
  pointerChecks.push({name,selectors,failures});
  if(failures.length)throw new Error(`${name}_POINTER_OVERLAP_${JSON.stringify(failures)}`);
};
const assertSurface=async(page,name,selector,minWidth=1,minHeight=1)=>{
  const el=page.locator(selector).first();
  await el.waitFor({state:'visible',timeout:10000});
  await el.scrollIntoViewIfNeeded();
  const geom=await el.evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{w:r.width,h:r.height,display:s.display,visibility:s.visibility,opacity:Number(s.opacity)}});
  const pass=geom.w>=minWidth&&geom.h>=minHeight&&geom.display!=='none'&&geom.visibility!=='hidden'&&geom.opacity>0;
  surfaceChecks.push({name,selector,...geom,pass});
  if(!pass)throw new Error(`${name}_SURFACE_BAD_${JSON.stringify(geom)}`);
  return el;
};
const wireDealer=async page=>{
  const session={authenticated:true,name:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc',user:{id:'visual-only',displayName:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc'}};
  const dashboard={summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:[],leads:[]};
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[]}'}):r.abort());
  await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[]}'}):r.abort());
};
const browser=await chromium.launch({headless:true});
try{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const m=await mobile.newPage();
  await m.goto(`${base}/?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  const intro=m.locator('.li');if(await intro.count()){await m.getByRole('button',{name:/skip intro/i}).click({timeout:2500}).catch(()=>{});await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{})}
  await assertHits(m,'MOBILE_STOREFRONT',['.rh-menu','.rh-call','.rh-hero-actions .rh-btn']);
  await m.locator('.rh-menu').click();await m.waitForTimeout(120);await assertHits(m,'MOBILE_NAV',['.rh-nav a']);
  await mobile.close();

  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  const d=await desktop.newPage();await wireDealer(d);
  await d.goto(`${base}/dealer?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await d.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
  await assertHits(d,'DEALER_DESKTOP',['.dcTop a','.dcTop button','.dcSide a']);

  await d.goto(`${base}/dealer/inventory/import?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  const desktopImport=await assertSurface(d,'DEALER_DESKTOP_IMPORT','.dcDrop',420,120);
  await assertHits(d,'DEALER_DESKTOP_IMPORT_ACTIONS',['.dcDrop a','.dcDrop button','.dcActions a','.dcActions button']);
  await desktopImport.screenshot({path:'immutable-visual-proof/dealer-import-desktop.png'});

  await d.goto(`${base}/dealer/inventory/new?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await d.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  await assertHits(d,'DEALER_DESKTOP_EDITOR',['.editTop a','.editTop button','.editSide a']);
  const desktopPhotos=await assertSurface(d,'DEALER_DESKTOP_PHOTOS','.sectionBlock:has(h2:text-is("Photos"))',500,180);
  await desktopPhotos.screenshot({path:'immutable-visual-proof/dealer-photos-desktop.png'});
  const desktopReadiness=await assertSurface(d,'DEALER_DESKTOP_READINESS','.readinessCard',240,180);
  await desktopReadiness.screenshot({path:'immutable-visual-proof/dealer-readiness-desktop.png'});
  const desktopPreview=d.getByRole('button',{name:/^preview$/i}).last();await desktopPreview.scrollIntoViewIfNeeded();await desktopPreview.click({timeout:5000});
  const desktopPreviewModal=await assertSurface(d,'DEALER_DESKTOP_PREVIEW','.previewModal',500,300);
  await assertHits(d,'DEALER_DESKTOP_PREVIEW_ACTIONS',['.previewModal button','.previewModal a']);
  await desktopPreviewModal.screenshot({path:'immutable-visual-proof/dealer-preview-desktop.png'});
  await desktop.close();

  const dealerMobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const dm=await dealerMobile.newPage();await wireDealer(dm);
  await dm.goto(`${base}/dealer?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});await dm.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});await assertHits(dm,'DEALER_MOBILE_DASH',['.dashMobileNav a','.dashMobileNav button','.dcTop a','.dcTop button']);
  await dm.goto(`${base}/dealer/inventory?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});await dm.locator('.inventoryContract').waitFor({state:'visible',timeout:10000});await assertHits(dm,'DEALER_MOBILE_INVENTORY',['.inventoryMobileNav a','.inventoryMobileNav button']);

  await dm.goto(`${base}/dealer/inventory/import?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  const mobileImport=await assertSurface(dm,'DEALER_MOBILE_IMPORT','.dcDrop',300,120);
  await assertHits(dm,'DEALER_MOBILE_IMPORT_ACTIONS',['.dcDrop a','.dcDrop button','.dcActions a','.dcActions button']);
  await mobileImport.screenshot({path:'immutable-visual-proof/dealer-import-mobile.png'});

  await dm.goto(`${base}/dealer/inventory/new?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await dm.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  await assertHits(dm,'DEALER_MOBILE_EDITOR_TOP',['.editTop a','.editTop button']);
  const mobilePhotos=await assertSurface(dm,'DEALER_MOBILE_PHOTOS','.sectionBlock:has(h2:text-is("Photos"))',300,180);
  await assertHits(dm,'DEALER_MOBILE_PHOTO_ACTIONS',['.photoTools button','.addPhoto']);
  await mobilePhotos.screenshot({path:'immutable-visual-proof/dealer-photos-mobile.png'});
  const mobileReadiness=await assertSurface(dm,'DEALER_MOBILE_READINESS','.mobileReadiness',300,120);
  await mobileReadiness.screenshot({path:'immutable-visual-proof/dealer-readiness-mobile.png'});
  const mobilePreview=dm.getByRole('button',{name:/^preview$/i}).first();await mobilePreview.scrollIntoViewIfNeeded();await mobilePreview.click({timeout:5000});
  const mobilePreviewModal=await assertSurface(dm,'DEALER_MOBILE_PREVIEW','.previewModal',300,300);
  await assertHits(dm,'DEALER_MOBILE_PREVIEW_ACTIONS',['.previewModal button','.previewModal a']);
  await mobilePreviewModal.screenshot({path:'immutable-visual-proof/dealer-preview-mobile.png'});
  await dealerMobile.close();
}finally{await browser.close()}

const metricsPath='immutable-visual-proof/metrics.json';
if(!fs.existsSync(metricsPath))throw new Error('VISUAL_METRICS_MISSING_AFTER_BASE_PROOF');
const metrics=JSON.parse(fs.readFileSync(metricsPath,'utf8'));
metrics.pointerChecks=pointerChecks;
metrics.pointerOverlapPass=pointerChecks.every(x=>x.failures.length===0);
metrics.surfaceChecks=surfaceChecks;
metrics.dealerSurfacePass=surfaceChecks.every(x=>x.pass);
fs.writeFileSync(metricsPath,JSON.stringify(metrics,null,2)+'\n');
console.log(`WDCC_POINTER_CONTRACT_PASS checks=${pointerChecks.length} dealerSurfaces=${surfaceChecks.length}`);
