import fs from "node:fs";
import {chromium} from "playwright";

const base="http://localhost:3000";
const out=process.env.WDCC_PROOF_OUT||"wdcc-preview-proof-v5";
fs.mkdirSync(out,{recursive:true});

const report={sha:process.env.GITHUB_SHA||"local",desktop:null,mobile:null,consoleErrors:[],httpErrors:[],requestFailures:[],abortedPrefetches:[],failure:null};
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const visibleMetrics=async page=>page.evaluate(()=>{
  const root=document.querySelector("main")||document.body;
  const nodes=[...root.querySelectorAll("*")].filter(el=>{
    const style=getComputedStyle(el),box=el.getBoundingClientRect();
    if(box.width<=0||box.height<=0||style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return false;
    return [...el.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||"").trim());
  });
  const fonts=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)).filter(n=>Number.isFinite(n)&&n>0&&n<80);
  return {minFont:fonts.length?Math.min(...fonts):0,horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-window.innerWidth)};
});
const watch=(page,label)=>{
  page.on("console",m=>{if(m.type()==="error")report.consoleErrors.push(`${label}: ${m.text()}`);});
  page.on("pageerror",e=>report.consoleErrors.push(`${label}: pageerror: ${String(e)}`));
  page.on("response",r=>{if(r.status()>=400&&new URL(r.url()).pathname!=="/favicon.ico")report.httpErrors.push(`${label}: HTTP ${r.status()} ${r.url()}`);});
  page.on("requestfailed",r=>{
    const detail=r.failure()?.errorText||"unknown",entry=`${label}: ${detail} ${r.url()}`;
    if(/ERR_ABORTED|NS_BINDING_ABORTED/i.test(detail))report.abortedPrefetches.push(entry);else report.requestFailures.push(entry);
  });
};

let browser=null;
try{
  browser=await chromium.launch({headless:true});
  const auth=await browser.newContext({viewport:{width:1440,height:1000}});
  let response=await auth.request.post(`${base}/api/auth/login`,{data:{username:"dealer",password:process.env.PREVIEW_PASSWORD||"preview-only-password"}});
  const login=await response.json().catch(()=>({}));
  assert(response.status()===200&&login?.ok===true&&login?.user?.id==="exact-dealer",`EDITOR_AUTH_${response.status()}_${JSON.stringify(login)}`);
  const storageState=await auth.storageState();
  await auth.close();

  async function run(viewport,label){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:label==="mobile",hasTouch:label==="mobile",storageState});
    const page=await context.newPage();
    watch(page,label);
    const metrics={};
    const nav=await page.goto(`${base}/dealer/inventory/new`,{waitUntil:"domcontentloaded",timeout:25000});
    assert(nav?.status()===200,`${label}_EDITOR_HTTP_${nav?.status()}`);
    await page.waitForTimeout(600);
    assert(await page.locator('[data-wizard-stage="info"]').count()===1,`${label}_INFO_MISSING`);

    await page.locator('input[name="year"]').fill("2024");
    await page.locator('input[name="make"]').fill("Toyota");
    await page.locator('input[name="model"]').fill("Camry");
    await page.locator('input[name="trim"]').fill("SE");
    await page.screenshot({path:`${out}/${label}-dealer-editor-01-info.png`,fullPage:true});
    metrics.info=await visibleMetrics(page);

    await page.locator('.wizardNav .next').click();
    await page.locator('[data-wizard-stage="pricing"]').waitFor({state:"visible"});
    await page.locator('input[name="price"]').fill("23995");
    await page.locator('input[name="downPayment"]').fill("3500");
    await page.locator('input[name="mileage"]').fill("32150");
    await page.locator('input[name="stock"]').fill(`VISUAL-${label.toUpperCase()}`);
    await page.screenshot({path:`${out}/${label}-dealer-editor-02-pricing.png`,fullPage:true});
    metrics.pricing=await visibleMetrics(page);

    await page.locator('.wizardNav .next').click();
    await page.locator('[data-wizard-stage="photos"]').waitFor({state:"visible"});
    const fileInput=page.locator('input[accept="image/jpeg,image/png,image/webp,image/avif"]');
    await fileInput.setInputFiles("public/wdcc-hero-v2.webp");
    await page.locator('.thumbGrid .thumb img').waitFor({state:"visible"});
    assert(await page.locator('.thumbGrid .thumb').count()===1,`${label}_PHOTO_PREVIEW_COUNT`);
    await page.screenshot({path:`${out}/${label}-dealer-editor-03-photos.png`,fullPage:true});
    metrics.photos=await visibleMetrics(page);

    await page.locator('.wizardNav .next').click();
    await page.locator('[data-wizard-stage="details"]').waitFor({state:"visible"});
    await page.locator('textarea').fill("Clean preview-only dealer listing used to validate the complete vehicle editor experience.");
    await page.screenshot({path:`${out}/${label}-dealer-editor-04-details.png`,fullPage:true});
    metrics.details=await visibleMetrics(page);

    await page.locator('.wizardNav .next').click();
    await page.locator('[data-wizard-stage="review"]').waitFor({state:"visible"});
    assert((await page.locator('[data-wizard-stage="review"]').innerText()).includes("2024 Toyota Camry"),`${label}_REVIEW_IDENTITY`);
    assert((await page.locator('[data-wizard-stage="review"]').innerText()).includes("1"),`${label}_REVIEW_PHOTO_COUNT`);
    await page.screenshot({path:`${out}/${label}-dealer-editor-05-review.png`,fullPage:true});
    metrics.review=await visibleMetrics(page);

    const previewButton=page.locator('.wizardNav button').filter({hasText:"Preview"}).first();
    await previewButton.click();
    await page.locator('.previewModal').waitFor({state:"visible"});
    assert((await page.locator('.previewModal').innerText()).includes("2024 Toyota Camry SE"),`${label}_PREVIEW_IDENTITY`);
    await page.screenshot({path:`${out}/${label}-dealer-editor-06-preview-modal.png`,fullPage:false});
    metrics.preview=await visibleMetrics(page);
    await page.locator('.closePreview').click();

    if(label==="mobile"){
      for(const [stage,value] of Object.entries(metrics)){
        assert(value.minFont>=8,`MOBILE_EDITOR_${stage.toUpperCase()}_MICROTYPE_${value.minFont}`);
        assert(value.horizontalOverflow<=2,`MOBILE_EDITOR_${stage.toUpperCase()}_OVERFLOW_${value.horizontalOverflow}`);
      }
    }
    await context.close();
    return metrics;
  }

  report.desktop=await run({width:1440,height:1000},"desktop");
  report.mobile=await run({width:390,height:844},"mobile");
  assert(report.consoleErrors.length===0,`EDITOR_CONSOLE_ERRORS_${JSON.stringify(report.consoleErrors)}`);
  assert(report.httpErrors.length===0,`EDITOR_HTTP_ERRORS_${JSON.stringify(report.httpErrors)}`);
  assert(report.requestFailures.length===0,`EDITOR_REQUEST_FAILURES_${JSON.stringify(report.requestFailures)}`);
}catch(error){
  report.failure=String(error instanceof Error?error.message:error);
  throw error;
}finally{
  fs.writeFileSync(`${out}/editor-wizard-report.json`,JSON.stringify(report,null,2)+"\n");
  if(browser)await browser.close().catch(()=>{});
}
