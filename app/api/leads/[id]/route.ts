import {NextResponse} from "next/server";
import {signedSessionSubject} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {leadStages,type LeadStage,updateLeadStatusForSignedSession} from "../../../../lib/wdccDb";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const headers=(rid:string)=>({"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon"});

function normalizeStage(value:unknown):LeadStage|null{
  const raw=String(value||"").trim().toLowerCase().replace(/[\s-]+/g,"_");
  const stage=({deal:"deal_working",dealworking:"deal_working",application:"deal_working",appointment_scheduled:"appointment"} as Record<string,string>)[raw]||raw;
  return (leadStages as readonly string[]).includes(stage)?stage as LeadStage:null;
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const rid=requestId(request);
  if(!isDealerRuntime(request))return proxyDealer(request,`/api/leads/${encodeURIComponent(id)}`);
  let subject:any;
  try{subject=await signedSessionSubject();}
  catch{return NextResponse.json({ok:false,error:"auth_backend_unavailable"},{status:503,headers:headers(rid)});}
  if(!subject||!editorRoles.has(String(subject.role||"").toLowerCase())){
    return NextResponse.json({ok:false,error:subject?"Forbidden":"Unauthorized"},{status:subject?403:401,headers:headers(rid)});
  }
  try{
    const body=await request.json();
    const status=normalizeStage(body?.status??body?.pipelineStage??body?.stage);
    if(!status)return NextResponse.json({ok:false,error:"invalid_lead_status",allowed:leadStages},{status:400,headers:headers(rid)});
    const updated=await updateLeadStatusForSignedSession({leadId:id,status,subject});
    if(updated.outcome==="unauthorized")return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:headers(rid)});
    if(updated.outcome==="not_found")return NextResponse.json({ok:false,error:"Not found"},{status:404,headers:headers(rid)});
    return NextResponse.json({ok:true,item:updated.lead,requestId:rid,source:"neon-canonical"},{headers:headers(rid)});
  }catch{
    return NextResponse.json({ok:false,error:"lead_update_failed"},{status:503,headers:headers(rid)});
  }
}
