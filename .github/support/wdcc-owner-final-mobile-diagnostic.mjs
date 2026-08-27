import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.URL;if(!base)throw new Error('URL_REQUIRED');
const out='owner-final-lock-proof';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),p=await ctx.newPage();
 for(let i=0;i<15;i++){const r=await p.goto(`${base}/?owner-review=1&mdiag=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);if(r?.status()===200)break;await p.waitForTimeout(1000)}
 const intro=p.locator('.li');if(await intro.count()){const b=p.getByRole('button',{name:/skip intro/i});if(await b.count())await b.click().catch(()=>{});await intro.waitFor({state:'detached',timeout:7000}).catch(()=>{})}
 await p.locator('img[data-wdcc-logo-art="owner-approved"]').waitFor({state:'visible',timeout:10000});await p.locator('.rh-grid>article').first().waitFor({state:'visible',timeout:10000});
 const diag=await p.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const x=e?.getBoundingClientRect();return x?{x:x.x,y:x.y,w:x.width,h:x.height,right:x.right,bottom:x.bottom}:null},grid=q('.rh-grid'),utility=q('[data-wdcc-public-chrome="utility"]');return{header:r(q('[data-wdcc-public-chrome="header"]')),logo:r(q('img[data-wdcc-logo-art="owner-approved"]')),menu:r(q('.rh-menu')),call:r(q('.rh-call')),utilityDisplay:getComputedStyle(utility).display,hero:r(q('.rh-hero')),headline:r(q('.rh-copy h1')),proof:r(q('.rh-proof-copy')),ctas:[...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(r),phone:r(q('.rh-phone')),benefitsColumns:getComputedStyle(q('.rh-benefits')).gridTemplateColumns,benefit:r(q('.rh-benefit')),gridDisplay:getComputedStyle(grid).display,cards:[...grid.children].map(r),financeColumns:getComputedStyle(q('.rh-steps')).gridTemplateColumns,trustColumns:getComputedStyle(q('.rh-trust-grid')).gridTemplateColumns,overflow:document.documentElement.scrollWidth-innerWidth}});
 fs.writeFileSync(`${out}/mobile-diagnostic.json`,JSON.stringify(diag,null,2)+'\n');await p.screenshot({path:`${out}/mobile-diagnostic.png`,fullPage:true});console.log('WDCC_MOBILE_DIAGNOSTIC',JSON.stringify(diag));await ctx.close();
}finally{await browser.close()}
