import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("the exact VehicleEditor publish payload verifies media before one atomic signed write",async()=>{
  const[route,dbSource,mediaSource,harness]=await Promise.all([
    read("app/api/inventory/[id]/route.ts"),
    read("lib/wdccDb.ts"),
    read("lib/vehicleMedia.ts"),
    read("tests/launch-readiness/run.mjs")
  ]);

  assert.match(route,/vehicleEditorPublishKeys=new Set\(\["photoPathnames","primaryPhotoPathname","status","internalOnly","visibility"\]\)/);
  assert.match(route,/bodyKeys\.length===vehicleEditorPublishKeys\.size&&bodyKeys\.every\(key=>vehicleEditorPublishKeys\.has\(key\)\)/);
  const fastStart=route.indexOf("if(vehicleEditorPublishShape)");
  const fastEnd=route.indexOf("const[authResult,vehicleResult]",fastStart);
  assert.ok(fastStart>=0&&fastEnd>fastStart,"exact publish fast path is missing");
  const fastPath=route.slice(fastStart,fastEnd);
  assert.match(fastPath,/subject=await signedSessionSubject\(\)/);
  assert.doesNotMatch(fastPath,/currentUser\(|canonicalDealerId\(|getVehicle\(|updateVehicle\(/,"fast publish must not retain a Neon preflight or write waterfall");
  assert.match(fastPath,/photoPathnames\.length<1\|\|body\.photoPathnames\.length>10/);
  assert.match(fastPath,/new Set\(canonicalPathnames\)\.size!==canonicalPathnames\.length/);
  assert.match(fastPath,/isVehicleMediaPathname\(id,value\)/);
  assert.match(fastPath,/canonicalPathnames\.includes\(primaryPhotoPathname\)/);
  assert.match(fastPath,/visibility!==publishVisibility/);
  const verify=fastPath.indexOf("verifyVehicleMediaPathnamesForPublish(id,canonicalPathnames)");
  const publish=fastPath.indexOf("publishVehicleForSignedSession({");
  assert.ok(verify>=0&&publish>verify,"every media object must be externally verified before the atomic Neon write");
  assert.match(fastPath,/mediaVerified=!mediaAuthorityFailed&&mediaCheck\?\.ok===true/);
  assert.match(fastPath,/media_authority_unavailable"},503/);
  assert.match(fastPath,/publication\.outcome==="unauthorized"[\s\S]*"Unauthorized"},401/);
  assert.match(fastPath,/publication\.outcome==="status_conflict"[\s\S]*vehicle_status_conflict/);
  const unauthorizedOutcome=fastPath.indexOf('publication.outcome==="unauthorized"');
  const missingOutcome=fastPath.indexOf('publication.outcome==="not_found"');
  const conflictOutcome=fastPath.indexOf('publication.outcome==="status_conflict"');
  const mediaOutcome=fastPath.indexOf('publication.outcome==="media_unverified"');
  assert.ok(unauthorizedOutcome>=0&&missingOutcome>unauthorizedOutcome&&conflictOutcome>missingOutcome&&mediaOutcome>conflictOutcome,"live authorization and scoped lifecycle outcomes must precede media-state responses");

  const helperStart=dbSource.indexOf("export async function publishVehicleForSignedSession");
  const helperEnd=dbSource.indexOf("export async function updateVehicle",helperStart);
  assert.ok(helperStart>=0&&helperEnd>helperStart,"atomic signed publish helper is missing");
  const helper=dbSource.slice(helperStart,helperEnd);
  assert.equal((helper.match(/db\(\)\.query\(/g)||[]).length,1,"publish helper must use one Neon request");
  assert.doesNotMatch(helper,/assertWddcSchemaReady\(|canonicalDealerId\(|resolvePortalAccess\(|getVehicle\(|updateVehicle\(/);
  for(const marker of [
    "isVehicleMediaPathname(input.vehicleId,pathname)",
    "d.id=$4::uuid and d.slug=$5 and d.status='active'",
    "u.id=$1::uuid","lower(u.email)=lower($2)","not coalesce(u.banned,false)",
    "a.is_platform_admin=true and a.status='active'",
    "m.user_id=u.id and m.dealer_id=d.id and m.status='active' and r.scope='dealer'",
    "join actor a on a.tenant_id=v.dealer_id","v.id=$6::uuid",
    "jsonb_array_elements(case when jsonb_typeof(sv.media)='array' then sv.media else '[]'::jsonb end)",
    "v.status=sv.status and v.status in ('draft','published') and $11::boolean",
    "status='published'","primary_image_url=$8","internal_only=$9","visibility=$10"
  ])assert.ok(helper.includes(marker),`atomic publish helper is missing invariant: ${marker}`);
  assert.match(helper,/actorId!==input\.subject\.id\|\|actorEmail!==email\|\|actorRole!==role\|\|actorTenantId!==input\.subject\.tenantId/);
  assert.ok(helper.indexOf('if(!row.access_ok)return {outcome:"unauthorized"}')<helper.indexOf('if(!row.vehicle_exists)return {outcome:"not_found"}'),"authorization must precede tenant-scoped existence");
  assert.ok(helper.indexOf('if(!row.vehicle_exists)return {outcome:"not_found"}')<helper.indexOf('if(!input.mediaVerified)return {outcome:"media_unverified"}'),"tenant-scoped existence must precede media state");
  assert.match(helper,/typeof row\.current_status!=="string"/,"malformed lifecycle data must fail closed");
  assert.match(helper,/!Array\.isArray\(row\.vehicle\.media\)/,"malformed write results must throw instead of returning a false success");
  assert.match(helper,/!row\.vehicle\)return \{outcome:"status_conflict",status:"concurrent_change"\}/);

  assert.match(mediaSource,/BlobNotFoundError/);
  assert.match(mediaSource,/verifyVehicleMediaPathnamesForPublish/);
  assert.match(mediaSource,/VEHICLE_MEDIA_PUBLISH_VERIFY_TIMEOUT_MS=5_000/);
  assert.match(mediaSource,/abortSignal:AbortSignal\.timeout\(VEHICLE_MEDIA_PUBLISH_VERIFY_TIMEOUT_MS\)/);
  assert.match(mediaSource,/WDCC_VEHICLE_MEDIA_AUTHORITY_UNAVAILABLE/);
  assert.match(mediaSource,/WDCC_VEHICLE_MEDIA_METADATA_INVALID/);

  assert.match(harness,/data:\{photoPathnames:\[photoPathname\],primaryPhotoPathname:photoPathname,status:"published",internalOnly:false,visibility:"public"\}/);
  assert.match(harness,/const MUTATION_BUDGET_MS=20_000/);
  assert.match(harness,/const READ_BUDGET_MS=15_000/);
});
