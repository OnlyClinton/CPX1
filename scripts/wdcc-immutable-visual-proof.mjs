import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
if(!base)throw new Error('IMMUTABLE_PREVIEW_URL_MISSING');
const out='immutable-visual-proof';
fs.mkdirSync(out,{recursive:true});

const proof={
  sha:process.env.GITHUB_SHA||'',
  url:base,
  provider:{status:0,ok:false,itemCount:0,customerVisibleCount:0,mode:'unknown'},
  storefront:{},dealer:{},writeRequests:[]
};
const customerVisible=v=>String(v?.status||'').toLowerCase()==='published'&&v?.internalOnly!==true&&!['internal','dealer_only'].includes(String(v?.visibility||'').toLowerCase())&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/i.test(String(v?.stock||''));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

let items=[];
try{
  const r=await fetch(`${base}/api/inventory?visual-provider=${Date.now()}`);
  proof.provider.status=r.status;
  const j=await r.json().catch(()=>({items:[]}));
  items=Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[];
  proof.provider.ok=r.ok;
  proof.provider.itemCount=items.length;
  proof.provider.customerVisibleCount=items.filter(customerVisible).length;
  proof.provider.mode=r.ok?(items.length?'available':'available-empty'):'blocked';
}catch(e){proof.provider.mode='blocked';proof.provider.error=String(e?.message||e)}

const browser=await chromium.launch({headless:true});
const watchWrites=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))proof.writeRequests.push({method:r.method(),url:r.url()})});
const finishIntro=async page=>{
  const intro=page.locator('.li');
  if(await intro.count()){
    await page.getByRole('button',{name:/skip intro/i}).click({timeout:1800}).catch(()=>{});
    await intro.waitFor({state:'detached',timeout:5000}).catch(()=>{});
  }
  await page.locator('.rh-header').waitFor({state:'visible',timeout:8000});
};
const waitInventorySettled=async page=>page.waitForFunction(()=>{
  const cards=document.querySelectorAll('.rh-card').length;
  const state=document.querySelector('.rh-inventory-state');
  return cards>0||(state&&!/loading/i.test(state.textContent||''));
},null,{timeout:10000});
const checkCtas=async page=>{
  const a=page.locator('.rh-hero-actions a.rh-btn');
  if(await a.count()!==2)throw new Error('HERO_CTA_COUNT');
  const data=await a.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{text:(n.textContent||'').trim(),aria:n.getAttribute('aria-label'),path:new URL(n.href).pathname,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width}}));
  if(data[0].text!=='GET PRE-APPROVED'||data[0].aria!=='GET PRE-APPROVED'||data[0].path!=='/get-approved')throw new Error(`PRIMARY_CTA_BAD ${JSON.stringify(data[0])}`);
  if(data[1].text!=='BROWSE INVENTORY'||data[1].aria!=='BROWSE INVENTORY'||data[1].path!=='/inventory')throw new Error(`SECONDARY_CTA_BAD ${JSON.stringify(data[1])}`);
  return data;
};
const checkInventoryUi=async(page,mobile)=>{
  await waitInventorySettled(page);
  const cards=page.locator('.rh-grid .rh-card');
  const count=await cards.count();
  const state=page.locator('.rh-inventory-state');
  if(!proof.provider.ok){
    if(count!==0)throw new Error(`PROVIDER_BLOCKED_BUT_CARDS_RENDERED_${count}`);
    await state.waitFor({state:'visible',timeout:5000});
    const text=(await state.innerText()).toLowerCase();
    if(!text.includes('temporarily unavailable')||!text.includes('not substituting demo vehicles'))throw new Error(`INVENTORY_FALLBACK_BAD ${text}`);
    return{mode:'provider-fallback',cards:0,text};
  }
  if(count===0){await state.waitFor({state:'visible',timeout:5000});return{mode:'available-empty',cards:0,text:await state.innerText()}}
  if(mobile&&count>=2){
    const grid=page.locator('.rh-grid');
    const before=await grid.evaluate(el=>el.scrollLeft);
    await grid.evaluate(el=>el.scrollBy({left:Math.max(220,el.clientWidth*.85),behavior:'instant'}));
    await sleep(250);
    const after=await grid.evaluate(el=>el.scrollLeft);
    if(after<=before+20)throw new Error(`MOBILE_CAROUSEL_DID_NOT_ADVANCE ${before}->${after}`);
    return{mode:'live-carousel',cards:count,before,after};
  }
  if(!mobile){
    const grid=page.locator('.rh-grid');
    const geom=await grid.evaluate(el=>{const s=getComputedStyle(el);return{display:s.display,tracks:s.gridTemplateColumns.split(/\s+/).filter(Boolean)}});
    if(geom.display!=='grid'||geom.tracks.length!==3)throw new Error(`DESKTOP_GRID_BAD ${JSON.stringify(geom)}`);
    return{mode:'live-grid',cards:count,...geom};
  }
  return{mode:'single-live-card',cards:count};
};

