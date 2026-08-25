import crypto from "node:crypto";

const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
const STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h";

function runtimeRole(){
  return String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();
}

export function isDealerRuntime(request?:Request){
  const role=runtimeRole();
  if(role==="backend"||role==="api"||role==="canonical")return true;
  if(role==="frontend"||role==="storefront"||role==="proxy")return false;

  // On Vercel, project identity is authoritative. A customer/dealer alias may point
  // at the storefront project, but that must never turn the storefront into a
  // state-owning backend merely because the Host header says "dealer".
  const project=String(process.env.VERCEL_PROJECT_ID||"").trim();
  if(project===DEALER_PROJECT_ID||project===PHOENIX_PROJECT_ID)return true;
  if(project===STOREFRONT_PROJECT_ID)return false;

  // Host detection is only a rollback/local fallback when project identity is absent.
  if(!request)return false;
  try{
    const host=new URL(request.url).host.toLowerCase();
    return host==="dealer.wedontcarecars.com"||host.startsWith("wdcc-dealer-portal-")||host==="wdcc-dealer-portal.vercel.app"||host.startsWith("wdcc-cpx-launch-")||host==="wdcc-cpx-launch.vercel.app";
  }catch{return false;}
}

export function requestId(request:Request){
  const supplied=String(request.headers.get("x-wdcc-request-id")||request.headers.get("x-request-id")||"").trim().slice(0,160);
  return supplied||crypto.randomUUID();
}
