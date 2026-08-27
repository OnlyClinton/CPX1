import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {blobAuthority,WDCC_PHOENIX_PROJECT_ID} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};

function canonicalRuntime(){
  const role=String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();
  return process.env.VERCEL_PROJECT_ID===WDCC_PHOENIX_PROJECT_ID||role==="backend"||role==="api"||role==="canonical";
}

function provider(){
  const declared=String(process.env.WDCC_PROVIDER||"").trim().toLowerCase();
  if(declared)return declared;
  if(process.env.RAILWAY_DEPLOYMENT_ID||process.env.RAILWAY_GIT_COMMIT_SHA)return "railway";
  if(process.env.VERCEL_PROJECT_ID)return "vercel";
  return "portable";
}

function integrations(){
  const email=Boolean((process.env.RESEND_API_KEY||"").trim());
  const sms=Boolean((process.env.TWILIO_ACCOUNT_SID||"").trim()&&(process.env.TWILIO_AUTH_TOKEN||"").trim()&&(process.env.TWILIO_FROM_NUMBER||"").trim()&&(process.env.WDCC_LEAD_NOTIFICATION_PHONE||"").trim());
  const webhook=Boolean((process.env.WDCC_LEAD_WEBHOOK_URL||"").trim());
  return{email:{configured:email},sms:{configured:sms},webhook:{configured:webhook},dashboard:{configured:true}};
}

export async function GET(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT_SHA||process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||null;

  if(canonicalRuntime()){
    const storage=blobAuthority();
    const session=Boolean((process.env.SESSION_SECRET||"").trim());
    const notificationIntegrations=integrations();
    if(storage.mode==="missing"||!session){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-V53-OPS-HARDENED",backend:"local",storage:storage.mode,session:session?"configured":"missing",state:"unverified",integrations:notificationIntegrations,provider:provider(),commit},{status:503,headers});
    }
    try{
      const state=await readState();
      return NextResponse.json({ok:true,degraded:false,service:"wdcc-canonical-backend",release:"WDCC-V53-OPS-HARDENED",backend:"local",storage:storage.mode,session:"configured",state:"readable",revision:state.revision,integrations:notificationIntegrations,provider:provider(),commit},{status:200,headers});
    }catch(error){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-V53-OPS-HARDENED",backend:"local",storage:storage.mode,session:"configured",state:"unreadable",integrations:notificationIntegrations,error:error instanceof Error?error.message:"state_read_failed",provider:provider(),commit},{status:503,headers});
    }
  }

  try{
    const {response,json}=await backendHealth();
    const ok=response.ok&&json?.ok===true&&json?.state!=="unreadable";
    const notificationIntegrations=json?.integrations||integrations();
    return NextResponse.json({ok,degraded:!ok,service:"wdcc-hardened-dealer-facade",release:"WDCC-V53-OPS-HARDENED",backend:ok?"healthy":"degraded",backendState:json?.state||null,backendStorage:json?.storage||null,integrations:notificationIntegrations,integrationReadinessSource:json?.integrations?"canonical-backend":"facade-runtime",provider:provider(),commit},{status:ok?200:503,headers});
  }catch(error){
    return NextResponse.json({ok:false,degraded:true,service:"wdcc-hardened-dealer-facade",release:"WDCC-V53-OPS-HARDENED",backend:"unreachable",integrations:integrations(),integrationReadinessSource:"facade-runtime",error:error instanceof Error?error.message:"backend_health_failed",commit},{status:503,headers});
  }
}
