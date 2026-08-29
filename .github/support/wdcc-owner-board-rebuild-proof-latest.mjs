import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const sourcePath=new URL('./wdcc-owner-board-rebuild-proof.mjs',import.meta.url);
let src=fs.readFileSync(sourcePath,'utf8');

const oldAssertion="if(hm.display!=='flex'||hm.cards.length!==5||hm.cards[0].w<330||hm.cards[0].w>370||hm.cards[1].x<350||hm.ctas.length!==2||hm.ctas[1].y<=hm.ctas[0].bottom||!hm.menu||hm.menu.w<38||!hm.call||hm.call.w<38||hm.benefits!==2||hm.finance!==1||hm.trust!==2)fail('HOME_MOBILE',hm);";
const latestAssertion="if(hm.display!=='flex'||hm.cards.length!==5||hm.cards[0].w<100||hm.cards[0].w>130||hm.cards[1].x>=170||hm.cards[2].x>=390||hm.cards[3].x<350||hm.cards[3].x>430||hm.ctas.length!==2||hm.ctas[1].y<=hm.ctas[0].bottom||!hm.menu||hm.menu.w<38||!hm.call||hm.call.w<38||hm.benefits!==4||hm.finance!==1||hm.trust!==2)fail('HOME_MOBILE',hm);";
if(!src.includes(oldAssertion))throw new Error('OWNER_BOARD_LATEST_MOBILE_ASSERTION_TARGET_MISSING');
src=src.replace(oldAssertion,latestAssertion);

const oldCapture="return{display:getComputedStyle(g).display,cards,ctas,menu:R(q('.rh-menu')),call:R(q('.rh-call')),benefits:tracks(q('.rh-benefits')),finance:tracks(q('.rh-steps')),trust:tracks(q('.rh-trust-grid'))}";
const latestCapture="return{display:getComputedStyle(g).display,cards,ctas,menu:R(q('.rh-menu')),call:R(q('.rh-call')),benefits:tracks(q('.rh-benefits')),finance:tracks(q('.rh-steps')),trust:tracks(q('.rh-trust-grid')),featuredEyebrow:(q('.rh-section-head small')?.textContent||'').trim(),featuredTitle:(q('.rh-section-head h2')?.textContent||'').trim()}";
if(!src.includes(oldCapture))throw new Error('OWNER_BOARD_LATEST_MOBILE_CAPTURE_TARGET_MISSING');
src=src.replace(oldCapture,latestCapture);

const latestAssertionWithHeading=latestAssertion.replace("if(hm.display", "if(hm.featuredEyebrow!=='FEATURED INVENTORY'||hm.featuredTitle!=='Vehicles ready now.'||hm.display");
if(!src.includes(latestAssertion))throw new Error('OWNER_BOARD_LATEST_HEADING_ASSERTION_TARGET_MISSING');
src=src.replace(latestAssertion,latestAssertionWithHeading);

const tmp=`/tmp/wdcc-owner-board-latest-${process.env.GITHUB_SHA||Date.now()}.mjs`;
fs.writeFileSync(tmp,src);
await import(`${pathToFileURL(tmp).href}?v=${Date.now()}`);
