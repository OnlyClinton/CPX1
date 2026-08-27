import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  The base fixture already owns the supplied geometry:
    - desktop Featured Inventory: five compact columns
    - phone Featured Inventory: compact multi-card horizontal rail with the next cards visible
    - full /inventory: three columns desktop, one column mobile
    - phone Add/Edit: two readable columns at 390px
  This wrapper only corrects drawer visibility semantics: the off-canvas sidebar does
  not need to be visible while closed; the top dealer brand must remain visible.
*/
const source='scripts/wdcc-verified-real-snapshot-visual-stress.mjs';
const runtime='scripts/.wdcc-verified-real-snapshot-owner-contract.runtime.mjs';
let code=fs.readFileSync(source,'utf8');

const from="if(spec.mobile){if(fields.tracks!==2||!sideBrand||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
const to="if(spec.mobile){if(fields.tracks!==2||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}";
if(!code.includes(from))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${from}`);
code=code.replace(from,to);

fs.writeFileSync(runtime,code);
try{
  await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-contract=${Date.now()}`);
}finally{
  fs.rmSync(runtime,{force:true});
}
