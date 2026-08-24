import {proxyDealer} from "../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  return proxyDealer(request,"/api/inventory");
}
export async function POST(request:Request){
  return proxyDealer(request,"/api/inventory");
}
