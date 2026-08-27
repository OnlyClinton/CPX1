import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  The base fixture owns the populated visual data while this wrapper aligns legacy
  mechanical assertions with the current FINAL VISUAL AUTHORITY:
    - desktop Featured Inventory: five compact columns
    - phone Featured Inventory: one dominant readable card plus controlled next-card peek
    - full /inventory: three columns desktop, one column mobile
    - phone Add/Edit: two readable columns at 390px
  It also corrects drawer visibility semantics: the off-canvas sidebar does not
  need to be visible while closed; the top dealer brand must remain visible.
*/
const source='scripts/wdcc-verified-real-snapshot-visual-stress.mjs';
const runtime='scripts/.wdcc-verified-real-snapshot-owner-contract.runtime.mjs';
let code=fs.readFileSync(source,'utf8');

const editorFrom="if(spec.mobile){if(fields.tracks!==2||!sideBrand||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
const editorTo="if(spec.mobile){if(fields.tracks!==2||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
if(!code.includes(editorFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${editorFrom}`);
code=code.replace(editorFrom,editorTo);

const densityFrom="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.46||d.cardW<d.viewport*.28||d.secondX>=d.viewport)fail('MOBILE_FEATURED_DENSITY_3294',d)";
const densityTo="if(d.display!=='flex'||count!==5||d.cardW>d.viewport*.88||d.cardW<d.viewport*.72||d.secondX>=d.viewport*.96||d.secondX<=d.viewport*.78)fail('MOBILE_FEATURED_DENSITY_3294',d)";
if(!code.includes(densityFrom))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${densityFrom}`);
code=code.replace(densityFrom,densityTo);

fs.writeFileSync(runtime,code);
try{
  await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-contract=${Date.now()}`);
}finally{
  fs.rmSync(runtime,{force:true});
}
