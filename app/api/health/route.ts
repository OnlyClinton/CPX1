import {NextResponse} from "next/server";
import {readState} from "../../../lib/store";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const state=await readState();
    const blobConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const authConfigured=Boolean(process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32);
    const ok=blobConfigured&&authConfigured;
    return NextResponse.json({
      ok,
      degraded:!ok,
      service:"wdcc-unified-dealer-platform",
      release:"WDCC-DEALER-UNIFIED-AUTH-V1",
      revision:Number(state.revision||0),
      users:Array.isArray(state.users)?state.users.length:0,
      vehicles:Array.isArray(state.vehicles)?state.vehicles.length:0,
      leads:Array.isArray(state.leads)?state.leads.length:0,
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null
    },{
      status:ok?200:503,
      headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}
    });
  }catch(error){
    return NextResponse.json({
      ok:false,
      degraded:true,
      service:"wdcc-unified-dealer-platform",
      release:"WDCC-DEALER-UNIFIED-AUTH-V1",
      error:error instanceof Error?error.message:"state_unavailable",
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null
    },{
      status:500,
      headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}
    });
  }
}
