/**
 * WDCC ISOLATED conversion UX tests.
 * Runs only against loopback-built Next server; every mutating API request
 * is intercepted by Playwright and returned from a synthetic in-memory stub.
 * NO production writes, external lead notifications or password resets.
 */
import {chromium} from "playwright-core";

const base=process.env.WDCC_LOCAL_ORIGIN||"http://127.0.0.1:3197";
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error("LOCALHOST_ONLY_REQUIRED");
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||"/usr/bin/google-chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const checks=[];
const add=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),...(detail?{detail}: {})});
async function context(){
  const c=await browser.newContext({viewport:{width:390,height:844}});
  // In isolated tests never allow a real outbound mutating request.
  await c.route("**/api/**",async route=>{
    if(route.request().method()!=="GET")return route.fulfill({status:418,json:{ok:false,error:"blocked_unmocked_write"}});
    if(route.request().url().includes("/api/inventory"))return route.fulfill({status:200,json:{ok:true,count:0,items:[],degraded:false}});
    if(route.request().url().includes("/api/auth/session"))return route.fulfill({status:200,json:{authenticated:false}});
    return route.fulfill({status:503,json:{ok:false,error:"isolated_fixture_only"}});
  });
  return c;
}
try{
 for(const [path,kind] of [["/contact","contact"],["/get-approved","approval"],["/schedule-test-drive","schedule"]]){
  const c=await context();const page=await c.newPage();const sent=[];
  await page.route("**/api/leads",async route=>{
    sent.push(route.request().postDataJSON());
    return route.fulfill({status:201,json:{ok:true,persisted:true,sync:{dealer:"saved",upstream:"pending"}}});
  });
  await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:15000});
  const form=page.locator("form.leadForm");
  await form.locator('input[name="name"]').fill("Offline QA Test");
  await form.locator('input[name="email"]').fill("test-user@example.invalid");
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector("form.leadForm [role=status]")?.textContent?.includes("Saved for follow-up"),{timeout:9000});
  const message=await form.locator("[role=status]").textContent();
  add(kind+" recorded synthetic request",sent.length===1);
  add(kind+" carried user consent",sent[0]?.consent===true);
  add(kind+" correct type",sent[0]?.kind===kind);
  add(kind+" truthful saved/pending message",/Saved for follow-up; notifications may be delayed/.test(message||""));
  await c.close();
 }
 // A syntactically OK response without persisted:true must never be a success.
 {
  const c=await context(),page=await c.newPage();let count=0;
  await page.route("**/api/leads",async route=>{count++;return route.fulfill({status:200,json:{ok:true,persisted:false}});});
  await page.goto(base+"/contact",{waitUntil:"domcontentloaded",timeout:15000});
  const form=page.locator("form.leadForm");
  await form.locator('input[name="name"]').fill("Offline QA Test");
  await form.locator('input[name="email"]').fill("test-user@example.invalid");
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector("form.leadForm [role=status]")?.textContent?.includes("couldn't send"),{timeout:9000});
  add("unpersisted reply rejected",count===1);
  add("unpersisted reply does not claim success",!((await form.locator("[role=status]").textContent())||"").includes("received."));
  await c.close();
 }
 // Browser-side consent gate: do not submit without opt-in.
 {
  const c=await context(),page=await c.newPage();let calls=0;
  await page.route("**/api/leads",async route=>{calls++;return route.fulfill({status:201,json:{ok:true,persisted:true}});});
  await page.goto(base+"/contact",{waitUntil:"domcontentloaded",timeout:15000});
  const form=page.locator("form.leadForm");
  await form.locator('input[name="name"]').fill("Offline QA Test");
  await form.locator('input[name="email"]').fill("test-user@example.invalid");
  await form.locator('button[type="submit"]').click();
  add("unconsented lead blocked by form",calls===0 && await form.evaluate(el=>!el.checkValidity()));
  await c.close();
 }
 // Account recovery must reveal no account existence, and be UI-accessible.
 {
  const c=await context(),page=await c.newPage();let calls=0,body=null;
  await page.route("**/api/auth/password-reset/request",async route=>{
    calls++;body=route.request().postDataJSON();
    return route.fulfill({status:200,json:{ok:true,message:"If that WDCC account is eligible for recovery, a reset link will arrive shortly."}});
  });
  await page.goto(base+"/forgot-password",{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator("form input").fill("unknown-test-account");
  await page.locator("form button").click();
  await page.waitForFunction(()=>document.querySelector("form [role=status]")?.textContent?.includes("If that WDCC account"),{timeout:9000});
  add("recovery endpoint invoked once in mock",calls===1);
  add("recovery username safely transmitted",body?.login==="unknown-test-account");
  add("recovery UI generic account-safe message",!((await page.locator("form [role=status]").textContent())||"").includes("account not found"));
  await c.close();
 }
 // Reset completion must require token and matching passwords (no actual reset).
 {
  const c=await context(),page=await c.newPage();let calls=0,payload=null;
  await page.route("**/api/auth/password-reset/confirm",async route=>{
    calls++;payload=route.request().postDataJSON();
    return route.fulfill({status:200,json:{ok:true}});
  });
  const token="offline-mock-token-0000000000";
  await page.goto(base+"/reset-password?token="+token,{waitUntil:"domcontentloaded",timeout:15000});
  await page.locator('form input').nth(0).fill("Safe-mocked-Password-2026");
  await page.locator('form input').nth(1).fill("Safe-mocked-Password-2026");
  await page.locator("form button").click();
  await page.waitForFunction(()=>document.querySelector("form [role=status]")?.textContent?.includes("Password updated"),{timeout:9000});
  add("reset completion mocked once",calls===1);
  add("reset passes matching password and token to mock",payload?.token===token&&payload?.password==="Safe-mocked-Password-2026");
  await c.close();
 }
}finally{await browser.close()}
const failures=checks.filter(x=>!x.pass);
console.log(JSON.stringify({kind:"WDCC_OFFLINE_CONVERSION_E2E",scope:"LOOPBACK_WITH_INTERCEPTED_WRITES",tested:checks.length,passed:checks.length-failures.length,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
