import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const writes=[];
const fail=(name,data={})=>{throw new Error(`${name} ${JSON.stringify(data)}`)};
const watch=p=>p.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});

const vehicles=[
 {id:'proof-vdp',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',fuelType:'Gasoline',bodyStyle:'Coupe',condition:'Used',description:'Clean title. Runs and drives great.',features:['Bluetooth','Backup Camera','Keyless Entry','Alloy Wheels'],primary_image_url:'/wdcc-review-media/nissan350z'},
 {id:'proof-charger',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/fordF150'},
 {id:'proof-camaro',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/hondaPilot'},
 {id:'proof-jeep',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,mileage:60000,stock:'JGCL2020',status:'draft',visibility:'public',primary_image_url:'/wdcc-review-media/kiaSportage'},
 {id:'proof-f150',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const leads=[{id:'l1',name:'John Doe',kind:'contact',stage:'new',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date().toISOString()}];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'frozen-proof',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads};

async function wire(page){
 await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
 await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
 await page.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
 await page.route('**/api/inventory/**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:vehicles[0]})}):r.abort());
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
async function shot(page,name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true})}

const result={sha,url:base,desktop:{},mobile:{},dealer:{},writes,pass:false};
try{
 const dctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const d=await dctx.newPage();watch(d);
 await goto(d,'/?owner-review=1');
 const skip=d.getByRole('button',{name:/skip intro/i});if(await skip.count())await skip.click().catch(()=>{});
 await d.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:15000});
 const home=await d.evaluate(()=>{const q=s=>document.querySelector(s),logo=q('img[data-wdcc-logo-art="owner-wordmark"]'),ls=getComputedStyle(logo),lr=logo?.getBoundingClientRect();return{headline:[...document.querySelectorAll('.rh-copy h1 span')].map(x=>(x.textContent||'').trim()),colors:[...document.querySelectorAll('.rh-copy h1 span')].map(x=>getComputedStyle(x).color),logoSrc:logo?.getAttribute('src')||'',logoNaturalW:logo?.naturalWidth||0,logoNaturalH:logo?.naturalHeight||0,logoDisplay:ls.display,logoVisibility:ls.visibility,logoOpacity:ls.opacity,logoW:lr?.width||0,logoH:lr?.height||0,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,featured:getComputedStyle(q('.rh-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:q('.rh-grid')?.children.length||0,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(JSON.stringify(home.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(home.colors)!==JSON.stringify(['rgb(242, 31, 50)','rgb(22, 138, 244)','rgb(255, 255, 255)'])||home.logoSrc!=='/wdcc-logo-transparent.webp'||home.logoNaturalW<20||home.logoNaturalH<20||home.logoDisplay==='none'||home.logoVisibility==='hidden'||Number(home.logoOpacity)<.9||home.logoW<120||home.logoH<50||home.benefits!==4||home.featured!==5||home.cards<5||home.finance!==4||home.trust!==4||home.overflow>2)fail('DESKTOP_HOME',home);
 result.desktop.home=home;await shot(d,'desktop-home');

 await goto(d,'/vehicle/real-2004-nissan-350z?owner-review=1');await d.locator('.vehicleLayout').waitFor({state:'visible',timeout:15000});
 const vdp=await d.evaluate(()=>({columns:getComputedStyle(document.querySelector('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,actions:[...document.querySelectorAll('.vehicleActionsPrimary .cta')].map(x=>(x.textContent||'').trim()),facts:document.querySelectorAll('.vehicleFacts span').length,photo:!!document.querySelector('.vehiclePhoto img'),overflow:document.documentElement.scrollWidth-innerWidth}));
 if(vdp.columns!==2||JSON.stringify(vdp.actions)!==JSON.stringify(['SCHEDULE TEST DRIVE','CALL SEAN'])||vdp.facts<5||!vdp.photo||vdp.overflow>2)fail('DESKTOP_VDP',vdp);
 result.desktop.vdp=vdp;await shot(d,'desktop-vdp');

 const dealer=await dctx.newPage();watch(dealer);await wire(dealer);await goto(dealer,'/dealer');await dealer.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:15000});
 const dash=await dealer.evaluate(()=>{const q=s=>document.querySelector(s),top=s=>q(s)?.getBoundingClientRect().top||0,img=q('.dcTop .brand>img'),style=getComputedStyle(img),r=img?.getBoundingClientRect(),before=getComputedStyle(q('.dcTop .brand'),'::before');return{metrics:getComputedStyle(q('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,ops:getComputedStyle(q('.opsCards')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,delta:Math.max(top('.inventoryOverview'),top('.recentVehicles'),top('.activityLocked'))-Math.min(top('.inventoryOverview'),top('.recentVehicles'),top('.activityLocked')),brandSrc:img?.getAttribute('src')||'',brandNaturalW:img?.naturalWidth||0,brandNaturalH:img?.naturalHeight||0,brandDisplay:style.display,brandVisibility:style.visibility,brandOpacity:style.opacity,brandW:r?.width||0,brandH:r?.height||0,beforeDisplay:before.display,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(dash.metrics!==6||dash.ops!==4||dash.delta>3||dash.brandSrc!=='/wdcc-official-logo.webp'||dash.brandNaturalW<20||dash.brandNaturalH<20||dash.brandDisplay==='none'||dash.brandVisibility==='hidden'||Number(dash.brandOpacity)<.9||dash.brandW<45||dash.brandH<45||dash.beforeDisplay!=='none'||dash.overflow>2)fail('DEALER_DESKTOP',dash);
 result.dealer.desktop=dash;await shot(dealer,'dealer-desktop');
 await dctx.close();

 const mctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const m=await mctx.newPage();watch(m);await goto(m,'/?owner-review=1');const mskip=m.getByRole('button',{name:/skip intro/i});if(await mskip.count())await mskip.click().catch(()=>{});await m.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:15000});
 const mobile=await m.evaluate(()=>{const q=s=>document.querySelector(s),header=q('[data-wdcc-public-chrome="header"]'),grid=q('.rh-grid'),logo=q('img[data-wdcc-logo-art="owner-wordmark"]'),ls=getComputedStyle(logo),lr=logo?.getBoundingClientRect(),first=grid?.children?.[0]?.getBoundingClientRect(),second=grid?.children?.[1]?.getBoundingClientRect(),third=grid?.children?.[2]?.getBoundingClientRect();return{headerH:header?.getBoundingClientRect().height||0,logoSrc:logo?.getAttribute('src')||'',logoNaturalW:logo?.naturalWidth||0,logoNaturalH:logo?.naturalHeight||0,logoDisplay:ls.display,logoVisibility:ls.visibility,logoOpacity:ls.opacity,logoW:lr?.width||0,logoH:lr?.height||0,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,visibleCards:[first,second,third].filter(r=>r&&r.left<innerWidth&&r.right>0).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(Math.abs(mobile.headerH-64)>2||mobile.logoSrc!=='/wdcc-logo-transparent.webp'||mobile.logoNaturalW<20||mobile.logoNaturalH<20||mobile.logoDisplay==='none'||mobile.logoVisibility==='hidden'||Number(mobile.logoOpacity)<.9||mobile.logoW<100||mobile.logoH<42||mobile.benefits!==2||mobile.finance!==1||mobile.trust!==2||mobile.visibleCards<2||mobile.overflow>2)fail('MOBILE_HOME',mobile);
 result.mobile.home=mobile;await shot(m,'mobile-home');

 const md=await mctx.newPage();watch(md);await wire(md);await goto(md,'/dealer');await md.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:15000});
 const mdash=await md.evaluate(()=>{const q=s=>document.querySelector(s),img=q('.dcTop .brand>img'),style=getComputedStyle(img),r=img?.getBoundingClientRect(),before=getComputedStyle(q('.dcTop .brand'),'::before');return{side:getComputedStyle(q('.dcSide')).display,nav:getComputedStyle(q('.dashMobileNav')).display,metrics:getComputedStyle(q('.dashMetrics')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,brandSrc:img?.getAttribute('src')||'',brandNaturalW:img?.naturalWidth||0,brandNaturalH:img?.naturalHeight||0,brandDisplay:style.display,brandVisibility:style.visibility,brandOpacity:style.opacity,brandW:r?.width||0,brandH:r?.height||0,beforeDisplay:before.display,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(mdash.side!=='none'||mdash.nav!=='grid'||mdash.metrics!==2||mdash.brandSrc!=='/wdcc-official-logo.webp'||mdash.brandNaturalW<20||mdash.brandNaturalH<20||mdash.brandDisplay==='none'||mdash.brandVisibility==='hidden'||Number(mdash.brandOpacity)<.9||mdash.brandW<38||mdash.brandH<38||mdash.beforeDisplay!=='none'||mdash.overflow>2)fail('DEALER_MOBILE',mdash);
 result.dealer.mobile=mdash;await shot(md,'dealer-mobile');
 await mctx.close();

 if(writes.length)fail('WRITE_REQUESTS',writes);
 result.pass=true;fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
