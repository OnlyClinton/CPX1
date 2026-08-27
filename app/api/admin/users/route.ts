import {proxyDealer} from "../../../../lib/dealerProxy";
import {NextResponse} from "next/server";
import {neonRecoveryEnabled,recoveryRpc} from "../../../../lib/wdccNeonRecovery";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  if(!neonRecoveryEnabled())return proxyDealer(request,"/api/admin/users");
  const result=await recoveryRpc(request,"wdcc_recovery_admin_users");
  if(!result.ok)return NextResponse.json({ok:false,users:[],error:result.error,recovery:true},{status:result.status,headers:{"Cache-Control":"private, no-store","X-WDCC-Recovery-Source":"neon"}});
  const users=(Array.isArray(result.data)?result.data:[]).map((user:any)=>({...user,username:user.username||user.email||"",disabled:String(user.status||"").toLowerCase()!=="active"}));
  return NextResponse.json({ok:true,users,count:users.length,recovery:true,readOnly:true},{headers:{"Cache-Control":"private, no-store","X-WDCC-Recovery-Source":"neon"}});
}

function locked(){return NextResponse.json({ok:false,error:"RECOVERY_READ_ONLY",recovery:true},{status:423,headers:{"Cache-Control":"no-store","X-WDCC-Recovery-Source":"neon"}})}
export async function POST(request:Request){return neonRecoveryEnabled()?locked():proxyDealer(request,"/api/admin/users")}
export async function PATCH(request:Request){return neonRecoveryEnabled()?locked():proxyDealer(request,"/api/admin/users")}
