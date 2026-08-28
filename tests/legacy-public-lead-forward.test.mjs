import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const handler=require("../api/public-lead.js");

function responseCapture(){
  const headers={};
  let resolve;
  const completed=new Promise(done=>{resolve=done});
  return {
    response:{statusCode:200,setHeader(name,value){headers[String(name).toLowerCase()]=String(value)},end(body){resolve({status:this.statusCode,headers,body:JSON.parse(String(body))})}},
    completed
  };
}

async function invoke({method="POST",body={},headers={}}={}){
  const capture=responseCapture();
  await handler({method,body,headers},capture.response);
  return capture.completed;
}

test("legacy public lead route fails closed without an explicit canonical authority",async t=>{
  const original={url:process.env.WDCC_CANONICAL_LEAD_URL,backend:process.env.WDCC_DEALER_BACKEND_URL};
  delete process.env.WDCC_CANONICAL_LEAD_URL;delete process.env.WDCC_DEALER_BACKEND_URL;
  let calls=0;const priorFetch=globalThis.fetch;globalThis.fetch=async()=>{calls+=1;throw Error("unexpected")};
  t.after(()=>{globalThis.fetch=priorFetch;if(original.url===undefined)delete process.env.WDCC_CANONICAL_LEAD_URL;else process.env.WDCC_CANONICAL_LEAD_URL=original.url;if(original.backend===undefined)delete process.env.WDCC_DEALER_BACKEND_URL;else process.env.WDCC_DEALER_BACKEND_URL=original.backend});
  const result=await invoke({body:{kind:"contact",name:"Buyer",phone:"8135550100",consent:true}});
  assert.equal(result.status,503);assert.equal(result.body.persisted,false);assert.equal(result.body.error,"canonical_lead_authority_unavailable");assert.equal(calls,0);
});

test("legacy public lead route forwards legacy fields into the canonical Neon contract",async t=>{
  const prior={fetch:globalThis.fetch,url:process.env.WDCC_CANONICAL_LEAD_URL,environment:process.env.WDCC_ENVIRONMENT};
  process.env.WDCC_CANONICAL_LEAD_URL="http://127.0.0.1:43111/api/leads";process.env.WDCC_ENVIRONMENT="test";
  let request;
  globalThis.fetch=async(input,init)=>{
    request={url:String(input),init,payload:JSON.parse(String(init.body))};
    return new Response(JSON.stringify({ok:true,persisted:true,leadId:"lead-1"}),{status:201,headers:{"x-wdcc-data-authority":"neon"}});
  };
  t.after(()=>{globalThis.fetch=prior.fetch;if(prior.url===undefined)delete process.env.WDCC_CANONICAL_LEAD_URL;else process.env.WDCC_CANONICAL_LEAD_URL=prior.url;if(prior.environment===undefined)delete process.env.WDCC_ENVIRONMENT;else process.env.WDCC_ENVIRONMENT=prior.environment});
  const result=await invoke({
    headers:{"idempotency-key":"legacy-key-1","user-agent":"legacy-client","x-forwarded-for":"203.0.113.5"},
    body:{intent:"schedule-test-drive",first:"Pat",last:"Buyer",phone:"8135550101",down:"1500",vehicle:"Challenger",consent:true}
  });
  assert.equal(result.status,201);assert.equal(result.body.persisted,true);assert.equal(result.headers["x-wdcc-data-authority"],"neon");
  assert.equal(request.url,"http://127.0.0.1:43111/api/leads");assert.equal(request.init.headers["idempotency-key"],"legacy-key-1");
  assert.deepEqual({kind:request.payload.kind,name:request.payload.name,downPayment:request.payload.downPayment,vehicleInterest:request.payload.vehicleInterest,idempotencyKey:request.payload.idempotencyKey},{kind:"schedule-test-drive",name:"Pat Buyer",downPayment:"1500",vehicleInterest:"Challenger",idempotencyKey:"legacy-key-1"});
});

test("legacy public lead route rejects unsafe canonical targets and malformed payloads",async t=>{
  const prior={url:process.env.WDCC_CANONICAL_LEAD_URL,environment:process.env.WDCC_ENVIRONMENT};
  process.env.WDCC_CANONICAL_LEAD_URL="http://example.com/api/leads";process.env.WDCC_ENVIRONMENT="test";
  t.after(()=>{if(prior.url===undefined)delete process.env.WDCC_CANONICAL_LEAD_URL;else process.env.WDCC_CANONICAL_LEAD_URL=prior.url;if(prior.environment===undefined)delete process.env.WDCC_ENVIRONMENT;else process.env.WDCC_ENVIRONMENT=prior.environment});
  assert.equal((await invoke({body:{}})).status,503);
  process.env.WDCC_CANONICAL_LEAD_URL="http://127.0.0.1:43111/api/leads";
  assert.equal((await invoke({body:"not-json"})).status,400);
  assert.equal((await invoke({method:"GET"})).status,405);
});
