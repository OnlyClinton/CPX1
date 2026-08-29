import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL,sha=process.env.GITHUB_SHA;
if(!base||!sha||!base.includes(sha))throw new Error(`NOT_EXACT_SHA ${base||''} ${sha||''}`);
const out='frozen-final-proof';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});

async function openIntro(page,prefix){
  let response=null;
  for(let i=0;i<15;i++){
    response=await page.goto(`${base}/?owner-animation=1&intro-proof=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    if(response?.status()===200)return;
    await page.waitForTimeout(1000);
  }
  throw new Error(`${prefix.toUpperCase()}_INTRO_HTTP_${response?.status()||0}`);
}

async function sample(page){
  return page.evaluate(()=>{
    const root=document.querySelector('.li'),scene=document.querySelector('.li-scene img'),badge=document.querySelector('.li-badge'),one=document.querySelector('.li-smoke-one'),two=document.querySelector('.li-smoke-two');
    if(!root||!scene||!badge)return null;
    const t=getComputedStyle(scene).transform;
    let scale=0;
    try{scale=new DOMMatrixReadOnly(t).a}catch{}
    return{
      motion:root.getAttribute('data-wdcc-intro-motion'),
      phase:root.getAttribute('data-wdcc-intro-v32-phase'),
      legacyPhase:root.getAttribute('data-wdcc-intro-phase'),
      benchmark:root.getAttribute('data-wdcc-intro-benchmark'),
      sceneTransform:t,
      sceneScale:scale,
      sceneAnimation:getComputedStyle(scene).animationName,
      badgeOpacity:Number(getComputedStyle(badge).opacity),
      badgeAnimation:getComputedStyle(badge).animationName,
      smokeOne:Number(one?getComputedStyle(one).opacity:0),
      smokeTwo:Number(two?getComputedStyle(two).opacity:0),
      badgeWidth:badge.getBoundingClientRect().width
    };
  });
}

async function prove(viewport,prefix){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage();
  try{
    await openIntro(page,prefix);
    await page.locator('.li[data-wdcc-intro-ready="true"]').waitFor({state:'visible',timeout:12000});

    await page.waitForTimeout(180);
    const start=await sample(page);
    await page.screenshot({path:`${out}/${prefix}-intro-v32-start.png`,fullPage:true});

    await page.waitForTimeout(700);
    const active=await sample(page);
    await page.screenshot({path:`${out}/${prefix}-intro-v32-active.png`,fullPage:true});

    await page.waitForFunction(()=>document.querySelector('.li')?.getAttribute('data-wdcc-intro-v32-phase')==='reveal',null,{timeout:2500});
    await page.waitForTimeout(600);
    const reveal=await sample(page);
    await page.screenshot({path:`${out}/${prefix}-intro-v32-reveal.png`,fullPage:true});

    if(!start||!active||!reveal)throw new Error(`${prefix.toUpperCase()}_INTRO_SAMPLE_MISSING`);
    if(start.motion!=='full'||active.motion!=='full'||reveal.motion!=='full'||start.phase!=='impact'||reveal.phase!=='reveal'||start.benchmark!=='wdcc-v32-storefront')throw new Error(`${prefix.toUpperCase()}_INTRO_PHASE_FAIL ${JSON.stringify({start,active,reveal})}`);
    if(start.sceneAnimation!=='liV32Scene'||active.sceneAnimation!=='liV32Scene'||start.badgeAnimation!=='liV32Badge')throw new Error(`${prefix.toUpperCase()}_V32_ANIMATION_NAMES_FAIL ${JSON.stringify({start,active})}`);
    if(!start.sceneScale||!active.sceneScale||!reveal.sceneScale||start.sceneScale-reveal.sceneScale<.025||start.sceneTransform===active.sceneTransform||active.sceneTransform===reveal.sceneTransform)throw new Error(`${prefix.toUpperCase()}_SCENE_PUSH_FAIL ${JSON.stringify({start,active,reveal})}`);
    if(active.badgeOpacity<.75||reveal.badgeOpacity<.95)throw new Error(`${prefix.toUpperCase()}_BADGE_RESOLVE_FAIL ${JSON.stringify({start,active,reveal})}`);
    if(Math.max(active.smokeOne,active.smokeTwo)<.12)throw new Error(`${prefix.toUpperCase()}_SMOKE_MOTION_FAIL ${JSON.stringify({start,active,reveal})}`);
    if(prefix==='mobile'&&(active.badgeWidth<120||active.badgeWidth>235))throw new Error(`MOBILE_BADGE_SIZE_FAIL ${JSON.stringify(active)}`);
    if(prefix==='desktop'&&(active.badgeWidth<180||active.badgeWidth>305))throw new Error(`DESKTOP_BADGE_SIZE_FAIL ${JSON.stringify(active)}`);

    await page.locator('.li').waitFor({state:'detached',timeout:4000});
    await page.screenshot({path:`${out}/${prefix}-intro-v32-complete.png`,fullPage:true});
    return{start,active,reveal,completed:true};
  }finally{await context.close()}
}

try{
  const mobile=await prove({width:390,height:844},'mobile');
  const desktop=await prove({width:1440,height:1000},'desktop');
  const result={sha,url:base,benchmark:'wdcc-v32-storefront',mobile,desktop,pass:true};
  fs.writeFileSync(`${out}/intro-motion-result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
