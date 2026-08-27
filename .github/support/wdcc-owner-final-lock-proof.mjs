import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='owner-final-lock-proof';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const writes=[];
const watch=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
const fail=(name,data={})=>{throw new Error(`${name} ${JSON.stringify(data)}`)};

const vehicles=[
 {id:'real-2004-nissan-350z',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Clean title. Runs and drives great.',primary_image_url:'/wdcc-review-media/nissan350z'},
 {id:'real-2016-ford-f150-limited',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,downPayment:1500,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/fordF150'},
 {id:'real-2019-honda-pilot',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,downPayment:1500,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/hondaPilot'},
 {id:'real-2019-kia-sportage',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,downPayment:2000,mileage:60000,stock:'JGCL2020',status:'draft',visibility:'public',transmission:'Automatic',drivetrain:'4WD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/kiaSportage'},
 {id:'real-2019-toyota-rav4',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,downPayment:2000,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const leads=[
 {id:'l1',name:'John Doe',kind:'contact',stage:'new',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date().toISOString()},
 {id:'l2',name:'Mike Smith',kind:'appointment',stage:'contacted',vehicleInterest:'2019 Dodge Charger R/T',createdAt:new Date(Date.now()-60000).toISOString()},
 {id:'l3',name:'Sarah Johnson',kind:'application',stage:'qualified',vehicleInterest:'2018 Chevrolet Camaro LT',createdAt:new Date(Date.now()-120000).toISOString()}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-final-lock',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads};

async function wire(page){
 await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
 await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
 await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
 await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:leads})}):r.abort());
}
async function goto(page,path){
 let response=null;
 for(let i=0;i<20;i++){
   const join=path.includes('?')?'&':'?';
   response=await page.goto(`${base}${path}${join}proof=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
   if(response?.status()===200)return;
   await page.waitForTimeout(1000);
 }
 fail('HTTP',{path,status:response?.status()||0});
}
async function skipIntro(page){
 const intro=page.locator('.li');
 if(!await intro.count())return;
 const b=page.getByRole('button',{name:/skip intro/i});
 if(await b.count())await b.click().catch(()=>{});
 await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{});
}
async function waitPhotos(page,sel){
 await page.waitForFunction(selector=>{const imgs=[...document.querySelectorAll(selector)];return imgs.length>=5&&imgs.slice(0,5).every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20)},sel,{timeout:20000});
}

const result={sha,url:base,desktop:{},mobile:{},dealer:{},writes,pass:false};
try{
 const dctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const d=await dctx.newPage();watch(d);
 await goto(d,'/?owner-review=1');await skipIntro(d);
 await d.locator('img[data-wdcc-logo-art="owner-approved"]').waitFor({state:'visible',timeout:10000});
 await d.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});await waitPhotos(d,'.rh-grid>article img');
 const home=await d.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null},grid=q('.rh-grid'),logo=q('img[data-wdcc-logo-art="owner-approved"]');return{logo:{src:logo?.getAttribute('src')||'',...r(logo),nw:logo?.naturalWidth||0},header:r(q('[data-wdcc-public-chrome="header"]')),hero:r(q('.rh-hero')),headline:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim()),colors:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,featured:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:grid.children.length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 const expected=['rgb(242, 31, 50)','rgb(22, 138, 244)','rgb(255, 255, 255)'];
 if(home.logo.src!=='/wdcc-owner-logo'||home.logo.nw<20||home.logo.w<80||home.header.h<70||home.hero.h<520||JSON.stringify(home.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(home.colors)!==JSON.stringify(expected)||home.benefits!==4||home.featured!==5||home.cards!==5||home.finance!==4||home.trust!==4||home.overflow>2)fail('DESKTOP_HOME',home);
 result.desktop.home=home;await d.screenshot({path:`${out}/desktop-home.png`,fullPage:true});

 const dd=await dctx.newPage();watch(dd);await wire(dd);await goto(dd,'/dealer');await dd.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
 const dash=await dd.evaluate(()=>{const q=s=>document.querySelector(s),top=s=>q(s)?.getBoundingClientRect().top||0;return{metrics:getComputedStyle(q('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,ops:getComputedStyle(q('.opsCards')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,inventoryTop:top('.inventoryOverview'),vehiclesTop:top('.recentVehicles'),activityTop:top('.activityLocked'),side:getComputedStyle(q('.dcSide')).display,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(dash.metrics!==6||dash.ops!==4||dash.side==='none'||Math.max(dash.inventoryTop,dash.vehiclesTop,dash.activityTop)-Math.min(dash.inventoryTop,dash.vehiclesTop,dash.activityTop)>3||dash.overflow>2)fail('DEALER_DASHBOARD',dash);
 result.dealer.dashboard=dash;await dd.screenshot({path:`${out}/dealer-dashboard.png`,fullPage:true});
 await goto(dd,'/dealer/inventory');await dd.locator('.inventoryRow').first().waitFor({state:'visible',timeout:10000});
 const inv=await dd.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,head:getComputedStyle(document.querySelector('.inventoryHead')).display,overflow:document.documentElement.scrollWidth-innerWidth}));if(inv.rows<5||inv.head==='none'||inv.overflow>2)fail('DEALER_INVENTORY',inv);result.dealer.inventory=inv;await dd.screenshot({path:`${out}/dealer-inventory.png`,fullPage:true});
 await goto(dd,'/dealer/inventory/new');await dd.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
 const edit=await dd.evaluate(()=>{const img=document.querySelector('.editTop .topBrand img');return{steps:document.querySelectorAll('.stepper button').length,right:getComputedStyle(document.querySelector('.editRight')).display,logo:{w:img?.getBoundingClientRect().width||0,nw:img?.naturalWidth||0},overflow:document.documentElement.scrollWidth-innerWidth}});if(edit.steps!==5||edit.right==='none'||edit.logo.w<45||edit.logo.nw<20||edit.overflow>2)fail('DEALER_EDITOR',edit);result.dealer.editor=edit;await dd.screenshot({path:`${out}/dealer-editor.png`,fullPage:true});
 await dctx.close();

 const mctx=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const m=await mctx.newPage();watch(m);await goto(m,'/?owner-review=1');await skipIntro(m);await m.locator('img[data-wdcc-logo-art="owner-approved"]').waitFor({state:'visible',timeout:10000});await m.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});await waitPhotos(m,'.rh-grid>article img');
 const mh=await m.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null},grid=q('.rh-grid'),cards=[...grid.children].map(r),logo=q('img[data-wdcc-logo-art="owner-approved"]'),utility=q('[data-wdcc-public-chrome="utility"]'),ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(r);return{header:r(q('[data-wdcc-public-chrome="header"]')),logo:r(logo),utility:getComputedStyle(utility).display,hero:r(q('.rh-hero')),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,display:getComputedStyle(grid).display,cards,ctas,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(mh.utility!=='none'||mh.header.h<62||mh.header.h>66||mh.logo.w<58||mh.logo.w>66||mh.hero.h>525||mh.hero.h<470||mh.benefits!==4||mh.display!=='flex'||mh.cards.length!==5||mh.cards[2].right>390||mh.ctas.length!==2||mh.ctas[1].y<=mh.ctas[0].bottom||mh.finance!==1||mh.trust!==2||mh.overflow>2)fail('MOBILE_HOME',mh);
 result.mobile.home=mh;await m.screenshot({path:`${out}/mobile-home.png`,fullPage:true});
 const md=await mctx.newPage();watch(md);await wire(md);await goto(md,'/dealer');await md.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});const mdash=await md.evaluate(()=>({side:getComputedStyle(document.querySelector('.dcSide')).display,nav:getComputedStyle(document.querySelector('.dashMobileNav')).display,metrics:getComputedStyle(document.querySelector('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));if(mdash.side!=='none'||mdash.nav!=='grid'||mdash.metrics!==2||mdash.overflow>2)fail('MOBILE_DEALER',mdash);result.mobile.dealer=mdash;await md.screenshot({path:`${out}/mobile-dealer.png`,fullPage:true});await mctx.close();

 if(writes.length)fail('WRITE_REQUESTS',writes);
 result.pass=true;fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');console.log('WDCC_OWNER_FINAL_LOCK_PASS',JSON.stringify({sha,desktopFeatured:home.featured,mobileThirdRight:mh.cards[2].right,dashboardAligned:[dash.inventoryTop,dash.vehiclesTop,dash.activityTop],writes:writes.length}));
}finally{await browser.close()}
