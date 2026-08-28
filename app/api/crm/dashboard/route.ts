import {NextResponse} from "next/server";
import {signedSessionSubject} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {dashboardBundleForSignedSession} from "../../../../lib/wdccDb";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-WDCC-Data-Authority":"neon"};

function stageOf(lead:any){
  const value=String(lead?.pipelineStage||lead?.status||"new").trim().toLowerCase().replace(/[\s-]+/g,"_");
  return value==="deal"||value==="dealworking"?"deal_working":value;
}

function recent(value:unknown,days:number){
  const time=new Date(String(value||"")).getTime();
  return Number.isFinite(time)&&time>=Date.now()-days*24*60*60*1000;
}

function priorityFor(lead:any){
  let score=28;
  if(lead.phone)score+=14;if(lead.email)score+=8;if(lead.vehicleInterest||lead.vehicleId)score+=13;
  if(stageOf(lead)==="appointment"||lead.kind==="schedule")score+=22;
  if(lead.kind==="approval")score+=12;
  if(recent(lead.createdAt,1))score+=8;
  if(["qualified","appointment","showed","deal_working","approved"].includes(stageOf(lead)))score+=12;
  return Math.max(0,Math.min(100,score));
}

function nextActionFor(lead:any){
  const stage=stageOf(lead);
  if(stage==="new")return lead.phone?"Call now":"Reply to the buyer";
  if(stage==="contacted"||stage==="engaged")return "Confirm vehicle fit";
  if(stage==="qualified")return "Schedule a test drive";
  if(stage==="appointment")return "Confirm appointment";
  if(stage==="showed")return "Build the deal";
  if(stage==="deal_working")return "Finish approval";
  if(stage==="approved")return "Close the sale";
  if(stage==="nurture")return "Schedule follow-up";
  return "Review customer record";
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/crm/dashboard");
  let subject;
  try{subject=await signedSessionSubject();}
  catch{return NextResponse.json({ok:false,error:"auth_backend_unavailable"},{status:503,headers});}
  if(!subject)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
  try{
    const bundle=await dashboardBundleForSignedSession(subject);
    if(bundle.outcome!=="authorized")return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
    // Suppressed QA records remain visible as records so persistence can be audited,
    // but they never contribute to customer-facing operational totals below.
    const storedLeads=bundle.leads,inventory=bundle.inventory;
    const leads=storedLeads.map(lead=>({...lead,pipelineStage:stageOf(lead),stage:stageOf(lead),priority:priorityFor(lead),nextAction:nextActionFor(lead)}));
    const operationalLeads=leads.filter(lead=>!lead.qa&&stageOf(lead)!=="test");
    const pipeline:Record<string,number>={new:0,contacted:0,engaged:0,qualified:0,appointment:0,showed:0,deal:0,deal_working:0,approved:0,sold:0,lost:0,nurture:0};
    for(const lead of operationalLeads){const stage=stageOf(lead);pipeline[stage]=(pipeline[stage]||0)+1;}
    pipeline.deal=pipeline.deal_working;
    const active=operationalLeads.filter(lead=>!["sold","lost","nurture"].includes(stageOf(lead)));
    const hotLeads=[...active].sort((a,b)=>b.priority-a.priority||new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime());
    const publishedInventory=inventory.filter(item=>["available","published"].includes(String(item.status||"").toLowerCase())&&!item.internalOnly&&item.visibility!=="internal").length;
    const summary={
      totalLeads:operationalLeads.length,
      newToday:operationalLeads.filter(lead=>stageOf(lead)==="new"&&recent(lead.createdAt,1)).length,
      newLeads:pipeline.new,
      hotLeads:hotLeads.filter(lead=>lead.priority>=70).length,
      appointments:operationalLeads.filter(lead=>stageOf(lead)==="appointment"||lead.kind==="schedule").length,
      applications:operationalLeads.filter(lead=>lead.kind==="approval"||["deal_working","approved"].includes(stageOf(lead))).length,
      approved:pipeline.approved,
      sold:pipeline.sold,
      soldThisWeek:operationalLeads.filter(lead=>stageOf(lead)==="sold"&&recent(lead.updatedAt||lead.createdAt,7)).length,
      messages:operationalLeads.filter(lead=>lead.kind==="contact").length,
      totalInventory:inventory.length,
      publishedInventory,
      draftInventory:inventory.filter(item=>String(item.status||"").toLowerCase()==="draft").length
    };
    const leadVisibility={
      returned:leads.length,
      operational:operationalLeads.length,
      suppressedQa:leads.filter(lead=>lead.qa||stageOf(lead)==="test").length
    };
    console.info(`WDCC_DASHBOARD_READ ${JSON.stringify({...leadVisibility,inventory:inventory.length})}`);
    return NextResponse.json({
      ok:true,
      summary,
      pipeline,
      hotLeads,
      leads,
      leadVisibility,
      inventory,
      generatedAt:new Date().toISOString(),
      source:"neon-canonical"
    },{headers});
  }catch{
    return NextResponse.json({ok:false,summary:{},pipeline:{},hotLeads:[],leads:[],inventory:[],error:"dashboard_read_failed",source:"neon-canonical"},{status:503,headers});
  }
}
