import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.R31_BASE_URL || 'http://127.0.0.1:3000';
const out = process.env.R31_QA_OUT || 'artifacts/r31-local-visual';
await fs.mkdir(out,{recursive:true});

const browser = await chromium.launch({headless:true});
const report = {base,generatedAt:new Date().toISOString(),viewports:{},assetChecks:{},inventory:null,errors:[]};

async function bytes(path){
  const r=await fetch(base+path,{redirect:'manual'});
  const b=Buffer.from(await r.arrayBuffer());
  return {status:r.status,bytes:b.length,magic:b.subarray(0,4).toString('ascii')};
}
report.assetChecks.logo=await bytes('/wdcc-logo-transparent.webp');
report.assetChecks.hero=await bytes('/wdcc-hero-v2.webp');
if(report.assetChecks.logo.status!==200||report.assetChecks.logo.magic!=='RIFF') throw new Error('canonical_logo_not_served');
if(report.assetChecks.hero.status!==200||report.assetChecks.hero.magic!=='RIFF') throw new Error('canonical_hero_not_served');

const invResp=await fetch(base+'/api/inventory',{headers:{accept:'application/json'}});
const invJson=await invResp.json().catch(()=>({}));
report.inventory={status:invResp.status,count:Array.isArray(invJson.items)?invJson.items.length:null,error:invJson.error||null};

for(const cfg of [
  {name:'desktop',width:1440,height:1000},
  {name:'tablet',width:820,height:1180},
  {name:'mobile',width:390,height:844},
]){
  const context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1});
  const page=await context.newPage();
  const consoleErrors=[]; const pageErrors=[]; const failed=[];
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('requestfailed',r=>failed.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'failed'}`));

  const response=await page.goto(base+'/r31-preview',{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()>=400) throw new Error(`${cfg.name}_route_${response?.status()||'no_response'}`);

  await page.waitForTimeout(650);
  await page.screenshot({path:`${out}/${cfg.name}-intro-reveal.png`,fullPage:false});
  const revealBadge=await page.locator('.intro-badge').boundingBox().catch(()=>null);

  await page.waitForTimeout(1350);
  await page.screenshot({path:`${out}/${cfg.name}-intro-dock.png`,fullPage:false});
  const dockBadge=await page.locator('.intro-badge').boundingBox().catch(()=>null);
  const headerLogo=await page.locator('.logoBrand img').boundingBox().catch(()=>null);

  await page.waitForTimeout(1150);
  await page.getByRole('heading',{name:/BAD CREDIT/i}).waitFor({state:'visible',timeout:10000});
  await page.screenshot({path:`${out}/${cfg.name}-hero.png`,fullPage:false});
  await page.screenshot({path:`${out}/${cfg.name}-full.png`,fullPage:true});

  const cards=await page.locator('.grid .card').count();
  const headerLogoLoaded=await page.locator('.logoBrand img').evaluate((el)=>el.complete&&el.naturalWidth>0).catch(()=>false);
  const hasHero=await page.locator('main').getByText("WE DON'T CARE.",{exact:false}).count();
  const stickyVisible=cfg.width<=900?await page.locator('.stickyCtaBar').isVisible().catch(()=>false):null;

  report.viewports[cfg.name]={
    viewport:{width:cfg.width,height:cfg.height},
    revealBadge,dockBadge,headerLogo,cards,headerLogoLoaded,hasHero:Boolean(hasHero),stickyVisible,
    consoleErrors,pageErrors,failedRequests:failed
  };
  if(pageErrors.length) report.errors.push(...pageErrors.map(x=>`${cfg.name}: ${x}`));
  await context.close();
}

await browser.close();
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));

if(!report.viewports.desktop.headerLogoLoaded) throw new Error('desktop_logo_not_loaded');
if(!report.viewports.desktop.hasHero) throw new Error('desktop_hero_copy_missing');
if(!report.viewports.mobile.stickyVisible) throw new Error('mobile_sticky_cta_missing');
if(report.errors.length) throw new Error(`page_errors:${report.errors.join('|')}`);
console.log(JSON.stringify(report,null,2));
