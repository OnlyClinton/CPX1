import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {publicVehicles,readState} from "../../../../lib/store";

export const dynamic="force-dynamic";
const allowed=new Set(["dealer_agent","tenant_admin","platform_admin"]);

function normalizeStatus(value:unknown){
  const status=String(value||"new").toLowerCase().replace(/\s+/g,"_");
  if(["new","captured"].includes(status))return "new";
  if(["contacted","contact_attempted","attempted"].includes(status))return "contacted";
  if(["engaged","working"].includes(status))return "engaged";
  if(["qualified","vehicle_matched"].includes(status))return "qualified";
  if(["appointment","appointment_set","confirmed"].includes(status))return "appointment";
  if(["showed","show"].includes(status))return "showed";
  if(["deal","deal_working","finance","funding"].includes(status))return "deal";
  if(["sold","won"].includes(status))return "sold";
  if(["lost","closed_lost","archived"].includes(status))return "lost";
  return "new";
}

function priority(lead:any){
  const score=Number(lead?.leadScore??lead?.lead_score);
  if(Number.isFinite(score))return score;
  const kind=String(lead?.kind||"").toLowerCase();
  const age=Math.max(0,Date.now()-Date.parse(lead?.createdAt||lead?.created_at||new Date().toISOString()));
  const recency=Math.max(0,40-Math.floor(age/900000));
  return Math.min(99,recency+(kind==="schedule"?35:kind==="approval"?30:20));
}

function nextAction(lead:any){
  const status=normalizeStatus(lead?.status);
  if(status==="sold")return "Completed";
  if(status==="lost")return "Review recovery";
  const kind=String(lead?.kind||"").toLowerCase();
  if(kind==="schedule")return "Confirm appointment";
  if(kind==="approval")return "Call and qualify";
  if(kind==="contact")return "Reply now";
  return "Make contact";
}

export async function GET(){
  const user=await currentUser();
  if(!user||!allowed.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  try{
    const state=await readState();
    const platform=String(user.role||"").toLowerCase()==="platform_admin";
    const tenantId=String(user.tenantId||"wdcc");
    const leads=(platform?state.leads:state.leads.filter((lead:any)=>String(lead.tenantId||"wdcc")===tenantId))
      .map((lead:any)=>({...lead,pipelineStage:normalizeStatus(lead.status),priority:priority(lead),nextAction:nextAction(lead)}))
      .sort((a:any,b:any)=>b.priority-a.priority||String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const allVehicles=platform?state.vehicles:state.vehicles.filter((vehicle:any)=>String(vehicle.tenantId||"wdcc")===tenantId);
    const published=publicVehicles({...state,vehicles:allVehicles});
    const stages=["new","contacted","engaged","qualified","appointment","showed","deal","sold","lost"];
    const pipeline=Object.fromEntries(stages.map(stage=>[stage,leads.filter((lead:any)=>lead.pipelineStage===stage).length]));
    const now=Date.now();
    const today=leads.filter((lead:any)=>{
      const time=Date.parse(lead.createdAt||lead.created_at||"");
      return Number.isFinite(time)&&new Date(time).toDateString()===new Date(now).toDateString();
    });
    const appointments=leads.filter((lead:any)=>lead.pipelineStage==="appointment"||String(lead.kind||"").toLowerCase()==="schedule");
    const sold=leads.filter((lead:any)=>lead.pipelineStage==="sold").length;
    return NextResponse.json({
      ok:true,
      summary:{totalLeads:leads.length,newToday:today.length,hotLeads:leads.filter((lead:any)=>lead.priority>=70&&!['sold','lost'].includes(lead.pipelineStage)).length,appointments:appointments.length,sold,publishedInventory:published.length,totalInventory:allVehicles.length},
      pipeline,
      leads:leads.slice(0,100),
      hotLeads:leads.filter((lead:any)=>!['sold','lost'].includes(lead.pipelineStage)).slice(0,8),
      inventory:published,
      generatedAt:new Date().toISOString()
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"crm_read_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
