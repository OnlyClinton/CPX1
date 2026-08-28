import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {isIsolatedWorkersDevPreviewHost} from "../lib/visualPreviewGate.ts";

const source=relative=>readFile(new URL(`../${relative}`,import.meta.url),"utf8");

test("visual fixtures require the server preview flag and an isolated workers.dev host",()=>{
  assert.equal(isIsolatedWorkersDevPreviewHost("sha-wdcc-v2.workers.dev","1"),true);
  assert.equal(isIsolatedWorkersDevPreviewHost("sha-wdcc-v2.workers.dev:443","1"),true);
  for(const host of ["workers.dev","dealer.wedontcarecars.com","wdcc-cpx-launch-cpxagency.vercel.app","localhost:3000","sha-wdcc-v2.workers.dev.evil.test","sha-wdcc-v2.workers.dev@evil.test"]){
    assert.equal(isIsolatedWorkersDevPreviewHost(host,"1"),false,`${host} must not receive visual fixtures`);
  }
  assert.equal(isIsolatedWorkersDevPreviewHost("sha-wdcc-v2.workers.dev","0"),false);
});

test("raw production query flags cannot activate storefront or editor fixtures",async()=>{
  const[homePage,inventoryPage,review,home,inventory,editorPage,editor,vehiclePage,vehicleClient]=await Promise.all([
    source("app/page.tsx"),source("app/inventory/page.tsx"),source("app/wdccVisualReviewInventory.ts"),
    source("app/ReferenceCloneHome.tsx"),source("app/InventoryGrid.tsx"),source("app/dealer/inventory/new/page.tsx"),
    source("app/dealer/inventory/VehicleEditor.tsx"),source("app/vehicle/[id]/page.tsx"),source("app/vehicle/[id]/VehicleDetailsClient.tsx")
  ]);
  assert.match(homePage,/allowVisualFixture=\{isIsolatedWorkersDevPreview\(await headers\(\)\)\}/);
  assert.match(inventoryPage,/allowVisualFixture=\{allowVisualFixture\}/);
  assert.match(review,/if\(!allowed\)\{sessionStorage\.removeItem\(REVIEW_KEY\);return false\}/);
  assert.match(home,/isWdccVisualReviewFixture\(allowVisualFixture\)/);
  assert.match(inventory,/isWdccVisualReviewFixture\(allowVisualFixture\)/);
  assert.match(editorPage,/allowVisualProof=\{allowVisualProof\}/);
  assert.match(editor,/visualProof=allowVisualProof&&params\.has\("visual-proof"\)/);
  assert.match(vehiclePage,/allowVisualFixture=\{isIsolatedWorkersDevPreview\(requestHeaders\)\}/);
  assert.match(vehicleClient,/isWdccVisualReviewFixture\(allowVisualFixture\)/);
});

test("vehicle details use canonical inventory and contain no recovery preemption",async()=>{
  const[page,client]=await Promise.all([source("app/vehicle/[id]/page.tsx"),source("app/vehicle/[id]/VehicleDetailsClient.tsx")]);
  for(const text of[page,client]){
    assert.doesNotMatch(text,/recoveryInventory|WDCC_RECOVERY_INVENTORY/i);
  }
  assert.match(client,/fetch\(`\/api\/inventory\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(client,/body\?\.recoveryFallback===true/);
  assert.match(client,/body\?\.inventorySource==="verified-recovery-readonly"/);
  assert.match(client,/if\(!response\.ok\|\|nonCanonical\)/);
  assert.match(client,/setVehicle\(null\);setState\("error"\)/);
});
