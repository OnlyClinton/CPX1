import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  Controlling contract:
    - desktop Featured Inventory may remain the compact populated board presentation
    - phone Featured Inventory is one dominant swipe/snap card
    - full /inventory is THREE columns on desktop and one compact row per vehicle on mobile
    - phone Add/Edit is ONE readable field column at 390px
  It also follows the current dealer shell and explicitly opens Photos before media checks.
*/
const source='scripts/wdcc-verified-real-snapshot-visual-stress.mjs';
const runtime='scripts/.wdcc-verified-real-snapshot-owner-contract.runtime.mjs';
let code=fs.readFileSync(source,'utf8');

const editorFrom="if(spec.mobile){if(fields.tracks!==2||!sideBrand||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
const editorTo="if(spec.mobile){if(fields.tracks!==1||fields.w<300||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
if(!code.includes(editorFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${editorFrom}`);
code=code.replace(editorFrom,editorTo);

const editorDesktopFrom="else{if(fields.tracks!==4||layout.tracks!==2||sideBrand||!topBrand)fail('DESKTOP_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
const editorDesktopTo="else{if(fields.tracks!==4||layout.tracks!==2||!sideBrand||!topBrand)fail('DESKTOP_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
if(!code.includes(editorDesktopFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${editorDesktopFrom}`);
code=code.replace(editorDesktopFrom,editorDesktopTo);

const inventoryContract="for(const spec of [{name:'desktop',viewport:{width:1440,height:1000},mobile:false,tracks:3},{name:'mobile',viewport:{width:390,height:844},mobile:true,tracks:1}])";
if(!code.includes(inventoryContract))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${inventoryContract}`);

const densityFrom="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.46||d.cardW<d.viewport*.28||d.secondX>=d.viewport)fail('MOBILE_FEATURED_DENSITY_3294',d)";
const densityTo="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.96||d.cardW<d.viewport*.85||d.secondX<d.viewport*.90||d.secondX>d.viewport*1.05)fail('MOBILE_FEATURED_DENSITY_3294',d)";
if(!code.includes(densityFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${densityFrom}`);
code=code.replace(densityFrom,densityTo);

const dashboardFrom="for(const spec of [{name:'desktop',viewport:{width:1440,height:1000},mobile:false},{name:'mobile',viewport:{width:390,height:844},mobile:true}]){const{ctx,page}=await newPage(spec.viewport,spec.mobile);await visit(page,'/dealer','.dealerDashboardLocked');const metrics=await grid(page.locator('.dashMetrics')),recent=await page.locator('.recentVehicles a').count(),logos=await page.locator('main.dealerDashboardLocked>.dcTop>.brand>img').count();if(spec.mobile?metrics.tracks!==2:metrics.tracks!==6)fail(`${spec.name.toUpperCase()}_DASH_METRICS`,metrics);if(recent<5||logos!==1)fail(`${spec.name.toUpperCase()}_DASH_DATA`,{recent,logos});result.pages[`${spec.name}DealerDashboard`]={metrics,recent,logos};";
const dashboardTo="for(const spec of [{name:'desktop',viewport:{width:1440,height:1000},mobile:false},{name:'mobile',viewport:{width:390,height:844},mobile:true}]){const{ctx,page}=await newPage(spec.viewport,spec.mobile);await visit(page,'/dealer','.portalApp');const metrics=await grid(page.locator('.metricGrid')),metricCount=await page.locator('.metricGrid > article').count(),recent=await page.locator('.vehicleRows > div').count(),logos=await page.locator('.portalBrand img,.topIdentity img').count();if(metricCount!==4||(spec.mobile?metrics.tracks!==2:metrics.tracks!==4))fail(`${spec.name.toUpperCase()}_DASH_METRICS`,{...metrics,metricCount});if(recent<5||logos!==2)fail(`${spec.name.toUpperCase()}_DASH_DATA`,{recent,logos});result.pages[`${spec.name}DealerDashboard`]={metrics,metricCount,recent,logos};";
if(!code.includes(dashboardFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${dashboardFrom}`);
code=code.replace(dashboardFrom,dashboardTo);

const photoFrom="if(result.mediaAvailable)await page.locator('.photoDrop img').first().waitFor({state:'visible',timeout:10000});else await page.locator('.photoDrop').waitFor({state:'visible'});";
const photoTo="const photosStep=page.locator('.stepper button').filter({hasText:'Photos'}).first();await photosStep.waitFor({state:'visible',timeout:10000});await photosStep.click();await page.locator('[data-wizard-stage=\"photos\"]').waitFor({state:'visible',timeout:10000});if(result.mediaAvailable)await page.locator('.photoDrop img').first().waitFor({state:'visible',timeout:10000});else await page.locator('.photoDrop').waitFor({state:'visible'});";
if(!code.includes(photoFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${photoFrom}`);
code=code.replace(photoFrom,photoTo);

fs.writeFileSync(runtime,code);
try{await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-contract=${Date.now()}`)}finally{fs.rmSync(runtime,{force:true})}
