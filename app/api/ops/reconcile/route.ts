import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {readRecentAnalyticsEvents} from "../../../../lib/analyticsAudit";
import {readRecentDeadLetters} from "../../../../lib/deadLetter";
import {publicVehicles,readState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const roles=new Set(["dealer_agent","tenant_admin","platform_admin"]);

export async function GET(){
  const user=await currentUser().catch(()=>null);
  if(!user||!roles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  try{
    const state=await readState();
    const tenantId=String(user.tenantId||"wdcc");
    const admin=String(user.role).toLowerCase()==="platform_admin";
    const leads=(admin?state.leads:state.leads.filter((x:any)=>String(x?.tenantId||"wdcc")===tenantId)).filter((x:any)=>x?.qa!==true&&String(x?.status||"").toLowerCase()!=="test");
    const vehicles=(admin?state.vehicles:state.vehicles.filter((x:any)=>String(x?.tenantId||"wdcc")===tenantId));
    const analytics=await readRecentAnalyticsEvents(500,admin?null:tenantId);
    const deadLetters=(await readRecentDeadLetters(500)).filter((x:any)=>admin||String(x?.tenantId||"wdcc")===tenantId);

    const persistedLeadIds=new Set(analytics.filter((x:any)=>x?.event==="lead.persisted"&&x?.leadId).map((x:any)=>String(x.leadId)));
    const missingLeadAnalytics=leads.filter((x:any)=>!persistedLeadIds.has(String(x.id))).map((x:any)=>({id:x.id,kind:x.kind,createdAt:x.createdAt,source:x.source||null,sync:x.sync||null}));
    const pendingLeadSync=leads.filter((x:any)=>String(x?.sync?.upstream||"")!=="synced").map((x:any)=>({id:x.id,upstream:x?.sync?.upstream||"unknown",lastError:x?.sync?.lastError||null,createdAt:x.createdAt}));
    const failedNotifications=leads.filter((x:any)=>Object.values(x?.notifications||{}).some((v:any)=>String(v||"").startsWith("failed"))).map((x:any)=>({id:x.id,notifications:x.notifications,createdAt:x.createdAt}));

    const publicIds=new Set(publicVehicles(state).map((x:any)=>String(x.id)));
    const publishedNotPublic=vehicles.filter((x:any)=>String(x?.status||"").toLowerCase()==="published"&&!publicIds.has(String(x.id))).map((x:any)=>({id:x.id,stock:x.stock||null,year:x.year||null,make:x.make||null,model:x.model||null,status:x.status||null}));
    const openDeadLetters=deadLetters.filter((x:any)=>String(x?.status||"open")!=="resolved");

    const issues={missingLeadAnalytics,pendingLeadSync,failedNotifications,publishedNotPublic,openDeadLetters};
    const counts={leads:leads.length,vehicles:vehicles.length,analytics:analytics.length,missingLeadAnalytics:missingLeadAnalytics.length,pendingLeadSync:pendingLeadSync.length,failedNotifications:failedNotifications.length,publishedNotPublic:publishedNotPublic.length,openDeadLetters:openDeadLetters.length};
    const ok=counts.missingLeadAnalytics===0&&counts.pendingLeadSync===0&&counts.failedNotifications===0&&counts.publishedNotPublic===0&&counts.openDeadLetters===0;
    return NextResponse.json({ok,degraded:!ok,checkedAt:new Date().toISOString(),counts,issues},{status:ok?200:503,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
  }catch(error){return NextResponse.json({ok:false,degraded:true,error:error instanceof Error?error.message:"reconciliation_failed"},{status:500,headers:{"Cache-Control":"private, no-store"}});}
}
