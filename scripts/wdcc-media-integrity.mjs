import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const assets = [
  {path: "public/wdcc-hero-v2.webp", minBytes: 100_000},
  {path: "public/wdcc-logo-transparent.webp", minBytes: 40_000},
  {path: "public/assets/hero-car.webp", minBytes: 100_000},
  {path: "public/assets/cars/2004-nissan-350z-1.webp", minBytes: 180_000, inventory: true},
  {path: "public/assets/cars/2016-ford-f150-limited-1.webp", minBytes: 90_000, inventory: true},
  {path: "public/assets/cars/2019-honda-pilot-1.webp", minBytes: 110_000, inventory: true},
  {path: "public/assets/cars/2019-kia-sportage-1.webp", minBytes: 150_000, inventory: true},
  {path: "public/assets/cars/2019-toyota-rav4-1.webp", minBytes: 65_000, inventory: true},
];

const inventoryHashes=new Set();

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
  if(asset.inventory)inventoryHashes.add(createHash("sha256").update(file).digest("hex"));
}

if(inventoryHashes.size!==5)throw new Error(`inventory media is not unique (${inventoryHashes.size}/5 unique)`);

console.log(`WDCC_MEDIA_INTEGRITY=PASS assets=${assets.length} inventory_unique=${inventoryHashes.size}`);
