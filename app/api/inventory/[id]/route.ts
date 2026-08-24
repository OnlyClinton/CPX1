import {proxyDealer} from "../../../../lib/dealerProxy";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyDealer(request,`/api/inventory/${encodeURIComponent(id)}`);
}
