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
      ok,degraded:!ok,service:"wdcc-unified-platform",release:"WDCC-V47-ROUTING-RECOVERY",
      storage:{
        ok:true,mode:"vercel-private-blob-ledger",revision:state.revision,
        immutableMutationBackups:true,
        counts:{
          tenants:state.tenants.length,users:state.users.length,
          vehicles:state.vehicles.filter(vehicle=>vehicle.status!=="archived").length,
          leads:state.leads.length,audit:state.audit.length
        }
      },
      mediaConfigured:blobConfigured,authConfigured,
      leadRouting:{
        persistence:true,
        emailConfigured:Boolean(process.env.RESEND_API_KEY),
        webhookConfigured:Boolean(process.env.WDCC_LEAD_WEBHOOK_URL)
      }
    },{status:ok?200:503,headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({
      ok:false,degraded:true,service:"wdcc-unified-platform",release:"WDCC-V47-ROUTING-RECOVERY",
      error:error instanceof Error?error.message:"health_failed",
      storage:{ok:false,mode:"unavailable"}
    },{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
