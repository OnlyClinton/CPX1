import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {blobAuthority,WDCC_PHOENIX_PROJECT_ID} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};

export async function GET(){
  const project=process.env.VERCEL_PROJECT_ID||"";
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||null;

  if(project===WDCC_PHOENIX_PROJECT_ID){
    const storage=blobAuthority();
    const session=Boolean((process.env.SESSION_SECRET||"").trim());
    if(storage.mode==="missing"||!session){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-phoenix",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:session?"configured":"missing",state:"unverified",commit},{status:503,headers});
    }
    try{
      const state=await readState();
      return NextResponse.json({ok:true,degraded:false,service:"wdcc-canonical-phoenix",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:"configured",state:"readable",revision:state.revision,commit},{status:200,headers});
    }catch(error){
      return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-phoenix",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"local",storage:storage.mode,session:"configured",state:"unreadable",error:error instanceof Error?error.message:"state_read_failed",commit},{status:503,headers});
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
