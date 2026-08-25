import crypto from "node:crypto";

const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";

function runtimeRole(){
  return String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();
}

function dealerHost(value:string){
  const host=String(value||"").split(",")[0].trim().toLowerCase();
  return host==="dealer.wedontcarecars.com"||host.startsWith("wdcc-dealer-portal-")||host==="wdcc-dealer-portal.vercel.app";
}

export function isDealerRuntime(request?:Request){
  const role=runtimeRole();
  if(role==="backend"||role==="api"||role==="canonical")return true;

  // Cloudflare terminates dealer.wedontcarecars.com and proxies to the
  // storefront origin. Honor the original forwarded dealer hostname before
  // applying the storefront role fallback so authenticated dealer API reads
  // stay on the dealer runtime path.
  if(request){
    try{
      if(dealerHost(request.headers.get("x-forwarded-host")||""))return true;
      if(dealerHost(new URL(request.url).host))return true;
    }catch{}
  }

  if(role==="frontend"||role==="storefront"||role==="proxy")return false;

  // Legacy Vercel detection remains as a rollback-compatible fallback.
  if(process.env.VERCEL_PROJECT_ID===DEALER_PROJECT_ID)return true;
  return false;
}

export function requestId(request:Request){
  const supplied=String(request.headers.get("x-wdcc-request-id")||request.headers.get("x-request-id")||"").trim().slice(0,160);
  return supplied||crypto.randomUUID();
}
