import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {measureDealerMediaEvidence} from "./wdcc-dealer-media-evidence.mjs";

const primary="public/wdcc-mockup-preview/2020-dodge-challenger-sxt.webp";
const references=[
  "public/wdcc-dealer-proof/reference-only/01-front-angle.webp",
  "public/wdcc-dealer-proof/reference-only/02-interior.webp",
  "public/wdcc-dealer-proof/reference-only/03-rear-road.webp",
  "public/wdcc-dealer-proof/reference-only/04-rear-skyline.webp",
  "public/wdcc-dealer-proof/reference-only/05-rear-side.webp",
  "public/wdcc-dealer-proof/reference-only/06-rear-close.webp"
];

test("approved desktop and mobile dealer media sets are visually distinct",async()=>{
  const desktop=await measureDealerMediaEvidence([primary,...references.slice(0,4)]);
  const mobile=await measureDealerMediaEvidence([primary,...references]);
  assert.equal(desktop.pass,true);
  assert.equal(mobile.pass,true);
  assert.equal(new Set(mobile.items.map(item=>item.sourceId)).size,7);
  assert.equal(new Set(mobile.items.map(item=>item.sourceSha256)).size,7);
  assert.equal(new Set(mobile.items.map(item=>item.perceptualFingerprint)).size,7);
  assert.equal(mobile.pairwise.length,21);
  assert.ok(mobile.pairwise.every(pair=>pair.pass));
});

test("renamed duplicate bytes cannot satisfy source uniqueness",async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"wdcc-media-evidence-"));
  const renamed=path.join(temporary,"renamed.webp");
  try{
    fs.copyFileSync(primary,renamed);
    const evidence=await measureDealerMediaEvidence([primary,renamed]);
    assert.equal(evidence.pass,false);
    assert.equal(new Set(evidence.items.map(item=>item.sourceSha256)).size,1);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("minor derivative recrop cannot masquerade as a distinct view",async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"wdcc-media-recrop-"));
  const recrop=path.join(temporary,"recrop.webp");
  try{
    const metadata=await sharp(primary).metadata();
    await sharp(primary).extract({left:1,top:0,width:metadata.width-1,height:metadata.height}).resize(metadata.width,metadata.height).webp({quality:96}).toFile(recrop);
    const evidence=await measureDealerMediaEvidence([primary,recrop]);
    assert.equal(evidence.pass,false);
    assert.ok(evidence.pairwise.some(pair=>!pair.pass));
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
