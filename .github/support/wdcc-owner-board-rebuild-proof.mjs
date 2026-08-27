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
const fail=(name,data={})=>{throw new Error(`${name}_${JSON.stringify(data)}`)};

const vehicles=[
  {id:'real-2004-nissan-350z',year:2004,make:'Nissan',model:'350Z',price:4900,downPayment:2000,mileage:154000,stock:'WDCC-350Z-2004',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Convertible',description:'Verified historical WDCC record.',primary_image_url:'/wdcc-review-media/nissan350z'},
  {id:'real-2016-ford-f150-limited',year:2016,make:'Ford',model:'F-150',trim:'Limited',price:15000,downPayment:6000,mileage:164000,stock:'WDCC-F150-2016',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4x4',bodyStyle:'Truck',description:'Verified historical WDCC record.',primary_image_url:'/wdcc-review-media/fordF150'},
  {id:'real-2019-honda-pilot',year:2019,make:'Honda',model:'Pilot',price:7900,downPayment:3000,mileage:380000,stock:'WDCC-PILOT-2019',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'AWD',bodyStyle:'SUV',description:'Verified historical WDCC record.',primary_image_url:'/wdcc-review-media/hondaPilot'},
  {id:'real-2019-kia-sportage',year:2019,make:'Kia',model:'Sportage',price:6500,downPayment:2500,mileage:127000,stock:'WDCC-SPORTAGE-2019',status:'draft',visibility:'public',transmission:'Automatic',drivetrain:'FWD',bodyStyle:'SUV',description:'Verified historical WDCC record.',primary_image_url:'/wdcc-review-media/kiaSportage'},
  {id:'real-2019-toyota-rav4',year:2019,make:'Toyota',model:'RAV4',price:10500,downPayment:4500,mileage:240000,stock:'WDCC-RAV4-2019',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'AWD',bodyStyle:'SUV',description:'Verified historical WDCC record.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-board',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:0,newToday:0,appointments:0,applications:0,messages:0},inventory:vehicles,leads:[]};

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
    const response=await page.goto(`${base}${path}${join}board-proof=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    status=response?.status()||0;
    if(status===200)return response;
    await page.waitForTimeout(1200);
  }
  fail(`${name}_HTTP`,{status,path});
}
async function skipIntro(page){
  const intro=page.locator('.li');
  if(!await intro.count())return;
  const skip=page.getByRole('button',{name:/skip intro/i});
  if(await skip.count())await skip.click().catch(()=>{});
  await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{});
}
async function waitFiveRecovered(page,selector){
  await page.waitForFunction(sel=>{
    const imgs=[...document.querySelectorAll(sel)];
    return imgs.length===5&&imgs.every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20&&String(i.getAttribute('src')||'').startsWith('/wdcc-review-media/'));
  },selector,{timeout:20000});
}

const result={sha,url:base,desktop:{},mobile:{},dealer:{},writes,pass:false};
try{
  const desktopContext=await browser.newContext({viewport:{width:1440,height:1000},screen:{width:1440,height:1000},deviceScaleFactor:1});
  const desktop=await desktopContext.newPage();watch(desktop);
  await goto200(desktop,'/?owner-review=1','DESKTOP_HOME');
  await skipIntro(desktop);
  await desktop.locator('.wdcc-wordmark').waitFor({state:'visible',timeout:10000});
  await desktop.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitFiveRecovered(desktop,'.rh-grid>article img');
  const home=await desktop.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2}:null};
    const grid=q('.rh-grid');
    const cards=[...grid.children].map(rect);
    const headline=[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim());
    const colors=[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color);
    return{
      wordmark:(q('.wdcc-wordmark')?.textContent||'').replace(/\s+/g,' ').trim(),
      roundHeaderLogo:document.querySelectorAll('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art]').length,
      utility:rect(q('[data-wdcc-public-chrome="utility"]')),
      header:rect(q('[data-wdcc-public-chrome="header"]')),
      hero:rect(q('.rh-hero')),
      heroLoaded:Boolean(q('.rh-hero-art')?.complete&&q('.rh-hero-art')?.naturalWidth>20),
      headline,colors,
      benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      gridDisplay:getComputedStyle(grid).display,
      gridTracks:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      cards,
      placeholders:grid.querySelectorAll('[role="img"][aria-label*="photo unavailable" i]').length,
      finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  const expectedHeadline=['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."];
  const expectedColors=['rgb(255, 255, 255)','rgb(22, 138, 244)','rgb(242, 31, 50)'];
  if(!/WDCC.*WE DON'T CARE CARS/i.test(home.wordmark)||home.roundHeaderLogo!==0||!home.utility||home.utility.h<28||!home.header||home.header.h<70||!home.hero||home.hero.h<520||!home.heroLoaded||JSON.stringify(home.headline)!==JSON.stringify(expectedHeadline)||JSON.stringify(home.colors)!==JSON.stringify(expectedColors)||home.benefits!==4||home.gridDisplay!=='grid'||home.gridTracks!==5||home.cards.length!==5||home.placeholders!==0||home.finance!==4||home.trust!==4||home.overflow>2)fail('DESKTOP_50869',home);
  result.desktop.home=home;
  await desktop.screenshot({path:`${out}/50869-desktop-home.png`,fullPage:true});

  await goto200(desktop,'/inventory?owner-review=1','DESKTOP_INVENTORY');
  await desktop.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  const desktopInventory=await desktop.evaluate(()=>{
    const g=document.querySelector('.wdccVehicleGrid');
    return{tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(desktopInventory.tracks!==3||desktopInventory.cards!==5||desktopInventory.overflow>2)fail('DESKTOP_PUBLIC_INVENTORY',desktopInventory);
  result.desktop.inventory=desktopInventory;
  await desktop.screenshot({path:`${out}/desktop-inventory.png`,fullPage:true});

  const dealer=await desktopContext.newPage();watch(dealer);await wire(dealer);
  await goto200(dealer,'/dealer','DEALER_DASHBOARD');
  await dealer.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
  const dashboardView=await dealer.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
    return{sideDisplay:getComputedStyle(q('.dcSide')).display,side:rect(q('.dcSide')),content:rect(q('.dashboardContent')),metricTracks:getComputedStyle(q('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overview:rect(q('.inventoryOverview')),recent:rect(q('.recentVehicles')),opsTracks:getComputedStyle(q('.opsCards')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(dashboardView.sideDisplay==='none'||!dashboardView.side||dashboardView.side.w<150||!dashboardView.content||dashboardView.metricTracks!==6||!dashboardView.overview||!dashboardView.recent||dashboardView.opsTracks!==4||dashboardView.overflow>2)fail('DEALER_10668_DESKTOP',dashboardView);
  result.dealer.desktopDashboard=dashboardView;
  await dealer.screenshot({path:`${out}/10668-dashboard-desktop.png`,fullPage:true});

  await goto200(dealer,'/dealer/inventory','DEALER_ALL_VEHICLES');
  await dealer.locator('.inventoryTable').waitFor({state:'visible',timeout:10000});
  const allVehicles=await dealer.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,side:getComputedStyle(document.querySelector('.dcSide')).display,head:getComputedStyle(document.querySelector('.inventoryHead')).display,stats:getComputedStyle(document.querySelector('.inventoryStats')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(allVehicles.rows<5||allVehicles.side==='none'||allVehicles.head==='none'||allVehicles.stats!==5||allVehicles.overflow>2)fail('DEALER_51074_DESKTOP',allVehicles);
  result.dealer.desktopInventory=allVehicles;
  await dealer.screenshot({path:`${out}/51074-all-vehicles-desktop.png`,fullPage:true});

  await goto200(dealer,'/dealer/inventory/new','DEALER_EDITOR');
  await dealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const stepLabels=await dealer.locator('.stepper button').allTextContents();
  const editorView=await dealer.evaluate(()=>({right:document.querySelector('.editRight')?getComputedStyle(document.querySelector('.editRight')).display:'none',layout:document.querySelector('.editLayout')?getComputedStyle(document.querySelector('.editLayout')).gridTemplateColumns:'',fieldTracks:document.querySelector('.fieldGrid')?getComputedStyle(document.querySelector('.fieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(stepLabels.length!==5||stepLabels.map(x=>x.trim()).join('|')!=='1Info|2Pricing|3Photos|4Details|5Review'||editorView.right==='none'||editorView.overflow>2)fail('DEALER_10667_DESKTOP',{stepLabels,...editorView});
  result.dealer.desktopEditor={stepLabels,...editorView};
  await dealer.screenshot({path:`${out}/10667-add-edit-desktop.png`,fullPage:true});
  await desktopContext.close();

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mobile=await mobileContext.newPage();watch(mobile);
  await goto200(mobile,'/?owner-review=1','MOBILE_HOME');
  await skipIntro(mobile);
  await mobile.locator('.wdcc-wordmark').waitFor({state:'visible',timeout:10000});
  await mobile.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitFiveRecovered(mobile,'.rh-grid>article img');
  const mobileHome=await mobile.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2}:null};
    const grid=q('.rh-grid');
    const cards=[...grid.children].map(rect);
    const ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(rect);
    const wordmark=rect(q('.wdcc-wordmark'));
    const utility=q('[data-wdcc-public-chrome="utility"]');
    return{wordmarkText:(q('.wdcc-wordmark')?.textContent||'').replace(/\s+/g,' ').trim(),wordmark,roundHeaderLogo:document.querySelectorAll('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art]').length,utilityDisplay:utility?getComputedStyle(utility).display:'none',header:rect(q('[data-wdcc-public-chrome="header"]')),menu:rect(q('.rh-menu')),call:rect(q('.rh-call')),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gridDisplay:getComputedStyle(grid).display,cards,ctas,placeholders:grid.querySelectorAll('[role="img"][aria-label*="photo unavailable" i]').length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(!/WDCC.*WE DON'T CARE CARS/i.test(mobileHome.wordmarkText)||!mobileHome.wordmark||Math.abs(mobileHome.wordmark.cx-195)>5||mobileHome.roundHeaderLogo!==0||mobileHome.utilityDisplay!=='none'||!mobileHome.header||mobileHome.header.h<64||mobileHome.header.h>72||!mobileHome.menu||mobileHome.menu.w<38||!mobileHome.call||mobileHome.call.w<38||mobileHome.benefits!==4||mobileHome.gridDisplay!=='flex'||mobileHome.cards.length!==5||!mobileHome.cards[2]||mobileHome.cards[2].right>390||mobileHome.ctas.length!==2||mobileHome.ctas[1].y<=mobileHome.ctas[0].bottom||mobileHome.placeholders!==0||mobileHome.finance!==1||mobileHome.trust!==2||mobileHome.overflow>2)fail('MOBILE_50869',mobileHome);
  result.mobile.home=mobileHome;
  await mobile.screenshot({path:`${out}/50869-mobile-home.png`,fullPage:true});

  await goto200(mobile,'/inventory?owner-review=1','MOBILE_INVENTORY');
  await mobile.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  const mobileInventory=await mobile.evaluate(()=>{const g=document.querySelector('.wdccVehicleGrid'),a=g.querySelector('article>a');return{tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,mediaH:a?.getBoundingClientRect().height||0,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(mobileInventory.tracks!==1||mobileInventory.cards!==5||mobileInventory.mediaH>205||mobileInventory.overflow>2)fail('MOBILE_PUBLIC_INVENTORY',mobileInventory);
  result.mobile.inventory=mobileInventory;
  await mobile.screenshot({path:`${out}/mobile-inventory.png`,fullPage:true});

  const mobileDealer=await mobileContext.newPage();watch(mobileDealer);await wire(mobileDealer);
  await goto200(mobileDealer,'/dealer','MOBILE_DEALER_DASHBOARD');
  await mobileDealer.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
  const mobileDashboard=await mobileDealer.evaluate(()=>({side:getComputedStyle(document.querySelector('.dcSide')).display,nav:getComputedStyle(document.querySelector('.dashMobileNav')).display,metricTracks:getComputedStyle(document.querySelector('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(mobileDashboard.side!=='none'||mobileDashboard.nav!=='grid'||mobileDashboard.metricTracks!==2||mobileDashboard.overflow>2)fail('MOBILE_DEALER_10668',mobileDashboard);
  result.dealer.mobileDashboard=mobileDashboard;
  await mobileDealer.screenshot({path:`${out}/10668-dashboard-mobile.png`,fullPage:true});

  await goto200(mobileDealer,'/dealer/inventory','MOBILE_DEALER_INVENTORY');
  await mobileDealer.locator('.inventoryRow').first().waitFor({state:'visible',timeout:10000});
  const mobileAll=await mobileDealer.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,head:getComputedStyle(document.querySelector('.inventoryHead')).display,nav:getComputedStyle(document.querySelector('.inventoryMobileNav')).display,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(mobileAll.rows<5||mobileAll.head!=='none'||mobileAll.nav!=='grid'||mobileAll.overflow>2)fail('MOBILE_DEALER_51074',mobileAll);
  result.dealer.mobileInventory=mobileAll;
  await mobileDealer.screenshot({path:`${out}/51074-all-vehicles-mobile.png`,fullPage:true});

  await goto200(mobileDealer,'/dealer/inventory/new','MOBILE_DEALER_EDITOR');
  await mobileDealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const mobileSteps=await mobileDealer.locator('.stepper button').allTextContents();
  const mobileEditor=await mobileDealer.evaluate(()=>({side:document.querySelector('.editSide')?getComputedStyle(document.querySelector('.editSide')).display:'none',right:document.querySelector('.editRight')?getComputedStyle(document.querySelector('.editRight')).display:'none',fieldTracks:document.querySelector('.fieldGrid')?getComputedStyle(document.querySelector('.fieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(mobileSteps.length!==5||mobileEditor.side!=='none'||mobileEditor.right!=='none'||mobileEditor.fieldTracks!==2||mobileEditor.overflow>2)fail('MOBILE_DEALER_10667',{mobileSteps,...mobileEditor});
  result.dealer.mobileEditor={mobileSteps,...mobileEditor};
  await mobileDealer.screenshot({path:`${out}/10667-add-edit-mobile.png`,fullPage:true});
  await mobileContext.close();

  if(writes.length)fail('OWNER_BOARD_WRITE_REQUESTS',writes);
  result.pass=true;
  fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');
  console.log('WDCC_CANONICAL_OWNER_BOARD_PASS',JSON.stringify({desktopFeatured:home.gridTracks,mobileThirdRight:mobileHome.cards[2].right,desktopInventory:desktopInventory.tracks,mobileInventory:mobileInventory.tracks,dealerDesktop:dashboardView.metricTracks,dealerMobile:mobileDashboard.metricTracks,writes:writes.length}));
}finally{
  await browser.close();
}
