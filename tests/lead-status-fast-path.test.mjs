import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const routePath=new URL("../app/api/leads/[id]/route.ts",import.meta.url);
const dbPath=new URL("../lib/wdccDb.ts",import.meta.url);
const migrationPath=new URL("../db/20260827_001_wdcc_neon_business_flow.sql",import.meta.url);

test("lead status mutation keeps live authorization and update in one Neon request",async()=>{
  const [route,dbSource,migration]=await Promise.all([
    readFile(routePath,"utf8"),readFile(dbPath,"utf8"),readFile(migrationPath,"utf8")
  ]);
  assert.match(route,/signedSessionSubject\(\)/,"route must verify the signed cookie locally");
  assert.match(route,/updateLeadStatusForSignedSession\(/,"route must use the atomic live-auth mutation");
  assert.doesNotMatch(route,/currentUser\(/,"valid PATCH must not perform a separate Neon session lookup");
  assert.doesNotMatch(route,/canonicalDealerId\(/,"valid PATCH must not perform a dealer preflight query");

  const start=dbSource.indexOf("export async function updateLeadStatusForSignedSession");
  const end=dbSource.indexOf("export async function updateLeadStatus(",start);
  assert.ok(start>=0&&end>start,"single-query lead status helper is missing");
  const helper=dbSource.slice(start,end);
  assert.equal((helper.match(/db\(\)\.query\(/g)||[]).length,1,"helper must issue exactly one Neon request");
  assert.doesNotMatch(helper,/assertWddcSchemaReady\(|canonicalDealerId\(|getLead\(/,"helper must not hide a query waterfall");
  assert.match(helper,/lower\(u\.email\)=lower\(\$2\)/);
  assert.match(helper,/not coalesce\(u\.banned,false\)/);
  assert.match(helper,/d\.id=\$4::uuid and d\.slug=\$5 and d\.status='active'/);
  assert.match(helper,/m\.user_id=u\.id and m\.dealer_id=d\.id and m\.status='active'/);
  assert.match(helper,/join actor a on a\.tenant_id=l\.dealer_id/);
  assert.match(helper,/update public\.leads/);
  assert.match(helper,/insert into public\.events/);
  assert.match(helper,/select to_jsonb\(saved\) from enriched saved/);
  assert.match(migration,/wdcc_outbox_events_aggregate_created_idx[\s\S]*aggregate_type,aggregate_id,created_at desc/);
});
