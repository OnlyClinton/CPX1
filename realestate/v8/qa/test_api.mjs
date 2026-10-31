import assert from 'node:assert/strict';
import lead from '../api/lead.js';
const res = ()=>({code:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(obj){this.body=obj;return this}});
async function check(req,expect){let r=res();await lead(req,r);assert.equal(r.code,expect);assert.equal(r.body.accepted,false)};
const old=Object.fromEntries(['CPX_LEAD_STORE_URL','CPX_LEAD_STORE_TOKEN','CPX_SITE_ORIGIN'].map(k=>[k,process.env[k]]));
for(const k of Object.keys(old))delete process.env[k];
await check({method:'POST',headers:{'content-type':'application/json'},body:{name:'Test'}},503);
await check({method:'GET',headers:{},body:{}},405);
process.env.CPX_LEAD_STORE_URL='https://intake.example.test/';process.env.CPX_LEAD_STORE_TOKEN='synthetic_test_only';process.env.CPX_SITE_ORIGIN='https://preview.example.test';
await check({method:'POST',headers:{origin:'https://bad.example','content-type':'application/json'},body:{}},403);
await check({method:'POST',headers:{origin:'https://preview.example.test','content-type':'application/json'},body:{product:'estateos',name:'A'.repeat(5000)}},413);
await check({method:'POST',headers:{origin:'https://preview.example.test','content-type':'application/json'},body:{product:'estateos',name:'Example Person',email:'test@example.org',role:'Owner',interest:'Product walkthrough',consent:true}},503);
for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}
console.log('PASS: fail-closed, method, origin, size, bot protection. No network requests or PII stored.');