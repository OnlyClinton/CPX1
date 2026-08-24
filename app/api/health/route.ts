import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const {response,json}=await backendHealth();const ok=response.ok&&json?.ok===true;
    return NextResponse.json({ok,degraded:!ok,service:"wdcc-hardened-dealer-facade",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:ok?"healthy":"degraded",commit:process.env.VERCEL_GIT_COMMIT_SHA||null},{status:ok?200:503,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
  }catch{return NextResponse.json({ok:false,degraded:true,service:"wdcc-hardened-dealer-facade",release:"WDCC-V52-LEAD-INVENTORY-CONTRACT",backend:"unreachable",commit:process.env.VERCEL_GIT_COMMIT_SHA||null},{status:503,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});}
}
