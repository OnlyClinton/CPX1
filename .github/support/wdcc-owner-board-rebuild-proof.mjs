import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL;
const sha=process.env.GITHUB_SHA;
const out='owner-board-proof';
if(!base||!sha||!base.includes(sha))throw new Error(`OWNER_BOARD_NOT_EXACT_SHA_${base||''}_${sha||''}`);
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const writes=[];
const fail=(name,data={})=>{throw new Error(`${name}_${JSON.stringify(data)}`)};
const watch=page=>page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
const vehicles=[
  {id:'real-2004-nissan-350z',year:2020,make:'Dodge',model:'Challenger',trim:'SXT',price:24995,downPayment:2000,mileage:41000,stock:'DG-C2020-SXT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Coupe',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/nissan350z'},
  {id:'real-2016-ford-f150-limited',year:2019,make:'Dodge',model:'Charger',trim:'R/T',price:21995,downPayment:1500,mileage:53000,stock:'DCR-2019-RT',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Sedan',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/fordF150'},
  {id:'real-2019-honda-pilot',year:2018,make:'Chevrolet',model:'Camaro',trim:'LT',price:20995,downPayment:1500,mileage:38000,stock:'CC-LT-2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'RWD',bodyStyle:'Coupe',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/hondaPilot'},
  {id:'real-2019-kia-sportage',year:2020,make:'Jeep',model:'Grand Cherokee',trim:'Laredo',price:23995,downPayment:2000,mileage:60000,stock:'JGC-L-2020',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',bodyStyle:'SUV',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/kiaSportage'},
  {id:'real-2019-toyota-rav4',year:2018,make:'Ford',model:'F-150',trim:'XLT',price:22995,downPayment:2000,mileage:71000,stock:'F150-XLT-2018',status:'published',visibility:'public',transmission:'Automatic',drivetrain:'4WD',bodyStyle:'Truck',fuelType:'Gasoline',description:'Verified owner-review fixture.',primary_image_url:'/wdcc-review-media/toyotaRav4'}
];
const leads=[{id:'lead-1',name:'Customer One',source:'website',pipelineStage:'new',vehicleInterest:'2020 Dodge Challenger SXT',createdAt:new Date().toISOString()}];
const session={authenticated:true,name:'Sean',role:'dealer_agent',tenantId:'wdcc',user:{id:'owner-board',displayName:'Sean',role:'dealer_agent',tenantId:'wdcc'}};
const dashboard={summary:{newToday:5,applications:3,approved:2,sold:1},inventory:vehicles,leads};
const result={sha,url:base,boards:{},writes,pass:false};

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
    const response=await page.goto(`${base}${path}${join}owner-proof=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    status=response?.status()||0;
    if(status===200){
      await page.evaluate(()=>{globalThis.tracks=e=>e?getComputedStyle(e).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0});
      return response;
    }
    await page.waitForTimeout(1200);
  }
  fail(`${name}_HTTP`,{status,path});
}
async function skipIntro(page){const intro=page.locator('.li');if(!await intro.count())return;const skip=page.getByRole('button',{name:/skip intro/i});if(await skip.count())await skip.click().catch(()=>{});await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{})}
async function waitImages(page,selector,min=1){await page.waitForFunction(({selector,min})=>{const imgs=[...document.querySelectorAll(selector)];return imgs.length>=min&&imgs.slice(0,min).every(i=>i.complete&&i.naturalWidth>20&&i.naturalHeight>20)},{selector,min},{timeout:20000})}
async function noOverflow(page,name){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow>2)fail(`${name}_OVERFLOW`,{overflow});return overflow}
async function hitTargets(page,selector,name){
  const loc=page.locator(selector),n=Math.min(await loc.count(),8),checks=[];
  for(let i=0;i<n;i++){
    const el=loc.nth(i);if(!await el.isVisible())continue;await el.scrollIntoViewIfNeeded();
    const check=await el.evaluate(e=>{const r=e.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)),hit=document.elementFromPoint(x,y);return{ok:Boolean(hit&&(hit===e||e.contains(hit))),tag:hit?.tagName||'',cls:String(hit?.className||''),x,y,w:r.width,h:r.height}});
    checks.push(check);if(!check.ok)fail(`${name}_POINTER_BLOCKED`,{index:i,...check});
  }
  return checks;
}
async function publicHeader(page,mobile,name){
  const round=page.locator('[data-wdcc-public-chrome="header"] img.rh-logo-round[data-wdcc-logo-render="owner-approved-round"]');
  await round.waitFor({state:'visible',timeout:10000});
  const x=await page.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2}:null};const h=q('[data-wdcc-public-chrome="header"]'),u=q('[data-wdcc-public-chrome="utility"]'),r=q('img.rh-logo-round[data-wdcc-logo-render="owner-approved-round"]'),legacy=q('img[data-wdcc-logo-art="owner-wordmark"]');return{header:R(h),headerPos:getComputedStyle(h).position,utility:R(u),utilityDisplay:u?getComputedStyle(u).display:'none',round:R(r),roundSrc:r?.getAttribute('src')||'',roundLoaded:Boolean(r?.complete&&r?.naturalWidth>20&&r?.naturalHeight>20),legacyOpacity:legacy?Number(getComputedStyle(legacy).opacity):1,winW:innerWidth}});
  if(!x.header||x.headerPos!=='sticky'||!x.round||!x.roundLoaded||x.roundSrc!=='/wdcc-owner-logo'||Math.abs(x.round.w-x.round.h)>3||x.legacyOpacity>.05)fail(`${name}_ROUND_HEADER`,x);
  if(mobile){if(x.utilityDisplay!=='none'||x.round.w<54||Math.abs(x.round.cx-x.winW/2)>8||x.header.h<60||x.header.h>72)fail(`${name}_MOBILE_HEADER`,x)}else{if(!x.utility||x.utility.h<28||x.round.w<96||x.header.h<56)fail(`${name}_DESKTOP_HEADER`,x)}
  return x;
}

try{
  const dctx=await browser.newContext({viewport:{width:1440,height:1000},screen:{width:1440,height:1000},deviceScaleFactor:1});
  const d=await dctx.newPage();watch(d);
  await goto200(d,'/?owner-review=1','HOME_DESKTOP');
  const intro=d.locator('.li-badge img[data-wdcc-intro-badge-art="owner-approved"]');
  if(await intro.count()){await intro.waitFor({state:'visible',timeout:10000});const ir=await d.evaluate(()=>{const b=document.querySelector('.li-badge')?.getBoundingClientRect();return b?{w:b.width,h:b.height,cx:b.x+b.width/2,winW:innerWidth}:null});if(!ir||Math.abs(ir.cx-ir.winW/2)>5||Math.abs(ir.w-ir.h)>3)fail('INTRO_DESKTOP',ir);result.boards.intro=ir}
  await skipIntro(d);result.boards.homeDesktopHeader=await publicHeader(d,false,'HOME_DESKTOP');
  await d.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});await waitImages(d,'.rh-grid>article img',5);
  const hd=await d.evaluate(()=>{const q=s=>document.querySelector(s),g=q('.rh-grid');return{hero:Boolean(q('.rh-hero-art')?.complete&&q('.rh-hero-art')?.naturalWidth>20),headline:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>(e.textContent||'').trim()),colors:[...document.querySelectorAll('.rh-copy h1 span')].map(e=>getComputedStyle(e).color),benefits:tracks(q('.rh-benefits')),featured:tracks(g),cards:g.children.length,finance:tracks(q('.rh-steps')),trust:tracks(q('.rh-trust-grid'))}});
  if(!hd.hero||JSON.stringify(hd.headline)!==JSON.stringify(['BAD CREDIT?','NO CREDIT?',"WE DON'T CARE."])||JSON.stringify(hd.colors)!==JSON.stringify(['rgb(239, 23, 39)','rgb(22, 137, 255)','rgb(255, 255, 255)'])||hd.benefits!==4||hd.cards!==5||hd.finance!==4||hd.trust!==4)fail('HOME_DESKTOP',hd);await noOverflow(d,'HOME_DESKTOP');result.boards.homeDesktop=hd;await d.screenshot({path:`${out}/home-desktop.png`,fullPage:true});

  await goto200(d,'/inventory?owner-review=1','INVENTORY_DESKTOP');await d.locator('.inventoryGrid>article').first().waitFor({state:'visible',timeout:10000});
  const invD=await d.evaluate(()=>{const g=document.querySelector('.inventoryGrid');return{tracks:tracks(g),cards:g.children.length,controls:document.querySelectorAll('.publicInventoryControls input,.publicInventoryControls select').length}});if(invD.tracks!==3||invD.cards!==5||invD.controls<4)fail('INVENTORY_DESKTOP',invD);await noOverflow(d,'INVENTORY_DESKTOP');result.boards.inventoryDesktop=invD;await d.screenshot({path:`${out}/inventory-desktop.png`,fullPage:true});

  await goto200(d,'/get-approved?owner-review=1','APPROVAL_DESKTOP');await d.locator('.approvalCard').waitFor({state:'visible',timeout:10000});const appD=await d.evaluate(()=>({tracks:tracks(document.querySelector('main.approvalBoard')),stages:document.querySelectorAll('.approvalStages button').length}));if(appD.tracks!==2||appD.stages!==3)fail('APPROVAL_DESKTOP',appD);result.boards.approvalDesktop=appD;await d.screenshot({path:`${out}/approval-desktop.png`,fullPage:true});

  const dealer=await dctx.newPage();watch(dealer);await wire(dealer);
  await goto200(dealer,'/dealer','DEALER_DESKTOP');await dealer.locator('.portalApp').waitFor({state:'visible',timeout:10000});const dash=await dealer.evaluate(()=>({app:tracks(document.querySelector('.portalApp')),metrics:tracks(document.querySelector('.metricGrid')),quick:tracks(document.querySelector('.quickActions'))}));if(dash.app!==2||dash.metrics!==4||dash.quick!==4)fail('DEALER_DESKTOP',dash);result.boards.dealerDesktop=dash;await dealer.screenshot({path:`${out}/dealer-desktop.png`,fullPage:true});
  await goto200(dealer,'/dealer/inventory','DEALER_INVENTORY_DESKTOP');await dealer.locator('.inventoryTable').waitFor({state:'visible',timeout:10000});await dealer.waitForFunction(()=>document.querySelectorAll('.inventoryRow').length>=5,null,{timeout:15000});const rows=await dealer.locator('.inventoryRow').count();if(rows<5)fail('DEALER_INVENTORY_DESKTOP',{rows});result.boards.dealerInventoryDesktop={rows};await dealer.screenshot({path:`${out}/dealer-inventory-desktop.png`,fullPage:true});
  await goto200(dealer,'/dealer/inventory/new','EDITOR_DESKTOP');await dealer.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});const cleanD=await dealer.evaluate(()=>{const v=n=>document.querySelector(`input[name="${n}"]`)?.value||'';return{year:v('year'),make:v('make'),model:v('model'),vin:v('vin'),steps:document.querySelectorAll('.stepper button').length,field:tracks(document.querySelector('.fieldGrid'))}});if(cleanD.year||cleanD.make||cleanD.model||cleanD.vin||cleanD.steps!==5||cleanD.field!==4)fail('EDITOR_DESKTOP_CLEAN',cleanD);await hitTargets(dealer,'.stepper button','EDITOR_DESKTOP_STEPS');await dealer.locator('.stepper button').nth(2).click();await dealer.locator('.photoTools').waitFor({state:'visible',timeout:5000});await hitTargets(dealer,'.photoTools button','EDITOR_DESKTOP_PHOTOS');result.boards.editorDesktop=cleanD;await dealer.screenshot({path:`${out}/editor-desktop.png`,fullPage:true});await dctx.close();

  const mctx=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/142 Mobile Safari/537.36'});const m=await mctx.newPage();watch(m);
  await goto200(m,'/?owner-review=1','HOME_MOBILE');await skipIntro(m);result.boards.homeMobileHeader=await publicHeader(m,true,'HOME_MOBILE');await m.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
  const hm=await m.evaluate(()=>{const q=s=>document.querySelector(s),R=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};const g=q('.rh-grid'),cards=[...g.children].map(R),ctas=[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(R);return{display:getComputedStyle(g).display,cards,ctas,menu:R(q('.rh-menu')),call:R(q('.rh-call')),benefits:tracks(q('.rh-benefits')),finance:tracks(q('.rh-steps')),trust:tracks(q('.rh-trust-grid'))}});if(hm.display!=='flex'||hm.cards.length!==5||hm.cards[0].w<330||hm.cards[0].w>370||hm.cards[1].x<350||hm.ctas.length!==2||hm.ctas[1].y<=hm.ctas[0].bottom||!hm.menu||hm.menu.w<38||!hm.call||hm.call.w<38||hm.benefits!==2||hm.finance!==1||hm.trust!==2)fail('HOME_MOBILE',hm);await m.locator('.rh-menu').click();if(await m.locator('.rh-menu').getAttribute('aria-expanded')!=='true'||!await m.locator('.rh-nav.open').count())fail('HOME_MOBILE_MENU');await m.locator('.rh-menu').click();await noOverflow(m,'HOME_MOBILE');result.boards.homeMobile=hm;await m.screenshot({path:`${out}/home-mobile.png`,fullPage:true});

  await goto200(m,'/inventory?owner-review=1','INVENTORY_MOBILE');await m.locator('.inventoryGrid>article').first().waitFor({state:'visible',timeout:10000});const invM=await m.evaluate(()=>{const g=document.querySelector('.inventoryGrid'),a=g.querySelector('article'),media=a.querySelector('a:first-child'),r=media.getBoundingClientRect();return{tracks:tracks(g),cards:g.children.length,articleDisplay:getComputedStyle(a).display,articleTracks:tracks(a),media:{w:r.width,h:r.height}}});if(invM.tracks!==1||invM.cards!==5||invM.articleDisplay!=='grid'||invM.articleTracks!==2||invM.media.w<110||invM.media.w>155)fail('INVENTORY_MOBILE',invM);await noOverflow(m,'INVENTORY_MOBILE');result.boards.inventoryMobile=invM;await m.screenshot({path:`${out}/inventory-mobile.png`,fullPage:true});

  await goto200(m,'/get-approved?owner-review=1','APPROVAL_MOBILE');await m.locator('.approvalCard').waitFor({state:'visible',timeout:10000});const appM=await m.evaluate(()=>({display:getComputedStyle(document.querySelector('main.approvalBoard')).display,stages:document.querySelectorAll('.approvalStages button').length}));if(appM.display!=='block'||appM.stages!==3)fail('APPROVAL_MOBILE',appM);result.boards.approvalMobile=appM;await m.screenshot({path:`${out}/approval-mobile.png`,fullPage:true});

  await wire(m);await goto200(m,'/dealer','DEALER_MOBILE');await m.locator('.portalApp').waitFor({state:'visible',timeout:10000});const dm=await m.evaluate(()=>({side:getComputedStyle(document.querySelector('.portalSide')).display,metrics:tracks(document.querySelector('.metricGrid')),dashboard:tracks(document.querySelector('.dashboardGrid')),bottom:tracks(document.querySelector('.portalBottom'))}));if(dm.side!=='none'||dm.metrics!==2||dm.dashboard!==1||dm.bottom!==5)fail('DEALER_MOBILE',dm);result.boards.dealerMobile=dm;await m.screenshot({path:`${out}/dealer-mobile.png`,fullPage:true});
  await goto200(m,'/dealer/inventory','DEALER_INVENTORY_MOBILE');await m.waitForFunction(()=>document.querySelectorAll('.inventoryRow').length>=5,null,{timeout:15000});const dim=await m.evaluate(()=>({rows:document.querySelectorAll('.inventoryRow').length,side:getComputedStyle(document.querySelector('.dcSide')).display,head:getComputedStyle(document.querySelector('.inventoryHead')).display,bottom:tracks(document.querySelector('.inventoryMobileNav'))}));if(dim.rows<5||dim.side!=='none'||dim.head!=='none'||dim.bottom!==5)fail('DEALER_INVENTORY_MOBILE',dim);result.boards.dealerInventoryMobile=dim;await m.screenshot({path:`${out}/dealer-inventory-mobile.png`,fullPage:true});
  await goto200(m,'/dealer/inventory/new','EDITOR_MOBILE');await m.locator('.editVehicleApp').waitFor({state:'visible',timeout:10000});const cleanM=await m.evaluate(()=>{const v=n=>document.querySelector(`input[name="${n}"]`)?.value||'';return{year:v('year'),make:v('make'),model:v('model'),side:getComputedStyle(document.querySelector('.editSide')).display,field:tracks(document.querySelector('.fieldGrid')),steps:document.querySelectorAll('.stepper button').length}});if(cleanM.year||cleanM.make||cleanM.model||cleanM.side!=='none'||cleanM.field!==1||cleanM.steps!==5)fail('EDITOR_MOBILE_CLEAN',cleanM);await hitTargets(m,'.stepper button','EDITOR_MOBILE_STEPS');await m.locator('.stepper button').nth(2).click();await m.locator('.photoTools').waitFor({state:'visible',timeout:5000});await hitTargets(m,'.photoTools button','EDITOR_MOBILE_PHOTOS');result.boards.editorMobile=cleanM;await m.screenshot({path:`${out}/editor-mobile.png`,fullPage:true});await mctx.close();

  const actx=await browser.newContext({viewport:{width:980,height:844},screen:{width:980,height:844},deviceScaleFactor:1,isMobile:false,hasTouch:true,userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36'});const a=await actx.newPage();watch(a);await goto200(a,'/?owner-review=1','ANDROID_DESKTOP_SITE');await skipIntro(a);const ah=await publicHeader(a,false,'ANDROID_DESKTOP_SITE');await a.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});const ad=await a.evaluate(()=>({featured:tracks(document.querySelector('.rh-grid')),overflow:document.documentElement.scrollWidth-innerWidth}));if(ad.featured<3||ad.featured>4||ad.overflow>2)fail('ANDROID_DESKTOP_SITE',ad);result.boards.androidDesktopSite={...ad,header:ah};await a.screenshot({path:`${out}/android-desktop-site.png`,fullPage:true});await actx.close();

  if(writes.length)fail('OWNER_BOARD_BROWSER_WRITES',{writes});result.pass=true;fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');console.log('WDCC_OWNER_CONTROL_CONTRACT_PASS',JSON.stringify({sha,boards:Object.keys(result.boards),writes:writes.length}));
}catch(error){fs.writeFileSync(`${out}/failure.json`,JSON.stringify({sha,url:base,error:String(error?.stack||error),writes},null,2)+'\n');throw error}finally{await browser.close()}
