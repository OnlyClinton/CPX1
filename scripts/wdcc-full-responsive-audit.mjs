import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.URL||'http://127.0.0.1:4175';
const out=process.env.OUT||'responsive-audit';
fs.mkdirSync(out,{recursive:true});

const result={sha:process.env.GITHUB_SHA||'',base,startedAt:new Date().toISOString(),pages:{},skipped:[],critical:[],warnings:[],writeRequests:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeName=v=>v.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
const customerVisible=v=>String(v?.status||'').toLowerCase()==='published'&&v?.internalOnly!==true&&!['internal','dealer_only'].includes(String(v?.visibility||'').toLowerCase())&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/i.test(String(v?.stock||''));

let canonicalInventory=[];
try{
  const r=await fetch(`${base}/api/inventory?responsive-audit=${Date.now()}`);
  if(r.ok){const j=await r.json().catch(()=>({}));canonicalInventory=(Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[]).filter(customerVisible)}
}catch{}

const publicRoutes=[
  {name:'home',path:'/',marker:'.reference-home',skipIntro:true},
  {name:'inventory',path:'/inventory',marker:'.inventoryTop'},
  {name:'get-approved',path:'/get-approved',marker:'.leadPage'},
  {name:'schedule-test-drive',path:'/schedule-test-drive',marker:'.leadPage'},
  {name:'contact',path:'/contact',marker:'.leadPage'},
  {name:'login',path:'/login',marker:'.loginShell'},
  {name:'privacy',path:'/privacy',marker:'main'},
  {name:'terms',path:'/terms',marker:'main'},
  {name:'app',path:'/app',marker:'main'}
];
if(canonicalInventory[0]?.id)publicRoutes.push({name:'vehicle-detail',path:`/vehicle/${encodeURIComponent(String(canonicalInventory[0].id))}`,marker:'main'});
else result.skipped.push({name:'vehicle-detail',reason:'No canonical customer-visible inventory item available; no synthetic vehicle created.'});

const dealerRoutes=[
  {name:'dealer-dashboard',path:'/dealer',marker:'.dealerDashboardLocked'},
  {name:'dealer-inventory',path:'/dealer/inventory',marker:'.inventoryContract'},
  {name:'dealer-import',path:'/dealer/inventory/import',marker:'.dcDrop'},
  {name:'dealer-add-edit',path:'/dealer/inventory/new',marker:'.editVehicleApp'},
  {name:'dealer-leads',path:'/dealer/leads',marker:'.targetLeadShell'},
  {name:'dealer-crm',path:'/dealer/crm',textMarker:'My Day'},
  {name:'dealer-vehicle-logs',path:'/dealer/inventory/logs',marker:'.crmShell'}
];

const adminRoutes=[
  {name:'admin-root',path:'/admin',marker:'main'},
  {name:'admin-login',path:'/admin/login',marker:'main'},
  {name:'admin-dashboard',path:'/admin/dashboard',marker:'main'},
  {name:'admin-users',path:'/admin/users',marker:'main'}
];

function watchWrites(page){
  page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method()))result.writeRequests.push({method:r.method(),url:r.url()})});
}

async function wireDealer(page,role='dealer_agent'){
  watchWrites(page);
  const session={authenticated:true,name:'WDCC Visual QA',role,tenantId:'wdcc',user:{id:'visual-only',displayName:'WDCC Visual QA',role,tenantId:'wdcc'}};
  const dashboard={summary:{totalLeads:0,newToday:0,hotLeads:0,appointments:0,publishedInventory:0,totalInventory:0,soldThisWeek:0,applications:0,messages:0},pipeline:{},hotLeads:[],inventory:[],leads:[]};
  await page.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)}));
  await page.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)}));
  await page.route('**/api/dealer/vehicle-logs**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({revision:0,durable:[],ledger:[]})}));
  await page.route('**/api/inventory**',r=>{
    const req=r.request();
    if(req.method()!=='GET')return r.abort();
    const u=new URL(req.url());
    if(u.pathname==='/api/inventory')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[]})});
    return r.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"NOT_FOUND"}'});
  });
  await page.route('**/api/leads/**',r=>r.request().method()==='GET'?r.fulfill({status:404,contentType:'application/json',body:'{"ok":false}'}):r.abort());
}

