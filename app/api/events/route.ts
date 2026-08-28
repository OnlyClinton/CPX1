import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/events");
  // Analytics persistence is intentionally disabled in this release; fail
  // explicitly on the canonical runtime instead of recursively proxying.
  return Response.json({ok:false,error:"analytics_ingest_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"30"}});
}
