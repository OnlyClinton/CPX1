import crypto from "node:crypto";

const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";

export function isDealerRuntime(request?:Request){
  if(process.env.VERCEL_PROJECT_ID===DEALER_PROJECT_ID)return true;
  if(!request)return false;
  try{
    const host=new URL(request.url).host.toLowerCase();
    return host==="dealer.wedontcarecars.com"||host.startsWith("wdcc-dealer-portal-")||host==="wdcc-dealer-portal.vercel.app";
  }catch{return false;}
}

export function requestId(request:Request){
  const supplied=String(request.headers.get("x-wdcc-request-id")||request.headers.get("x-request-id")||"").trim().slice(0,160);
  return supplied||crypto.randomUUID();
}
