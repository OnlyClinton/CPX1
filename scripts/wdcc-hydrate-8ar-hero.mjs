import crypto from "node:crypto";
import fs from "node:fs/promises";

const OUTPUT = "public/wdcc-hero-v2.webp";
const EXPECTED_SIZE = 145504;
const EXPECTED_SHA256 = "1d7a0e4fced7450f2bbc66443d44b1f35bd9e24a6366308362aafa65576d3eb2";
const DONOR_DEPLOYMENT_ID = process.env.WDCC_8AR_DONOR_DEPLOYMENT_ID || "dpl_8ARLPgiW4ZKC9qwQxJrwqc2hrZzX";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_G6jmETRRl8fV3KfivPOdj8JM";

function fingerprint(buf) {
  return {
    size: buf.length,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
  };
}

function isCanonical(buf) {
  const fp = fingerprint(buf);
  return fp.size === EXPECTED_SIZE && fp.sha256 === EXPECTED_SHA256;
}

async function readCurrent() {
  try {
    return await fs.readFile(OUTPUT);
  } catch {
    return null;
  }
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`VERCEL_FILES_${response.status}`);
  return response.json();
}

function flatten(nodes, prefix = "", out = []) {
  for (const node of nodes || []) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "directory") flatten(node.children || [], path, out);
    else if (node.type === "file" && node.uid) out.push({ ...node, path });
  }
  return out;
}

async function downloadDeploymentFile(file, token) {
  const url = `https://api.vercel.com/v8/deployments/${DONOR_DEPLOYMENT_ID}/files/${file.uid}?teamId=${encodeURIComponent(TEAM_ID)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`VERCEL_FILE_${response.status}`);
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }
  const encoded = typeof parsed === "string"
    ? parsed
    : parsed?.data ?? parsed?.content ?? parsed?.file ?? parsed?.value;
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error("VERCEL_FILE_BODY_UNSUPPORTED");
  }
  return Buffer.from(encoded, "base64");
}

const current = await readCurrent();
if (current && isCanonical(current)) {
  console.log(`WDCC_8AR_HERO=CANONICAL size=${EXPECTED_SIZE} sha256=${EXPECTED_SHA256}`);
  process.exit(0);
}

if (current) {
  const fp = fingerprint(current);
  console.log(`WDCC_8AR_HERO=REPLACE_BAD size=${fp.size} sha256=${fp.sha256}`);
}

const token = process.env.VERCEL_TOKEN;
if (!token) throw new Error("VERCEL_TOKEN_REQUIRED_TO_RECOVER_8AR_HERO");

const listingUrl = `https://api.vercel.com/v6/deployments/${DONOR_DEPLOYMENT_ID}/files?teamId=${encodeURIComponent(TEAM_ID)}`;
const listing = await fetchJson(listingUrl, token);
const nodes = Array.isArray(listing) ? listing : (listing?.files || listing?.children || []);
const files = flatten(nodes);
const donor = files.find((file) => file.path === "wdcc-hero-v2.webp")
  || files.find((file) => file.path.endsWith("/wdcc-hero-v2.webp"));
if (!donor) throw new Error("CANONICAL_8AR_HERO_NOT_FOUND_IN_DONOR");

const recovered = await downloadDeploymentFile(donor, token);
const fp = fingerprint(recovered);
if (fp.size !== EXPECTED_SIZE) {
  throw new Error(`CANONICAL_8AR_HERO_SIZE_MISMATCH expected=${EXPECTED_SIZE} actual=${fp.size}`);
}
if (fp.sha256 !== EXPECTED_SHA256) {
  throw new Error(`CANONICAL_8AR_HERO_SHA_MISMATCH expected=${EXPECTED_SHA256} actual=${fp.sha256}`);
}
if (recovered.subarray(0, 4).toString("ascii") !== "RIFF" || recovered.subarray(8, 12).toString("ascii") !== "WEBP") {
  throw new Error("CANONICAL_8AR_HERO_NOT_WEBP");
}

await fs.writeFile(OUTPUT, recovered);
console.log(`WDCC_8AR_HERO=RECOVERED size=${fp.size} sha256=${fp.sha256} donor=${DONOR_DEPLOYMENT_ID}`);
