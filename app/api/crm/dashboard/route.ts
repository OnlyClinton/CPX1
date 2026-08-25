import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {publicVehicles,readState} from "../../../../lib/store";

export const dynamic="force-dynamic";

const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const stages=["new","contacted","engaged","qualified","appointment","showed","deal","sold","lost"] as const;

function stageOf(lead:any){
  const raw=String(lead?.pipelineStage||lead?.status||"new").trim().toLowerCase();
  if(raw==="test")return "new";
  return (stages as readonly string[]).includes(raw)?raw:"new";
}

function priorityOf(lead:any){
  const stage=stageOf(lead);
  if(stage==="sold"||stage==="lost")return 0;
  let score=10;
  const kind=String(lead?.kind||"").toLowerCase();
  if(kind==="schedule")score+=30;
  else if(kind==="approval")score+=25;
  else if(kind==="contact")score+=18;
  if(lead?.phone)score+=10;
  if(lead?.email)score+=5;
  if(lead?.vehicleInterest)score+=10;
  const age=Date.now()-Date.parse(String(lead?.updatedAt||lead?.createdAt||""));
  if(Number.isFinite(age)){
    if(age<60*60*1000)score+=25;
    else if(age<24*60*60*1000)score+=16;
    else if(age<3*24*60*60*1000)score+=8;
  }
  if(stage==="appointment")score+=20;
  else if(stage==="qualified")score+=14;
  else if(stage==="engaged"||stage==="contacted")score+=8;
  return Math.min(100,score);
}

function nextActionOf(lead:any){
  const stage=stageOf(lead);
  if(stage==="sold")return "Complete sold follow-up";
  if(stage==="lost")return "Review lost reason";
  if(stage==="appointment")return "Confirm appointment";
  if(stage==="qualified")return "Match vehicle and set appointment";
  if(stage==="showed")return "Work the deal";
  if(stage==="deal")return "Close the deal";
  const kind=String(lead?.kind||"").toLowerCase();
  if(kind==="schedule")return "Confirm test-drive time";
  if(kind==="approval")return "Call and review financing request";
  if(kind==="contact")return "Respond to customer";
  return "Make contact";
}

export async function GET(){
  try{
    const user=await currentUser();
    if(!user||!editorRoles.has(String(user.role||"").toLowerCase())){
      return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
    }
    const state=await readState();
    const role=String(user.role||"").toLowerCase();
    const tenantId=String(user.tenantId||"wdcc");
    const tenantLead=(lead:any)=>role==="platform_admin"||String(lead?.tenantId||"wdcc")===tenantId;
    const tenantVehicle=(vehicle:any)=>role==="platform_admin"||String(vehicle?.tenantId||"wdcc")===tenantId;

    const leads=(state.leads||[]).filter(tenantLead).filter((lead:any)=>lead?.qa!==true&&String(lead?.status||"").toLowerCase()!=="test").map((lead:any)=>({
      ...lead,
      pipelineStage:stageOf(lead),
      priority:priorityOf(lead),
      nextAction:nextActionOf(lead)
    })).sort((a:any,b:any)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")));

    const allInventory=(state.vehicles||[]).filter(tenantVehicle).filter((vehicle:any)=>String(vehicle?.status||"").toLowerCase()!=="archived");
    const inventory=publicVehicles(state).filter(tenantVehicle);
    const pipeline:Record<string,number>={new:0,contacted:0,engaged:0,qualified:0,appointment:0,showed:0,deal:0,sold:0,lost:0};
    for(const lead of leads)pipeline[stageOf(lead)]=(pipeline[stageOf(lead)]||0)+1;
    const startToday=new Date();startToday.setHours(0,0,0,0);
    const hotLeads=leads.filter((lead:any)=>!["sold","lost"].includes(stageOf(lead))).sort((a:any,b:any)=>Number(b.priority||0)-Number(a.priority||0));
    const summary={
      totalLeads:leads.length,
      newToday:leads.filter((lead:any)=>Date.parse(String(lead.createdAt||""))>=startToday.getTime()).length,
      hotLeads:hotLeads.filter((lead:any)=>Number(lead.priority||0)>=55).length,
      appointments:pipeline.appointment+(leads.filter((lead:any)=>String(lead.kind||"").toLowerCase()==="schedule"&&stageOf(lead)==="new").length),
      sold:pipeline.sold,
      totalInventory:allInventory.length,
      publishedInventory:inventory.length
    };

    return NextResponse.json({ok:true,revision:state.revision,summary,pipeline,hotLeads,leads,inventory},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("WDCC_CRM_DASHBOARD_ERROR",error);
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"crm_read_failed"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}
