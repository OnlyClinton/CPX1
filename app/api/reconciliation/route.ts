import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {readRecentAnalyticsEvents} from "../../../lib/analyticsAudit";
import {readRecentDeadLetters} from "../../../lib/deadLetter";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {readRecentVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const CPX_BACKEND_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
const readerRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);

function canonicalRuntime(request:Request){
  const project=process.env.VERCEL_PROJECT_ID||"";
  if(project===DEALER_PROJECT_ID||project===CPX_BACKEND_PROJECT_ID)return true;
  const host=new URL(request.url).host.toLowerCase();
  return host==="dealer.wedontcarecars.com"||host.includes("wdcc-dealer-portal")||host.includes("wdcc-cpx-launch");
}

function qaLead(lead:any){
  const status=String(lead?.status||"").toLowerCase();
  const name=String(lead?.name||"").toUpperCase();
  return lead?.qa===true||status==="test"||name.startsWith("WDCC QA")||name.startsWith("WDCC MATRIX")||name.startsWith("WDCC ISOLATED");
}

function badTransport(value:unknown){
  const v=String(value??"").toLowerCase();
  return v==="failed"||v.startsWith("failed_")||v==="pending"||v==="not_configured";
}

export async function GET(request:Request){
  if(!canonicalRuntime(request))return proxyDealer(request,"/api/reconciliation");
  const user=await currentUser().catch(()=>null);
  if(!user||!readerRoles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});

  try{
    const [state,events,deadLetters,vehicleAudit]=await Promise.all([
      readState(),readRecentAnalyticsEvents(500),readRecentDeadLetters(500),readRecentVehicleAudit(300)
    ]);
    const tenantId=String(user.tenantId||"wdcc");
    const platformAdmin=String(user.role||"").toLowerCase()==="platform_admin";
    const leads=state.leads.filter((lead:any)=>!qaLead(lead)&&(platformAdmin||String(lead.tenantId||"wdcc")===tenantId));
    const vehicles=state.vehicles.filter((vehicle:any)=>platformAdmin||String(vehicle.tenantId||"wdcc")===tenantId);
    const scopedEvents=events.filter((event:any)=>platformAdmin||!event.tenantId||String(event.tenantId)===tenantId);
    const scopedDead=deadLetters.filter((event:any)=>platformAdmin||!event.tenantId||String(event.tenantId)===tenantId);

    const analyticsLeadIds=new Set(scopedEvents.filter((e:any)=>e.event==="lead.persisted"&&e.leadId).map((e:any)=>String(e.leadId)));
    const leadsWithoutAnalytics=leads.filter((lead:any)=>!analyticsLeadIds.has(String(lead.id)));
    const upstreamPending=leads.filter((lead:any)=>String(lead?.sync?.upstream||"").toLowerCase()!=="synced");
    const notificationFailures=leads.filter((lead:any)=>{
      const n=lead?.notifications||{};return badTransport(n.email)||badTransport(n.sms)||badTransport(n.webhook);
    });

    const publishVerifyByVehicle=new Map<string,any>();
    for(const event of vehicleAudit){
      if(event?.action!=="vehicle.storefront_verify"||!event?.vehicleId)continue;
      if(!publishVerifyByVehicle.has(String(event.vehicleId)))publishVerifyByVehicle.set(String(event.vehicleId),event);
    }
    const published=vehicles.filter((v:any)=>String(v.status||"").toLowerCase()==="published");
    const publishedUnverified=published.filter((v:any)=>{
      const e=publishVerifyByVehicle.get(String(v.id));return !e||e.outcome!=="ok";
    });

    let publicInventory:any[]=[];let storefrontReachable=false;let storefrontError:string|null=null;
    try{
      const response=await fetch(`https://wedontcarecars.com/api/inventory?reconcile=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
      const json=await response.json().catch(()=>({}));
      publicInventory=Array.isArray(json?.items)?json.items:Array.isArray(json?.inventory)?json.inventory:[];
      storefrontReachable=response.ok;
      if(!response.ok)storefrontError=`HTTP_${response.status}`;
    }catch(error){storefrontError=error instanceof Error?error.message:"storefront_unreachable";}
    const publicIds=new Set(publicInventory.map((v:any)=>String(v.id)));
    const publishedMissingPublic=storefrontReachable?published.filter((v:any)=>!publicIds.has(String(v.id))):[];

    const issues=[
      {code:"lead_missing_analytics",severity:"high",count:leadsWithoutAnalytics.length},
      {code:"lead_upstream_not_synced",severity:"high",count:upstreamPending.length},
      {code:"lead_notification_problem",severity:"high",count:notificationFailures.length},
      {code:"vehicle_publish_unverified",severity:"high",count:publishedUnverified.length},
      {code:"vehicle_missing_public",severity:"critical",count:publishedMissingPublic.length},
      {code:"dead_letters_open",severity:"high",count:scopedDead.filter((d:any)=>String(d.status||"open")==="open").length},
      {code:"storefront_unreachable",severity:"critical",count:storefrontReachable?0:1}
    ];
    const critical=issues.filter(i=>i.severity==="critical").reduce((n,i)=>n+i.count,0);
    const high=issues.filter(i=>i.severity==="high").reduce((n,i)=>n+i.count,0);

    return NextResponse.json({
      ok:critical===0,
      generatedAt:new Date().toISOString(),
      health:critical?"critical":high?"degraded":"healthy",
      counts:{leads:leads.length,publishedVehicles:published.length,analyticsEvents:scopedEvents.length,deadLetters:scopedDead.length,critical,high},
      storefront:{reachable:storefrontReachable,error:storefrontError,publicVehicleCount:publicInventory.length},
      issues,
      samples:{
        leadsWithoutAnalytics:leadsWithoutAnalytics.slice(0,20).map((l:any)=>({id:l.id,name:l.name,kind:l.kind,source:l.source,createdAt:l.createdAt})),
        upstreamPending:upstreamPending.slice(0,20).map((l:any)=>({id:l.id,name:l.name,kind:l.kind,sync:l.sync})),
        notificationFailures:notificationFailures.slice(0,20).map((l:any)=>({id:l.id,name:l.name,notifications:l.notifications})),
        publishedUnverified:publishedUnverified.slice(0,20).map((v:any)=>({id:v.id,year:v.year,make:v.make,model:v.model,status:v.status})),
        publishedMissingPublic:publishedMissingPublic.slice(0,20).map((v:any)=>({id:v.id,year:v.year,make:v.make,model:v.model,status:v.status})),
        deadLetters:scopedDead.slice(0,30)
      }
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"reconciliation_failed"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}
