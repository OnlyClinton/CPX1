import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
const out='owner-board-proof';
if(!base||!sha||!base.includes(sha))throw new Error(`OWNER_BOARD_NOT_EXACT_SHA ${base||''} ${sha||''}`);
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const writes=[];
const watch=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
const R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
const fail=(name,data={})=>{throw new Error(`${name}_${JSON.stringify(data)}`)};

const vehicles=[
  {id:'real-2004-nissan-350z',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Clean title. Runs and drives great.',primary_image_url:'/wdcc-review-media/nissan350z'},
  {id:'real-2016-ford-f150-limited',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,downPayment:1500,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/fordF150'},
  {id:'real-2019-honda-pilot',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,downPayment:1500,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/hondaPilot'},
  {id:'real-2019-kia-sportage',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,downPayment:2000,mileage:60000,stock:'JGCL2020',status:'draft',visibility:'public',transmission:'Automatic',drivetrain:'4WD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/kiaSportage'},
  {id:'real-2019-toyota-rav4',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,downPayment:2000,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-board',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads:[]};

async function wire(page){
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
  await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"items":[]}'}):r.abort());
}
async function goto200(page,path,name){
  let status=0;
  for(let i=1;i<=15;i++){
    const join=path.includes('?')?'&':'?';
    const response=await page.goto(`${base}${path}${join}wob=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    status=response?.status()||0;
    if(status===200)return response;
    await page.waitForTimeout(1200);
  }
  fail(`${name}_HTTP`,{status,path});
}
async function skipIntro(page){
  const intro=page.locator('.li');
  if(!await intro.count())return;
  const b=page.getByRole('button',{name:/skip intro/i});
  if(await b.count())await b.click().catch(()=>{});
  await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{});
}
async function waitRecoveredPhotos(page,selector){
  await page.waitForFunction(sel=>{
    const imgs=[...document.querySelectorAll(sel)];
    return imgs.length===5&&imgs.every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20&&String(i.getAttribute('src')||'').startsWith('/wdcc-review-media/'));
  },selector,{timeout:20000});
}

const result={sha,url:base,desktop:{},mobile:{},dealer:{},writes,pass:false};
try{
  const dctx=await browser.newContext({viewport:{width:1440,height:1000},screen:{width:1440,height:1000},deviceScaleFactor:1});
  const d=await dctx.newPage();watch(d);
  await goto200(d,'/?owner-review=1','DESKTOP_HOME');
  await skipIntro(d);
  await d.locator('img[data-wdcc-logo-art="owner-approved"]').waitFor({state:'visible',timeout:10000});
  await d.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitRecoveredPhotos(d,'.rh-grid>article img');
  const home=await d.evaluate(()=>{const q=s=>document.querySelector(s),grid=q('.rh-grid'),logo=q('img[data-wdcc-logo-art="owner-approved"]'),lr=R(logo),cards=[...grid.children].map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height}}),headline=[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim()),colors=[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color);return{logo:{src:logo?.getAttribute('src')||'',w:lr?.w||0,h:lr?.h||0,naturalWidth:logo?.naturalWidth||0,naturalHeight:logo?.naturalHeight||0},utilityH:R(q('[data-wdcc-public-chrome="utility"]'))?.h||0,headerH:R(q('[data-wdcc-public-chrome="header"]'))?.h||0,heroH:R(q('.rh-hero'))?.h||0,heroLoaded:Boolean(q('.rh-hero-art')?.complete&&q('.rh-hero-art')?.naturalWidth>20),headline,colors,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gridDisplay:getComputedStyle(grid).display,gridTracks:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,placeholders:grid.querySelectorAll('[role="img"][aria-label*="photo unavailable" i]').length,overflow:document.documentElement.scrollWidth-innerWidth}});
  const expectedColors=['rgb(242, 31, 50)','rgb(22, 138, 244)','rgb(255, 255, 255)'];
  if(home.logo.src!=='/wdcc-owner-logo'||home.logo.naturalWidth<20||home.logo.naturalHeight<20||home.logo.w<70||home.utilityH<28||home.headerH<70||!home.heroLoaded||home.heroH<520||JSON.stringify(home.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(home.colors)!==JSON.stringify(expectedColors)||home.benefits!==4||home.gridDisplay!=='grid'||home.gridTracks!==5||home.cards.length!==5||home.finance!==4||home.trust!==4||home.placeholders!==0||home.overflow>2)fail('DESKTOP_50869',home);
  result.desktop.home=home;
  await d.screenshot({path:`${out}/50869-desktop-home.png`,fullPage:true});

  await goto200(d,'/inventory?owner-review=1','DESKTOP_INVENTORY');
  await d.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  const di=await d.evaluate(()=>{const g=document.querySelector('.wdccVehicleGrid');return{tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(di.tracks!==3||di.cards!==5||di.overflow>2)fail('DESKTOP_PUBLIC_INVENTORY',di);
  result.desktop.inventory=di;
  await d.screenshot({path:`${out}/desktop-inventory.png`,fullPage:true});

  const dd=await dctx.newPage();watch(dd);await wire(dd);
  await goto200(dd,'/dealer','DEALER_DASHBOARD');
  await dd.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
  const dash=await dd.evaluate(()=>({side:getComputedStyle(document.querySelector('.dcSide')).display,metricTracks:getComputedStyle(document.querySelector('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,workspace:getComputedStyle(document.querySelector('.dashboardContent')).backgroundColor,opsTracks:getComputedStyle(document.querySelector('.opsCards')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,activityTop:document.querySelector('.activityLocked')?.getBoundingClientRect().top||0,inventoryTop:document.querySelector('.inventoryOverview')?.getBoundingClientRect().top||0,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(dash.side==='none'||dash.metricTracks!==6||dash.opsTracks!==4||Math.abs(dash.activityTop-dash.inventoryTop)>3||dash.overflow>2)fail('DEALER_10668_DESKTOP',dash);
  result.dealer.desktopDashboard=dash;
  await dd.screenshot({path:`${out}/10668-dashboard-desktop.png`,fullPage:true});

  await goto200(dd,'/dealer/inventory','DEALER_ALL_VEHICLES');
  await dd.locator('.inventoryTable').waitFor({state:'visible',timeout:10000});
  const all=await dd.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,side:getComputedStyle(document.querySelector('.dcSide')).display,head:getComputedStyle(document.querySelector('.inventoryHead')).display,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(all.rows<5||all.side==='none'||all.head==='none'||all.overflow>2)fail('DEALER_51074_DESKTOP',all);
  result.dealer.desktopInventory=all;
  await dd.screenshot({path:`${out}/51074-all-vehicles-desktop.png`,fullPage:true});

  await goto200(dd,'/dealer/inventory/new','DEALER_EDITOR');
  await dd.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const steps=await dd.locator('.stepper button').count();
  const edit=await dd.evaluate(()=>({right:getComputedStyle(document.querySelector('.editRight')).display,layout:getComputedStyle(document.querySelector('.editLayout')).gridTemplateColumns,brandLogo:document.querySelector('.editTop .topBrand img')?.getBoundingClientRect().width||0,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(steps!==5||edit.right==='none'||edit.brandLogo<40||edit.overflow>2)fail('DEALER_10667_DESKTOP',{steps,...edit});
  result.dealer.desktopEditor={steps,...edit};
  await dd.screenshot({path:`${out}/10667-add-edit-desktop.png`,fullPage:true});
  await dctx.close();

  const mctx=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const m=await mctx.newPage();watch(m);
  await goto200(m,'/?owner-review=1','MOBILE_HOME');
  await skipIntro(m);
  await m.locator('img[data-wdcc-logo-art="owner-approved"]').waitFor({state:'visible',timeout:10000});
  await m.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitRecoveredPhotos(m,'.rh-grid>article img');
  const mobileHome=await m.evaluate(()=>{const q=s=>document.querySelector(s),grid=q('.rh-grid'),logo=q('img[data-wdcc-logo-art="owner-approved"]'),lr=R(logo),cards=[...grid.children].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,w:r.width}}),utility=q('[data-wdcc-public-chrome="utility"]'),ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(e=>R(e));return{logo:{src:logo?.getAttribute('src')||'',w:lr?.w||0,h:lr?.h||0,cx:lr?lr.x+lr.w/2:0,naturalWidth:logo?.naturalWidth||0},utilityDisplay:utility?getComputedStyle(utility).display:'none',headerH:R(q('[data-wdcc-public-chrome="header"]'))?.h||0,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gridDisplay:getComputedStyle(grid).display,cards,ctas,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,placeholders:grid.querySelectorAll('[role="img"][aria-label*="photo unavailable" i]').length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(mobileHome.logo.src!=='/wdcc-owner-logo'||mobileHome.logo.naturalWidth<20||mobileHome.logo.w<58||mobileHome.logo.w>66||Math.abs(mobileHome.logo.cx-195)>4||mobileHome.utilityDisplay!=='none'||mobileHome.headerH<62||mobileHome.headerH>66||mobileHome.benefits!==4||mobileHome.gridDisplay!=='flex'||mobileHome.cards.length!==5||!mobileHome.cards[2]||mobileHome.cards[2].right>390||mobileHome.ctas.length!==2||mobileHome.ctas[1].y<=mobileHome.ctas[0].bottom||mobileHome.finance!==1||mobileHome.trust!==2||mobileHome.placeholders!==0||mobileHome.overflow>2)fail('MOBILE_50869',mobileHome);
  result.mobile.home=mobileHome;
  await m.screenshot({path:`${out}/50869-mobile-home.png`,fullPage:true});

  await goto200(m,'/inventory?owner-review=1','MOBILE_PUBLIC_INVENTORY');
  await m.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  const mi=await m.evaluate(()=>{const g=document.querySelector('.wdccVehicleGrid'),a=g.querySelector('article>a');return{tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,mediaH:a?.getBoundingClientRect().height||0,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(mi.tracks!==1||mi.cards!==5||mi.mediaH>205||mi.overflow>2)fail('MOBILE_PUBLIC_INVENTORY',mi);
  result.mobile.inventory=mi;
  await m.screenshot({path:`${out}/mobile-inventory.png`,fullPage:true});

  const md=await mctx.newPage();watch(md);await wire(md);
  await goto200(md,'/dealer','MOBILE_DEALER_DASHBOARD');
  await md.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
  const mobileDash=await md.evaluate(()=>({side:getComputedStyle(document.querySelector('.dcSide')).display,nav:getComputedStyle(document.querySelector('.dashMobileNav')).display,metricTracks:getComputedStyle(document.querySelector('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(mobileDash.side!=='none'||mobileDash.nav!=='grid'||mobileDash.metricTracks!==2||mobileDash.overflow>2)fail('MOBILE_DEALER_10668',mobileDash);
  result.dealer.mobileDashboard=mobileDash;
  await md.screenshot({path:`${out}/10668-dashboard-mobile.png`,fullPage:true});

  await goto200(md,'/dealer/inventory','MOBILE_DEALER_INVENTORY');
  await md.locator('.inventoryRow').first().waitFor({state:'visible',timeout:10000});
  const mobileAll=await md.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,head:getComputedStyle(document.querySelector('.inventoryHead')).display,nav:getComputedStyle(document.querySelector('.inventoryMobileNav')).display,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(mobileAll.rows<5||mobileAll.head!=='none'||mobileAll.nav!=='grid'||mobileAll.overflow>2)fail('MOBILE_DEALER_51074',mobileAll);
  result.dealer.mobileInventory=mobileAll;
  await md.screenshot({path:`${out}/51074-all-vehicles-mobile.png`,fullPage:true});

  await goto200(md,'/dealer/inventory/new','MOBILE_DEALER_EDITOR');
  await md.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const msteps=await md.locator('.stepper button').count();
  const mobileEdit=await md.evaluate(()=>({side:document.querySelector('.editSide')?getComputedStyle(document.querySelector('.editSide')).display:'none',right:document.querySelector('.editRight')?getComputedStyle(document.querySelector('.editRight')).display:'none',fieldTracks:getComputedStyle(document.querySelector('.fieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(msteps!==5||mobileEdit.side!=='none'||mobileEdit.right!=='none'||mobileEdit.fieldTracks!==2||mobileEdit.overflow>2)fail('MOBILE_DEALER_10667',{msteps,...mobileEdit});
  result.dealer.mobileEditor={msteps,...mobileEdit};
  await md.screenshot({path:`${out}/10667-add-edit-mobile.png`,fullPage:true});
  await mctx.close();

  if(writes.length)fail('OWNER_BOARD_WRITE_REQUESTS',writes);
  result.pass=true;
  fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');
  console.log('WDCC_CANONICAL_OWNER_BOARD_PASS',JSON.stringify({desktopFeatured:home.gridTracks,mobileThirdRight:mobileHome.cards[2].right,desktopInventory:di.tracks,mobileInventory:mi.tracks,dealerDesktop:dash.metricTracks,dealerMobile:mobileDash.metricTracks,writes:writes.length}));
}finally{
  await browser.close();
}
