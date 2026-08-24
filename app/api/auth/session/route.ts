import {proxyDealer} from "../../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  return proxyDealer(request,"/api/auth/session");
}
