import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
if(!base)throw new Error('IMMUTABLE_PREVIEW_URL_MISSING');
const out='immutable-visual-proof';
fs.mkdirSync(out,{recursive:true});
const proof={sha:process.env.GITHUB_SHA||'',url:base,provider:{status:0,ok:false,itemCount:0,customerVisibleCount:0,mode:'unknown'},storefront:{},publicInventory:{},vdp:{},dealer:{},writeRequests:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const customerVisible=v=>String(v?.status||'').toLowerCase()==='published'&&v?.internalOnly!==true&&!['internal','dealer_only'].includes(String(v?.visibility||'').toLowerCase())&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/i.test(String(v?.stock||v?.stock_id||''));
const tracks=async locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return{display:s.display,tracks:s.gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
const visible=async locator=>locator.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>1&&r.height>1});

let items=[];
try{
  const r=await fetch(`${base}/api/inventory?visual-provider=${Date.now()}`);
  proof.provider.status=r.status;
  const j=await r.json().catch(()=>({items:[]}));
  items=(Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[]).filter(customerVisible);
  proof.provider.ok=r.ok&&!j.previewFallback&&j.inventorySource!=='last-known-good-real-proof';
  proof.provider.itemCount=Array.isArray(j.items)?j.items.length:Array.isArray(j.inventory)?j.inventory.length:0;
  proof.provider.customerVisibleCount=items.length;
  proof.provider.mode=proof.provider.ok?(items.length?'available':'available-empty'):'blocked-or-fallback';
}catch(e){proof.provider.mode='blocked';proof.provider.error=String(e?.message||e)}

const browser=await chromium.launch({headless:true});
const watchWrites=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))proof.writeRequests.push({method:r.method(),url:r.url()})});
const finishIntro=async page=>{const intro=page.locator('.li');if(await intro.count()){await page.getByRole('button',{name:/skip intro/i}).click({timeout:2000}).catch(()=>{});await intro.waitFor({state:'detached',timeout:6000}).catch(()=>{})}};
const settleHomeInventory=async page=>page.waitForFunction(()=>{const grid=document.querySelector('.rh-grid');const state=document.querySelector('.rh-inventory-state');return Boolean(grid)||Boolean(state&&!/loading/i.test(state.textContent||''))},null,{timeout:10000});
const assertNoOverflow=async(page,name)=>{const n=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(n>2)throw new Error(`${name}_HORIZONTAL_OVERFLOW_${n}`);return n};

async function wireDealer(page,mobile=false){
  watchWrites(page);
  const session={authenticated:true,name:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc',user:{id:'visual-only',displayName:'WDCC Visual QA',role:'dealer_agent',tenantId:'wdcc'}};
  const dashboard={summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:items,leads:[]};
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/inventory**',r=>{
    const req=r.request(),u=new URL(req.url());
    if(req.method()!=='GET')return r.abort();
    if(u.pathname==='/api/inventory')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items})});
    const id=decodeURIComponent(u.pathname.slice('/api/inventory/'.length));
    const item=items.find(v=>String(v.id||v.slug)===id);
    return item?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item})}):r.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"NOT_FOUND"}'});
  });
  await page.route('**/api/leads/**',r=>r.request().method()==='GET'?r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'}):r.abort());
  return mobile;
}

