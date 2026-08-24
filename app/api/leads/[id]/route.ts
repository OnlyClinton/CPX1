import {proxyDealer} from "../../../../lib/dealerProxy";

export const dynamic="force-dynamic";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyDealer(request,`/api/leads/${encodeURIComponent(id)}`);
}
