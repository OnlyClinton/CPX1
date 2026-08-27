import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Owner-contract wrapper for the verified historical real-record visual stress lane.
  The historical stress fixture is valuable for populated-state QA, but its first
  density assertions predated the locked owner contract. This wrapper keeps the
  latest real-record/media fixture and every downstream assertion while binding
  storefront geometry to the current acceptance contract:
    - desktop featured inventory: 3 columns, up to 5 populated items
    - phone featured inventory: one dominant horizontal snap card with a small
      next-card peek, never a squeezed two-up strip
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
