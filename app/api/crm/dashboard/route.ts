import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {neonRecoveryEnabled,recoveryRpc} from "../../../../lib/wdccNeonRecovery";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  if(!neonRecoveryEnabled())return proxyDealer(request,"/api/crm/dashboard");
  const result=await recoveryRpc(request,"wdcc_recovery_dashboard");
  if(!result.ok)return NextResponse.json({ok:false,summary:{},leads:[],inventory:[],error:result.error,recovery:true},{status:result.status,headers:{"Cache-Control":"private, no-store","X-WDCC-Recovery-Source":"neon"}});
  return NextResponse.json(result.data||{ok:true,summary:{},leads:[],inventory:[]},{status:200,headers:{"Cache-Control":"private, no-store","X-WDCC-Recovery-Source":"neon"}});
}
