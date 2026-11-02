import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

export function checkedOrigin(raw) {
  const url = new URL(raw);
  assert.equal(url.protocol, "https:", "HTTPS required");
  assert.ok(!url.username && !url.password && !url.port && url.pathname === "/" && !url.search && !url.hash,
    "Bare HTTPS origin required");
  assert.ok(url.hostname === "wedontcarecars.com" || url.hostname === "www.wedontcarecars.com" ||
    /^[-a-z0-9]+\.vercel\.app$/.test(url.hostname), "Unexpected release target host");
  return url.origin;
}

async function get(origin, path) {
  const response=await fetch(origin+path,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000)});
  return {status:response.status,headers:response.headers,body:await response.text()};
}
export async function verifyCandidate(origin,request=get) {
  const routes=["/","/financing","/reviews","/about","/inventory","/get-approved",
    "/schedule-test-drive","/privacy","/terms"];
  const evidence=[],errors=[];
  for(const path of routes){
    try{
      const r=await request(origin,path);
      const html=r.body||"";
      const problems=[];
      if(r.status!==200)problems.push("HTTP "+r.status);
      if(!/We Don.t Care Cars/i.test(html))problems.push("wrong storefront identity");
      if(!r.headers.has("content-security-policy"))problems.push("missing CSP");
      if(!r.headers.has("strict-transport-security"))problems.push("missing HSTS");
      if(path==="/" && /2004-nissan-350z|2016-ford-f150-limited|2019-honda-pilot/.test(html))
        problems.push("hardcoded unverified inventory");
      evidence.push({path,http:r.status,ok:problems.length===0,problems});
      errors.push(...problems.map(problem=>path+": "+problem));
    }catch(e){errors.push(path+": "+String(e?.message||e));}
  }
  for(const path of ["/api/health","/api/inventory"]){
    try{
      const r=await request(origin,path);
      let data;try{data=JSON.parse(r.body)}catch{data={}};
      const valid=path==="/api/health"?r.status===200&&data.ok===true&&data.degraded!==true:
        r.status===200&&data.ok===true&&Array.isArray(data.items);
      evidence.push({path,http:r.status,ok:valid,reason:valid?"contract_valid":"backend_unhealthy_or_invalid"});
      if(!valid)errors.push(path+": backend unhealthy or invalid JSON contract (HTTP "+r.status+")");
    }catch(e){errors.push(path+": "+String(e?.message||e));}
  }
  return {candidate:origin,status:errors.length?"HOLD":"PASS",scope:"Read-only route, identity, HTTP security and backend health contracts. No customer submissions, authentication, DB writes or penetration tests.",errors,evidence};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const arg=process.argv.find(x=>x.startsWith("--base="));
  assert.ok(arg,"--base=https://verified-candidate-origin/ required");
  const result=await verifyCandidate(checkedOrigin(arg.slice(7)));
  console.log(JSON.stringify(result,null,2));
  if(result.status!=="PASS")process.exitCode=1;
 }catch(e){console.error("HOLD: "+e.message);process.exitCode=1;}
}
