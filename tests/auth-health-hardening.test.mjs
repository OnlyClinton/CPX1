import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {neonAuthReadiness,neonAuthUrl,revokeNeonAuthSession} from "../lib/neonAuth.ts";

const loginPath=new URL("../app/api/auth/login/route.ts",import.meta.url);
const logoutPath=new URL("../app/api/auth/logout/route.ts",import.meta.url);
const healthPath=new URL("../app/api/health/route.ts",import.meta.url);

function restore(name,value){
  if(value===undefined)delete process.env[name];
  else process.env[name]=value;
}

function authSessionHeaders(){
  const headers=new Headers();
  headers.append("set-cookie","better-auth.session_token=opaque-token; Path=/; HttpOnly; Secure; SameSite=Lax");
  return headers;
}

test("Neon Auth configuration fails closed and only accepts a managed or explicit local endpoint",()=>{
  const previous={
    NODE_ENV:process.env.NODE_ENV,
    WDCC_ENVIRONMENT:process.env.WDCC_ENVIRONMENT,
    WDCC_NEON_AUTH_URL:process.env.WDCC_NEON_AUTH_URL
  };
  try{
    process.env.NODE_ENV="production";
    delete process.env.WDCC_ENVIRONMENT;
    delete process.env.WDCC_NEON_AUTH_URL;
    assert.throws(()=>neonAuthUrl(),/WDCC_NEON_AUTH_URL_NOT_CONFIGURED/);
    assert.deepEqual(neonAuthReadiness(),{configured:false,valid:false,provider:"neon-managed-better-auth",reason:"missing"});

    process.env.WDCC_NEON_AUTH_URL="https://example.com/neondb/auth";
    assert.throws(()=>neonAuthUrl(),/WDCC_NEON_AUTH_URL_INVALID/);
    assert.equal(neonAuthReadiness().valid,false);

    const managed="https://ep-safe-proof.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
    process.env.WDCC_NEON_AUTH_URL=managed;
    assert.equal(neonAuthUrl(),managed);
    assert.equal(neonAuthReadiness().valid,true);

    process.env.NODE_ENV="development";
    process.env.WDCC_ENVIRONMENT="dev";
    process.env.WDCC_NEON_AUTH_URL="http://127.0.0.1:8787/auth";
    assert.equal(neonAuthUrl(),"http://127.0.0.1:8787/auth");
  }finally{
    restore("NODE_ENV",previous.NODE_ENV);
    restore("WDCC_ENVIRONMENT",previous.WDCC_ENVIRONMENT);
    restore("WDCC_NEON_AUTH_URL",previous.WDCC_NEON_AUTH_URL);
  }
});

test("credential checks revoke the temporary Better Auth session server-side",async()=>{
  const previousUrl=process.env.WDCC_NEON_AUTH_URL,previousFetch=globalThis.fetch;
  const managed="https://ep-safe-proof.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
  const upstreamHeaders=authSessionHeaders();
  let request=null;
  try{
    process.env.WDCC_NEON_AUTH_URL=managed;
    globalThis.fetch=async(url,init)=>{
      request={url:String(url),init};
      return new Response(null,{status:200});
    };
    await revokeNeonAuthSession(upstreamHeaders,"https://dealer.example.test");
    assert.equal(request?.url,`${managed}/sign-out`);
    assert.equal(request?.init?.method,"POST");
    assert.equal(request?.init?.headers?.cookie,"better-auth.session_token=opaque-token");
    assert.equal(request?.init?.headers?.origin,"https://dealer.example.test");

    let called=false;
    globalThis.fetch=async()=>{called=true;return new Response(null,{status:200});};
    await assert.rejects(()=>revokeNeonAuthSession(new Headers(),"https://dealer.example.test"),/SESSION_COOKIE_MISSING/);
    assert.equal(called,false,"revocation must fail before a request when the upstream session cookie is absent");
  }finally{
    restore("WDCC_NEON_AUTH_URL",previousUrl);
    globalThis.fetch=previousFetch;
  }
});

test("Neon Auth revocation retries timeout and rate-limit transients idempotently before succeeding",async()=>{
  const previousUrl=process.env.WDCC_NEON_AUTH_URL;
  const managed="https://ep-safe-proof.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
  const requests=[],delays=[];
  try{
    process.env.WDCC_NEON_AUTH_URL=managed;
    await revokeNeonAuthSession(authSessionHeaders(),"https://dealer.example.test",{
      fetch:async(url,init)=>{
        requests.push({url:String(url),init});
        if(requests.length===1){const error=new Error("attempt timed out");error.name="TimeoutError";throw error;}
        if(requests.length===2)return new Response(null,{status:429,headers:{"retry-after":"1"}});
        return new Response(null,{status:204});
      },
      sleep:async delayMs=>{delays.push(delayMs);}
    });
    assert.equal(requests.length,3);
    assert.deepEqual(delays,[250,1000]);
    for(const request of requests){
      assert.equal(request.url,`${managed}/sign-out`);
      assert.equal(request.init.method,"POST");
      assert.equal(request.init.body,"{}");
      assert.equal(request.init.headers.cookie,"better-auth.session_token=opaque-token");
      assert.ok(request.init.signal instanceof AbortSignal);
    }
  }finally{
    restore("WDCC_NEON_AUTH_URL",previousUrl);
  }
});

