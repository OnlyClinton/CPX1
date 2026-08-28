import {GET as canonicalGET,POST as canonicalPOST} from "../leads/route";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  return isDealerRuntime(request)?canonicalGET(request):proxyDealer(request,"/api/leads");
}

export async function POST(request:Request){
  return isDealerRuntime(request)?canonicalPOST(request):proxyDealer(request,"/api/leads");
}