try{
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const m=await mobileCtx.newPage();watchWrites(m);
  await m.goto(`${base}/?visual-mobile=${Date.now()}`,{waitUntil:'commit',timeout:30000});
  const intro=m.locator('.li');
  await intro.waitFor({state:'attached',timeout:5000});
  await m.locator('.li-badge img').waitFor({state:'visible',timeout:5000});
  await m.locator('.li-scene img').waitFor({state:'visible',timeout:5000});
  await m.waitForFunction(()=>[document.querySelector('.li-badge img'),document.querySelector('.li-scene img')].every(x=>x&&x.complete&&x.naturalWidth>0),null,{timeout:5000});
  const staticIntro=await m.evaluate(()=>{const b=document.querySelector('.li-badge img'),s=document.querySelector('.li-scene img');const bs=getComputedStyle(b),ss=getComputedStyle(s),br=b.getBoundingClientRect();return{badgeW:br.width,badgeAnimation:bs.animationName,badgeTransform:bs.transform,sceneAnimation:ss.animationName,sceneTransform:ss.transform}});
  if(staticIntro.badgeW<145||staticIntro.badgeAnimation!=='none'||staticIntro.sceneAnimation!=='none'||staticIntro.badgeTransform!=='none'||staticIntro.sceneTransform!=='none')throw new Error(`INTRO_NOT_STATIC ${JSON.stringify(staticIntro)}`);
  proof.storefront.mobileIntro=staticIntro;
  await m.screenshot({path:`${out}/mobile-intro.png`});
  await finishIntro(m);
  await m.evaluate(()=>scrollTo(0,0));await sleep(120);
  const mobileGeom=await m.evaluate(()=>{
    const u=document.querySelector('.rh-utility').getBoundingClientRect(),h=document.querySelector('.rh-header').getBoundingClientRect(),hero=document.querySelector('.rh-hero').getBoundingClientRect(),logo=document.querySelector('.rh-logo img').getBoundingClientRect(),call=document.querySelector('.rh-call').getBoundingClientRect(),cs=getComputedStyle(document.querySelector('.rh-call')),benefits=getComputedStyle(document.querySelector('.rh-benefits'));
    return{docW:document.documentElement.scrollWidth,winW:innerWidth,uTop:u.top,uH:u.height,hTop:h.top,hBottom:h.bottom,heroTop:hero.top,logoW:logo.width,callW:call.width,callH:call.height,callRadius:cs.borderTopLeftRadius,benefitTracks:benefits.gridTemplateColumns.split(/\s+/).filter(Boolean).length};
  });
  if(mobileGeom.docW>mobileGeom.winW+1)throw new Error(`MOBILE_HORIZONTAL_OVERFLOW ${JSON.stringify(mobileGeom)}`);
  if(Math.abs(mobileGeom.uTop)>2||Math.abs(mobileGeom.hTop-mobileGeom.uH)>3||Math.abs(mobileGeom.heroTop-mobileGeom.hBottom)>3)throw new Error(`MOBILE_HEADER_HERO_GAP ${JSON.stringify(mobileGeom)}`);
  const round=mobileGeom.callRadius.includes('%')?parseFloat(mobileGeom.callRadius)>=49:parseFloat(mobileGeom.callRadius)>=mobileGeom.callW*.45;
  if(mobileGeom.logoW<70||Math.abs(mobileGeom.callW-mobileGeom.callH)>2||mobileGeom.callW<42||!round||mobileGeom.benefitTracks!==2)throw new Error(`MOBILE_GEOMETRY_BAD ${JSON.stringify(mobileGeom)}`);
  const mobileCtas=await checkCtas(m);
  if(mobileCtas[1].top<=mobileCtas[0].bottom)throw new Error('MOBILE_CTAS_NOT_STACKED');
  if(mobileCtas.some(x=>x.width<330))throw new Error(`MOBILE_CTAS_NOT_FULL_WIDTH ${JSON.stringify(mobileCtas)}`);
  const finance=await m.locator('.rh-finance .rh-step').evaluateAll(nodes=>nodes.map(n=>({client:n.clientWidth,scroll:n.scrollWidth,text:(n.textContent||'').trim()})));
  if(finance.some(x=>x.scroll>x.client+2))throw new Error(`MOBILE_FINANCE_OVERFLOW ${JSON.stringify(finance)}`);
  const menu=m.locator('.rh-menu');await menu.click();
  const nav=m.locator('.rh-nav.open');await nav.waitFor({state:'visible',timeout:3000});
  const navLinks=await nav.locator('a').count();if(navLinks<3)throw new Error(`MOBILE_NAV_INCOMPLETE_${navLinks}`);await menu.click();
  const mobileInventory=await checkInventoryUi(m,true);
  await m.screenshot({path:`${out}/mobile-storefront.png`,fullPage:true});
  proof.storefront.mobile={geometry:mobileGeom,ctas:mobileCtas,navLinks,inventory:mobileInventory};
  await mobileCtx.close();

  const desktopCtx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const d=await desktopCtx.newPage();watchWrites(d);
  await d.goto(`${base}/?visual-desktop=${Date.now()}`,{waitUntil:'commit',timeout:30000});await finishIntro(d);
  const desktopGeom=await d.evaluate(()=>{const menu=getComputedStyle(document.querySelector('.rh-menu')).display,logo=document.querySelector('.rh-logo img').getBoundingClientRect(),u=document.querySelector('.rh-utility').getBoundingClientRect(),h=document.querySelector('.rh-header').getBoundingClientRect(),hero=document.querySelector('.rh-hero').getBoundingClientRect();return{menu,logoW:logo.width,docW:document.documentElement.scrollWidth,winW:innerWidth,uTop:u.top,uH:u.height,hTop:h.top,hBottom:h.bottom,heroTop:hero.top}});
  if(desktopGeom.menu!=='none'||desktopGeom.logoW<80||desktopGeom.docW>desktopGeom.winW+1)throw new Error(`DESKTOP_CHROME_BAD ${JSON.stringify(desktopGeom)}`);
  const desktopCtas=await checkCtas(d);
  const desktopInventory=await checkInventoryUi(d,false);
  await d.screenshot({path:`${out}/desktop-storefront.png`,fullPage:true});
  proof.storefront.desktop={geometry:desktopGeom,ctas:desktopCtas,inventory:desktopInventory};

  const sessionBody=JSON.stringify({authenticated:true,name:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc',user:{id:'visual-only',displayName:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc'}});
  const dealerItems=proof.provider.ok?items:[];
  const dashBody=JSON.stringify({summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:dealerItems,leads:[]});
  async function wireDealer(page){
    watchWrites(page);
    await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:sessionBody}));
    await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:dashBody}));
    await page.route('**/api/inventory**',r=>{
      const req=r.request(),u=new URL(req.url());
      if(req.method()!=='GET')return r.abort();
      if(u.pathname==='/api/inventory')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:dealerItems})});
      const id=decodeURIComponent(u.pathname.slice('/api/inventory/'.length));
      const item=dealerItems.find(v=>String(v.id)===id);
      return item?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item})}):r.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"NOT_FOUND"}'});
    });
  }
  const capture=async(page,path,selector,name)=>{await page.goto(`${base}${path}${path.includes('?')?'&':'?'}visual=${Date.now()}`,{waitUntil:'commit',timeout:30000});await page.locator(selector).waitFor({state:'visible',timeout:10000});await page.screenshot({path:`${out}/${name}.png`,fullPage:true})};

  const dealer=await desktopCtx.newPage();await wireDealer(dealer);
  await capture(dealer,'/dealer','.dealerDashboardLocked','dealer-dashboard-desktop');
  const dashVisual=await dealer.evaluate(()=>{const title=document.querySelector('.dcTitle h1'),logo=document.querySelector('.dcTop .brand img'),ts=getComputedStyle(title),ls=getComputedStyle(logo),lr=logo.getBoundingClientRect();return{titleColor:ts.color,logoDisplay:ls.display,logoW:lr.width,logoH:lr.height,naturalW:logo.naturalWidth,naturalH:logo.naturalHeight}});
  const rgb=(dashVisual.titleColor.match(/\d+/g)||[]).slice(0,3).map(Number);
  if(dashVisual.logoDisplay==='none'||dashVisual.logoW<48||dashVisual.naturalW<1||(rgb.length===3&&rgb.every(v=>v>220)))throw new Error(`DEALER_DASHBOARD_VISUAL_BAD ${JSON.stringify(dashVisual)}`);
  await capture(dealer,'/dealer/inventory','.inventoryContract','dealer-inventory-desktop');
  await capture(dealer,'/dealer/inventory/import','.dcDrop','dealer-import-desktop');
  await dealer.goto(`${base}/dealer/inventory/new?visual=${Date.now()}`,{waitUntil:'commit',timeout:30000});
  await dealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  await dealer.screenshot({path:`${out}/dealer-editor-desktop.png`,fullPage:true});
  const photos=dealer.locator('.sectionBlock').filter({hasText:'Photos'}).first();if(await photos.count())await photos.screenshot({path:`${out}/dealer-photos-desktop.png`});
  const readiness=dealer.locator('.readinessCard').first();if(await readiness.count())await readiness.screenshot({path:`${out}/dealer-readiness-desktop.png`});
  const previewButton=dealer.getByRole('button',{name:/^preview$/i}).last();await previewButton.scrollIntoViewIfNeeded();await previewButton.click({timeout:5000});
  await dealer.locator('.previewModal').waitFor({state:'visible',timeout:5000});await dealer.locator('.previewModal').screenshot({path:`${out}/dealer-preview-desktop.png`});
  proof.dealer.desktop={dashboard:dashVisual,inventoryMode:proof.provider.ok?'canonical-readonly':'empty-provider-fallback',preview:'normal-click-pass'};
  await desktopCtx.close();

  const dealerMobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const dm=await dealerMobileCtx.newPage();await wireDealer(dm);
  await capture(dm,'/dealer','.dealerDashboardLocked','dealer-dashboard-mobile');
  await capture(dm,'/dealer/inventory','.inventoryContract','dealer-inventory-mobile');
  await capture(dm,'/dealer/inventory/import','.dcDrop','dealer-import-mobile');
  await dm.goto(`${base}/dealer/inventory/new?visual-mobile=${Date.now()}`,{waitUntil:'commit',timeout:30000});await dm.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  await dm.screenshot({path:`${out}/dealer-editor-mobile.png`,fullPage:true});
  const mobilePreview=dm.getByRole('button',{name:/^preview$/i}).last();await mobilePreview.scrollIntoViewIfNeeded();await mobilePreview.click({timeout:5000});await dm.locator('.previewModal').waitFor({state:'visible',timeout:5000});await dm.locator('.previewModal').screenshot({path:`${out}/dealer-preview-mobile.png`});
  proof.dealer.mobile={inventoryMode:proof.provider.ok?'canonical-readonly':'empty-provider-fallback',preview:'normal-click-pass'};
  await dealerMobileCtx.close();
}finally{await browser.close()}

if(proof.writeRequests.length)throw new Error(`VISUAL_PROOF_WRITE_REQUEST ${JSON.stringify(proof.writeRequests)}`);
fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(proof,null,2)+'\n');