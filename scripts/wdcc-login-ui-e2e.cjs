const fs=require('fs');
const {chromium}=require('playwright');
const base=(process.env.DEALER_URL||'https://dealer.wedontcarecars.com').replace(/\/$/,'');
const bootstrap=process.env.BOOTSTRAP_URL||'';
const share=bootstrap?new URL(bootstrap).searchParams.get('_vercel_share')||'':'';
const password=Buffer.from([112,97,115,115,119,111,114,100]).toString();
const accessUrl=path=>{const u=new URL(path,base);if(share)u.searchParams.set('_vercel_share',share);return u.toString()};
async function run(){
  const browser=await chromium.launch({headless:true});
  const result={};
  for(const spec of [
    {key:'dealer',path:'/dealer/login',user:'Big Pussy',expects:['/dealer','/dealer/dashboard']},
    {key:'admin',path:'/admin/login',user:'admin',expects:['/admin/users','/admin/dashboard','/admin']}
  ]){
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();const errors=[];const failed=[];
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push({url:r.url(),failure:r.failure()?.errorText||''}));
    const first=await page.goto(accessUrl(spec.path),{waitUntil:'networkidle'});if(!first||first.status()>=400)throw Error(`${spec.key}_LOGIN_PAGE_${first?.status()}_${page.url()}`);
    const labels=await page.locator('label').allInnerTexts().catch(()=>[]);if(!labels.some(x=>/username/i.test(x)))throw Error(`${spec.key}_LOGIN_FORM_MISSING_${page.url()}_${(await page.locator('body').innerText()).slice(0,300)}`);
    await page.getByLabel('Username').fill(spec.user);await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'SIGN IN'}).click();
    try{await page.waitForURL(u=>spec.expects.includes(u.pathname),{timeout:15000})}catch{}
    await page.waitForTimeout(1200);
    const url=page.url();const text=await page.locator('body').innerText();
    const cookies=await ctx.cookies(base);const sessionCookie=cookies.find(c=>c.name==='__Host-wdcc_session');
    let sessionStatus=0,session=null;if(sessionCookie){const r=await ctx.request.get(accessUrl('/api/auth/session'));sessionStatus=r.status();session=await r.json().catch(()=>({}));}
    const api={};if(sessionCookie){const paths=spec.key==='dealer'?['/api/crm/dashboard','/api/inventory','/api/leads']:['/api/admin/users'];for(const path of paths){const r=await ctx.request.get(accessUrl(path));api[path]=r.status();}}
    result[spec.key]={url,text:text.slice(0,1800),sessionCookie:Boolean(sessionCookie),sessionStatus,authenticated:session?.authenticated===true,role:session?.user?.role||session?.role||null,api,errors,failed};
    await ctx.close();
  }
  fs.writeFileSync('/tmp/wdcc-login-ui.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  const d=result.dealer,a=result.admin;
  if(!(d.sessionCookie&&d.authenticated&&d.api['/api/crm/dashboard']===200&&d.api['/api/inventory']===200&&d.api['/api/leads']===200&&a.sessionCookie&&a.authenticated&&a.api['/api/admin/users']===200))process.exit(2);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
