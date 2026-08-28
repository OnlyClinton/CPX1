import fs from "node:fs";
import {createHash} from "node:crypto";
import {deflateSync} from "node:zlib";
import sharp from "sharp";

const [output,desktopStorefront,mobileStorefront,desktopDealer,mobileDealer]=process.argv.slice(2);
if(!mobileDealer){
  throw new Error("usage: node generate-wdcc-mockup-fingerprints.mjs <output> <desktop-storefront> <mobile-storefront> <desktop-dealer> <mobile-dealer>");
}

const specs={
  desktopStorefront:{path:desktopStorefront,width:65,height:96,provenance:"1000003294.png approved desktop storefront crop, 696x1024"},
  mobileStorefront:{path:mobileStorefront,width:44,height:96,provenance:"1000003354.png complete approved mobile viewport, 710x1536"},
  desktopDealer:{path:desktopDealer,width:103,height:96,provenance:"1000003293.png approved 1280px+ dealer crop, 1047x980"},
  mobileDealer:{path:mobileDealer,width:43,height:96,provenance:"1000003293.png approved mobile dealer crop, 438x973"}
};

const encoded={},cropHashes={},fingerprintHashes={};
for(const[name,spec]of Object.entries(specs)){
  cropHashes[name]=createHash("sha256").update(fs.readFileSync(spec.path)).digest("hex");
  const raw=await sharp(spec.path).resize(spec.width,spec.height,{fit:"fill",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
  fingerprintHashes[name]=createHash("sha256").update(raw).digest("hex");
  encoded[name]=deflateSync(raw,{level:9}).toString("base64");
}

const moduleText=`import {inflateSync} from "node:zlib";

export const WDCC_MOCKUP_FINGERPRINT_SIZES=${JSON.stringify(Object.fromEntries(Object.entries(specs).map(([name,{width,height}])=>[name,{width,height}])))};
export const WDCC_MOCKUP_FINGERPRINT_PROVENANCE=${JSON.stringify(Object.fromEntries(Object.entries(specs).map(([name,{provenance}])=>[name,provenance])),null,2)};
export const WDCC_MOCKUP_REFERENCE_CROP_SHA256=${JSON.stringify(cropHashes,null,2)};
export const WDCC_MOCKUP_FINGERPRINT_SHA256=${JSON.stringify(fingerprintHashes,null,2)};

// Lossless RGB spatial fingerprints derived from the user's approved crops.
// Each grid is 96px high and keeps the reference aspect ratio. The scorer
// uses contain rather than stretch, so document-height drift remains visible.
const encoded=${JSON.stringify(encoded,null,2)};

export function wdccMockupFingerprint(view){
  const value=encoded[view],size=WDCC_MOCKUP_FINGERPRINT_SIZES[view];
  if(!value||!size)throw new Error(\`unknown WDCC mockup fingerprint: \${view}\`);
  const raw=inflateSync(Buffer.from(value,"base64"));
  const expected=size.width*size.height*3;
  if(raw.length!==expected)throw new Error(\`invalid WDCC mockup fingerprint length for \${view}: \${raw.length}\`);
  return {raw,size};
}
`;
fs.writeFileSync(output,moduleText);
