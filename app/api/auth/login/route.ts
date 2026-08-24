import {proxyDealer} from "../../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  return proxyDealer(request,"/api/auth/login");
}
