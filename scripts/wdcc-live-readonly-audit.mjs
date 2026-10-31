/**
 * WDCC unattended read-only production evidence probe.
 * Exact allowlisted hosts/routes only, no credentials, no writes, no PII.
 * No synthetic leads, password reset requests, admin mutations or load test.
 */
import fs from "node:fs";

const targets=[
  ["https://wedontcarecars.com",["/","/inventory","/about","/get-approved","/contact","/schedule-test-drive","/forgot-password","/sitemap.xml","/api/inventory?scope=public","/api/inventory","/api/health","/api/auth/session"]],
  ["https://dealer.wedontcarecars.com",["/","/inventory","/about","/dealer/login","/forgot-password","/sitemap.xml","/api/inventory","/api/health","/api/auth/session","/api/admin/users"]]
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const at=new Date().toISOString();
const observations=[];
const maxResponseBytes=100000;
function status(row){
  const good=[200,301,302,303,307,308].includes(row.http);
  return good?"reachable":row.http===403?"blocked":row.http===404?"missing":"not_verified";
}
for(const [host,paths] of targets){
  for(const path of paths){
    const url=host+path;
    const began=Date.now();
    let entry={host,path};
    try{
      const response=await fetch(url,{method:"GET",redirect:"manual",cache:"no-store",headers:{"user-agent":"WDCC-Owner-ReadOnly-Acceptance/1.0"},signal:AbortSignal.timeout(8500)});
      entry.http=response.status;
      entry.elapsedMs=Date.now()-began;
      entry.contentType=(response.headers.get("content-type")||"").slice(0,100);
      entry.finalDestination=response.headers.get("location")?.slice(0,200)||null;
      const body=(await response.text()).slice(0,maxResponseBytes);
      if(path.startsWith("/api/inventory")&&response.ok){
        try {
          const data=JSON.parse(body);
          entry.inventory={ok:data.ok===true,count:Number(data.count||0),degraded:data.degraded===true,recordIds:(data.items||[]).slice(0,15).map(x=>String(x.id||"")).filter(Boolean)};
        } catch{entry.inventory={error:"invalid_json"}}
      }else if(path==="/api/health"&&response.ok){
        try {
          const data=JSON.parse(body),n=data.integrations||{};
          entry.health={ok:data.ok===true,degraded:data.degraded===true,revision:data.revision??null,
            emailConfigured:n.email?.configured===true,smsConfigured:n.sms?.configured===true,webhookConfigured:n.webhook?.configured===true};
        }catch{entry.health={error:"invalid_json"}}
      }else if(path==="/api/auth/session"&&response.ok){
        try{entry.anonymousSession=JSON.parse(body).authenticated===true?"ALERT_AUTHENTICATED":"ANONYMOUS"}catch{entry.anonymousSession="UNPARSEABLE"}
      }else if(path==="/dealer/login"&&response.ok){
        entry.hasForgotPasswordLink=body.includes('href="/forgot-password"');
      }
      entry.state=status(entry);
    }catch(error){
      entry.error=String(error?.message||error).slice(0,160);
      entry.elapsedMs=Date.now()-began;
      entry.state="unavailable";
    }
    observations.push(entry);
    await sleep(650);
  }
}
const find=(host,path)=>observations.find(x=>x.host.endsWith(host)&&x.path===path);
const apex=find("https://wedontcarecars.com","/api/inventory");
const dealer=find("https://dealer.wedontcarecars.com","/api/inventory");
const problems=[];
for(const [host,p,label] of [
 ["https://wedontcarecars.com","/forgot-password","apex password recovery"],
 ["https://dealer.wedontcarecars.com","/forgot-password","dealer password recovery"],
 ["https://wedontcarecars.com","/sitemap.xml","apex sitemap"],
 ["https://dealer.wedontcarecars.com","/about","dealer About link"]
])if(find(host,p)?.http!==200)problems.push(label);
if((apex?.inventory?.count??0)!==(dealer?.inventory?.count??-1))problems.push("public inventory mismatch");
if(!find("https://dealer.wedontcarecars.com","/dealer/login")?.hasForgotPasswordLink)problems.push("dealer login recovery link absent");
for(const host of ["https://wedontcarecars.com","https://dealer.wedontcarecars.com"]){
  const health=find(host,"/api/health")?.health;
  if(!health?.ok)problems.push(host+" health unavailable");
  else if(!health.emailConfigured&&!health.smsConfigured&&!health.webhookConfigured)problems.push(host+" all notification channels unconfigured");
}
const report={kind:"WDCC_READ_ONLY_ACCEPTANCE",at,source:"unauthenticated HTTP GET only",hosts:targets.map(x=>x[0]),observations,openSignals:problems,releaseAccepted:false};
console.log(JSON.stringify(report,null,2));
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary)fs.appendFileSync(summary,["## WDCC read-only acceptance observation","",
  "**No changes to users, passwords, leads or inventory.**",
  "**Open signals:** "+problems.length,"",
  ...problems.map(x=>"- "+x),"",
  "Records checked: "+observations.length+"; dates and exact statuses in workflow artifact.",""].join("\n"));
if(process.env.WDCC_AUDIT_OUTPUT)fs.writeFileSync(process.env.WDCC_AUDIT_OUTPUT,JSON.stringify(report,null,2));