try{
  /* MOBILE STOREFRONT — intentional redesign, not desktop squeezed down. */
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const m=await mobileCtx.newPage();watchWrites(m);
  let r=await m.goto(`${base}/?visual-mobile=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  if(!r||r.status()>=400)throw new Error(`MOBILE_HOME_HTTP_${r?.status()||0}`);
  await finishIntro(m);await settleHomeInventory(m);await assertNoOverflow(m,'MOBILE_HOME');
  const mobileHome=await m.evaluate(()=>{
    const rect=s=>document.querySelector(s)?.getBoundingClientRect();
    const style=s=>getComputedStyle(document.querySelector(s));
    const h1=[...document.querySelectorAll('.rh-copy h1 span')].map(x=>(x.textContent||'').trim());
    const u=rect('.rh-utility'),h=rect('.rh-header'),hero=rect('.rh-hero'),call=rect('.rh-call'),logo=rect('.rh-logo img');
    return{h1,uTop:u?.top,uH:u?.height,hTop:h?.top,hBottom:h?.bottom,heroTop:hero?.top,callW:call?.width,callH:call?.height,callRadius:style('.rh-call').borderTopLeftRadius,logoW:logo?.width,benefitTracks:style('.rh-benefits').gridTemplateColumns.split(/\s+/).filter(Boolean).length,ctaCount:document.querySelectorAll('.rh-hero-actions .rh-btn').length};
  });
  if(JSON.stringify(mobileHome.h1)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."]))throw new Error(`MOBILE_HEADLINE_BAD_${JSON.stringify(mobileHome.h1)}`);
  if(Math.abs((mobileHome.hTop||0)-(mobileHome.uH||0))>3||Math.abs((mobileHome.heroTop||0)-(mobileHome.hBottom||0))>3)throw new Error(`MOBILE_CHROME_GAP_${JSON.stringify(mobileHome)}`);
  if((mobileHome.logoW||0)<90||Math.abs((mobileHome.callW||0)-(mobileHome.callH||0))>2||(mobileHome.callW||0)<44||mobileHome.benefitTracks!==2||mobileHome.ctaCount!==2)throw new Error(`MOBILE_HOME_GEOMETRY_BAD_${JSON.stringify(mobileHome)}`);
  const mobileCtas=await m.locator('.rh-hero-actions .rh-btn').evaluateAll(nodes=>nodes.map(n=>{const q=n.getBoundingClientRect();return{text:(n.textContent||'').trim(),path:new URL(n.href).pathname,w:q.width,top:q.top,bottom:q.bottom}}));
  if(mobileCtas[0]?.text!=='GET PRE-APPROVED'||mobileCtas[0]?.path!=='/get-approved'||mobileCtas[1]?.text!=='BROWSE INVENTORY'||mobileCtas[1]?.path!=='/inventory'||mobileCtas.some(x=>x.w<340)||mobileCtas[1].top<=mobileCtas[0].bottom)throw new Error(`MOBILE_CTA_BAD_${JSON.stringify(mobileCtas)}`);
  const mobileFeatured=await m.locator('.rh-grid').count()?await (async()=>{const grid=m.locator('.rh-grid');const count=await grid.locator(':scope > *').count();const display=await grid.evaluate(el=>getComputedStyle(el).display);let advanced=false;if(count>1){const before=await grid.evaluate(el=>el.scrollLeft);await grid.evaluate(el=>el.scrollBy({left:Math.max(260,el.clientWidth*.8),behavior:'instant'}));await sleep(250);const after=await grid.evaluate(el=>el.scrollLeft);advanced=after>before+20}if(display!=='flex'||(count>1&&!advanced))throw new Error(`MOBILE_FEATURED_NOT_CAROUSEL_${JSON.stringify({display,count,advanced})}`);return{display,count,advanced}})():{state:(await m.locator('.rh-inventory-state').innerText()).slice(0,120)};
  const financeTracks=await tracks(m.locator('.rh-steps'));if(financeTracks.tracks!==1)throw new Error(`MOBILE_FINANCE_NOT_STACKED_${JSON.stringify(financeTracks)}`);
  await m.screenshot({path:`${out}/mobile-storefront.png`,fullPage:true});
  proof.storefront.mobile={...mobileHome,ctas:mobileCtas,featured:mobileFeatured,financeTracks:financeTracks.tracks};

  /* MOBILE PUBLIC INVENTORY — one column, same canonical card component. */
  r=await m.goto(`${base}/inventory?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`MOBILE_INVENTORY_HTTP_${r?.status()||0}`);await sleep(900);await assertNoOverflow(m,'MOBILE_INVENTORY');
  const mig=m.locator('.inventoryGrid');await mig.waitFor({state:'visible',timeout:10000});const mi=await tracks(mig);if(mi.display!=='grid'||mi.tracks!==1)throw new Error(`MOBILE_INVENTORY_GRID_BAD_${JSON.stringify(mi)}`);await m.screenshot({path:`${out}/mobile-inventory.png`,fullPage:true});proof.publicInventory.mobile=mi;

  /* MOBILE VDP / honest unavailable state. */
  const vdpPath=items[0]?`/vehicle/${encodeURIComponent(String(items[0].id||items[0].slug))}`:'/vehicle/__visual-proof-unavailable__';
  r=await m.goto(`${base}${vdpPath}?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`MOBILE_VDP_HTTP_${r?.status()||0}`);await m.locator('.vehicleLayout,.vehicleUnavailable').first().waitFor({state:'visible',timeout:12000});await assertNoOverflow(m,'MOBILE_VDP');
  const vdpLayout=m.locator('.vehicleLayout');const mvdp=await vdpLayout.count()?await tracks(vdpLayout):{display:'unavailable',tracks:1,overflow:0};if(await vdpLayout.count()&&mvdp.tracks!==1)throw new Error(`MOBILE_VDP_NOT_SINGLE_COLUMN_${JSON.stringify(mvdp)}`);await m.screenshot({path:`${out}/mobile-vdp.png`,fullPage:true});proof.vdp.mobile=mvdp;
  await mobileCtx.close();

  /* DESKTOP STOREFRONT — five featured cards per supplied 3294 reference. */
  const desktopCtx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const d=await desktopCtx.newPage();watchWrites(d);
  r=await d.goto(`${base}/?visual-desktop=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DESKTOP_HOME_HTTP_${r?.status()||0}`);await finishIntro(d);await settleHomeInventory(d);await assertNoOverflow(d,'DESKTOP_HOME');
  const desktopHome=await d.evaluate(()=>{const menu=getComputedStyle(document.querySelector('.rh-menu')).display,logo=document.querySelector('.rh-logo img').getBoundingClientRect(),nav=getComputedStyle(document.querySelector('.rh-nav')).display,benefits=getComputedStyle(document.querySelector('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length;return{menu,nav,logoW:logo.width,benefits}});
  if(desktopHome.menu!=='none'||desktopHome.nav==='none'||desktopHome.logoW<100||desktopHome.benefits!==4)throw new Error(`DESKTOP_HOME_CHROME_BAD_${JSON.stringify(desktopHome)}`);
  let desktopFeatured={state:'no-live-cards'};if(await d.locator('.rh-grid').count()){const grid=d.locator('.rh-grid');const g=await tracks(grid);const count=await grid.locator(':scope > *').count();if(g.display!=='grid'||g.tracks!==5)throw new Error(`DESKTOP_FEATURED_GRID_BAD_${JSON.stringify({...g,count})}`);desktopFeatured={...g,count}}
  await d.screenshot({path:`${out}/desktop-storefront.png`,fullPage:true});proof.storefront.desktop={...desktopHome,featured:desktopFeatured};

  /* DESKTOP FULL INVENTORY — exactly three columns. */
  r=await d.goto(`${base}/inventory?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DESKTOP_INVENTORY_HTTP_${r?.status()||0}`);await sleep(900);await assertNoOverflow(d,'DESKTOP_INVENTORY');const dig=d.locator('.inventoryGrid');await dig.waitFor({state:'visible',timeout:10000});const di=await tracks(dig);if(di.display!=='grid'||di.tracks!==3)throw new Error(`DESKTOP_INVENTORY_GRID_BAD_${JSON.stringify(di)}`);await d.screenshot({path:`${out}/desktop-inventory.png`,fullPage:true});proof.publicInventory.desktop=di;

  /* DESKTOP VDP — media + summary columns. */
  r=await d.goto(`${base}${vdpPath}?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DESKTOP_VDP_HTTP_${r?.status()||0}`);await d.locator('.vehicleLayout,.vehicleUnavailable').first().waitFor({state:'visible',timeout:12000});await assertNoOverflow(d,'DESKTOP_VDP');const dvdp=await d.locator('.vehicleLayout').count()?await tracks(d.locator('.vehicleLayout')):{display:'unavailable',tracks:2,overflow:0};if(await d.locator('.vehicleLayout').count()&&dvdp.tracks!==2)throw new Error(`DESKTOP_VDP_GRID_BAD_${JSON.stringify(dvdp)}`);await d.screenshot({path:`${out}/desktop-vdp.png`,fullPage:true});proof.vdp.desktop=dvdp;

  /* DEALER DESKTOP — dark shell/light canvas; six KPIs; table inventory; 4-column editor fields. */
  const dealer=await desktopCtx.newPage();await wireDealer(dealer);
  r=await dealer.goto(`${base}/dealer?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_DASH_HTTP_${r?.status()||0}`);await dealer.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});await assertNoOverflow(dealer,'DEALER_DESKTOP');
  const ddShell=await tracks(dealer.locator('.dcShell'));const ddMetrics=await tracks(dealer.locator('.dashMetrics'));const ddSide=await visible(dealer.locator('.dcSide'));if(ddShell.tracks!==2||ddMetrics.tracks!==6||!ddSide)throw new Error(`DEALER_DESKTOP_LAYOUT_BAD_${JSON.stringify({ddShell,ddMetrics,ddSide})}`);await dealer.screenshot({path:`${out}/dealer-dashboard-desktop.png`,fullPage:true});
  r=await dealer.goto(`${base}/dealer/inventory?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_INV_HTTP_${r?.status()||0}`);await dealer.locator('.inventoryContract').waitFor({state:'visible',timeout:10000});const invHead=await dealer.locator('.inventoryHead').count()?await visible(dealer.locator('.inventoryHead')):false;if(!invHead)throw new Error('DEALER_DESKTOP_TABLE_HEAD_MISSING');await dealer.screenshot({path:`${out}/dealer-inventory-desktop.png`,fullPage:true});
  r=await dealer.goto(`${base}/dealer/inventory/new?visual=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_EDITOR_HTTP_${r?.status()||0}`);await dealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});const editLayout=await tracks(dealer.locator('.editLayout'));const fieldGrid=await tracks(dealer.locator('.fieldGrid'));if(editLayout.tracks!==2||fieldGrid.tracks!==4)throw new Error(`DEALER_EDITOR_DESKTOP_BAD_${JSON.stringify({editLayout,fieldGrid})}`);await dealer.screenshot({path:`${out}/dealer-editor-desktop.png`,fullPage:true});proof.dealer.desktop={shell:ddShell,kpis:ddMetrics,inventoryTable:true,editor:{editLayout,fieldGrid}};
  await desktopCtx.close();

  /* DEALER MOBILE — no sidebar, 2-column KPI tiles, inventory cards, 2-column form fields. */
  const dealerMobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const dm=await dealerMobileCtx.newPage();await wireDealer(dm,true);
  r=await dm.goto(`${base}/dealer?visual-mobile=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_MOBILE_HTTP_${r?.status()||0}`);await dm.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});await assertNoOverflow(dm,'DEALER_MOBILE');const mdSide=await visible(dm.locator('.dcSide'));const mdMetrics=await tracks(dm.locator('.dashMetrics'));const mdNav=await visible(dm.locator('.dashMobileNav'));if(mdSide||mdMetrics.tracks!==2||!mdNav)throw new Error(`DEALER_MOBILE_DASH_BAD_${JSON.stringify({mdSide,mdMetrics,mdNav})}`);await dm.screenshot({path:`${out}/dealer-dashboard-mobile.png`,fullPage:true});
  r=await dm.goto(`${base}/dealer/inventory?visual-mobile=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_MOBILE_INV_HTTP_${r?.status()||0}`);await dm.locator('.inventoryContract').waitFor({state:'visible',timeout:10000});const mh=await dm.locator('.inventoryHead').count()?await visible(dm.locator('.inventoryHead')):false;const mn=await visible(dm.locator('.inventoryMobileNav'));if(mh||!mn)throw new Error(`DEALER_MOBILE_INVENTORY_BAD_${JSON.stringify({headVisible:mh,navVisible:mn})}`);await dm.screenshot({path:`${out}/dealer-inventory-mobile.png`,fullPage:true});
  r=await dm.goto(`${base}/dealer/inventory/new?visual-mobile=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});if(!r||r.status()>=400)throw new Error(`DEALER_MOBILE_EDITOR_HTTP_${r?.status()||0}`);await dm.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});const mf=await tracks(dm.locator('.fieldGrid'));const inputFonts=await dm.locator('.fieldGrid input,.fieldGrid select').evaluateAll(xs=>xs.filter(x=>{const r=x.getBoundingClientRect();return r.width>1&&r.height>1}).map(x=>parseFloat(getComputedStyle(x).fontSize)||0));if(mf.tracks!==2||inputFonts.some(x=>x<15.5))throw new Error(`DEALER_MOBILE_EDITOR_BAD_${JSON.stringify({mf,inputFonts})}`);await dm.screenshot({path:`${out}/dealer-editor-mobile.png`,fullPage:true});proof.dealer.mobile={kpis:mdMetrics,sideVisible:mdSide,bottomNav:mdNav,inventoryHeadVisible:mh,inventoryNav:mn,editorFields:mf};
  await dealerMobileCtx.close();

}finally{await browser.close()}

if(proof.writeRequests.length)throw new Error(`VISUAL_PROOF_WRITE_REQUESTS_${proof.writeRequests.length}`);
fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(proof,null,2)+'\n');
console.log(`WDCC_SYSTEM_V2_VISUAL_PASS sha=${proof.sha} provider=${proof.provider.mode} writes=0`);
