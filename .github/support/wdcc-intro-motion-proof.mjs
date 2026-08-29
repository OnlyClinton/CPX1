import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL,sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage();
  const response=await page.goto(`${base}/?owner-animation=1&intro-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw new Error(`INTRO_HTTP_${response?.status()||0}`);
  await page.locator('.li[data-wdcc-intro-ready="true"]').waitFor({state:'visible',timeout:12000});
  await page.waitForTimeout(180);
  const first=await page.evaluate(()=>{const root=document.querySelector('.li'),front=document.querySelector('.li-wheel-front'),badge=document.querySelector('.li-badge');return{motion:root?.getAttribute('data-wdcc-intro-motion'),spin:getComputedStyle(root).getPropertyValue('--li-spin').trim(),wheel:getComputedStyle(front).transform,badgeOpacity:Number(getComputedStyle(badge).opacity),intro:!!root}});
  await page.screenshot({path:`${out}/mobile-intro-motion-start.png`,fullPage:true});
  await page.waitForTimeout(520);
  const second=await page.evaluate(()=>{const root=document.querySelector('.li'),front=document.querySelector('.li-wheel-front'),badge=document.querySelector('.li-badge'),smoke=document.querySelector('.li-smoke');return{motion:root?.getAttribute('data-wdcc-intro-motion'),spin:getComputedStyle(root).getPropertyValue('--li-spin').trim(),wheel:getComputedStyle(front).transform,badgeOpacity:Number(getComputedStyle(badge).opacity),smokeOpacity:Number(getComputedStyle(smoke).opacity),intro:!!root}});
  await page.screenshot({path:`${out}/mobile-intro-motion-active.png`,fullPage:true});
  if(!first.intro||!second.intro||first.motion!=='full'||second.motion!=='full'||!first.spin||!second.spin||first.spin===second.spin||first.wheel===second.wheel||second.badgeOpacity<.35)throw new Error(`INTRO_MOTION_FAIL ${JSON.stringify({first,second})}`);
  fs.writeFileSync(`${out}/intro-motion-result.json`,JSON.stringify({sha,url:base,first,second,pass:true},null,2));
  console.log(JSON.stringify({sha,first,second,pass:true},null,2));
}finally{await browser.close();}
