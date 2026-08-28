import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("dashboard authorization and both datasets share one bounded Neon query",async()=>{
  const[route,dbSource,harness]=await Promise.all([
    read("app/api/crm/dashboard/route.ts"),
    read("lib/wdccDb.ts"),
    read("tests/launch-readiness/run.mjs")
  ]);

  assert.match(route,/import \{signedSessionSubject\} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/auth"/);
  assert.match(route,/dashboardBundleForSignedSession\(subject\)/);
  assert.doesNotMatch(route,/currentUser\(|canonicalDealerId\(|listLeads\(|listVehicles\(/,"dashboard route must not retain a Neon preflight or data waterfall");
  assert.match(route,/if\(bundle\.outcome!=="authorized"\)return NextResponse\.json\(\{ok:false,error:"Unauthorized"\},\{status:401,headers\}\)/);
  assert.match(route,/const storedLeads=bundle\.leads,inventory=bundle\.inventory/);

  const start=dbSource.indexOf("export async function dashboardBundleForSignedSession");
  const end=dbSource.indexOf("export async function getLead",start);
  assert.ok(start>=0&&end>start,"atomic dashboard helper is missing");
  const helper=dbSource.slice(start,end);
  assert.equal((helper.match(/dashboardReadQuery\(/g)||[]).length,1,"dashboard helper must issue one logical read request");
  assert.doesNotMatch(helper,/assertWddcSchemaReady\(|canonicalDealerId\(|resolvePortalAccess\(|listLeads\(|listVehicles\(/,"atomic dashboard helper must not hide a query waterfall");
  for(const marker of [
    "d.id=$4::uuid and d.slug=$5 and d.status='active'",
    "u.id=$1::uuid","lower(u.email)=lower($2)","not coalesce(u.banned,false)",
    "a.is_platform_admin=true and a.status='active'","m.user_id=u.id and m.dealer_id=d.id and m.status='active' and r.scope='dealer'",
    "join actor a on a.tenant_id=l.dealer_id","join actor a on a.tenant_id=v.dealer_id",
    "dealer_id=l.dealer_id and aggregate_type='lead' and aggregate_id=l.id","order by created_at desc,id desc","as leads","as inventory"
  ])assert.ok(helper.includes(marker),`dashboard helper is missing security/data marker: ${marker}`);
  assert.match(helper,/actorId!==subject\.id\|\|actorEmail!==email\|\|actorRole!==role\|\|actorTenantId!==subject\.tenantId/);
  assert.match(helper,/dashboardAggregate\(row\.leads,"leads"\)/);
  assert.match(helper,/dashboardAggregate\(row\.inventory,"inventory"\)/);
  assert.doesNotMatch(helper,/array\(row\.(?:leads|inventory)\)/,"dashboard aggregates must not silently coerce malformed data to an empty response");

  assert.match(dbSource,/DASHBOARD_QUERY_TIMEOUTS_MS=Object\.freeze\(\[8_500,4_500\] as const\)/);
  assert.match(dbSource,/DASHBOARD_RETRY_DELAY_MS=100/);
  assert.match(dbSource,/status===429\|\|\(status>=500&&status<=599\)/);
  assert.match(dbSource,/attempt===DASHBOARD_QUERY_TIMEOUTS_MS\.length-1\|\|!transientDashboardRead\(error\)/,"non-transient and exhausted reads must fail closed");
  assert.doesNotMatch(dbSource,/DASHBOARD_QUERY_TIMEOUTS_MS[^\n]*15_000|DASHBOARD_RETRY_DELAY_MS\s*=\s*[1-9]\d{3}/,"dashboard retry envelope must stay below the 15-second read budget");

  const prewarm=harness.indexOf('await api(unauth,"GET","/api/crm/dashboard",{expected:401,label:"anonymous dashboard",requireAuthority:true})');
  const login=harness.indexOf("const dealerLogin=await api(dealer",prewarm);
  const timedRead=harness.indexOf('launchBudget("dealer dashboard after publish"',login);
  assert.ok(prewarm>=0&&login>prewarm&&timedRead>login,"anonymous dashboard boundary/prewarm must occur before the unchanged timed authenticated read");
  assert.match(harness,/const READ_BUDGET_MS=15_000/,"dashboard launch budget must remain 15 seconds");
});

test("dashboard aggregate decoding rejects malformed provider results",async()=>{
  const dbSource=await read("lib/wdccDb.ts");
  const start=dbSource.indexOf("function dashboardAggregate");
  const end=dbSource.indexOf("export async function dashboardBundleForSignedSession",start);
  assert.ok(start>=0&&end>start,"strict dashboard aggregate decoder is missing");
  const moduleSource=stripTypeScriptTypes(
    dbSource.slice(start,end).replace("function dashboardAggregate", "export function dashboardAggregate"),
    {mode:"transform"}
  );
  const {dashboardAggregate}=await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
  const valid=[{id:"proof"}];
  assert.equal(dashboardAggregate(valid,"leads"),valid,"valid JSON arrays must be preserved");
  for(const malformed of [undefined,null,{},"[]",0,false]){
    assert.throws(
      ()=>dashboardAggregate(malformed,"inventory"),
      /WDCC_DASHBOARD_INVALID_INVENTORY_AGGREGATE/,
      "malformed aggregates must throw so the route returns 503 with no partial response"
    );
  }
});

test("dashboard read retry is bounded and limited to transient transport/provider failures",async()=>{
  const dbSource=await read("lib/wdccDb.ts");
  const start=dbSource.indexOf("const DASHBOARD_QUERY_TIMEOUTS_MS");
  const end=dbSource.indexOf("export async function dashboardBundleForSignedSession",start);
  assert.ok(start>=0&&end>start,"dashboard retry implementation is missing");
  const moduleSource=stripTypeScriptTypes(
    dbSource.slice(start,end)
      .replace("async function dashboardReadQuery", "export async function dashboardReadQuery")
      .replace("db().query(query,params", "globalThis.__wdccDashboardQuery(query,params"),
    {mode:"transform"}
  );
  const {dashboardReadQuery}=await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
  const previous=globalThis.__wdccDashboardQuery;
  try{
    const transientErrors=[
      Object.assign(new Error("wrapped timeout"),{sourceError:{name:"TimeoutError",message:"timed out"}}),
      Object.assign(new Error("wrapped network"),{sourceError:{name:"TypeError",message:"fetch failed"}}),
      new Error("Server error (HTTP status 429): rate limited"),
      new Error("Server error (HTTP status 503): unavailable")
    ];
    for(const transient of transientErrors){
      let calls=0;
      globalThis.__wdccDashboardQuery=async()=>{calls++;if(calls===1)throw transient;return [{ok:true}]};
      assert.deepEqual(await dashboardReadQuery("select proof",[]),[{ok:true}]);
      assert.equal(calls,2,`${transient.message} must retry exactly once`);
    }

    for(const permanent of [new Error("Server error (HTTP status 400): invalid query"),Object.assign(new Error("relation missing"),{code:"42P01"})]){
      let calls=0;
      globalThis.__wdccDashboardQuery=async()=>{calls++;throw permanent};
      await assert.rejects(()=>dashboardReadQuery("select proof",[]),error=>error===permanent);
      assert.equal(calls,1,`${permanent.message} must fail closed without retry`);
    }

    let exhaustedCalls=0;
    const exhausted=Object.assign(new Error("network exhausted"),{sourceError:{name:"TypeError",message:"socket closed"}});
    globalThis.__wdccDashboardQuery=async()=>{exhaustedCalls++;throw exhausted};
    await assert.rejects(()=>dashboardReadQuery("select proof",[]),error=>error===exhausted);
    assert.equal(exhaustedCalls,2,"transient exhaustion must stop after the bounded second attempt");
  }finally{
    if(previous===undefined)delete globalThis.__wdccDashboardQuery;
    else globalThis.__wdccDashboardQuery=previous;
  }
});
