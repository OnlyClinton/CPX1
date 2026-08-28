import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {canStaffReadVehicleMedia,vehicleMediaIsPublic} from "../lib/vehicleMedia.ts";

const tenant="dealer-1";
const base={tenantId:tenant,dealerId:tenant,status:"published",visibility:"public",internalOnly:false,stock:"WDCC-100"};

test("vehicle media visibility is deliberate and fails closed for drafts, internal records, and QA fixtures",()=>{
  assert.equal(vehicleMediaIsPublic(base),true);
  assert.equal(vehicleMediaIsPublic({...base,status:"draft"}),false);
  assert.equal(vehicleMediaIsPublic({...base,visibility:"internal"}),false);
  assert.equal(vehicleMediaIsPublic({...base,internalOnly:true}),false);
  assert.equal(vehicleMediaIsPublic({...base,stock:"WDCC-QA-proof"}),false);
  assert.equal(vehicleMediaIsPublic({...base,badges:["CERTIFICATION"]}),false);
});

test("non-public vehicle media is limited to live staff scope",()=>{
  const draft={...base,status:"draft"};
  assert.equal(canStaffReadVehicleMedia(draft,null),false);
  assert.equal(canStaffReadVehicleMedia(draft,{role:"customer",tenantId:tenant}),false);
  assert.equal(canStaffReadVehicleMedia(draft,{role:"dealer_agent",tenantId:"dealer-2"}),false);
  assert.equal(canStaffReadVehicleMedia(draft,{role:"dealer_agent",tenantId:tenant}),true);
  assert.equal(canStaffReadVehicleMedia(draft,{role:"platform_admin",tenantId:"another"}),true);
});

test("new uploads are private and the media route authorizes DB association before streaming",async()=>{
  const [client,uploadRoute,mediaRoute]=await Promise.all([
    readFile(new URL("../lib/wdccUploadClient.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/upload/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/media/route.ts",import.meta.url),"utf8")
  ]);
  assert.match(client,/access:\"private\"/);
  assert.doesNotMatch(client,/access:\"public\"/);
  assert.match(uploadRoute,/access:\"private\"/);
  assert.match(mediaRoute,/getVehicle\(parsed\.vehicleId,\{includeNonPublic:true\}\)/);
  assert.match(mediaRoute,/const associated=/);
  assert.match(mediaRoute,/currentUser\(\)/);
  assert.match(mediaRoute,/canStaffReadVehicleMedia\(vehicle,user\)/);
  assert.match(mediaRoute,/readVehicleMediaPathname\(parsed\.pathname,\{allowPublicFallback:publicListing\}\)/);
  assert.doesNotMatch(mediaRoute,/Location:/,"the application route must not disclose a private Blob URL by redirect");
  assert.match(mediaRoute,/Cache-Control\":\"private, no-store\"/);
});
