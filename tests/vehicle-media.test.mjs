import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
  captureVehicleMedia,
  isVehicleMediaPathname,
  parseVehicleMediaPathname,
  readCapturedVehicleMedia,
  vehicleMediaCaptureRoot,
  verifyVehicleMediaPathnames
} from "../lib/vehicleMedia.ts";

test("vehicle media paths stay vehicle-scoped and local capture is verifiable",async()=>{
  const previousNodeEnv=process.env.NODE_ENV,previousCapture=process.env.WDCC_E2E_MEDIA_DIR;
  const root=await mkdtemp(join(tmpdir(),"wdcc-media-test-"));
  const vehicleId="113cce52-03e4-4cda-a7f3-4c615da729cf";
  const pathname=`media/wdcc/${vehicleId}/56dc9c6f-1783-43a6-846f-20dde25167a8-front.jpg`;
  try{
    process.env.NODE_ENV="production";
    process.env.WDCC_E2E_MEDIA_DIR=root;
    assert.equal(vehicleMediaCaptureRoot(),null,"production must never enable the local capture path");

    process.env.NODE_ENV="test";

    assert.deepEqual(parseVehicleMediaPathname(pathname),{pathname,vehicleId,filename:"56dc9c6f-1783-43a6-846f-20dde25167a8-front.jpg"});
    assert.equal(isVehicleMediaPathname(vehicleId,pathname),true);
    assert.equal(isVehicleMediaPathname("different-vehicle",pathname),false);
    assert.equal(parseVehicleMediaPathname(`media/wdcc/${vehicleId}/../secret.jpg`),null);
    assert.equal(parseVehicleMediaPathname(`media/wdcc/${vehicleId}/not-an-image.txt`),null);

    const bytes=new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0xff,0xd9]);
    const stored=await captureVehicleMedia(pathname,bytes,"image/jpeg");
    assert.equal(stored.provider,"e2e-local-capture");
    assert.equal(stored.size,bytes.byteLength);
    assert.match(stored.sha256,/^[0-9a-f]{64}$/);

    const captured=await readCapturedVehicleMedia(pathname);
    assert.equal(captured?.metadata.contentType,"image/jpeg");
    assert.deepEqual(captured?.body,bytes);

    const verified=await verifyVehicleMediaPathnames(vehicleId,[pathname]);
    assert.equal(verified.ok,true);
    assert.deepEqual(verified.missing,[]);
    assert.deepEqual(verified.verified,[pathname]);
  }finally{
    if(previousNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNodeEnv;
    if(previousCapture===undefined)delete process.env.WDCC_E2E_MEDIA_DIR;else process.env.WDCC_E2E_MEDIA_DIR=previousCapture;
    assert.ok(root.startsWith(`${tmpdir()}/wdcc-media-test-`));
    await rm(root,{recursive:true,force:true});
  }
});