async function finishIntro(page){
  const intro=page.locator('.li');
  if(await intro.count()){
    await page.getByRole('button',{name:/skip intro/i}).click({timeout:1800}).catch(()=>{});
    await intro.waitFor({state:'detached',timeout:6000}).catch(()=>{});
  }
}

async function auditPage(page,{name,path,marker,textMarker},mobile,kind){
  const key=`${mobile?'mobile':'desktop'}-${name}`;
  const url=`${base}${path}${path.includes('?')?'&':'?'}responsive-audit=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
  await sleep(450);
  if(name==='home')await finishIntro(page);
  if(marker)await page.locator(marker).first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
  if(textMarker)await page.getByText(textMarker,{exact:true}).first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
  await sleep(250);

  const audit=await page.evaluate(({mobile})=>{
    const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>1&&r.height>1};
    const px=(s,p)=>Number.parseFloat(getComputedStyle(s)[p])||0;
    const rect=e=>{const r=e.getBoundingClientRect();return{w:+r.width.toFixed(2),h:+r.height.toFixed(2),x:+r.x.toFixed(2),y:+r.y.toFixed(2)}};
    const critical=[];const warnings=[];
    const overflow=document.documentElement.scrollWidth-innerWidth;
    if(overflow>2)critical.push({type:'horizontal-overflow',overflow,docW:document.documentElement.scrollWidth,winW:innerWidth});

    const controls=[...document.querySelectorAll('form input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),form select,form textarea')].filter(vis);
    const controlData=controls.map((e,i)=>({tag:e.tagName.toLowerCase(),type:e.getAttribute('type')||'',font:px(e,'fontSize'),...rect(e),placeholder:e.getAttribute('placeholder')||'',i}));
    for(const c of controlData){
      const minH=mobile?46:40;
      if(c.h<minH)critical.push({type:'form-control-height',...c,minH});
      if(mobile&&c.font<15.5)critical.push({type:'mobile-form-font',...c,minFont:15.5});
      if(!mobile&&c.font<12)warnings.push({type:'desktop-form-font',...c,minFont:12});
    }
    const labels=[...document.querySelectorAll('form label')].filter(vis).map((e,i)=>({font:px(e,'fontSize'),text:(e.textContent||'').trim().slice(0,60),...rect(e),i}));
    for(const l of labels){const min=mobile?10.5:10;if(l.font<min)critical.push({type:'form-label-font',...l,minFont:min})}

    const mobileNav=[...document.querySelectorAll('.dashMobileNav span,.inventoryMobileNav span,.targetLeadMobile span,.refDealerMobileNav span')].filter(vis).map((e,i)=>({font:px(e,'fontSize'),text:(e.textContent||'').trim(),...rect(e),i}));
    for(const n of mobileNav){if(mobile&&n.font<9)critical.push({type:'mobile-nav-label-font',...n,minFont:9})}

    const desktopNav=[...document.querySelectorAll('.dcSide nav a,.targetLeadSide nav a,.crmSidebar nav a')].filter(vis).map((e,i)=>({font:px(e,'fontSize'),text:(e.textContent||'').trim(),...rect(e),i}));
    for(const n of desktopNav){if(!mobile&&n.font<11.5)critical.push({type:'desktop-nav-font',...n,minFont:11.5})}

    const headings=[...document.querySelectorAll('h1,h2')].filter(vis).slice(0,30).map(e=>({tag:e.tagName.toLowerCase(),font:px(e,'fontSize'),line:px(e,'lineHeight'),text:(e.textContent||'').trim().slice(0,80),...rect(e)}));
    const fixedBottom=[...document.querySelectorAll('.dashMobileNav,.inventoryMobileNav,.targetLeadMobile,.refDealerMobileNav')].filter(vis).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{...rect(e),position:s.position,bottom:s.bottom,viewportBottom:+(innerHeight-r.bottom).toFixed(2)}});
    for(const b of fixedBottom){if(mobile&&b.position==='fixed'&&Math.abs(b.viewportBottom)>3)critical.push({type:'mobile-nav-offscreen',...b})}

    const smallVisible=[...document.querySelectorAll('.dcContent small,.dashboardContent small,.targetLeadContent small,.crmMain small')].filter(vis).map((e,i)=>({font:px(e,'fontSize'),text:(e.textContent||'').trim().slice(0,60),i})).filter(x=>x.text&&x.font<9.5).slice(0,40);
    if(smallVisible.length)warnings.push({type:'remaining-microcopy',items:smallVisible});

    return{title:document.title,overflow,docW:document.documentElement.scrollWidth,winW:innerWidth,bodyH:document.documentElement.scrollHeight,controls:controlData,labels,headings,mobileNav,desktopNav,fixedBottom,critical,warnings};
  },{mobile});

  const http=response?.status()||0;
  if(http>=400||http===0)audit.critical.push({type:'http',status:http,url:page.url()});
  result.pages[key]={kind,path,http,finalUrl:page.url(),audit};
  for(const issue of audit.critical)result.critical.push({page:key,...issue});
  for(const issue of audit.warnings)result.warnings.push({page:key,...issue});
  await page.screenshot({path:`${out}/${safeName(key)}.png`,fullPage:true});
}

async function runGroup(routes,mobile,kind,wire){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
  for(const route of routes){
    const page=await ctx.newPage();
    page.on('pageerror',e=>result.warnings.push({page:`${mobile?'mobile':'desktop'}-${route.name}`,type:'pageerror',message:String(e)}));
    if(wire)await wire(page);
    else watchWrites(page);
    try{await auditPage(page,route,mobile,kind)}catch(e){result.critical.push({page:`${mobile?'mobile':'desktop'}-${route.name}`,type:'capture-failure',message:String(e?.message||e)});result.pages[`${mobile?'mobile':'desktop'}-${route.name}`]={kind,path:route.path,error:String(e?.message||e)}}
    await page.close();
  }
  await ctx.close();
}

const browser=await chromium.launch({headless:true});
try{
  await runGroup(publicRoutes,false,'public');
  await runGroup(publicRoutes,true,'public');
  await runGroup(dealerRoutes,false,'dealer',p=>wireDealer(p,'dealer_agent'));
  await runGroup(dealerRoutes,true,'dealer',p=>wireDealer(p,'dealer_agent'));
  /* Admin pages are included in the visual packet. Session is read-only and synthetic only for access rendering; no customer or transaction records are invented. */
  await runGroup(adminRoutes,false,'admin',p=>wireDealer(p,'platform_admin'));
  await runGroup(adminRoutes,true,'admin',p=>wireDealer(p,'platform_admin'));
}finally{await browser.close()}

result.finishedAt=new Date().toISOString();
result.summary={pageCaptures:Object.keys(result.pages).length,critical:result.critical.length,warnings:result.warnings.length,skipped:result.skipped.length,writeRequests:result.writeRequests.length};
fs.writeFileSync(`${out}/responsive-audit.json`,JSON.stringify(result,null,2)+'\n');
const lines=[
  '# WDCC full responsive audit',
  `SHA: ${result.sha}`,
  `Captured: ${result.summary.pageCaptures}`,
  `Critical: ${result.summary.critical}`,
  `Warnings: ${result.summary.warnings}`,
  `Skipped dynamic routes: ${result.summary.skipped}`,
  '',
  ...result.critical.map(x=>`CRITICAL ${x.page}: ${x.type} ${JSON.stringify(x)}`),
  ...result.skipped.map(x=>`SKIP ${x.name}: ${x.reason}`)
];
fs.writeFileSync(`${out}/responsive-audit.txt`,lines.join('\n')+'\n');
console.log(lines.join('\n'));
if(result.writeRequests.length)throw new Error(`RESPONSIVE_AUDIT_WRITE_REQUESTS_${result.writeRequests.length}`);
if(result.critical.length)throw new Error(`RESPONSIVE_AUDIT_CRITICAL_${result.critical.length}`);
