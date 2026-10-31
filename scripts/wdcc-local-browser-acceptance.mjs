/**
 * Owner-authorized localhost browser acceptance only (never automated production forms).
 * Run after Next build on 127.0.0.1:3197 with playwright-core + installed Chrome.
 * Screenshots contain public pages only. Never read authenticated dashboard data.
 */
import fs from "node:fs";
import path from "node:path";
import {chromium} from "playwright-core";

const base=process.env.WDCC_LOCAL_ORIGIN||"http://127.0.0.1:3197";
const output=process.env.WDCC_VISUAL_DIR||"wdcc-browser-evidence";
fs.mkdirSync(output,{recursive:true});
const chrome=process.env.CHROME_BIN||"/usr/bin/google-chrome";
const browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const results=[];
const add=(id,ok,context={})=>results.push({id,pass:Boolean(ok),...context});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 for(const device of [
   {name:"mobile390",width:390,height:844,isMobile:true,hasTouch:true},
   {name:"tablet768",width:768,height:1024,isMobile:false,hasTouch:false},
   {name:"desktop1440",width:1440,height:900,isMobile:false,hasTouch:false}
 ]){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:1});
  const page=await context.newPage();
  const jsErrors=[];
  page.on("pageerror",e=>jsErrors.push(e.message.slice(0,240)));
  for(const route of ["/","/inventory","/about","/login","/forgot-password"]){
    const res=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:14000});
    await delay(route==="/"?3600:route==="/inventory"?2400:650);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,title:document.title,body:document.body?.innerText?.slice(0,300)||""}));
    const overflow=dimensions.scrollWidth>dimensions.width+3;
    add(device.name+" "+route+" http",res?.status()===200,{http:res?.status()||null});
    add(device.name+" "+route+" no-horizontal-overflow",!overflow,{width:dimensions.width,scrollWidth:dimensions.scrollWidth});
    const filename=path.join(output,device.name+"-"+(route==="/ "?"home":route==="/ "?"home":route.replaceAll("/","")||"home")+".png");
    await page.screenshot({path:filename,fullPage:false,animations:"disabled"});
    if(route==="/about")add(device.name+" about-distinct",/about we don't care cars/i.test(dimensions.title)||/tampa bay.*about us/i.test(dimensions.body),{title:dimensions.title});
    if(route==="/login")add(device.name+" forgot-link",await page.locator('a[href="/forgot-password"]').count()>0);
    if(route==="/forgot-password")add(device.name+" recovery-input",await page.locator('form input').count()>0);
    if(route==="/inventory"){
      const cards=await page.locator('[data-inventory-card]').count();
      add(device.name+" inventory-cards-or-correct-empty",cards>0||/inventory is being updated/i.test(dimensions.body),{cards});
      add(device.name+" inventory-no-available-now-claim",!(await page.locator('text=/vehicles? available now/i').count()),{cards});
    }
  }
  add(device.name+" uncaught-JS-errors",jsErrors.length===0,{errors:jsErrors.slice(0,5)});
  await context.close();
 }
 const c=await browser.newContext({viewport:{width:390,height:844}});
 const p=await c.newPage();
 const inventory=await p.request.get(base+"/sitemap.xml");
 add("sitemap XML /about",inventory.status()===200&&(await inventory.text()).includes("wedontcarecars.com/about"));
 const robots=await p.request.get(base+"/robots.txt");
 add("robots sitemap discovery",robots.status()===200&&(await robots.text()).includes("sitemap.xml"));
 const about=await p.request.get(base+"/about");
 add("about page no redirect",about.status()===200);
 const nonexisting=await p.request.get(base+"/definitely-not-a-real-route");
 add("unknown route 404",nonexisting.status()===404,{http:nonexisting.status()});
 await c.close();
}finally{await browser.close()}
const failed=results.filter(x=>!x.pass);
const report={kind:"WDCC_LOCAL_BROWSER_ACCEPTANCE",at:new Date().toISOString(),checks:results.length,passed:results.length-failed.length,failed:failed.length,results};
fs.writeFileSync(path.join(output,"browser-checks.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks,passed:report.passed,failed:report.failed,failures:failed},null,2));
if(failed.length)process.exitCode=1;
