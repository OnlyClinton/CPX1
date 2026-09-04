import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime,requestId} from "../../../../lib/dealerRuntime";
import {readState} from "../../../../lib/store";
import {readRecentVehicleAudit} from "../../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const roles=new Set(["dealer","dealer_agent","tenant_admin","platform_admin"]);

export async function GET(request:Request){
  const rid=requestId(request);
  if(!isDealerRuntime(request))return NextResponse.json({ok:false,error:"not_found"},{status:404,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
  const user=await currentUser().catch(()=>null);
  if(!user||!roles.has(String(user.role||"").toLowerCase()))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}});
  const [durable,state]=await Promise.all([
    readRecentVehicleAudit(150).catch(()=>[]),
    readState().catch(()=>null)
  ]);
  const tenantId=String(user.tenantId||"wdcc");
  const vehicleIds=new Set((state?.vehicles||[]).filter((vehicle:any)=>String(user.role).toLowerCase()==="platform_admin"||String(vehicle.tenantId||"wdcc")===tenantId).map((vehicle:any)=>String(vehicle.id)));
  const ledger=(state?.audit||[]).filter((event:any)=>String(event.action||"").startsWith("vehicle.")&&(String(user.role).toLowerCase()==="platform_admin"||!event.vehicleId||vehicleIds.has(String(event.vehicleId)))).slice(-250).reverse();
  const visibleDurable=durable.filter((event:any)=>String(user.role).toLowerCase()==="platform_admin"||!event.vehicleId||vehicleIds.has(String(event.vehicleId)));
  return NextResponse.json({ok:true,revision:state?.revision??null,durable:visibleDurable,ledger},{headers:{"Cache-Control":"private, no-store","X-WDCC-Request-ID":rid}});
}
