import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {readRecentVehicleAudit} from "../../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const roles=new Set(["dealer_agent","tenant_admin","platform_admin"]);

export async function GET(request:Request){
  const rid=requestId(request);
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/dealer/vehicle-logs");
  try{
    const user=await currentUser();
    if(!user)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid}});
    if(!roles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Forbidden"},{status:403,headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid}});
    const durable=await readRecentVehicleAudit(150);
    return NextResponse.json({ok:true,revision:null,durable,ledger:durable,source:"neon-canonical"},{headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid,"X-WDCC-Data-Authority":"neon"}});
  }catch(error){
    console.error("WDCC_VEHICLE_LOGS_UNAVAILABLE",error);
    return NextResponse.json({ok:false,error:"vehicle_logs_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"5","X-WDCC-Request-ID":rid}});
  }
}
