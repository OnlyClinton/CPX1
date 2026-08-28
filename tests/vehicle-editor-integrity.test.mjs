import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {uploadVehiclePhotos} from "../lib/wdccUploadClient.ts";

const editorPath=new URL("../app/dealer/inventory/VehicleEditor.tsx",import.meta.url);

test("vehicle photo uploads are bounded to three workers and preserve input order",async()=>{
  const files=Array.from({length:8},(_,index)=>new File([`photo-${index}`],`photo-${index}.jpg`,{type:"image/jpeg"}));
  let active=0,maximumActive=0;
  const started=[];
  const result=await uploadVehiclePhotos({
    vehicleId:"vehicle-proof",requestId:"request-proof",files,maxConcurrency:99,
    onStart:index=>started.push(index),
    uploader:async({file})=>{
      active+=1;maximumActive=Math.max(maximumActive,active);
      const index=Number(file.name.match(/\d+/)?.[0]||0);
      await new Promise(resolve=>setTimeout(resolve,(8-index)*2));
      active-=1;
      return {pathname:`media/wdcc/vehicle-proof/${file.name}`,provider:"test",sha256:"hash",contentType:file.type,size:file.size,url:""};
    }
  });
  assert.equal(maximumActive,3);
  assert.deepEqual(started,[0,1,2,3,4,5,6,7]);
  assert.deepEqual(result.map(item=>item.pathname),files.map(file=>`media/wdcc/vehicle-proof/${file.name}`));
});

test("bounded uploads retain the first upload error and stop starting queued work",async()=>{
  const files=Array.from({length:7},(_,index)=>new File([String(index)],`${index}.jpg`,{type:"image/jpeg"}));
  const failure=new Error("provider rejected photo");
  let started=0;
  await assert.rejects(
    uploadVehiclePhotos({
      vehicleId:"vehicle-proof",requestId:"request-proof",files,
      uploader:async({file})=>{
        started+=1;
        if(file.name==="1.jpg")throw failure;
        await new Promise(resolve=>setTimeout(resolve,10));
        return {pathname:`media/wdcc/vehicle-proof/${file.name}`,provider:"test",sha256:"hash",contentType:file.type,size:file.size,url:""};
      }
    }),
    error=>error===failure
  );
  assert.equal(started,3,"only the already-active worker set may start after the first rejection");
});

test("editor resets navigation state, ignores stale loads, saves media/status atomically, and exposes native controls",async()=>{
  const source=await readFile(editorPath,"utf8");
  assert.doesNotMatch(source,/\/api\/auth\/session/,"the server-guarded editor must not add a redundant client auth waterfall");
  assert.match(source,/new AbortController\(\)/);
  assert.match(source,/signal:controller\.signal/);
  assert.match(source,/generation!==loadGeneration\.current/);
  for(const reset of ["setFiles([])","setExisting([])","setPrimary(0)","setForm({...initial})","setInternalOnly(false)","setStep(0)"]){
    assert.ok(source.includes(reset),`missing editor reset: ${reset}`);
  }
  assert.match(source,/\?scope=dealer/);
  assert.match(source,/JSON\.stringify\(\{photoPathnames:paths,primaryPhotoPathname:primaryPath,status:intent===\"published\"\?\"published\":\"draft\"/,
    "photo removal and target status must commit in one PATCH");
  assert.match(source,/aria-pressed=\{i===primary\}/);
  assert.match(source,/aria-live="polite"/);
  assert.match(source,/role="dialog"/);
  assert.match(source,/aria-modal="true"/);
  assert.match(source,/event\.key===\"Escape\"/);
  assert.match(source,/setTimeout\(\(\)=>trigger\?\.focus\(\),0\)/);
});
