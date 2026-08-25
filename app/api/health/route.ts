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

export async function GET(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT_SHA||process.env.CF_PAGES_COMMIT_SHA||null;

  if(canonicalRuntime()){
    const storage=blobAuthority();
    const session=Boolean((process.env.SESSION_SECRET||"").trim());
    if(storage.mode==="missing"||!session){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:session?"configured":"missing",state:"unverified",provider:process.env.RAILWAY_ENVIRONMENT?"railway":"vercel",commit},{status:503,headers});
    }
    try{
      const state=await readState();
      return NextResponse.json({ok:true,degraded:false,service:"wdcc-canonical-backend",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:"configured",state:"readable",revision:state.revision,provider:process.env.RAILWAY_ENVIRONMENT?"railway":"vercel",commit},{status:200,headers});
    }catch(error){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:"configured",state:"unreadable",error:error instanceof Error?error.message:"state_read_failed",provider:process.env.RAILWAY_ENVIRONMENT?"railway":"vercel",commit},{status:503,headers});
    }
  }

  try{
    const {response,json}=await backendHealth();
    const ok=response.ok&&json?.ok===true&&json?.state!=="unreadable";
    return NextResponse.json({ok,degraded:!ok,service:"wdcc-hardened-dealer-facade",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:ok?"healthy":"degraded",backendState:json?.state||null,backendStorage:json?.storage||null,commit},{status:ok?200:503,headers});
  }catch(error){
    return NextResponse.json({ok:false,degraded:true,service:"wdcc-hardened-dealer-facade",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"unreachable",error:error instanceof Error?error.message:"backend_health_failed",commit},{status:503,headers});
  }
}
