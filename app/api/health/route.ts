import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const {response,json}=await backendHealth();
    const ok=response.ok&&json?.ok===true;
    return NextResponse.json({
      ok,
      degraded:!ok,
      service:"wdcc-hardened-dealer-facade",
      release:"WDCC-V51-STATELESS-HARDENED",
      backend:ok?"healthy":"degraded"
    },{
      status:ok?200:503,
      headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}
    });
  }catch{
    return NextResponse.json({
      ok:false,
      degraded:true,
      service:"wdcc-hardened-dealer-facade",
      release:"WDCC-V51-STATELESS-HARDENED",
      backend:"unreachable"
    },{
      status:503,
      headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}
    });
  }
}
