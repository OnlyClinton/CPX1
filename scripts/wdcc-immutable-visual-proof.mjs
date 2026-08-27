import fs from 'node:fs';
import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const base=process.env.URL;
if(!base)throw new Error('IMMUTABLE_PREVIEW_URL_MISSING');
const sourcePath=new URL('./wdcc-immutable-visual-proof-base.mjs',import.meta.url);
const alignedPath=new URL('./.wdcc-immutable-visual-proof-aligned.mjs',import.meta.url);
let source=fs.readFileSync(sourcePath,'utf8');
// Align legacy proof assertions with FINAL VISUAL AUTHORITY 51077.
const oldMobileChrome="if(Math.abs((mobileHome.hTop||0)-(mobileHome.uH||0))>3||Math.abs((mobileHome.heroTop||0)-(mobileHome.hBottom||0))>3)throw new Error(`MOBILE_CHROME_GAP_${JSON.stringify(mobileHome)}`);";
const newMobileChrome="if((mobileHome.uH||0)>1||Math.abs(mobileHome.hTop||0)>3||Math.abs((mobileHome.heroTop||0)-(mobileHome.hBottom||0))>3)throw new Error(`MOBILE_CHROME_GAP_${JSON.stringify(mobileHome)}`);";
if(!source.includes(oldMobileChrome))throw new Error(`IMMUTABLE_OWNER_CONTRACT_SOURCE_DRIFT: ${oldMobileChrome}`);
source=source.replace(oldMobileChrome,newMobileChrome);
const oldMobileEditor="if(mf.tracks!==2||inputFonts.some(x=>x<15.5))throw new Error(`DEALER_MOBILE_EDITOR_BAD_${JSON.stringify({mf,inputFonts})}`);";
const newMobileEditor="if(mf.tracks!==1||mf.overflow>0||inputFonts.some(x=>x<15.5))throw new Error(`DEALER_MOBILE_EDITOR_BAD_${JSON.stringify({mf,inputFonts})}`);";
if(!source.includes(oldMobileEditor))throw new Error(`IMMUTABLE_OWNER_CONTRACT_SOURCE_DRIFT: ${oldMobileEditor}`);
source=source.replace(oldMobileEditor,newMobileEditor);
fs.writeFileSync(alignedPath,source);
try{await import(`${pathToFileURL(alignedPath.pathname).href}?aligned=${Date.now()}`)}finally{fs.rmSync(alignedPath,{force:true})}

