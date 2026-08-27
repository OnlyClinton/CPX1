import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  The historical real-record/media fixture is useful; legacy density assertions are not.
  This wrapper binds populated-state QA to the current owner contract:
    - desktop featured inventory: exactly 3 columns (up to 5 populated records)
    - phone featured inventory: one dominant horizontal snap card with a controlled peek
    - phone Add/Edit: one readable field column, stacked work layout, top brand only
*/
const source='scripts/wdcc-verified-real-snapshot-visual-stress.mjs';
const runtime='scripts/.wdcc-verified-real-snapshot-owner-contract.runtime.mjs';
let code=fs.readFileSync(source,'utf8');

const rewrites=[
  [
    "g.display!=='grid'||g.tracks!==5||count!==5",
    "g.display!=='grid'||g.tracks!==3||count!==5"
  ],
  [
    "return{display:s.display,count:cards.length,cardW:cards[0]?.width||0,secondX:cards[1]?.x||9999,viewport:innerWidth,uH:u?.height,hTop:h?.top,hBottom:h?.bottom,heroTop:hero?.top}",
    "return{display:s.display,snap:s.scrollSnapType,count:cards.length,cardW:cards[0]?.width||0,secondX:cards[1]?.x||9999,viewport:innerWidth,uH:u?.height,hTop:h?.top,hBottom:h?.bottom,heroTop:hero?.top}"
  ],
  [
    "d.display!=='flex'||count!==5||d.cardW>d.viewport*.46||d.cardW<d.viewport*.28||d.secondX>=d.viewport",
    "d.display!=='flex'||!String(d.snap||'').includes('x')||count!==5||d.cardW>d.viewport*.90||d.cardW<d.viewport*.78||d.secondX<d.viewport*.88||d.secondX>=d.viewport"
  ],
  [
    "if(spec.mobile){if(fields.tracks!==2||!sideBrand||!topBrand)fail('MOBILE_EDITOR_3293',{fields,layout,sideBrand,topBrand})}",
    "if(spec.mobile){if(fields.tracks!==1||layout.display!=='block'||sideBrand||!topBrand)fail('MOBILE_EDITOR_OWNER_CONTRACT',{fields,layout,sideBrand,topBrand})}"
  ]
];

for(const [from,to] of rewrites){
  if(!code.includes(from))throw new Error(`OWNER_CONTRACT_STRESS_SOURCE_DRIFT: ${from}`);
  code=code.replace(from,to);
}

fs.writeFileSync(runtime,code);
try{
  await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-contract=${Date.now()}`);
}finally{
  fs.rmSync(runtime,{force:true});
}
