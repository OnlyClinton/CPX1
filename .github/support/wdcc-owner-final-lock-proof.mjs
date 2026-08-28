import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='owner-final-lock-proof';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const writes=[];
const pageErrors=[];
const watch=page=>{
 page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
 page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
};
const fail=(name,data={})=>{throw new Error(`${name} ${JSON.stringify(data)}`)};
const rect=e=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null};

const vehicles=[
 {id:'proof-vdp',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',fuelType:'Gasoline',bodyStyle:'Coupe',condition:'Used',description:'Clean title. Runs and drives great. Well maintained inside and out.',features:['Bluetooth','Backup Camera','Keyless Entry','Alloy Wheels'],primary_image_url:'/wdcc-review-media/nissan350z',image:'/wdcc-review-media/fordF150'},
 {id:'proof-charger',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,downPayment:1500,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',fuelType:'Gasoline',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/fordF150'},
 {id:'proof-camaro',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,downPayment:1500,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',fuelType:'Gasoline',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/hondaPilot'},
 {id:'proof-jeep',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,downPayment:2000,mileage:60000,stock:'JGCL2020',status:'draft',visibility:'public',transmission:'Automatic',drivetrain:'4WD',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/kiaSportage'},
 {id:'proof-f150',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,downPayment:2000,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',fuelType:'Gasoline',description:'Dealer vehicle.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const leads=[
 {id:'l1',name:'John Doe',phone:'8135550101',kind:'contact',stage:'new',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date().toISOString()},
 {id:'l2',name:'Mike Smith',phone:'8135550102',kind:'appointment',stage:'appointment',vehicleInterest:'2019 Dodge Charger R/T',createdAt:new Date(Date.now()-60000).toISOString()},
 {id:'l3',name:'Sarah Johnson',email:'sarah@example.com',kind:'application',stage:'approved',vehicleInterest:'2018 Chevrolet Camaro LT',createdAt:new Date(Date.now()-120000).toISOString()},
 {id:'l4',name:'David Brown',phone:'8135550104',kind:'test-drive',stage:'showed',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date(Date.now()-180000).toISOString()}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-final-lock',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads};

async function wire(page){
 await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
 await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
 // Playwright resolves the most recently registered matching route first.
 // Register collection routes before item routes so /api/inventory/:id and /api/leads/:id win correctly.
 await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
 await page.route('**/api/inventory/**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:vehicles[0]})}):r.abort());
 await page.route('**/api/leads**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:leads})}):r.abort());
 await page.route('**/api/leads/**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:leads[0]})}):r.abort());
}
async function goto(page,path){
 let response=null;
 for(let i=0;i<25;i++){
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
async function waitPhotos(page,sel,min=1){await page.waitForFunction(([selector,count])=>{const imgs=[...document.querySelectorAll(selector)];return imgs.length>=count&&imgs.slice(0,count).every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20)},[sel,min],{timeout:20000})}
async function screenshot(page,name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true})}

const result={sha,url:base,public:{},dealer:{},modules:{},devices:{},writes,pageErrors,pass:false};
try{
 const dctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const d=await dctx.newPage();watch(d);await wire(d);
 await goto(d,'/?owner-review=1');
 if(await d.locator('.li').count())await screenshot(d,'intro-desktop');
 await skipIntro(d);
 await d.locator('img[data-wdcc-logo-art="owner-wordmark"]').waitFor({state:'visible',timeout:10000});
 await d.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});await waitPhotos(d,'.rh-grid>article img',5);
 const home=await d.evaluate(()=>{const q=s=>document.querySelector(s),grid=q('.rh-grid'),logo=q('img[data-wdcc-logo-art="owner-wordmark"]');return{logo:{src:logo?.getAttribute('src')||'',...((e)=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null})(logo),nw:logo?.naturalWidth||0},header:((e)=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null})(q('[data-wdcc-public-chrome="header"]')),hero:((e)=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null})(q('.rh-hero')),headline:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim()),colors:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,featured:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:grid.children.length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 const expected=['rgb(242, 31, 50)','rgb(22, 138, 244)','rgb(255, 255, 255)'];
 if(home.logo.src!=='/wdcc-logo-transparent.webp'||home.logo.nw<20||home.logo.w<100||home.header.h<70||home.hero.h<520||JSON.stringify(home.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(home.colors)!==JSON.stringify(expected)||home.benefits!==4||home.featured!==5||home.cards!==5||home.finance!==4||home.trust!==4||home.overflow>2)fail('DESKTOP_HOME',home);
 result.public.homeDesktop=home;await screenshot(d,'homepage-desktop');

 await goto(d,'/inventory');await d.locator('.wdccVehicleGrid article').first().waitFor({state:'visible',timeout:10000});await waitPhotos(d,'.wdccVehicleGrid article img',4);
 const inventoryDesktop=await d.evaluate(()=>{const q=s=>document.querySelector(s),grid=q('.wdccVehicleGrid');return{cards:grid?.children.length||0,columns:grid?getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0,controls:document.querySelectorAll('.publicInventoryControls input,.publicInventoryControls select').length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(inventoryDesktop.cards<4||inventoryDesktop.columns!==3||inventoryDesktop.controls<4||inventoryDesktop.overflow>2)fail('PUBLIC_INVENTORY_DESKTOP',inventoryDesktop);result.public.inventoryDesktop=inventoryDesktop;await screenshot(d,'inventory-desktop');

 await goto(d,'/vehicle/proof-vdp');await d.locator('.vehicleLayout').waitFor({state:'visible',timeout:10000});await waitPhotos(d,'.vehiclePhoto img',1);
 const vdp=await d.evaluate(()=>{const q=s=>document.querySelector(s);return{layout:getComputedStyle(q('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gallery:document.querySelectorAll('.vehicleGallery button').length,facts:document.querySelectorAll('.vehicleFacts span').length,features:document.querySelectorAll('.vehicleFeatures span').length,actions:[...document.querySelectorAll('.vehicleActionsPrimary .cta')].map(x=>(x.textContent||'').trim()),heroSubstitute:document.querySelectorAll('.vehicleMedia img[src*="wdcc-hero-v2"]').length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(vdp.layout!==2||vdp.gallery<2||vdp.facts<5||vdp.features<1||JSON.stringify(vdp.actions)!==JSON.stringify(['SCHEDULE TEST DRIVE','CALL SEAN'])||vdp.heroSubstitute!==0||vdp.overflow>2)fail('VDP_DESKTOP',vdp);result.public.vdpDesktop=vdp;await screenshot(d,'vehicle-detail-desktop');

 await goto(d,'/get-approved');await d.locator('.approvalWizard').waitFor({state:'visible',timeout:10000});
 const approval=await d.evaluate(()=>({contactPreference:!!document.querySelector('select'),name:!!document.querySelector('input[autocomplete="name"]'),phone:!!document.querySelector('input[type="tel"]'),email:!!document.querySelector('input[type="email"]'),stages:document.querySelectorAll('.approvalStages button').length,overflow:document.documentElement.scrollWidth-innerWidth}));if(!approval.contactPreference||!approval.name||!approval.phone||!approval.email||approval.stages!==3||approval.overflow>2)fail('APPROVAL_FORM',approval);result.public.approval=approval;await screenshot(d,'preapproval-desktop');

 await goto(d,'/schedule-test-drive?vehicle=proof-vdp');await d.locator('.leadForm').waitFor({state:'visible',timeout:10000});
 const schedule=await d.evaluate(()=>({name:!!document.querySelector('input[name="name"]'),phone:!!document.querySelector('input[name="phone"]'),email:!!document.querySelector('input[name="email"]'),vehicle:!!document.querySelector('input[name="vehicleInterest"]'),date:!!document.querySelector('input[name="preferredDate"][type="date"]'),time:!!document.querySelector('input[name="preferredTime"][type="time"]'),comments:!!document.querySelector('textarea[name="message"]'),consent:!!document.querySelector('input[name="consent"]'),overflow:document.documentElement.scrollWidth-innerWidth}));if(Object.entries(schedule).some(([k,v])=>k!=='overflow'&&!v)||schedule.overflow>2)fail('TEST_DRIVE_FORM',schedule);result.public.schedule=schedule;await screenshot(d,'test-drive-desktop');

 await goto(d,'/contact');await d.locator('.leadForm').waitFor({state:'visible',timeout:10000});const contact=await d.evaluate(()=>({name:!!document.querySelector('input[name="name"]'),phone:!!document.querySelector('input[name="phone"]'),email:!!document.querySelector('input[name="email"]'),message:!!document.querySelector('textarea[name="message"][required]'),consent:!!document.querySelector('input[name="consent"]'),overflow:document.documentElement.scrollWidth-innerWidth}));if(Object.entries(contact).some(([k,v])=>k!=='overflow'&&!v)||contact.overflow>2)fail('CONTACT_FORM',contact);result.public.contact=contact;

 const login=await dctx.newPage();watch(login);await goto(login,'/dealer');await login.locator('.lockedDealerLogin').waitFor({state:'visible',timeout:10000});result.dealer.login=true;await screenshot(login,'dealer-login');await login.close();

 const dd=await dctx.newPage();watch(dd);await wire(dd);await goto(dd,'/dealer');await dd.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
 const dash=await dd.evaluate(()=>{const q=s=>document.querySelector(s),top=s=>q(s)?.getBoundingClientRect().top||0;return{metrics:getComputedStyle(q('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,ops:getComputedStyle(q('.opsCards')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,inventoryTop:top('.inventoryOverview'),vehiclesTop:top('.recentVehicles'),activityTop:top('.activityLocked'),side:getComputedStyle(q('.dcSide')).display,navLinks:[...document.querySelectorAll('.dcSide [data-wdcc-dealer-nav="canonical"] a')].map(a=>a.getAttribute('href')),overflow:document.documentElement.scrollWidth-innerWidth}});
 const requiredRoutes=['/dealer/appointments','/dealer/test-drives','/dealer/customers','/dealer/applications','/dealer/messages','/dealer/reports','/dealer/settings'];
 if(dash.metrics!==6||dash.ops!==4||dash.side==='none'||requiredRoutes.some(x=>!dash.navLinks.includes(x))||Math.max(dash.inventoryTop,dash.vehiclesTop,dash.activityTop)-Math.min(dash.inventoryTop,dash.vehiclesTop,dash.activityTop)>3||dash.overflow>2)fail('DEALER_DASHBOARD',dash);
 result.dealer.dashboard=dash;await screenshot(dd,'dealer-dashboard-desktop');

 await goto(dd,'/dealer/inventory');await dd.locator('.inventoryRow').first().waitFor({state:'visible',timeout:10000});
 const inv=await dd.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,head:getComputedStyle(document.querySelector('.inventoryHead')).display,overflow:document.documentElement.scrollWidth-innerWidth}));if(inv.rows<5||inv.head==='none'||inv.overflow>2)fail('DEALER_INVENTORY',inv);result.dealer.inventory=inv;await screenshot(dd,'dealer-inventory-desktop');

 await goto(dd,'/dealer/inventory/new');await dd.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});
 const editorInitial=await dd.evaluate(()=>({steps:document.querySelectorAll('.stepper button').length,label:document.querySelector('.editHead>span')?.textContent?.trim(),stage:document.querySelector('[data-wizard-stage]')?.getAttribute('data-wizard-stage'),sideBrandImages:document.querySelectorAll('.editSide img').length,topBrandImages:document.querySelectorAll('.editTop .topBrand img').length,overflow:document.documentElement.scrollWidth-innerWidth}));
 if(editorInitial.steps!==5||editorInitial.label!=='Step 1 of 5'||editorInitial.stage!=='info'||editorInitial.sideBrandImages!==0||editorInitial.topBrandImages!==1||editorInitial.overflow>2)fail('DEALER_EDITOR_INITIAL',editorInitial);await screenshot(dd,'dealer-add-edit-info');
 for(const [index,key,file] of [[1,'pricing','dealer-add-edit-pricing'],[2,'photos','dealer-add-edit-photos-desktop'],[3,'details','dealer-add-edit-details'],[4,'review','dealer-add-edit-review']]){await dd.locator('.stepper button').nth(index).click();await dd.locator(`[data-wizard-stage="${key}"]`).waitFor({state:'visible'});const s=await dd.evaluate(()=>({label:document.querySelector('.editHead>span')?.textContent?.trim(),stage:document.querySelector('[data-wizard-stage]')?.getAttribute('data-wizard-stage'),overflow:document.documentElement.scrollWidth-innerWidth}));if(s.stage!==key||s.label!==`Step ${index+1} of 5`||s.overflow>2)fail('EDITOR_STAGE',{index,key,s});await screenshot(dd,file)}
 await dd.locator('.stepper button').nth(2).click();
 const editorPhotos=await dd.evaluate(()=>({comingSoon:document.querySelectorAll('.vehiclePreview .previewPhotoComingSoon').length,heroFallback:document.querySelectorAll('.vehiclePreview img[src*="wdcc-hero-v2"]').length,tools:[...document.querySelectorAll('.photoTools button b')].map(x=>x.textContent?.trim()),readiness:document.querySelectorAll('.readinessCard,.mobileReadiness').length}));if(editorPhotos.comingSoon<1||editorPhotos.heroFallback!==0||editorPhotos.readiness<1||!['Take Photo','Upload Files','Drag & Drop'].every(x=>editorPhotos.tools.includes(x)))fail('DEALER_EDITOR_PHOTOS',editorPhotos);result.dealer.editor={initial:editorInitial,photos:editorPhotos};
 await dd.getByRole('button',{name:'Preview'}).first().click();await dd.locator('.previewModal').waitFor({state:'visible'});await screenshot(dd,'dealer-listing-preview');await dd.locator('.closePreview').click();

 await goto(dd,'/dealer/inventory/import');const imp=await dd.evaluate(()=>({steps:document.querySelectorAll('.dcStep').length,title:document.querySelector('h1')?.textContent?.trim(),overflow:document.documentElement.scrollWidth-innerWidth}));if(imp.steps!==4||imp.title!=='Import Vehicles'||imp.overflow>2)fail('DEALER_IMPORT',imp);result.dealer.import=imp;await screenshot(dd,'dealer-import');

 for(const [path,title,file] of [['/dealer/leads','Leads','dealer-leads'],['/dealer/appointments','Appointments','dealer-appointments'],['/dealer/test-drives','Test Drives','dealer-test-drives'],['/dealer/customers','Customers','dealer-customers'],['/dealer/applications','Applications','dealer-applications'],['/dealer/messages','Messages','dealer-messages'],['/dealer/reports','Reports','dealer-reports'],['/dealer/settings','Settings','dealer-settings']]){
   await goto(dd,path);const shell=path==='/dealer/leads'?'.leadsContract':'.dealerModulePage';await dd.locator(shell).waitFor({state:'visible',timeout:10000});const state=await dd.evaluate(([expectedPath,expectedTitle])=>({path:location.pathname,title:document.querySelector('.dcContent h1')?.textContent?.trim(),canonicalNav:!!document.querySelector('[data-wdcc-dealer-nav="canonical"]'),overflow:document.documentElement.scrollWidth-innerWidth}),[path,title]);if(state.path!==path||state.title!==title||!state.canonicalNav||state.overflow>2)fail('DEALER_MODULE',{expected:{path,title},state});result.modules[path]=state;await screenshot(dd,file);
 }
 await dd.close();

 for(const [width,height,label] of [[1280,900,'1280'],[768,1024,'tablet'],[440,900,'440']]){
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<800});const p=await ctx.newPage();watch(p);await wire(p);await goto(p,'/?owner-review=1');await skipIntro(p);await p.locator('.rh-hero').waitFor({state:'visible'});const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,header:document.querySelector('[data-wdcc-public-chrome="header"]')?.getBoundingClientRect().height||0,hero:document.querySelector('.rh-hero')?.getBoundingClientRect().height||0}));if(state.overflow>2||state.header<60||state.hero<400)fail('DEVICE_CLASS',{width,state});result.devices[label]=state;await screenshot(p,`homepage-${label}`);await ctx.close();
 }
 await dctx.close();

 const mctx=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const m=await mctx.newPage();watch(m);await wire(m);await goto(m,'/?owner-review=1');await skipIntro(m);await m.locator('img[data-wdcc-logo-art="owner-wordmark"]').waitFor({state:'visible',timeout:10000});await m.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});await waitPhotos(m,'.rh-grid>article img',5);
 const mh=await m.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null},grid=q('.rh-grid'),cards=[...grid.children].map(r),logo=q('img[data-wdcc-logo-art="owner-wordmark"]'),utility=q('[data-wdcc-public-chrome="utility"]'),ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(r);return{header:r(q('[data-wdcc-public-chrome="header"]')),logo:r(logo),utility:getComputedStyle(utility).display,hero:r(q('.rh-hero')),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,display:getComputedStyle(grid).display,cards,ctas,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(mh.utility!=='none'||mh.header.h<62||mh.header.h>66||mh.logo.w<90||mh.logo.w>125||mh.hero.h>525||mh.hero.h<470||mh.benefits!==2||mh.display!=='flex'||mh.cards.length!==5||mh.cards[1].x>=390||mh.ctas.length!==2||mh.ctas[1].y<=mh.ctas[0].bottom||mh.finance!==1||mh.trust!==2||mh.overflow>2)fail('MOBILE_HOME',mh);result.public.homeMobile=mh;await screenshot(m,'homepage-mobile');

 await goto(m,'/inventory');await m.locator('.wdccVehicleGrid article').first().waitFor({state:'visible',timeout:10000});const minv=await m.evaluate(()=>{const g=document.querySelector('.wdccVehicleGrid');return{cards:g?.children.length||0,columns:g?getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0,overflow:document.documentElement.scrollWidth-innerWidth}});if(minv.cards<4||minv.columns!==1||minv.overflow>2)fail('PUBLIC_INVENTORY_MOBILE',minv);result.public.inventoryMobile=minv;await screenshot(m,'inventory-mobile');

 await goto(m,'/vehicle/proof-vdp');await m.locator('.vehicleLayout').waitFor({state:'visible',timeout:10000});const mvdp=await m.evaluate(()=>({columns:getComputedStyle(document.querySelector('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,gallery:document.querySelectorAll('.vehicleGallery button').length,facts:getComputedStyle(document.querySelector('.vehicleFacts')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));if(mvdp.columns!==1||mvdp.gallery<2||mvdp.facts!==2||mvdp.overflow>2)fail('VDP_MOBILE',mvdp);result.public.vdpMobile=mvdp;await screenshot(m,'vehicle-detail-mobile');

 const md=await mctx.newPage();watch(md);await wire(md);await goto(md,'/dealer');await md.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});const mdash=await md.evaluate(()=>({side:getComputedStyle(document.querySelector('.dcSide')).display,nav:getComputedStyle(document.querySelector('.dashMobileNav')).display,metrics:getComputedStyle(document.querySelector('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));if(mdash.side!=='none'||mdash.nav!=='grid'||mdash.metrics!==2||mdash.overflow>2)fail('MOBILE_DEALER',mdash);result.dealer.mobileDashboard=mdash;await screenshot(md,'dealer-dashboard-mobile');
 await goto(md,'/dealer/inventory');await md.locator('.inventoryRow').first().waitFor({state:'visible',timeout:10000});await screenshot(md,'dealer-inventory-mobile');
 await goto(md,'/dealer/inventory/new');await md.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});await md.locator('.stepper button').nth(2).click();await md.locator('[data-wizard-stage="photos"]').waitFor({state:'visible'});await screenshot(md,'dealer-add-edit-photos-mobile');
 await mctx.close();

 if(writes.length)fail('WRITE_REQUESTS',writes);
 if(pageErrors.length)fail('PAGE_ERRORS',pageErrors);
 result.pass=true;fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');console.log('WDCC_OWNER_FINAL_LOCK_PASS',JSON.stringify({sha,public:Object.keys(result.public).length,dealer:Object.keys(result.dealer).length,modules:Object.keys(result.modules).length,devices:Object.keys(result.devices).length,writes:writes.length,pageErrors:pageErrors.length}));
}finally{await browser.close()}