fs.mkdirSync('immutable-visual-proof',{recursive:true});
const pointerChecks=[];
const surfaceChecks=[];
const brandChecks=[];
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
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
const decodePng=buf=>{
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  if(buf.length<33||!buf.subarray(0,8).equals(sig))throw new Error('BRAND_SCREENSHOT_NOT_PNG');
  let off=8,width=0,height=0,bitDepth=0,colorType=-1,interlace=-1;const idat=[];
  while(off+12<=buf.length){
    const len=buf.readUInt32BE(off);const type=buf.toString('ascii',off+4,off+8);const data=buf.subarray(off+8,off+8+len);off+=12+len;
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];interlace=data[12]}
    else if(type==='IDAT')idat.push(data);
    else if(type==='IEND')break;
  }
  if(bitDepth!==8||interlace!==0||![2,6].includes(colorType))throw new Error(`BRAND_SCREENSHOT_PNG_UNSUPPORTED_${JSON.stringify({width,height,bitDepth,colorType,interlace})}`);
  const bpp=colorType===6?4:3,stride=width*bpp,raw=zlib.inflateSync(Buffer.concat(idat));
  if(raw.length<(stride+1)*height)throw new Error('BRAND_SCREENSHOT_PNG_TRUNCATED');
  const pixels=Buffer.alloc(stride*height);let pos=0;
  for(let y=0;y<height;y++){
    const filter=raw[pos++],row=y*stride,prev=(y-1)*stride;
    for(let x=0;x<stride;x++){
      const v=raw[pos++],a=x>=bpp?pixels[row+x-bpp]:0,b=y>0?pixels[prev+x]:0,c=y>0&&x>=bpp?pixels[prev+x-bpp]:0;
      pixels[row+x]=filter===0?v:filter===1?(v+a)&255:filter===2?(v+b)&255:filter===3?(v+Math.floor((a+b)/2))&255:filter===4?(v+paeth(a,b,c))&255:(()=>{throw new Error(`BRAND_SCREENSHOT_PNG_FILTER_${filter}`)})();
    }
  }
  return{width,height,bpp,pixels};
};
const rgb=hex=>{const h=hex.replace('#','');return h.length===3?[...h].map(c=>parseInt(c+c,16)):[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const analyzePng=(buf,background)=>{
  const {width,height,bpp,pixels}=decodePng(buf),bg=rgb(background);let ink=0,sum=0,sum2=0,minL=255,maxL=0;const n=width*height;
  for(let p=0;p<pixels.length;p+=bpp){
    const r=pixels[p],g=pixels[p+1],b=pixels[p+2],dist=Math.hypot(r-bg[0],g-bg[1],b-bg[2]);if(dist>42)ink++;
    const l=.2126*r+.7152*g+.0722*b;sum+=l;sum2+=l*l;if(l<minL)minL=l;if(l>maxL)maxL=l;
  }
  const mean=sum/n,lumaStd=Math.sqrt(Math.max(0,sum2/n-mean*mean));
  return{pixelWidth:width,pixelHeight:height,inkFraction:ink/n,lumaStd,lumaRange:maxL-minL,minLuma:minL,maxLuma:maxL};
};
const assertBrandPixels=async(page,name,{selector,background,minWidth=1,minHeight=1,minInkFraction=.012,minLumaStd=4,minLumaRange=28,centerTolerance=null,expectedText='',expectedAsset=''})=>{
  const el=page.locator(selector).first();await el.waitFor({state:'visible',timeout:10000});
  const geom=await el.evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{w:r.width,h:r.height,cx:r.left+r.width/2,centerDelta:Math.abs(r.left+r.width/2-innerWidth/2),display:s.display,visibility:s.visibility,opacity:Number(s.opacity),backgroundImage:s.backgroundImage,text:(node.textContent||'').replace(/\s+/g,' ').trim()}});
  const path=`immutable-visual-proof/${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`,shot=await el.screenshot({path});
  const pixels=analyzePng(shot,background);
  const textPass=!expectedText||geom.text.toUpperCase().includes(expectedText.toUpperCase());
  const assetPass=!expectedAsset||String(geom.backgroundImage||'').includes(expectedAsset);
  const pass=geom.w>=minWidth&&geom.h>=minHeight&&geom.display!=='none'&&geom.visibility!=='hidden'&&geom.opacity>0&&(centerTolerance==null||geom.centerDelta<=centerTolerance)&&textPass&&assetPass&&pixels.inkFraction>=minInkFraction&&pixels.lumaStd>=minLumaStd&&pixels.lumaRange>=minLumaRange;
  const result={name,selector,background,minWidth,minHeight,minInkFraction,minLumaStd,minLumaRange,centerTolerance,expectedText,expectedAsset,...geom,...pixels,textPass,assetPass,pass};brandChecks.push(result);
  if(!pass)throw new Error(`${name}_BRAND_PIXEL_CONTRAST_FAILED_${JSON.stringify(result)}`);return el;
};
const wireDealer=async page=>{
  const session={authenticated:true,name:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc',user:{id:'visual-only',displayName:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc'}};
  const dashboard={summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:[],leads:[]};
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[]}'}):r.abort());
  await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[]}'}):r.abort());
};
const openWizardStage=async(page,label,stage)=>{
  const button=page.locator('.stepper button').filter({hasText:label}).first();
  await button.waitFor({state:'visible',timeout:10000});
  await button.click();
  await page.locator(`[data-wizard-stage="${stage}"]`).first().waitFor({state:'visible',timeout:10000});
};
const browser=await chromium.launch({headless:true});
try{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const m=await mobile.newPage();
  await m.goto(`${base}/?pointer-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  const intro=m.locator('.li');
  if(await intro.count()){
    await assertBrandPixels(m,'MOBILE_INTRO_BADGE',{selector:'.li-badge img[data-wdcc-intro-badge-art="owner-approved"]',background:'#ffffff',minWidth:220,minHeight:220,minInkFraction:.012,minLumaStd:4,minLumaRange:32,centerTolerance:4});
    await m.getByRole('button',{name:/skip intro/i}).click({timeout:2500}).catch(()=>{});
    await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{});
  }else throw new Error('MOBILE_INTRO_MISSING_FOR_BRAND_PROOF');
  await assertBrandPixels(m,'MOBILE_HEADER_EMBLEM',{selector:'[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-approved"]',background:'#02080d',minWidth:90,minHeight:90,minInkFraction:.015,minLumaStd:8,minLumaRange:80,centerTolerance:4});
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
  await openWizardStage(d,'Photos','photos');
  const desktopPhotos=await assertSurface(d,'DEALER_DESKTOP_PHOTOS','[data-wizard-stage="photos"]',500,180);
  await desktopPhotos.screenshot({path:'immutable-visual-proof/dealer-photos-desktop.png'});
  const desktopReadiness=await assertSurface(d,'DEALER_DESKTOP_READINESS','.readinessCard',240,180);
  await desktopReadiness.screenshot({path:'immutable-visual-proof/dealer-readiness-desktop.png'});
  const desktopLivePreview=await assertSurface(d,'DEALER_DESKTOP_LIVE_PREVIEW','.editRight .vehiclePreview',240,180);
  await desktopLivePreview.screenshot({path:'immutable-visual-proof/dealer-live-preview-desktop.png'});
  await openWizardStage(d,'Review','review');
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
  await openWizardStage(dm,'Photos','photos');
  const mobilePhotos=await assertSurface(dm,'DEALER_MOBILE_PHOTOS','[data-wizard-stage="photos"]',300,180);
  await assertHits(dm,'DEALER_MOBILE_PHOTO_ACTIONS',['.photoTools button','.addPhoto']);
  await mobilePhotos.screenshot({path:'immutable-visual-proof/dealer-photos-mobile.png'});
  const mobileReadiness=await assertSurface(dm,'DEALER_MOBILE_READINESS','.mobileReadiness',300,120);
  await mobileReadiness.screenshot({path:'immutable-visual-proof/dealer-readiness-mobile.png'});
  const mobileLivePreview=await assertSurface(dm,'DEALER_MOBILE_LIVE_PREVIEW','.mobilePreview .vehiclePreview',300,180);
  await mobileLivePreview.screenshot({path:'immutable-visual-proof/dealer-live-preview-mobile.png'});
  await openWizardStage(dm,'Review','review');
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
metrics.brandChecks=brandChecks;
metrics.brandPixelContrastPass=brandChecks.length>=2&&brandChecks.every(x=>x.pass);
fs.writeFileSync(metricsPath,JSON.stringify(metrics,null,2)+'\n');
console.log(`WDCC_POINTER_CONTRACT_PASS checks=${pointerChecks.length} dealerSurfaces=${surfaceChecks.length}`);
console.log(`WDCC_BRAND_PIXEL_CONTRAST_PASS checks=${brandChecks.length}`);