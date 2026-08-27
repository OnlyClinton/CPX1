import fs from "node:fs";
import {chromium,request as requestFactory} from "playwright";

const base="http://localhost:3000";
const bad="http://localhost:3001";
const out=process.env.WDCC_PROOF_OUT||"wdcc-preview-proof-v4";
fs.mkdirSync(out,{recursive:true});

const report={
  sha:process.env.GITHUB_SHA||"local",
  functional:[],
  consoleErrors:[],
  httpErrors:[],
  requestFailures:[],
  abortedPrefetches:[],
  metrics:{},
  failure:null
};

const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const json=async response=>response.json().catch(()=>({}));
const ignoredHttp=url=>{try{return new URL(url).pathname==="/favicon.ico";}catch{return false;}};
const watch=(page,label)=>{
  page.on("console",message=>{
    if(message.type()==="error")report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror",error=>report.consoleErrors.push(`${label}: pageerror: ${String(error)}`));
  page.on("response",response=>{
    if(response.status()>=400&&!ignoredHttp(response.url()))report.httpErrors.push(`${label}: HTTP ${response.status()} ${response.url()}`);
  });
  page.on("requestfailed",request=>{
    const detail=request.failure()?.errorText||"unknown";
    const entry=`${label}: ${detail} ${request.url()}`;
    if(/ERR_ABORTED|NS_BINDING_ABORTED/i.test(detail))report.abortedPrefetches.push(entry);
    else report.requestFailures.push(entry);
  });
};
const visibleTextMetrics=async(page,selector)=>page.evaluate(sel=>{
  const root=document.querySelector(sel)||document.body;
  const nodes=[...root.querySelectorAll("*")].filter(el=>{
    const style=getComputedStyle(el),box=el.getBoundingClientRect();
    if(box.width<=0||box.height<=0||style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return false;
    const own=[...el.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||"").trim());
    return own;
  });
  const fontSizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)).filter(n=>Number.isFinite(n)&&n>0&&n<80);
  const small=nodes.map(el=>({
    tag:el.tagName.toLowerCase(),
    cls:String(el.className||"").slice(0,120),
    text:String(el.textContent||"").trim().replace(/\s+/g," ").slice(0,90),
    font:parseFloat(getComputedStyle(el).fontSize)
  })).filter(x=>Number.isFinite(x.font)).sort((a,b)=>a.font-b.font).slice(0,12);
  return {
    minFont:fontSizes.length?Math.min(...fontSizes):0,
    scrollWidth:document.documentElement.scrollWidth,
    innerWidth:window.innerWidth,
    horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-window.innerWidth),
    smallest:small
  };
},selector);

