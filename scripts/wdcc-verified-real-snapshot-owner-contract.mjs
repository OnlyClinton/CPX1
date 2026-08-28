import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  The base fixture owns the populated visual data while this wrapper aligns legacy
  mechanical assertions with the current FINAL VISUAL AUTHORITY:
    - desktop Featured Inventory: five compact columns
    - phone Featured Inventory: one dominant swipe/snap card with the next card advancing off-canvas
    - full /inventory: three columns desktop, one column mobile
    - phone Add/Edit: one full-width readable field column at 390px
  It also corrects drawer visibility semantics: the off-canvas sidebar does not
  need to be visible while closed; the top dealer brand must remain visible.
  This wrapper is also a shared exact-SHA trigger for Responsive + Real Snapshot
  acceptance after proof-harness-only corrections; the executable contract below is unchanged.
*/
const source='scripts/wdcc-verified-real-snapshot-visual-stress.mjs';
const runtime='scripts/.wdcc-verified-real-snapshot-owner-contract.runtime.mjs';
let code=fs.readFileSync(source,'utf8');

const editorFrom="if(spec.mobile){if(fields.tracks!==2||!sideBrand||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
const editorTo="if(spec.mobile){if(fields.tracks!==1||fields.w<300||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
if(!code.includes(editorFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${editorFrom}`);
code=code.replace(editorFrom,editorTo);

const densityFrom="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.46||d.cardW<d.viewport*.28||d.secondX>=d.viewport)fail('MOBILE_FEATURED_DENSITY_3294',d)";
const densityTo="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.96||d.cardW<d.viewport*.85||d.secondX<d.viewport*.90||d.secondX>d.viewport*1.05)fail('MOBILE_FEATURED_DENSITY_3294',d)";
if(!code.includes(densityFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${densityFrom}`);
code=code.replace(densityFrom,densityTo);

const photoFrom="if(result.mediaAvailable)await page.locator('.photoDrop img').first().waitFor({state:'visible',timeout:10000});else await page.locator('.photoDrop').waitFor({state:'visible'});";
const photoTo="const photosStep=page.locator('.stepper button').filter({hasText:'Photos'}).first();await photosStep.waitFor({state:'visible',timeout:10000});await photosStep.click();await page.locator('[data-wizard-stage=\"photos\"]').waitFor({state:'visible',timeout:10000});if(result.mediaAvailable)await page.locator('.photoDrop img').first().waitFor({state:'visible',timeout:10000});else await page.locator('.photoDrop').waitFor({state:'visible'});";
if(!code.includes(photoFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${photoFrom}`);
code=code.replace(photoFrom,photoTo);

fs.writeFileSync(runtime,code);
try{
  await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-contract=${Date.now()}`);
}finally{
  fs.rmSync(runtime,{force:true});
}
