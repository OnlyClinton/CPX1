import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL||'http://127.0.0.1:4175';
const out=process.env.OUT||'responsive-audit';
fs.mkdirSync(out,{recursive:true});

const customerVisible=v=>String(v?.status||'').toLowerCase()==='published'&&v?.internalOnly!==true&&!['internal','dealer_only'].includes(String(v?.visibility||'').toLowerCase())&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/i.test(String(v?.stock||v?.stock_id||''));
let realId='';
try{
  const r=await fetch(`${base}/api/inventory?vehicle-page-audit=${Date.now()}`);
  if(r.ok){
    const j=await r.json().catch(()=>({}));
    const items=(Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[]).filter(customerVisible);
    realId=String(items[0]?.id||items[0]?.slug||'');
  }
}catch{}

const target=realId?`/vehicle/${encodeURIComponent(realId)}`:'/vehicle/__responsive-audit-unavailable__';
const expected=realId?'.vehicleSummary':'.vehicleUnavailable';
const mode=realId?'canonical-vehicle':'honest-unavailable-fallback';
const writes=[];
const captures=[];
const browser=await chromium.launch({headless:true});

try{
  for(const spec of [{name:'desktop',viewport:{width:1440,height:1000},mobile:false},{name:'mobile',viewport:{width:390,height:844},mobile:true}]){
    const ctx=await browser.newContext({viewport:spec.viewport,isMobile:spec.mobile,hasTouch:spec.mobile,deviceScaleFactor:1});
    const page=await ctx.newPage();
    page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))writes.push({method:r.method(),url:r.url()})});
    const response=await page.goto(`${base}${target}?vehicle-page-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    if(!response||response.status()>=400)throw new Error(`VEHICLE_PAGE_HTTP_${response?.status()||0}_${spec.name}`);
    await page.locator(expected).waitFor({state:'visible',timeout:12000});
    await page.waitForTimeout(250);
    const metrics=await page.evaluate(({expected,mobile})=>{
      const root=document.querySelector(expected);
      const overflow=document.documentElement.scrollWidth-innerWidth;
      const links=[...root.querySelectorAll('a')].filter(a=>{const r=a.getBoundingClientRect(),s=getComputedStyle(a);return r.width>1&&r.height>1&&s.display!=='none'&&s.visibility!=='hidden'}).map(a=>{const r=a.getBoundingClientRect();return{text:(a.textContent||'').trim(),w:r.width,h:r.height,href:a.getAttribute('href')||''}});
      const h2=root.querySelector('h2');
      return{overflow,docW:document.documentElement.scrollWidth,winW:innerWidth,heading:(h2?.textContent||'').trim(),headingFont:h2?parseFloat(getComputedStyle(h2).fontSize)||0:0,links,mobile};
    },{expected,mobile:spec.mobile});
    if(metrics.overflow>2)throw new Error(`VEHICLE_PAGE_HORIZONTAL_OVERFLOW_${spec.name}_${metrics.overflow}`);
    if(!metrics.heading||metrics.headingFont<(spec.mobile?24:26))throw new Error(`VEHICLE_PAGE_HEADING_BAD_${spec.name}_${JSON.stringify(metrics)}`);
    if(realId){
      if(metrics.links.length!==2)throw new Error(`VEHICLE_PAGE_PRIMARY_ACTION_COUNT_BAD_${spec.name}_${metrics.links.length}`);
      const labels=metrics.links.map(x=>x.text.toUpperCase());
      if(!labels.some(x=>x.includes('SCHEDULE TEST DRIVE'))||!labels.some(x=>x.includes('CALL SEAN')))throw new Error(`VEHICLE_PAGE_PRIMARY_ACTIONS_BAD_${spec.name}_${JSON.stringify(metrics.links)}`);
    }else if(metrics.links.length<2)throw new Error(`VEHICLE_PAGE_FALLBACK_ACTIONS_MISSING_${spec.name}_${metrics.links.length}`);
    if(spec.mobile&&metrics.links.some(x=>x.h<46))throw new Error(`VEHICLE_PAGE_MOBILE_ACTION_HEIGHT_${JSON.stringify(metrics.links)}`);
    const screenshot=`${out}/${spec.name}-vehicle-detail.png`;
    await page.screenshot({path:screenshot,fullPage:true});
    captures.push({viewport:spec.name,target,mode,expected,metrics,screenshot});
    await ctx.close();
  }
}finally{await browser.close()}

if(writes.length)throw new Error(`VEHICLE_PAGE_AUDIT_WRITES_${writes.length}`);
fs.writeFileSync(`${out}/vehicle-page-audit.json`,JSON.stringify({sha:process.env.GITHUB_SHA||'',mode,target,expected,realId:realId||null,captures,writes},null,2)+'\n');
console.log(`VEHICLE_PAGE_AUDIT PASS mode=${mode} target=${target} captures=${captures.length} writes=${writes.length}`);
