import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
const out='owner-board-proof';
if(!base||!sha||!base.includes(sha))throw new Error(`OWNER_BOARD_NOT_EXACT_SHA_${base||''}_${sha||''}`);
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const writes=[];
const watch=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
const fail=(name,data={})=>{throw new Error(`${name}_${JSON.stringify(data)}`)};
const tracks=e=>e?getComputedStyle(e).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0;

const vehicles=[
  {id:'real-2004-nissan-350z',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DG-C2020-SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Coupe',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/nissan350z'},
  {id:'real-2016-ford-f150-limited',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,downPayment:1500,mileage:53000,stock:'DCR-2019-RT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Sedan',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/fordF150'},
  {id:'real-2019-honda-pilot',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,downPayment:1500,mileage:38000,stock:'CC-LT-2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Coupe',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/hondaPilot'},
  {id:'real-2019-kia-sportage',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,downPayment:2000,mileage:60000,stock:'JGC-L-2020',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',bodyStyle:'SUV',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/kiaSportage'},
  {id:'real-2019-toyota-rav4',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,downPayment:2000,mileage:71000,stock:'F150-XLT-2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',bodyStyle:'Truck',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const leads=[
  {id:'lead-1',name:'Customer One',source:'website',pipelineStage:'new',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date().toISOString()},
  {id:'lead-2',name:'Customer Two',source:'phone',pipelineStage:'approved',vehicleInterest:'2019 Dodge Charger R/T',createdAt:new Date(Date.now()-900000).toISOString()},
  {id:'lead-3',name:'Customer Three',source:'walk-in',pipelineStage:'application',vehicleInterest:'2018 Chevrolet Camaro LT',createdAt:new Date(Date.now()-1800000).toISOString()},
  {id:'lead-4',name:'Customer Four',source:'referral',pipelineStage:'sold',vehicleInterest:'2020 Jeep Grand Cherokee Laredo',createdAt:new Date(Date.now()-3600000).toISOString()}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-board',displayName:'Sean',username:'Dealer',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{newToday:58,applications:27,approved:19,sold:11},inventory:vehicles,leads};

async function wire(page){
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
  await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:leads})}):r.abort());
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
async function waitImages(page,selector,min=1){
  await page.waitForFunction(({selector,min})=>{
    const imgs=[...document.querySelectorAll(selector)];
    return imgs.length>=min&&imgs.slice(0,min).every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20);
  },{selector,min},{timeout:20000});
}
const rectFn=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2}:null};
const result={sha,url:base,boards:{},writes,pass:false};

