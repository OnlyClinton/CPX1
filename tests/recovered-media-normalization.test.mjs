import assert from "node:assert/strict";
import test from "node:test";

import {normalizeWdccLegacyVehicleMedia,resolveWdccVehiclePrimaryMedia,WDCC_RECOVERED_MEDIA_PATHS} from "../lib/wdccRecoveredMediaPaths.ts";

const legacy=(filename)=>`https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/${filename}.jpg`;

test("known retired baseline vehicle blobs normalize to same-origin recovered media",()=>{
  const cases=[
    [{year:2004,make:"Nissan",model:"350Z"},WDCC_RECOVERED_MEDIA_PATHS.nissan350z],
    [{year:2016,make:"Ford",model:"F-150"},WDCC_RECOVERED_MEDIA_PATHS.fordF150],
    [{year:2019,make:"Honda",model:"Pilot"},WDCC_RECOVERED_MEDIA_PATHS.hondaPilot],
    [{year:2019,make:"Kia",model:"Sportage"},WDCC_RECOVERED_MEDIA_PATHS.kiaSportage],
    [{year:2019,make:"Toyota",model:"RAV4"},WDCC_RECOVERED_MEDIA_PATHS.toyotaRav4]
  ];
  for(const [identity,expected] of cases){
    assert.equal(normalizeWdccLegacyVehicleMedia({...identity,primaryImageUrl:legacy("retired-baseline")}),expected);
  }
});

test("unknown and dealer-upload media pass through unchanged",()=>{
  const unknownVehicle=legacy("unknown-vehicle");
  assert.equal(normalizeWdccLegacyVehicleMedia({year:2024,make:"Ford",model:"F-150",primaryImageUrl:unknownVehicle}),unknownVehicle);
  const currentBlob="https://new-store.public.blob.vercel-storage.com/media/wdcc/vehicle/front.webp";
  assert.equal(normalizeWdccLegacyVehicleMedia({year:2016,make:"Ford",model:"F-150",primaryImageUrl:currentBlob}),currentBlob);
});

test("canonical media resolution serves recovered files directly and prioritizes new uploads",()=>{
  const baseline=resolveWdccVehiclePrimaryMedia({
    id:"11111111-1111-4111-8111-111111111111",year:2004,make:"Nissan",model:"350Z",
    mediaPathnames:[],primaryImageUrl:legacy("350z")
  });
  assert.equal(baseline.primaryPhotoPathname,null,"same-origin static recovery media must not be sent through /api/media");
  assert.equal(baseline.directImageUrl,WDCC_RECOVERED_MEDIA_PATHS.nissan350z);
  assert.equal(baseline.primaryImageUrl,WDCC_RECOVERED_MEDIA_PATHS.nissan350z);

  const vehicleId="33333333-3333-4333-8333-333333333333";
  const uploaded=`media/wdcc/${vehicleId}/fresh-dealer-photo.webp`;
  const updated=resolveWdccVehiclePrimaryMedia({
    id:vehicleId,year:2004,make:"Nissan",model:"350Z",
    mediaPathnames:[uploaded],primaryImageUrl:legacy("stale-350z")
  });
  assert.equal(updated.primaryPhotoPathname,uploaded);
  assert.equal(updated.directImageUrl,null);
  assert.equal(updated.primaryImageUrl,uploaded);
});
