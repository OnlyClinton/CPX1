import {clearSessionCookieHeader} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/logout");
  const headers=new Headers({"content-type":"application/json","cache-control":"private, no-store, max-age=0"});
  headers.append("set-cookie",clearSessionCookieHeader());
  return new Response(JSON.stringify({ok:true,upstreamRevocation:"completed_during_login"}),{status:200,headers});
}