test("exhausted revocation transients fail closed before an app session can be issued",async()=>{
  const previousUrl=process.env.WDCC_NEON_AUTH_URL;
  const managed="https://ep-safe-proof.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
  const delays=[];
  let attempts=0;
  try{
    process.env.WDCC_NEON_AUTH_URL=managed;
    await assert.rejects(()=>revokeNeonAuthSession(authSessionHeaders(),"https://dealer.example.test",{
      fetch:async()=>{
        attempts+=1;
        if(attempts===2)throw new TypeError("transient network failure");
        return new Response(null,{status:503});
      },
      sleep:async delayMs=>{delays.push(delayMs);}
    }),/WDCC_NEON_AUTH_SESSION_REVOCATION_RETRY_EXHAUSTED:http_503:attempts=3/);
    assert.equal(attempts,3);
    assert.deepEqual(delays,[250,500]);

    const login=await readFile(loginPath,"utf8");
    const rejected=login.indexOf('if(revocationResult.status==="rejected")');
    const appSession=login.indexOf('headers.append("set-cookie",sessionCookieHeader');
    assert.ok(rejected>=0&&appSession>rejected,"the app session cookie must remain after the revocation rejection guard");
    assert.match(login.slice(rejected,appSession),/return unavailable\(\)/,"revocation exhaustion must return 503 before app-session issuance");
  }finally{
    restore("WDCC_NEON_AUTH_URL",previousUrl);
  }
});

test("Neon Auth revocation does not retry nonretryable contract responses",async()=>{
  const previousUrl=process.env.WDCC_NEON_AUTH_URL;
  const managed="https://ep-safe-proof.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
  let attempts=0,waited=false;
  try{
    process.env.WDCC_NEON_AUTH_URL=managed;
    await assert.rejects(()=>revokeNeonAuthSession(authSessionHeaders(),"https://dealer.example.test",{
      fetch:async()=>{attempts+=1;return new Response(null,{status:400});},
      sleep:async()=>{waited=true;}
    }),/WDCC_NEON_AUTH_SESSION_REVOCATION_NON_RETRYABLE:http_400:attempts=1/);
    assert.equal(attempts,1);
    assert.equal(waited,false);
  }finally{
    restore("WDCC_NEON_AUTH_URL",previousUrl);
  }
});

test("login, logout, and health retain the hardened production contracts",async()=>{
  const [login,logout,health]=await Promise.all([
    readFile(loginPath,"utf8"),readFile(logoutPath,"utf8"),readFile(healthPath,"utf8")
  ]);

  assert.match(login,/if\(validEmail\(raw\)\)return \{email:raw/,"provisioned staff emails must reach Neon Auth");
  assert.match(login,/resolvePortalAccess\(\{id:authenticatedId,email:authenticatedEmail\}\)/,"login must enforce live portal membership");
  assert.match(login,/login\.expectedRole&&user\.role!==login\.expectedRole/,"the two convenience aliases must retain their intended role boundary");
  assert.match(login,/revokeNeonAuthSession\(upstream\.headers,origin\)/,"credential-check sessions must be revoked before issuing the WDCC cookie");
  assert.match(login,/if\(!user\|\|[\s\S]*return invalidCredentials\(\)/,"access denial must use the non-enumerating credential response");
  assert.doesNotMatch(login,/portal_access_not_configured/,"login responses must not enumerate valid auth accounts without portal access");

  assert.match(logout,/upstreamRevocation:"completed_during_login"/,"logout must report why it has no upstream session to revoke");

  assert.match(health,/vehicleBlobClientUploadToken\(\)/,"health must use the exact token required by the client upload route");
  assert.doesNotMatch(health,/VERCEL_OIDC_TOKEN|BLOB_STORE_ID/,"read-only Blob credentials must not make upload readiness green");
  assert.match(health,/neonAuthReadiness\(\)/,"health must verify the explicit Neon Auth configuration");
  assert.match(health,/neon_auth_url_missing/);
  assert.match(health,/neon_auth_database_mismatch/);
  assert.match(health,/vehicle_media_upload_not_ready/);
});
