import {NextResponse} from "next/server";
import {readState} from "../../../lib/store";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    await readState();
    const blobConfigured=Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const authConfigured=Boolean(process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32);
    const ok=blobConfigured&&authConfigured;
    return NextResponse.json({
      ok,
      degraded:!ok,
      service:"wdcc-unified-platform",
      release:"WDCC-V50-HARDENED"
    },{
      status:ok?200:503,
      headers:{
        "Cache-Control":"no-store",
        "X-Robots-Tag":"noindex, nofollow"
      }
    });
  }catch{
    return NextResponse.json({
      ok:false,
      degraded:true,
      service:"wdcc-unified-platform",
      release:"WDCC-V50-HARDENED"
    },{
      status:500,
      headers:{
        "Cache-Control":"no-store",
        "X-Robots-Tag":"noindex, nofollow"
      }
    });
  }
}
