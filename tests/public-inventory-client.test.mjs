import assert from "node:assert/strict";
import test from "node:test";

import {loadPublicInventory,PublicInventoryRequestError,requestPublicInventory} from "../lib/publicInventoryClient.ts";

const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json"}
});

test("public inventory retries bounded transient responses and returns the live payload",async()=>{
  const responses=[new Response("temporary edge failure",{status:503}),json({error:"bad_gateway"},502),json({ok:true,items:[{id:"live-1"}]})];
  const delays=[];
  let calls=0;
  const body=await requestPublicInventory({
    fetchImpl:async()=>responses[calls++],
    retryDelaysMs:[25,75,125],
    sleep:async delay=>{delays.push(delay)}
  });
  assert.equal(calls,3);
  assert.deepEqual(delays,[25,75]);
  assert.deepEqual(body,{ok:true,items:[{id:"live-1"}]});
});

test("public inventory does not retry persistent HTTP or invalid-payload failures",async()=>{
  for(const response of [json({error:"Forbidden"},403),json(null,200)]){
    let calls=0;
    await assert.rejects(
      requestPublicInventory({fetchImpl:async()=>{calls++;return response},retryDelaysMs:[1,1],sleep:async()=>{}}),
      error=>error instanceof PublicInventoryRequestError&&error.retryable===false
    );
    assert.equal(calls,1);
  }
});

test("public inventory exposes a persistent transient failure after the retry budget",async()=>{
  let calls=0;
  await assert.rejects(
    requestPublicInventory({
      fetchImpl:async()=>{calls++;return json({error:"inventory_unavailable"},503)},
      retryDelaysMs:[10,20],sleep:async()=>{}
    }),
    error=>error instanceof PublicInventoryRequestError&&error.status===503&&error.retryable===true
  );
  assert.equal(calls,3);
});

test("public inventory bounds a hanging attempt and exposes timeout after the budget",async()=>{
  let calls=0;
  const started=Date.now();
  await assert.rejects(
    requestPublicInventory({
      fetchImpl:async()=>{calls++;return new Promise(()=>{})},
      retryDelaysMs:[],attemptTimeoutMs:15
    }),
    error=>error instanceof PublicInventoryRequestError&&error.code==="inventory_timeout"&&error.retryable===true
  );
  assert.equal(calls,1);
  assert.ok(Date.now()-started<250,"a hanging fetch must not escape the attempt deadline");
});

test("public inventory deduplicates concurrent consumers without caching the result",async()=>{
  let calls=0;
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const fetchImpl=async()=>{calls++;await gate;return json({ok:true,items:[]})};
  const first=loadPublicInventory({fetchImpl,retryDelaysMs:[]});
  const second=loadPublicInventory({fetchImpl,retryDelaysMs:[]});
  assert.equal(first,second);
  release();
  await Promise.all([first,second]);
  assert.equal(calls,1);
  await loadPublicInventory({fetchImpl,retryDelaysMs:[]});
  assert.equal(calls,2,"settled results must not become stale client cache");
});

test("public inventory retries network errors but never retries an abort",async()=>{
  let calls=0;
  const recovered=await requestPublicInventory({
    fetchImpl:async()=>{calls++;if(calls===1)throw new TypeError("network down");return json({ok:true,items:[]})},
    retryDelaysMs:[0],sleep:async()=>{}
  });
  assert.equal(recovered.ok,true);
  assert.equal(calls,2);

  const controller=new AbortController();
  controller.abort();
  let abortedCalls=0;
  await assert.rejects(
    requestPublicInventory({fetchImpl:async()=>{abortedCalls++;return json({ok:true})},signal:controller.signal}),
    error=>error?.name==="AbortError"
  );
  assert.equal(abortedCalls,0);
});
