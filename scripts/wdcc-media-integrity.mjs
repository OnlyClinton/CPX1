import {readFileSync} from "node:fs";

const assets = [
  {path: "public/wdcc-hero-v2.webp", minBytes: 100_000},
  {path: "public/wdcc-logo-transparent.webp", minBytes: 40_000},
  {path: "public/assets/hero-car.webp", minBytes: 100_000},
];

for (const asset of assets) {
  const file = readFileSync(asset.path);
  const riff = file.subarray(0, 4).toString("ascii");
  const webp = file.subarray(8, 12).toString("ascii");
  const declaredBytes = file.readUInt32LE(4) + 8;

  if (riff !== "RIFF" || webp !== "WEBP") {
    throw new Error(`${asset.path}: invalid WebP signature`);
  }
  if (declaredBytes !== file.length) {
    throw new Error(`${asset.path}: truncated WebP (${file.length}/${declaredBytes} bytes)`);
  }
  if (file.length < asset.minBytes) {
    throw new Error(`${asset.path}: unexpectedly small (${file.length} bytes)`);
  }
}

console.log(`WDCC_MEDIA_INTEGRITY=PASS assets=${assets.length}`);