try{
  const desktopContext=await browser.newContext({viewport:{width:1440,height:1000},screen:{width:1440,height:1000},deviceScaleFactor:1});
  const desktop=await desktopContext.newPage();watch(desktop);

  // 51546 — PUBLIC HOME, desktop
  await goto200(desktop,'/?owner-review=1','HOME_51546_DESKTOP');
  const introArt=desktop.locator('.li-badge img[data-wdcc-intro-badge-art="owner-approved"]');
  if(await introArt.count()){
    await introArt.waitFor({state:'visible',timeout:10000});
    const intro=await desktop.evaluate(()=>{const a=document.querySelector('.li-badge img[data-wdcc-intro-badge-art="owner-approved"]'),b=document.querySelector('.li-badge')?.getBoundingClientRect();return{art:Boolean(a&&a.complete&&a.naturalWidth>20),badge:b?{w:b.width,h:b.height,cx:b.x+b.width/2}:null,winW:innerWidth}});
    if(!intro.art||!intro.badge||Math.abs(intro.badge.cx-intro.winW/2)>5)fail('INTRO_50985_DESKTOP',intro);
    result.boards.intro50985=intro;
  }
  await skipIntro(desktop);
  await desktop.locator('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-wordmark"]').waitFor({state:'visible',timeout:10000});
  await desktop.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitImages(desktop,'.rh-grid>article img',5);
  const homeD=await desktop.evaluate(()=>{
    const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2}:null};
    const grid=q('.rh-grid');
    return{logo:R(q('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-wordmark"]')),roundHeader:document.querySelectorAll('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-approved"]').length,utility:R(q('[data-wdcc-public-chrome="utility"]')),header:R(q('[data-wdcc-public-chrome="header"]')),hero:R(q('.rh-hero')),heroLoaded:Boolean(q('.rh-hero-art')?.complete&&q('.rh-hero-art')?.naturalWidth>20),headline:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim()),colors:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,featured:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:grid.children.length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(!homeD.logo||homeD.logo.w<100||homeD.logo.h<25||homeD.roundHeader!==0||!homeD.utility||homeD.utility.h<28||!homeD.header||homeD.header.h<58||homeD.header.h>64||!homeD.hero||homeD.hero.h<500||!homeD.heroLoaded||JSON.stringify(homeD.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(homeD.colors)!==JSON.stringify(['rgb(239, 23, 39)','rgb(22, 137, 255)','rgb(255, 255, 255)'])||homeD.benefits!==4||homeD.featured!==5||homeD.cards!==5||homeD.finance!==4||homeD.trust!==4||homeD.overflow>2)fail('HOME_51546_DESKTOP',homeD);
  result.boards.home51546Desktop=homeD;
  await desktop.screenshot({path:`${out}/51546-home-desktop.png`,fullPage:true});

  // 51543 — PUBLIC INVENTORY, desktop
  await goto200(desktop,'/inventory?owner-review=1','INVENTORY_51543_DESKTOP');
  await desktop.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  await waitImages(desktop,'.wdccVehicleGrid>article img',5);
  const invD=await desktop.evaluate(()=>{const q=s=>document.querySelector(s),g=q('.wdccVehicleGrid'),h=q('.inventoryTop');return{hero:h?{h:h.getBoundingClientRect().height}:null,tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,controls:document.querySelectorAll('.publicInventoryControls input,.publicInventoryControls select').length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(!invD.hero||invD.hero.h<250||invD.tracks!==5||invD.cards!==5||invD.controls<4||invD.overflow>2)fail('INVENTORY_51543_DESKTOP',invD);
  result.boards.inventory51543Desktop=invD;
  await desktop.screenshot({path:`${out}/51543-inventory-desktop.png`,fullPage:true});

  // 51075 — PRE-APPROVAL, desktop
  await goto200(desktop,'/get-approved?owner-review=1','APPROVAL_51075_DESKTOP');
  await desktop.locator('.approvalCard').waitFor({state:'visible',timeout:10000});
  const approvalD=await desktop.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};const main=q('main.approvalBoard'),card=q('.approvalCard');return{display:getComputedStyle(main).display,tracks:getComputedStyle(main).gridTemplateColumns.split(/\s+/).filter(Boolean).length,scene:R(q('.approvalScene')),card:R(card),cardBg:getComputedStyle(card).backgroundColor,stages:document.querySelectorAll('.approvalStages button,.approvalStages>div').length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(approvalD.display!=='grid'||approvalD.tracks!==2||!approvalD.scene||approvalD.scene.h<600||!approvalD.card||approvalD.card.w<420||approvalD.cardBg!=='rgb(255, 255, 255)'||approvalD.overflow>2)fail('APPROVAL_51075_DESKTOP',approvalD);
  result.boards.approval51075Desktop=approvalD;
  await desktop.screenshot({path:`${out}/51075-preapproval-desktop.png`,fullPage:true});

  // Dealer pages use read-only mocked session/data.
  const dealer=await desktopContext.newPage();watch(dealer);await wire(dealer);

  // 51076 — DEALER DASHBOARD, desktop
  await goto200(dealer,'/dealer','DASHBOARD_51076_DESKTOP');
  await dealer.locator('.portalApp').waitFor({state:'visible',timeout:10000});
  const dashD=await dealer.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null};return{appTracks:getComputedStyle(q('.portalApp')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,side:R(q('.portalSide')),metrics:getComputedStyle(q('.metricGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,metricCount:document.querySelectorAll('.metricGrid .metric').length,dashboardTracks:getComputedStyle(q('.dashboardGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,quickTracks:getComputedStyle(q('.quickActions')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,workspaceBg:getComputedStyle(q('.portalWorkspace')).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(dashD.appTracks!==2||!dashD.side||dashD.side.w<165||dashD.metrics!==4||dashD.metricCount!==4||dashD.dashboardTracks!==2||dashD.quickTracks!==4||dashD.overflow>2)fail('DASHBOARD_51076_DESKTOP',dashD);
  result.boards.dashboard51076Desktop=dashD;
  await dealer.screenshot({path:`${out}/51076-dashboard-desktop.png`,fullPage:true});

  // 51522 — ALL VEHICLES, desktop
  await goto200(dealer,'/dealer/inventory','ALL_VEHICLES_51522_DESKTOP');
  await dealer.locator('.inventoryTable').waitFor({state:'visible',timeout:10000});
  await dealer.waitForFunction(()=>document.querySelectorAll('.inventoryRow').length>=5,null,{timeout:15000});
  const allD=await dealer.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,side:getComputedStyle(document.querySelector('.dcSide')).display,head:getComputedStyle(document.querySelector('.inventoryHead')).display,stats:getComputedStyle(document.querySelector('.inventoryStats')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,contentBg:getComputedStyle(document.querySelector('.dcContent')).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(allD.rows<5||allD.side==='none'||allD.head==='none'||allD.stats!==5||allD.overflow>2)fail('ALL_VEHICLES_51522_DESKTOP',allD);
  result.boards.allVehicles51522Desktop=allD;
  await dealer.screenshot({path:`${out}/51522-all-vehicles-desktop.png`,fullPage:true});

  // 51073 / 51517 — ADD VEHICLE must start clean, desktop
  await goto200(dealer,'/dealer/inventory/new','ADD_51073_DESKTOP');
  await dealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const addClean=await dealer.evaluate(()=>{const value=n=>document.querySelector(`input[name="${n}"]`)?.value||'';return{year:value('year'),make:value('make'),model:value('model'),vin:value('vin'),steps:document.querySelectorAll('.stepper button').length,right:getComputedStyle(document.querySelector('.editRight')).display,fieldTracks:getComputedStyle(document.querySelector('.fieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(addClean.year||addClean.make||addClean.model||addClean.vin||addClean.steps!==5||addClean.right==='none'||addClean.fieldTracks!==4||addClean.overflow>2)fail('ADD_51073_CLEAN_DESKTOP',addClean);
  await dealer.locator('.stepper button').nth(2).click();
  await dealer.locator('.photoTools').waitFor({state:'visible',timeout:5000});
  const photosD=await dealer.evaluate(()=>({tools:document.querySelectorAll('.photoTools button').length,right:getComputedStyle(document.querySelector('.editRight')).display,thumbs:document.querySelectorAll('.thumbGrid>*').length,readiness:Boolean(document.querySelector('.readinessCard')),preview:Boolean(document.querySelector('.vehiclePreview'))}));
  if(photosD.tools!==3||photosD.right==='none'||!photosD.readiness||!photosD.preview)fail('ADD_51517_PHOTOS_DESKTOP',photosD);
  result.boards.add51073Desktop={...addClean,photos:photosD};
  await dealer.screenshot({path:`${out}/51073-51517-add-vehicle-desktop.png`,fullPage:true});
  await desktopContext.close();

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/142 Mobile Safari/537.36'});
  const mobile=await mobileContext.newPage();watch(mobile);

  // 51546 — PUBLIC HOME, mobile
  await goto200(mobile,'/?owner-review=1','HOME_51546_MOBILE');
  await skipIntro(mobile);
  await mobile.locator('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-wordmark"]').waitFor({state:'visible',timeout:10000});
  await mobile.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  await waitImages(mobile,'.rh-grid>article img',5);
  const homeM=await mobile.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2}:null};const g=q('.rh-grid'),cards=[...g.children].map(R),ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(R),art=R(q('.rh-hero-art')),copy=R(q('.rh-hero-inner')),logo=R(q('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-wordmark"]'));return{logo,utility:getComputedStyle(q('[data-wdcc-public-chrome="utility"]')).display,header:R(q('[data-wdcc-public-chrome="header"]')),menu:R(q('.rh-menu')),call:R(q('.rh-call')),art,copy,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gridDisplay:getComputedStyle(g).display,cards,ctas,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(!homeM.logo||Math.abs(homeM.logo.cx-195)>6||homeM.logo.w<85||homeM.logo.h<20||homeM.utility!=='none'||!homeM.header||homeM.header.h<64||homeM.header.h>72||!homeM.menu||homeM.menu.w<38||!homeM.call||homeM.call.w<38||!homeM.art||!homeM.copy||homeM.art.bottom>homeM.copy.y+2||homeM.benefits!==2||homeM.gridDisplay!=='flex'||homeM.cards.length!==5||!homeM.cards[0]||homeM.cards[0].w<340||homeM.cards[0].right>390||!homeM.cards[1]||homeM.cards[1].x<360||homeM.ctas.length!==2||homeM.ctas[1].y<=homeM.ctas[0].bottom||homeM.finance!==1||homeM.trust!==2||homeM.overflow>2)fail('HOME_51546_MOBILE',homeM);
  await mobile.locator('.rh-menu').click();
  if(await mobile.locator('.rh-menu').getAttribute('aria-expanded')!=='true'||!await mobile.locator('.rh-nav.open').count())fail('HOME_51546_MOBILE_MENU');
  await mobile.locator('.rh-menu').click();
  result.boards.home51546Mobile=homeM;
  await mobile.screenshot({path:`${out}/51546-home-mobile.png`,fullPage:true});

  // 51543 — PUBLIC INVENTORY, mobile rows
  await goto200(mobile,'/inventory?owner-review=1','INVENTORY_51543_MOBILE');
  await mobile.locator('.wdccVehicleGrid>article').first().waitFor({state:'visible',timeout:10000});
  const invM=await mobile.evaluate(()=>{const g=document.querySelector('.wdccVehicleGrid'),a=g?.querySelector('article'),media=a?.querySelector('a:first-child'),r=a?.getBoundingClientRect(),m=media?.getBoundingClientRect();return{tracks:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:g.children.length,articleDisplay:a?getComputedStyle(a).display:'',articleTracks:a?getComputedStyle(a).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0,row:r?{w:r.width,h:r.height}:null,media:m?{w:m.width,h:m.height}:null,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(invM.tracks!==1||invM.cards!==5||invM.articleDisplay!=='grid'||invM.articleTracks!==2||!invM.media||invM.media.w<120||invM.media.w>140||invM.media.h>140||invM.overflow>2)fail('INVENTORY_51543_MOBILE',invM);
  result.boards.inventory51543Mobile=invM;
  await mobile.screenshot({path:`${out}/51543-inventory-mobile.png`,fullPage:true});

  // 51075 — PRE-APPROVAL, mobile stack
  await goto200(mobile,'/get-approved?owner-review=1','APPROVAL_51075_MOBILE');
  await mobile.locator('.approvalCard').waitFor({state:'visible',timeout:10000});
  const approvalM=await mobile.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}:null};const main=q('main.approvalBoard'),scene=R(q('.approvalScene')),card=R(q('.approvalCard'));return{display:getComputedStyle(main).display,scene,card,fieldTracks:getComputedStyle(q('.approvalFieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(approvalM.display!=='block'||!approvalM.scene||approvalM.scene.h<320||!approvalM.card||approvalM.card.y<approvalM.scene.bottom-10||approvalM.fieldTracks!==2||approvalM.overflow>2)fail('APPROVAL_51075_MOBILE',approvalM);
  result.boards.approval51075Mobile=approvalM;
  await mobile.screenshot({path:`${out}/51075-preapproval-mobile.png`,fullPage:true});

  await wire(mobile);

  // 51076 — DEALER DASHBOARD, mobile
  await goto200(mobile,'/dealer','DASHBOARD_51076_MOBILE');
  await mobile.locator('.portalApp').waitFor({state:'visible',timeout:10000});
  const dashM=await mobile.evaluate(()=>{const q=s=>document.querySelector(s);return{side:getComputedStyle(q('.portalSide')).display,metrics:getComputedStyle(q('.metricGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,dashboard:getComputedStyle(q('.dashboardGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,quick:getComputedStyle(q('.quickActions')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,bottom:getComputedStyle(q('.portalBottom')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(dashM.side!=='none'||dashM.metrics!==2||dashM.dashboard!==1||dashM.quick!==4||dashM.bottom!==5||dashM.overflow>2)fail('DASHBOARD_51076_MOBILE',dashM);
  result.boards.dashboard51076Mobile=dashM;
  await mobile.screenshot({path:`${out}/51076-dashboard-mobile.png`,fullPage:true});

  // 51522 — ALL VEHICLES, mobile
  await goto200(mobile,'/dealer/inventory','ALL_VEHICLES_51522_MOBILE');
  await mobile.waitForFunction(()=>document.querySelectorAll('.inventoryRow').length>=5,null,{timeout:15000});
  const allM=await mobile.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,side:getComputedStyle(document.querySelector('.dcSide')).display,head:getComputedStyle(document.querySelector('.inventoryHead')).display,row:getComputedStyle(document.querySelector('.inventoryRow')).display,bottom:getComputedStyle(document.querySelector('.inventoryMobileNav')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));
  if(allM.rows<5||allM.side!=='none'||allM.head!=='none'||allM.row!=='grid'||allM.bottom!==5||allM.overflow>2)fail('ALL_VEHICLES_51522_MOBILE',allM);
  result.boards.allVehicles51522Mobile=allM;
  await mobile.screenshot({path:`${out}/51522-all-vehicles-mobile.png`,fullPage:true});

  // 51073 / 51517 — ADD VEHICLE clean + Photos mobile
  await goto200(mobile,'/dealer/inventory/new','ADD_51073_MOBILE');
  await mobile.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
  const addM=await mobile.evaluate(()=>{const value=n=>document.querySelector(`input[name="${n}"]`)?.value||'';return{year:value('year'),make:value('make'),model:value('model'),side:getComputedStyle(document.querySelector('.editSide')).display,fieldTracks:getComputedStyle(document.querySelector('.fieldGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(addM.year||addM.make||addM.model||addM.side!=='none'||addM.fieldTracks!==2||addM.overflow>2)fail('ADD_51073_CLEAN_MOBILE',addM);
  await mobile.locator('.stepper button').nth(2).click();
  await mobile.locator('.mobileReadiness').waitFor({state:'visible',timeout:5000});
  const photosM=await mobile.evaluate(()=>({tools:document.querySelectorAll('.photoTools button').length,thumbTracks:getComputedStyle(document.querySelector('.thumbGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,readiness:getComputedStyle(document.querySelector('.mobileReadiness')).display,preview:getComputedStyle(document.querySelector('.mobilePreview')).display}));
  if(photosM.tools!==3||photosM.thumbTracks!==4||photosM.readiness==='none'||photosM.preview==='none')fail('ADD_51517_PHOTOS_MOBILE',photosM);
  result.boards.add51073Mobile={...addM,photos:photosM};
  await mobile.screenshot({path:`${out}/51073-51517-add-vehicle-mobile.png`,fullPage:true});
  await mobileContext.close();

  // Android Chrome “Desktop site” compact-desktop board behavior.
  const compactContext=await browser.newContext({viewport:{width:980,height:844},screen:{width:980,height:844},deviceScaleFactor:1,isMobile:false,hasTouch:true,userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36'});
  const compact=await compactContext.newPage();watch(compact);
  await goto200(compact,'/?owner-review=1','ANDROID_DESKTOP_SITE');
  await skipIntro(compact);
  await compact.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  const compactView=await compact.evaluate(()=>{const g=document.querySelector('.rh-grid'),logo=document.querySelector('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-wordmark"]')?.getBoundingClientRect();return{featured:getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,logo:logo?{w:logo.width,h:logo.height}:null,overflow:document.documentElement.scrollWidth-innerWidth}});
  if(compactView.featured!==4||!compactView.logo||compactView.logo.w<100||compactView.overflow>2)fail('ANDROID_DESKTOP_SITE',compactView);
  result.boards.androidDesktopSite=compactView;
  await compact.screenshot({path:`${out}/android-desktop-site.png`,fullPage:true});
  await compactContext.close();

  if(writes.length)fail('OWNER_BOARD_BROWSER_WRITES',{writes});
  result.pass=true;
  fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');
  console.log('WDCC_OWNER_SUPPLIED_BOARD_PASS',JSON.stringify({sha,boards:Object.keys(result.boards),writes:writes.length}));
}catch(error){
  fs.writeFileSync(`${out}/failure.json`,JSON.stringify({sha,url:base,error:String(error?.stack||error),writes},null,2)+'\n');
  throw error;
}finally{
  await browser.close();
}
