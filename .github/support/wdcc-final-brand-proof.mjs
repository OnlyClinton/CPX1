import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL,sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof',KEY='wdcc-owner-review-fixture-v4-mock-split';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),writes=[];
const fail=(name,data={})=>{throw new Error(`${name} ${JSON.stringify(data)}`)};
const watch=p=>p.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});

const vehicles=[
 {id:'proof-vdp',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',views:246,leads:18,primary_image_url:'/wdcc-review-media/nissan350z'},
 {id:'proof-charger',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',views:215,leads:16,primary_image_url:'/wdcc-review-media/fordF150'},
 {id:'proof-camaro',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',views:176,leads:14,primary_image_url:'/wdcc-review-media/hondaPilot'},
 {id:'proof-jeep',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,mileage:60000,stock:'JGCL2020',status:'published',visibility:'public',views:162,leads:12,primary_image_url:'/wdcc-review-media/kiaSportage'},
 {id:'proof-f150',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',views:138,leads:9,primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const now=Date.now();
const leads=[
 {id:'l1',name:'John D.',kind:'approval',stage:'approved',source:'Website',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date(now-2*60000).toISOString()},
 {id:'l2',name:'Maria R.',kind:'contact',stage:'new',source:'Phone',vehicleInterest:'2019 Dodge Charger R/T',createdAt:new Date(now-15*60000).toISOString()},
 {id:'l3',name:'Mike S.',kind:'appointment',stage:'appointment',source:'Walk-in',vehicleInterest:'2018 Chevrolet Camaro LT',createdAt:new Date(now-22*60000).toISOString()},
 {id:'l4',name:'Taylor B.',kind:'contact',stage:'sold',source:'Referral',vehicleInterest:'2020 Jeep Grand Cherokee',createdAt:new Date(now-35*60000).toISOString()}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'brand-proof',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:11,newToday:58,appointments:5,applications:27,approved:19,messages:3},inventory:vehicles,leads};
const REVIEW_MEDIA_PATHS=vehicles.map(v=>String(v.primary_image_url));
const reviewMedia=new Map();

async function primeReviewMedia(){
 for(const path of REVIEW_MEDIA_PATHS){
  let bytes=null,last='not_attempted';
  for(let attempt=0;attempt<20;attempt++){
   try{
    const response=await fetch(`${base}${path}`,{cache:'no-store'});
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(response.ok&&type.startsWith('image/webp')){
     const candidate=Buffer.from(await response.arrayBuffer());
     if(candidate.length>1000){bytes=candidate;last=`ok:${candidate.length}`;break}
     last=`small:${candidate.length}`;
    }else last=`http:${response.status}:${type}`;
   }catch(error){last=String(error?.message||error)}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!bytes)fail('REVIEW_MEDIA_UNAVAILABLE',{path,last});
  reviewMedia.set(path,bytes);
 }
}
async function serveReviewMedia(p){
 await p.route('**/wdcc-review-media/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const body=reviewMedia.get(path);
  return body?route.fulfill({status:200,contentType:'image/webp',headers:{'cache-control':'public, max-age=604800, immutable','x-wdcc-proof-media':'verified-preview-bytes'},body}):route.continue();
 });
}
async function waitImages(p,selector,min=1){
 await p.waitForFunction(({selector,min})=>{
  const imgs=[...document.querySelectorAll(selector)];
  return imgs.length>=min&&imgs.every(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0);
 },{selector,min},{timeout:30000});
}
async function wire(p){
 await p.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
 await p.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
 await p.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
 await p.route('**/api/inventory/**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:vehicles[0]})}):r.abort());
}
async function go(p,path){let r=null;for(let i=0;i<20;i++){const join=path.includes('?')?'&':'?';r=await p.goto(`${base}${path}${join}proof=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);if(r?.status()===200)return;await p.waitForTimeout(1000)}fail('HTTP',{path,status:r?.status()||0})}
async function ownerHome(p){await go(p,'/?owner-review=1');await p.evaluate(k=>sessionStorage.setItem(k,'1'),KEY);await p.reload({waitUntil:'domcontentloaded',timeout:30000});const skip=p.getByRole('button',{name:/skip intro/i});if(await skip.count())await skip.click().catch(()=>{});await p.locator('.wdcc-header-wordmark').waitFor({state:'visible',timeout:10000});await p.waitForFunction(()=>document.querySelectorAll('.rh-grid>article').length===5,null,{timeout:30000});await waitImages(p,'.rh-grid>article img',5)}
async function shot(p,name){await p.screenshot({path:`${out}/${name}.png`,fullPage:true})}
const result={sha,url:base,desktop:{},mobile:{},dealer:{},writes,pass:false};

try{
 await primeReviewMedia();
 const dc=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const d=await dc.newPage();await serveReviewMedia(d);watch(d);await ownerHome(d);
 const home=await d.evaluate(()=>{const q=s=>document.querySelector(s),w=q('.wdcc-header-wordmark'),wr=w.getBoundingClientRect(),hero=q('.rh-hero').getBoundingClientRect(),imgs=[...document.querySelectorAll('.rh-grid>article img')];return{text:(w.textContent||'').replace(/\s+/g,' ').trim(),wordmarkW:wr.width,wordmarkH:wr.height,cc:getComputedStyle(q('.wdcc-header-wordmark>strong>span')).color,heroH:hero.height,headline:[...document.querySelectorAll('.rh-copy h1 span')].map(x=>(x.textContent||'').trim()),headlineColors:[...document.querySelectorAll('.rh-copy h1 span')].map(x=>getComputedStyle(x).color),benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,featured:getComputedStyle(q('.rh-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cards:q('.rh-grid').children.length,images:imgs.map(i=>[i.naturalWidth,i.naturalHeight]),finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(!home.text.includes('WDCC')||!home.text.includes("WE DON'T CARE CARS")||home.wordmarkW<118||home.wordmarkH<28||home.cc!=='rgb(242, 31, 50)'||Math.abs(home.heroH-500)>3||JSON.stringify(home.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(home.headlineColors)!==JSON.stringify(['rgb(242, 31, 50)','rgb(22, 138, 244)','rgb(255, 255, 255)'])||home.benefits!==4||home.featured!==5||home.cards!==5||home.images.length!==5||home.images.some(([w,h])=>w<1||h<1)||home.finance!==4||home.trust!==4||home.overflow>2)fail('DESKTOP_STOREFRONT',home);
 result.desktop.home=home;await shot(d,'desktop-storefront');

 await go(d,'/vehicle/real-2004-nissan-350z?owner-review=1');await d.locator('.vehicleLayout').waitFor({state:'visible',timeout:15000});await waitImages(d,'.vehiclePhoto img',1);
 const vdp=await d.evaluate(()=>{const img=document.querySelector('.vehiclePhoto img');return{cols:getComputedStyle(document.querySelector('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,actions:[...document.querySelectorAll('.vehicleActionsPrimary .cta')].map(x=>(x.textContent||'').trim()),photo:!!img,nw:img?.naturalWidth||0,nh:img?.naturalHeight||0,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(vdp.cols!==2||JSON.stringify(vdp.actions)!==JSON.stringify(['SCHEDULE TEST DRIVE','CALL SEAN'])||!vdp.photo||vdp.nw<1||vdp.nh<1||vdp.overflow>2)fail('DESKTOP_VDP',vdp);result.desktop.vdp=vdp;await shot(d,'desktop-vdp');

 const dd=await dc.newPage();await serveReviewMedia(dd);watch(dd);await wire(dd);await go(dd,'/dealer');await dd.locator('.targetDealerApp').waitFor({state:'visible',timeout:15000});await waitImages(dd,'.topVehicleTable img',5);
 const dealerDesktop=await dd.evaluate(()=>{const q=s=>document.querySelector(s),brand=q('.targetDealerTopBrand'),img=q('.targetDealerTopBrand img'),vehicleImgs=[...document.querySelectorAll('.topVehicleTable img')];return{before:getComputedStyle(brand,'::before').content,after:getComputedStyle(brand,'::after').content,imgDisplay:img?getComputedStyle(img).display:'missing',stats:getComputedStyle(q('.targetDealerStats')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,charts:getComputedStyle(q('.targetDealerCharts')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,lower:getComputedStyle(q('.targetDealerLower')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,quick:getComputedStyle(q('.targetDealerQuick')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,vehicleImages:vehicleImgs.map(i=>[i.naturalWidth,i.naturalHeight]),side:getComputedStyle(q('.targetDealerSide')).display,bottom:getComputedStyle(q('.targetDealerMobile')).display,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(!dealerDesktop.before.includes('WDCC')||!dealerDesktop.after.includes("WE DON'T CARE CARS")||dealerDesktop.imgDisplay!=='none'||dealerDesktop.stats!==4||dealerDesktop.charts!==2||dealerDesktop.lower!==2||dealerDesktop.quick!==4||dealerDesktop.vehicleImages.length!==5||dealerDesktop.vehicleImages.some(([w,h])=>w<1||h<1)||dealerDesktop.side==='none'||dealerDesktop.bottom!=='none'||dealerDesktop.overflow>2)fail('DEALER_DESKTOP_MOCK',dealerDesktop);
 result.dealer.desktop=dealerDesktop;await shot(dd,'desktop-dealer');await dc.close();

 const mc=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const m=await mc.newPage();await serveReviewMedia(m);watch(m);await ownerHome(m);
 const mobileHome=await m.evaluate(()=>{const q=s=>document.querySelector(s),w=q('.wdcc-header-wordmark'),grid=q('.rh-grid'),cards=[...grid.children].map(x=>x.getBoundingClientRect()),first=cards[0],imgs=[...grid.querySelectorAll('img')];return{header:q('[data-wdcc-public-chrome="header"]').getBoundingClientRect().height,text:(w.textContent||'').replace(/\s+/g,' ').trim(),cc:getComputedStyle(q('.wdcc-header-wordmark>strong>span')).color,heroH:q('.rh-hero').getBoundingClientRect().height,benefits:getComputedStyle(q('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,finance:getComputedStyle(q('.rh-steps')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,trust:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,cardRatio:first?first.width/innerWidth:0,visible:cards.filter(x=>x.left<innerWidth&&x.right>0).length,images:imgs.map(i=>[i.naturalWidth,i.naturalHeight]),overflow:document.documentElement.scrollWidth-innerWidth}});
 if(Math.abs(mobileHome.header-64)>2||!mobileHome.text.includes('WDCC')||mobileHome.cc!=='rgb(242, 31, 50)'||Math.abs(mobileHome.heroH-470)>3||mobileHome.benefits!==2||mobileHome.finance!==1||mobileHome.trust!==2||mobileHome.cardRatio<.8||mobileHome.cardRatio>.92||mobileHome.visible<1||mobileHome.visible>2||mobileHome.images.length!==5||mobileHome.images.some(([w,h])=>w<1||h<1)||mobileHome.overflow>2)fail('MOBILE_STOREFRONT',mobileHome);
 result.mobile.home=mobileHome;await shot(m,'mobile-storefront');

 const md=await mc.newPage();await serveReviewMedia(md);watch(md);await wire(md);await go(md,'/dealer');await md.locator('.targetDealerApp').waitFor({state:'visible',timeout:15000});
 const dealerMobile=await md.evaluate(()=>{const q=s=>document.querySelector(s),brand=q('.targetDealerTopBrand'),img=q('.targetDealerTopBrand img'),lower=q('.targetDealerLower>section:first-child');return{header:q('.targetDealerTop').getBoundingClientRect().height,before:getComputedStyle(brand,'::before').content,after:getComputedStyle(brand,'::after').content,imgDisplay:img?getComputedStyle(img).display:'missing',side:getComputedStyle(q('.targetDealerSide')).display,stats:getComputedStyle(q('.targetDealerStats')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,charts:getComputedStyle(q('.targetDealerCharts')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,topVehicles:getComputedStyle(lower).display,quick:getComputedStyle(q('.targetDealerQuick')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,bottom:getComputedStyle(q('.targetDealerMobile')).display,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(Math.abs(dealerMobile.header-64)>2||!dealerMobile.before.includes('WDCC')||!dealerMobile.after.includes("WE DON'T CARE CARS")||dealerMobile.imgDisplay!=='none'||dealerMobile.side!=='none'||dealerMobile.stats!==2||dealerMobile.charts!==1||dealerMobile.topVehicles!=='none'||dealerMobile.quick!==4||dealerMobile.bottom!=='none'||dealerMobile.overflow>2)fail('DEALER_MOBILE_MOCK',dealerMobile);
 result.dealer.mobile=dealerMobile;await shot(md,'mobile-dealer');await mc.close();

 if(writes.length)fail('WRITES',writes);
 result.pass=true;fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
