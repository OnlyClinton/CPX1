import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.URL;if(!base)throw new Error('URL_REQUIRED');
const out='owner-final-lock-proof';fs.mkdirSync(out,{recursive:true});
const vehicles=[{id:'v1',year:2020,make:'Dodge',model:'Challenger',price:24995,status:'published'},{id:'v2',year:2019,make:'Dodge',model:'Charger',price:21995,status:'published'},{id:'v3',year:2018,make:'Chevrolet',model:'Camaro',price:20995,status:'published'},{id:'v4',year:2020,make:'Jeep',model:'Grand Cherokee',price:23995,status:'draft'},{id:'v5',year:2018,make:'Ford',model:'F-150',price:22995,status:'published'}];
const leads=[{id:'l1',name:'John Doe',kind:'contact',stage:'new'},{id:'l2',name:'Mike Smith',kind:'appointment',stage:'contacted'},{id:'l3',name:'Sarah Johnson',kind:'application',stage:'qualified'}];
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage();
 await p.route('**/api/auth/session**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,user:{role:'dealer_agent'}})}));
 await p.route('**/api/crm/dashboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{soldThisWeek:7,newToday:12,appointments:5,applications:8,messages:3},inventory:vehicles,leads})}));
 for(let i=0;i<15;i++){const r=await p.goto(`${base}/dealer?diag=${Date.now()}-${i}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);if(r?.status()===200)break;await p.waitForTimeout(1000)}
 await p.locator('.dealerDashboardLocked').waitFor({state:'visible',timeout:10000});
 const diag=await p.evaluate(()=>{const q=s=>document.querySelector(s),box=s=>{const r=q(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};return{contentDisplay:getComputedStyle(q('.dashboardContent')).display,contentColumns:getComputedStyle(q('.dashboardContent')).gridTemplateColumns,contentAreas:getComputedStyle(q('.dashboardContent')).gridTemplateAreas,gridDisplay:getComputedStyle(q('.dashboardGridLocked')).display,metricsColumns:getComputedStyle(q('.dashMetrics')).gridTemplateColumns,opsColumns:getComputedStyle(q('.opsCards')).gridTemplateColumns,inventory:box('.inventoryOverview'),vehicles:box('.recentVehicles'),activity:box('.activityLocked'),ops:box('.opsCards'),overflow:document.documentElement.scrollWidth-innerWidth}});
 fs.writeFileSync(`${out}/dashboard-diagnostic.json`,JSON.stringify(diag,null,2)+'\n');
 await p.screenshot({path:`${out}/dashboard-diagnostic.png`,fullPage:true});
 console.log('WDCC_DASHBOARD_DIAGNOSTIC',JSON.stringify(diag));
 await ctx.close();
}finally{await browser.close()}
