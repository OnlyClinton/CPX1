const fs=require('fs');
const {chromium}=require('playwright');
const base=process.env.DEALER_URL||'https://dealer.wedontcarecars.com';
const password=Buffer.from([112,97,115,115,119,111,114,100]).toString();
async function run(){
  const browser=await chromium.launch({headless:true});
  const result={};
  for(const spec of [
    {key:'dealer',path:'/dealer/login',user:'Big Pussy',expect:'/dealer'},
    {key:'admin',path:'/admin/login',user:'admin',expect:'/admin/dashboard'}
  ]){
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();const errors=[];const failed=[];
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push({url:r.url(),failure:r.failure()?.errorText||''}));
    const first=await page.goto(base+spec.path,{waitUntil:'networkidle'});if(!first||first.status()>=400)throw Error(`${spec.key}_LOGIN_PAGE_${first?.status()}`);
    await page.getByLabel('Username').fill(spec.user);await page.getByLabel('Password').fill(password);
    await Promise.all([page.getByRole('button',{name:'SIGN IN'}).click(),page.waitForTimeout(300)]);
    try{await page.waitForURL(u=>u.pathname===spec.expect,{timeout:15000})}catch{}
    await page.waitForTimeout(1500);
    const url=page.url();const text=await page.locator('body').innerText();
    const cookies=await ctx.cookies(base);const sessionCookie=cookies.find(c=>c.name==='__Host-wdcc_session');
    let sessionStatus=0,session=null;if(sessionCookie){const r=await ctx.request.get(base+'/api/auth/session');sessionStatus=r.status();session=await r.json().catch(()=>({}));}
    result[spec.key]={url,text:text.slice(0,1800),sessionCookie:Boolean(sessionCookie),sessionStatus,authenticated:session?.authenticated===true,role:session?.user?.role||null,errors,failed};
    await ctx.close();
  }
  fs.writeFileSync('/tmp/wdcc-login-ui.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  const d=result.dealer,a=result.admin;
  if(!(new URL(d.url).pathname==='/dealer'&&d.sessionCookie&&d.authenticated&&new URL(a.url).pathname==='/admin/dashboard'&&a.sessionCookie&&a.authenticated))process.exit(2);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
