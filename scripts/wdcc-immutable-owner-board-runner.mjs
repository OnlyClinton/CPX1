import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

/*
  Current-owner-board runner for the immutable visual lane.
  The canonical proof remains unchanged in-repo; this runner patches only
  superseded geometry literals in the temporary executable copy.
  Keeping this runner under scripts/ also gives the full acceptance matrix one
  shared exact-SHA trigger after proof-harness corrections, without app changes.
*/
const sourcePath='scripts/wdcc-immutable-visual-proof.mjs';
const runtime='scripts/.wdcc-immutable-owner-board.runtime.mjs';
let code=fs.readFileSync(sourcePath,'utf8');

const injectionPoint='source=source.replace(oldMobileEditor,newMobileEditor);';
if(!code.includes(injectionPoint))throw new Error(`IMMUTABLE_OWNER_BOARD_WRAPPER_DRIFT: ${injectionPoint}`);
const injection=`${injectionPoint}\nconst ownerBoardPairs=[['(mobileHome.logoW||0)<90','(mobileHome.logoW||0)<58'],['(mobileHome.callW||0)<44','(mobileHome.callW||0)<40'],['mobileHome.benefitTracks!==2','mobileHome.benefitTracks!==4'],['desktopHome.logoW<100','desktopHome.logoW<60']];\nfor(const [from,to] of ownerBoardPairs){if(!source.includes(from))throw new Error(\`IMMUTABLE_OWNER_BOARD_SOURCE_DRIFT: \${from}\`);source=source.replace(from,to);}`;
code=code.replace(injectionPoint,injection);

const brandFrom='minWidth:90,minHeight:90';
const brandTo='minWidth:58,minHeight:58';
if(!code.includes(brandFrom))throw new Error(`IMMUTABLE_OWNER_BOARD_BRAND_DRIFT: ${brandFrom}`);
code=code.replace(brandFrom,brandTo);

fs.writeFileSync(runtime,code);
try{
  await import(`${pathToFileURL(process.cwd()+'/'+runtime).href}?owner-board=${Date.now()}`);
}finally{
  fs.rmSync(runtime,{force:true});
}
