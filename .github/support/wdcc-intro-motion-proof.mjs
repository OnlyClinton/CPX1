import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL,sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});

async function prove(viewport,prefix){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage();
  try{
    const response=await page.goto(`${base}/?owner-animation=1&intro-proof=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200)throw new Error(`${prefix.toUpperCase()}_INTRO_HTTP_${response?.status()||0}`);
    await page.locator('.li[data-wdcc-intro-ready="true"]').waitFor({state:'visible',timeout:12000});
    await page.waitForFunction(()=>document.querySelector('.li')?.getAttribute('data-wdcc-intro-phase')==='move',null,{timeout:5000});
    await page.waitForTimeout(420);
    const center=await page.evaluate(()=>{
      const root=document.querySelector('.li'),scene=document.querySelector('.li-scene img'),badge=document.querySelector('.li-badge');
      const r=badge?.getBoundingClientRect();
      return{motion:root?.getAttribute('data-wdcc-intro-motion'),phase:root?.getAttribute('data-wdcc-intro-phase'),sceneTransform:scene?getComputedStyle(scene).transform:'',badge:r?{left:r.left,top:r.top,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}:null,viewport:{w:innerWidth,h:innerHeight}};
    });
    await page.screenshot({path:`${out}/${prefix}-intro-center.png`,fullPage:true});

    await page.waitForFunction(()=>document.querySelector('.li')?.getAttribute('data-wdcc-intro-phase')==='handoff',null,{timeout:5000});
    await page.waitForTimeout(700);
    const handoff=await page.evaluate(()=>{
      const root=document.querySelector('.li'),scene=document.querySelector('.li-scene img'),badge=document.querySelector('.li-badge');
      const r=badge?.getBoundingClientRect();
      return{motion:root?.getAttribute('data-wdcc-intro-motion'),phase:root?.getAttribute('data-wdcc-intro-phase'),sceneTransform:scene?getComputedStyle(scene).transform:'',badge:r?{left:r.left,top:r.top,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}:null,viewport:{w:innerWidth,h:innerHeight}};
    });
    await page.screenshot({path:`${out}/${prefix}-intro-handoff.png`,fullPage:true});

    if(center.motion!=='full'||handoff.motion!=='full'||center.phase!=='move'||handoff.phase!=='handoff'||!center.badge||!handoff.badge)throw new Error(`${prefix.toUpperCase()}_INTRO_PHASE_FAIL ${JSON.stringify({center,handoff})}`);
    if(center.sceneTransform===handoff.sceneTransform)throw new Error(`${prefix.toUpperCase()}_SCENE_DID_NOT_MOVE ${JSON.stringify({center,handoff})}`);
    if(center.badge.width<150||handoff.badge.width>70||center.badge.width-handoff.badge.width<90)throw new Error(`${prefix.toUpperCase()}_BADGE_DID_NOT_SHRINK ${JSON.stringify({center:center.badge,handoff:handoff.badge})}`);
    if(center.badge.cy-handoff.badge.cy<120)throw new Error(`${prefix.toUpperCase()}_BADGE_DID_NOT_TRAVEL ${JSON.stringify({center:center.badge,handoff:handoff.badge})}`);
    if(prefix==='mobile'&&Math.abs(handoff.badge.cx-handoff.viewport.w/2)>8)throw new Error(`MOBILE_BADGE_NOT_HEADER_CENTER ${JSON.stringify(handoff)}`);
    if(prefix==='desktop'&&handoff.badge.cx>120)throw new Error(`DESKTOP_BADGE_NOT_HEADER_LEFT ${JSON.stringify(handoff)}`);

    await page.locator('.li').waitFor({state:'detached',timeout:5000});
    await page.screenshot({path:`${out}/${prefix}-intro-complete.png`,fullPage:true});
    return{center,handoff,completed:true};
  }finally{await context.close()}
}

try{
  const mobile=await prove({width:390,height:844},'mobile');
  const desktop=await prove({width:1440,height:1000},'desktop');
  const result={sha,url:base,mobile,desktop,pass:true};
  fs.writeFileSync(`${out}/intro-motion-result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
