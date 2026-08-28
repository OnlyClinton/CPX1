import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("runtime schema readiness requires durable lead idempotency and tenant contracts",async()=>{
  const source=await read("lib/wdccDb.ts");
  for(const marker of [
    "wdcc_leads_dealer_idempotency_uidx","wdcc_outbox_events_idempotency_uidx",
    "wdcc_outbox_events_aggregate_created_idx","validated_constraints","outbox_defaults",
    "lead_defaults_trigger","outbox_primary_key","outbox_dealer_fk"
  ])assert.ok(source.includes(marker),`Runtime schema contract is missing ${marker}`);
  assert.match(source,/trigger_state\.tgrelid='public\.leads'::regclass[\s\S]*trigger_function\.proname='wdcc_bind_lead_defaults'/);
  assert.match(source,/WDCC_SCHEMA_CONTRACT_INCOMPLETE/);
});

test("migrations validate checks, harden outbox fields, and attach the QA binding trigger",async()=>{
  const [business,qa]=await Promise.all([
    read("db/20260827_001_wdcc_neon_business_flow.sql"),
    read("db/20260828_002_wdcc_tenant_bound_qa_leads.sql")
  ]);
  for(const column of ["dealer_id","aggregate_type","aggregate_id","event_type","idempotency_key","payload","status","attempts","available_at","created_at","updated_at"]){
    assert.match(business,new RegExp(`alter column ${column} set not null`),`Outbox migration does not require ${column}`);
  }
  for(const constraint of ["wdcc_vehicles_visibility_check","wdcc_leads_monthly_income_check","wdcc_leads_down_payment_check","wdcc_outbox_status_check_v1"]){
    assert.match(business,new RegExp(`validate constraint ${constraint}`),`Migration does not validate ${constraint}`);
  }
  assert.match(business,/foreign key\(dealer_id\) references public\.dealers\(id\) on delete cascade not valid/);
  assert.match(qa,/create trigger wdcc_tenant_bound_lead_defaults_before_insert_v3[\s\S]*execute function public\.wdcc_bind_lead_defaults\(\)/);
});

test("launch proof independently verifies the deployed schema contract",async()=>{
  const proof=await read("tests/launch-readiness/run.mjs");
  for(const marker of ["outbox_columns","outbox_defaults","required_indexes","validated_checks","outbox_primary_key","outbox_dealer_fk","lead_defaults_trigger"]){
    assert.ok(proof.includes(marker),`Launch proof does not verify ${marker}`);
  }
  assert.match(proof,/assert\.deepEqual\(schemaContract/);
});
