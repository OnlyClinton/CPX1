import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {isInternalVehicleRecord,isQaVehicleRecord,readState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const allowedRoles=new Set(["dealer_agent","tenant_admin","platform_admin","dealer","admin"]);
const pipelineStages=["new","contacted","engaged","qualified","appointment","showed","deal","sold"] as const;

function json(body:any,status:number,rid:string){
  return Response.json(body,{status,headers:{"cache-control":"private, no-store","x-wdcc-request-id":rid}});
}
function lower(value:unknown){return String(value??"").trim().toLowerCase();}
function leadStage(lead:any){
  const raw=lower(lead?.pipelineStage||lead?.stage||lead?.status||"new");
  if(raw.includes("sold")||raw.includes("closed won"))return "sold";
  if(raw.includes("deal")||raw.includes("contract"))return "deal";
  if(raw.includes("show"))return "showed";
  if(raw.includes("appoint")||raw.includes("test drive")||raw.includes("scheduled"))return "appointment";
  if(raw.includes("qualif")||raw.includes("approv"))return "qualified";
  if(raw.includes("engag"))return "engaged";
  if(raw.includes("contact"))return "contacted";
  return "new";
}
function leadCreatedAt(lead:any){return String(lead?.createdAt||lead?.created_at||lead?.submittedAt||lead?.at||"");}
function publicVehicle(vehicle:any){
  return lower(vehicle?.status)==="published"&&!isQaVehicleRecord(vehicle)&&!isInternalVehicleRecord(vehicle);
}
function priorityFor(lead:any){
  if(Number.isFinite(Number(lead?.priority)))return Math.max(0,Math.min(100,Number(lead.priority)));
  let score=30;
  const stage=leadStage(lead);
  if(stage==="new")score+=24;
  if(stage==="contacted"||stage==="engaged")score+=16;
  if(stage==="qualified"||stage==="appointment")score+=28;
  if(lead?.phone)score+=8;
  if(lead?.vehicleInterest||lead?.vehicle_id||lead?.vehicleId)score+=8;
  const created=Date.parse(leadCreatedAt(lead));
  if(Number.isFinite(created)&&Date.now()-created<24*60*60*1000)score+=8;
  return Math.min(100,score);
}
function nextActionFor(lead:any){
  if(lead?.nextAction)return String(lead.nextAction);
  const stage=leadStage(lead);
  if(stage==="new")return "Make first contact";
  if(stage==="contacted"||stage==="engaged")return "Confirm vehicle and financing";
  if(stage==="qualified")return "Book appointment";
  if(stage==="appointment")return "Confirm appointment";
  if(stage==="showed")return "Work the deal";
  if(stage==="deal")return "Close and deliver";
  return "Review customer";
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/crm/dashboard");
  const rid=requestId(request);
  try{
    const user=await currentUser().catch(()=>null);
    if(!user||!allowedRoles.has(lower(user.role)))return json({ok:false,error:"Unauthorized"},401,rid);

    const state=await readState();
    const platform=lower(user.role)==="platform_admin";
    const tenantId=String(user.tenantId||"wdcc");
    const leads=state.leads.filter((lead:any)=>platform||String(lead?.tenantId||lead?.tenant_id||"wdcc")===tenantId);
    const inventory=state.vehicles.filter((vehicle:any)=>platform||String(vehicle?.tenantId||"wdcc")===tenantId);
    const customerInventory=inventory.filter(publicVehicle);
    const today=new Date().toISOString().slice(0,10);
    const weekAgo=Date.now()-7*24*60*60*1000;

    const pipeline:Record<string,number>=Object.fromEntries(pipelineStages.map(stage=>[stage,0]));
    for(const lead of leads)pipeline[leadStage(lead)]=(pipeline[leadStage(lead)]||0)+1;

    const scored=leads.map((lead:any)=>({...lead,pipelineStage:leadStage(lead),priority:priorityFor(lead),nextAction:nextActionFor(lead)}));
    const hotLeads=[...scored]
      .filter((lead:any)=>lead.pipelineStage!=="sold")
      .sort((a:any,b:any)=>Number(b.priority||0)-Number(a.priority||0)||Date.parse(leadCreatedAt(b))-Date.parse(leadCreatedAt(a)))
      .slice(0,12);
    const newToday=leads.filter((lead:any)=>leadCreatedAt(lead).slice(0,10)===today).length;
    const appointments=leads.filter((lead:any)=>leadStage(lead)==="appointment"||/schedule|test.?drive|appointment/i.test(String(lead?.kind||""))).length;
    const applications=leads.filter((lead:any)=>/approval|application|finance/i.test(String(lead?.kind||""))).length;
    const approved=leads.filter((lead:any)=>/approved/i.test(String(lead?.status||lead?.stage||lead?.pipelineStage||""))).length;
    const sold=leads.filter((lead:any)=>leadStage(lead)==="sold").length;
    const soldThisWeek=leads.filter((lead:any)=>leadStage(lead)==="sold"&&Number.isFinite(Date.parse(lead?.updatedAt||lead?.updated_at||leadCreatedAt(lead)))&&Date.parse(lead?.updatedAt||lead?.updated_at||leadCreatedAt(lead))>=weekAgo).length;

    return json({
      ok:true,
      summary:{
        totalLeads:leads.length,
        newToday,
        newLeads:pipeline.new||0,
        hotLeads:hotLeads.length,
        appointments,
        applications,
        approved,
        sold,
        soldThisWeek,
        totalInventory:inventory.length,
        publishedInventory:customerInventory.length
      },
      pipeline,
      hotLeads,
      leads:scored,
      inventory:customerInventory,
      revision:state.revision
    },200,rid);
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:"crm_dashboard_failed"},500,rid);
  }
}