let browser=null;
let dealer=null;
let anonymous=null;
try{
  browser=await chromium.launch({headless:true});
  dealer=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const api=dealer.request;

  let response=await api.post(`${base}/api/auth/login`,{data:{username:"dealer",password:process.env.PREVIEW_PASSWORD||"preview-only-password"}});
  let body=await json(response);
  assert(response.status()===200&&body?.ok===true&&body?.user?.id==="exact-dealer",`AUTH_LOGIN_${response.status()}_${JSON.stringify(body)}`);
  response=await api.get(`${base}/api/auth/session`);
  body=await json(response);
  assert(response.status()===200&&body?.authenticated===true&&body?.user?.id==="exact-dealer",`AUTH_SESSION_${response.status()}_${JSON.stringify(body)}`);
  report.functional.push("real_login_session_route_exact_identity");

  const stock=`WDCC-QA-PREVIEW-${Date.now()}`;
  response=await api.post(`${base}/api/inventory`,{data:{year:2022,make:"WDCC",model:"Conflict Retry",price:19995,downPayment:2500,mileage:12345,stock,internalOnly:true,description:"automated temporary qa vehicle preview-only"}});
  body=await json(response);
  assert(response.status()===201&&body?.item?.id&&body?.mutationAttempt===2,`CREATE_RETRY_${response.status()}_${JSON.stringify(body)}`);
  const id=String(body.item.id);
  report.functional.push("conflict_retry_create");

  const image=fs.readFileSync("public/wdcc-hero-v2.webp");
  response=await api.post(`${base}/api/upload`,{multipart:{vehicleId:id,requestId:`upload-${Date.now()}`,file:{name:"proof.webp",mimeType:"image/webp",buffer:image}}});
  body=await json(response);
  assert(response.status()===200&&body?.ok===true&&body?.checkpointed===true&&body?.pathname,`UPLOAD_${response.status()}_${JSON.stringify(body)}`);
  const pathname=String(body.pathname);
  response=await api.get(`${base}/api/inventory/${id}`);
  body=await json(response);
  assert(response.status()===200&&body?.item?.photoPathnames?.includes(pathname)&&body?.item?.primaryPhotoPathname===pathname,`CHECKPOINT_${response.status()}_${JSON.stringify(body)}`);
  response=await api.get(`${base}/api/media?p=${encodeURIComponent(pathname)}`);
  assert(response.status()===200&&(await response.body()).length===image.length,`MEDIA_READ_${response.status()}`);
  report.functional.push("media_upload_checkpoint_readback");

  response=await api.patch(`${base}/api/inventory/${id}`,{data:{status:"published",internalOnly:true,visibility:"internal"}});
  body=await json(response);
  assert(response.status()===200&&body?.storefront?.verified===true&&body?.storefront?.expected==="hidden",`INTERNAL_PUBLISH_${response.status()}_${JSON.stringify(body)}`);
  anonymous=await requestFactory.newContext({baseURL:base});
  response=await anonymous.get("/api/inventory");
  body=await json(response);
  assert(response.status()===200&&!body?.items?.some(vehicle=>String(vehicle?.id)===id),`PUBLIC_ISOLATION_${response.status()}_${JSON.stringify(body)}`);
  report.functional.push("publish_verified_hidden_public_isolation");

  const partialStock=`WDCC-QA-PARTIAL-${Date.now()}`;
  response=await api.post(`${base}/api/inventory`,{data:{year:2021,make:"WDCC",model:"Partial Media",price:15500,downPayment:2000,mileage:22000,stock:partialStock,internalOnly:true,description:"automated temporary qa vehicle preview-only"}});
  body=await json(response);
  assert(response.status()===201&&body?.item?.id,`PARTIAL_CREATE_${response.status()}_${JSON.stringify(body)}`);
  const partialId=String(body.item.id);
  response=await api.post(`${base}/api/upload`,{multipart:{vehicleId:partialId,requestId:"partial-1",file:{name:"first.webp",mimeType:"image/webp",buffer:image}}});
  body=await json(response);
  assert(response.status()===200&&body?.checkpointed===true&&body?.pathname,`PARTIAL_FIRST_${response.status()}_${JSON.stringify(body)}`);
  const firstPath=String(body.pathname);
  await fetch("http://127.0.0.1:4102/__control/fail-next",{method:"POST",headers:{Authorization:"Bearer preview-media-token"}});
  response=await api.post(`${base}/api/upload`,{multipart:{vehicleId:partialId,requestId:"partial-2",file:{name:"second.webp",mimeType:"image/webp",buffer:image}}});
  body=await json(response);
  assert(response.status()>=400&&String(body?.error||"").includes("media_provider_failed"),`PARTIAL_SECOND_${response.status()}_${JSON.stringify(body)}`);
  response=await api.get(`${base}/api/inventory/${partialId}`);
  body=await json(response);
  assert(response.status()===200&&body?.item?.photoPathnames?.length===1&&body?.item?.photoPathnames?.[0]===firstPath,`PARTIAL_PRESERVE_${response.status()}_${JSON.stringify(body)}`);
  report.functional.push("partial_upload_preserves_prior_checkpoint");

  const failStock=`WDCC-QA-VERIFY-${Date.now()}`;
  response=await api.post(`${base}/api/inventory`,{data:{year:2020,make:"WDCC",model:"Verify Fail",price:14500,downPayment:1800,mileage:33000,stock:failStock,internalOnly:false,description:"preview publication verification test"}});
  body=await json(response);
  assert(response.status()===201&&body?.item?.id,`VERIFY_CREATE_${response.status()}_${JSON.stringify(body)}`);
  const failId=String(body.item.id);
  response=await api.post(`${base}/api/upload`,{multipart:{vehicleId:failId,requestId:"verify-photo",file:{name:"verify.webp",mimeType:"image/webp",buffer:image}}});
  assert(response.status()===200,`VERIFY_UPLOAD_${response.status()}`);
  response=await api.patch(`${bad}/api/inventory/${failId}`,{data:{status:"published",internalOnly:false,visibility:"public"}});
  body=await json(response);
  assert(response.status()===409&&body?.ok===false&&body?.error==="storefront_verification_failed"&&body?.storefront?.verified===false&&body?.rollback?.performed===true&&body?.item?.status==="draft",`VERIFY_FAIL_CLOSED_${response.status()}_${JSON.stringify(body)}`);
  response=await api.get(`${base}/api/inventory/${failId}`);
  body=await json(response);
  assert(response.status()===200&&body?.item?.status==="draft",`ROLLBACK_READBACK_${response.status()}_${JSON.stringify(body)}`);
  response=await anonymous.get("/api/inventory");
  body=await json(response);
  assert(!body?.items?.some(vehicle=>String(vehicle?.id)===failId),`ROLLBACK_PUBLIC_LEAK_${JSON.stringify(body)}`);
  report.functional.push("failed_publish_auto_rolls_back_and_stays_publicly_hidden");

  async function publicShots(viewport,label){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:label==="mobile",hasTouch:label==="mobile"});
    const page=await context.newPage();
    watch(page,`${label}-public`);
    let nav=await page.goto(`${base}/?intro=1&proof=${Date.now()}`,{waitUntil:"domcontentloaded",timeout:25000});
    assert(nav?.status()===200,`${label}_ROOT_HTTP_${nav?.status()}`);
    await page.waitForTimeout(900);
    await page.screenshot({path:`${out}/${label}-01-intro.png`});
    const skip=page.locator(".li-skip");
    if(await skip.count())await skip.click({force:true});
    await page.waitForTimeout(600);
    await page.screenshot({path:`${out}/${label}-02-home.png`,fullPage:true});
    nav=await page.goto(`${base}/inventory?proof=${Date.now()}`,{waitUntil:"domcontentloaded",timeout:25000});
    assert(nav?.status()===200,`${label}_INVENTORY_HTTP_${nav?.status()}`);
    await page.waitForTimeout(900);
    await page.screenshot({path:`${out}/${label}-03-inventory.png`,fullPage:true});
    const inventoryMetrics=await visibleTextMetrics(page,".inventoryPage");
    report.metrics[`${label}Inventory`]=inventoryMetrics;
    if(label==="mobile"){
      assert(inventoryMetrics.minFont>=8,`MOBILE_INVENTORY_MICROTYPE_${inventoryMetrics.minFont}_${JSON.stringify(inventoryMetrics.smallest.slice(0,5))}`);
      assert(inventoryMetrics.horizontalOverflow<=2,`MOBILE_INVENTORY_OVERFLOW_${inventoryMetrics.horizontalOverflow}`);
    }
    nav=await page.goto(`${base}/about?proof=${Date.now()}`,{waitUntil:"domcontentloaded",timeout:25000});
    assert(nav?.status()===200,`${label}_ABOUT_HTTP_${nav?.status()}`);
    await page.waitForTimeout(650);
    await page.screenshot({path:`${out}/${label}-04-about.png`,fullPage:true});
    const aboutMetrics=await visibleTextMetrics(page,"main");
    report.metrics[`${label}About`]=aboutMetrics;
    if(label==="mobile")assert(aboutMetrics.horizontalOverflow<=2,`MOBILE_ABOUT_OVERFLOW_${aboutMetrics.horizontalOverflow}`);
    await context.close();
  }

  const storageState=await dealer.storageState();
  async function dealerShots(viewport,label){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:label==="mobile",hasTouch:label==="mobile",storageState});
    const page=await context.newPage();
    watch(page,`${label}-dealer`);
    for(const [name,path] of [["dashboard","/dealer/dashboard"],["inventory","/dealer/inventory"],["editor","/dealer/inventory/new"]]){
      const nav=await page.goto(`${base}${path}`,{waitUntil:"domcontentloaded",timeout:25000});
      assert(nav?.status()===200,`${label}_${name}_HTTP_${nav?.status()}`);
      await page.waitForTimeout(750);
      assert(!page.url().endsWith("/dealer"),`${label}_${name}_AUTH_REDIRECT`);
      await page.screenshot({path:`${out}/${label}-dealer-${name}.png`,fullPage:true});
      const metrics=await visibleTextMetrics(page,"main");
      report.metrics[`${label}Dealer${name[0].toUpperCase()+name.slice(1)}`]=metrics;
      if(label==="mobile"){
        assert(metrics.minFont>=8,`MOBILE_DEALER_${name.toUpperCase()}_MICROTYPE_${metrics.minFont}_${JSON.stringify(metrics.smallest.slice(0,5))}`);
        assert(metrics.horizontalOverflow<=2,`MOBILE_DEALER_${name.toUpperCase()}_OVERFLOW_${metrics.horizontalOverflow}`);
      }
    }
    const year=page.locator('input[name="year"]');
    const box=await year.boundingBox();
    assert(await year.count()===1&&Boolean(box)&&box.height>=40,`${label}_EDITOR_CONTROL_TOO_SHORT_${box?.height}`);
    await context.close();
  }

  await publicShots({width:1440,height:1000},"desktop");
  await publicShots({width:390,height:844},"mobile");
  await dealerShots({width:1440,height:1000},"desktop");
  await dealerShots({width:390,height:844},"mobile");

  assert(report.httpErrors.length===0,`HTTP_ERRORS_${JSON.stringify(report.httpErrors)}`);
  assert(report.consoleErrors.length===0,`CONSOLE_ERRORS_${JSON.stringify(report.consoleErrors)}`);
  assert(report.requestFailures.length===0,`REQUEST_FAILURES_${JSON.stringify(report.requestFailures)}`);
  report.functional.push("browser_clean_public_about_and_authenticated_dealer_desktop_mobile");
}catch(error){
  report.failure=String(error instanceof Error?error.message:error);
  throw error;
}finally{
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+"\n");
  if(anonymous)await anonymous.dispose().catch(()=>{});
  if(dealer)await dealer.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
}
