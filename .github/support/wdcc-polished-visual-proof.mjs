import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL,sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const writes=[];
const vehicles=[
{id:'proof-vdp',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,mileage:41000,stock:'DGC2020SXT',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/nissan350z'},
{id:'proof-charger',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,mileage:53000,stock:'DCR2019RT',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/fordF150'},
{id:'proof-camaro',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,mileage:38000,stock:'CCLT2018',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/hondaPilot'},
{id:'proof-jeep',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,mileage:60000,stock:'JGCL2020',status:'draft',visibility:'public',primary_image_url:'/wdcc-review-media/kiaSportage'},
{id:'proof-f150',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,mileage:71000,stock:'FF150XLT2018',status:'published',visibility:'public',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'visual-proof',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads:[{id:'l1',name:'John Doe',kind:'contact',stage:'new',vehicleInterest:'Challenger',createdAt:new Date().toISOString()}]};
const fail=(name,data={})=>{throw new Error(`${name} ${JSON.stringify(data)}`)};
const watch=p=>p.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
async function wire(p){
 await p.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
 await p.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
 await p.route('**/api/inventory**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:vehicles})}):r.abort());
 await p.route('**/api/inventory/**',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:vehicles[0]})}):r.abort());
}
async function go(p,path){
 let r=null;
 for(let i=0;i<20;i++){
  const j=path.includes('?')?'&':'?';
  r=await p.goto(`${base}${path}${j}polish=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
  if(r?.status()===200)return;
  await p.waitForTimeout(700);
 }
 fail('HTTP',{path,status:r?.status()||0});
}
async function decodeImages(p,selector,minCount){
 await p.waitForFunction(({selector,minCount})=>document.querySelectorAll(selector).length>=minCount,{selector,minCount},{timeout:30000});
 const result=await p.evaluate(async({selector,minCount})=>{
  const imgs=[...document.querySelectorAll(selector)].slice(0,minCount);
  const rows=[];
  for(let i=0;i<imgs.length;i++){
   const img=imgs[i];
   for(let attempt=0;attempt<5;attempt++){
    if(img.complete&&img.naturalWidth>0&&img.naturalHeight>0)break;
    const raw=img.getAttribute('src')||img.src;
    const clean=raw.replace(/([?&])wdccRetry=[^&]*/g,'$1').replace(/[?&]$/,'');
    const join=clean.includes('?')?'&':'?';
    img.src=`${clean}${join}wdccRetry=${i}-${attempt}-${Date.now()}`;
    await new Promise(resolve=>{const done=()=>resolve();img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(done,2200)});
   }
   rows.push({src:img.getAttribute('src'),complete:img.complete,nw:img.naturalWidth,nh:img.naturalHeight});
  }
  return rows;
 },{selector,minCount});
 if(result.length<minCount||result.some(x=>!x.complete||x.nw<20||x.nh<20))fail('MEDIA_DECODE',{selector,result});
 return result;
}
function rgb(v){const m=String(v).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0]}
function lum(c){const a=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]}
function contrast(a,b){const l1=lum(rgb(a)),l2=lum(rgb(b));return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}
async function shot(p,name,fullPage=true){await p.screenshot({path:`${out}/${name}.png`,fullPage});}

const result={sha,url:base,home:{},dealer:{},vdp:{},writes,pass:false};
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const home=await desktop.newPage();watch(home);await go(home,'/?owner-review=1');
 const skip=home.getByRole('button',{name:/skip intro/i});if(await skip.count())await skip.click().catch(()=>{});
 await home.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:20000});
 const homeMedia=await decodeImages(home,'.rh-grid>article img',5);
 const homeCheck=await home.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,cards:document.querySelectorAll('.rh-grid>article').length,headline:[...document.querySelectorAll('.rh-copy h1 span')].map(x=>(x.textContent||'').trim())}));
 if(homeCheck.overflow>2||homeCheck.cards!==5)fail('DESKTOP_HOME',homeCheck);result.home.desktop={...homeCheck,media:homeMedia};await shot(home,'desktop-home');

 const vdp=await desktop.newPage();watch(vdp);await go(vdp,'/vehicle/real-2004-nissan-350z?owner-review=1');await vdp.locator('.vehicleLayout').waitFor({state:'visible',timeout:20000});await decodeImages(vdp,'.vehiclePhoto img',1);
 const vdpCheck=await vdp.evaluate(()=>({cols:getComputedStyle(document.querySelector('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,facts:[...document.querySelectorAll('.vehicleFacts>span')].map(x=>({label:x.querySelector('small')?.textContent?.trim(),value:x.querySelector('b')?.textContent?.trim(),display:getComputedStyle(x).display})),heroBg:getComputedStyle(document.querySelector('.vehicleTop'),'::before').backgroundImage,overflow:document.documentElement.scrollWidth-innerWidth}));
 if(vdpCheck.cols!==2||vdpCheck.overflow>2||vdpCheck.facts.length<5||vdpCheck.facts.some(x=>!x.label||!x.value)||vdpCheck.heroBg.includes('wdcc-hero-v2'))fail('DESKTOP_VDP',vdpCheck);result.vdp.desktop=vdpCheck;await shot(vdp,'desktop-vdp');

 const dealer=await desktop.newPage();watch(dealer);await wire(dealer);await go(dealer,'/dealer');await dealer.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:20000});const dealerMedia=await decodeImages(dealer,'.recentVehicles .miniThumb img',5);
 const dealerCheck=await dealer.evaluate(()=>{const h=document.querySelector('.dcTitle h1'),canvas=document.querySelector('.dcContent.dashboardContent');return{title:getComputedStyle(h).color,canvas:getComputedStyle(canvas).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth}});
 dealerCheck.contrast=contrast(dealerCheck.title,dealerCheck.canvas);if(dealerCheck.contrast<4.5||dealerCheck.overflow>2)fail('DEALER_DESKTOP',dealerCheck);result.dealer.desktop={...dealerCheck,media:dealerMedia};await shot(dealer,'dealer-desktop');await desktop.close();

 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const mh=await mobile.newPage();watch(mh);await go(mh,'/?owner-review=1');const mskip=mh.getByRole('button',{name:/skip intro/i});if(await mskip.count())await mskip.click().catch(()=>{});await mh.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:20000});const mMedia=await decodeImages(mh,'.rh-grid>article img',5);
 const mobileHome=await mh.evaluate(()=>{const h=document.querySelector('.rh-section-head h2'),r=h.getBoundingClientRect();return{heading:h.textContent?.trim(),headingHeight:r.height,fontSize:parseFloat(getComputedStyle(h).fontSize),firstCard:document.querySelector('.rh-grid>article')?.getBoundingClientRect().width||0,overflow:document.documentElement.scrollWidth-innerWidth}});
 if(mobileHome.overflow>2||mobileHome.firstCard<300||mobileHome.headingHeight>mobileHome.fontSize*1.45)fail('MOBILE_HOME',mobileHome);result.home.mobile={...mobileHome,media:mMedia};await shot(mh,'mobile-home');

 const mv=await mobile.newPage();watch(mv);await go(mv,'/vehicle/real-2004-nissan-350z?owner-review=1');await mv.locator('.vehicleLayout').waitFor({state:'visible',timeout:20000});await decodeImages(mv,'.vehiclePhoto img',1);const mobileVdp=await mv.evaluate(()=>({cols:getComputedStyle(document.querySelector('.vehicleLayout')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,factCols:getComputedStyle(document.querySelector('.vehicleFacts')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,overflow:document.documentElement.scrollWidth-innerWidth}));if(mobileVdp.cols!==1||mobileVdp.factCols!==2||mobileVdp.overflow>2)fail('MOBILE_VDP',mobileVdp);result.vdp.mobile=mobileVdp;await shot(mv,'mobile-vdp');

 const md=await mobile.newPage();watch(md);await wire(md);await go(md,'/dealer');await md.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:20000});const mdMedia=await decodeImages(md,'.recentVehicles .miniThumb img',5);const mobileDealer=await md.evaluate(()=>{const h=document.querySelector('.dcTitle h1'),canvas=document.querySelector('.dcContent.dashboardContent');return{title:getComputedStyle(h).color,canvas:getComputedStyle(canvas).backgroundColor,bottomPadding:parseFloat(getComputedStyle(canvas).paddingBottom),overflow:document.documentElement.scrollWidth-innerWidth}});mobileDealer.contrast=contrast(mobileDealer.title,mobileDealer.canvas);if(mobileDealer.contrast<4.5||mobileDealer.bottomPadding<100||mobileDealer.overflow>2)fail('DEALER_MOBILE',mobileDealer);result.dealer.mobile={...mobileDealer,media:mdMedia};await shot(md,'dealer-mobile',false);await mobile.close();
 if(writes.length)fail('WRITES',writes);result.pass=true;fs.writeFileSync(`${out}/polished-result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
