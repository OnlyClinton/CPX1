import crypto from "node:crypto";

const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";

function runtimeRole(){
  return String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();
}

export function isDealerRuntime(request?:Request){
  const role=runtimeRole();
  if(role==="backend"||role==="api"||role==="canonical")return true;

  // A known canonical Vercel project always wins over a stale role variable.
  // Cloudflare does not receive VERCEL_PROJECT_ID, while this ordering prevents
  // a misconfigured Vercel deployment from proxying back to its own origin.
  const projectId=String(process.env.VERCEL_PROJECT_ID||"").trim();
  if(projectId===DEALER_PROJECT_ID||projectId===PHOENIX_PROJECT_ID)return true;

  if(role==="frontend"||role==="storefront"||role==="proxy")return false;

  if(!request)return false;
  try{
    const host=new URL(request.url).host.toLowerCase();
    return host==="dealer.wedontcarecars.com"||host.startsWith("wdcc-dealer-portal-")||host==="wdcc-dealer-portal.vercel.app"||host.startsWith("wdcc-cpx-launch-")||host==="wdcc-cpx-launch-cpxagency.vercel.app"||host==="wdcc-cpx-launch.vercel.app";
  }catch{return false;}
}

export function requestId(request:Request){
  const supplied=String(request.headers.get("x-wdcc-request-id")||request.headers.get("x-request-id")||"").trim().slice(0,160);
  return supplied||crypto.randomUUID();
}
