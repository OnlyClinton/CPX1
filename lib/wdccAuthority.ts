// Customer/dealer frontends must write through the immutable healthy Phoenix ledger authority.
export const WDCC_CANONICAL_BACKEND_DEFAULT="https://wdcc-cpx-launch-qhcvflfih-cpxagency.vercel.app";
export const WDCC_DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
export const WDCC_PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export const WDCC_STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h";
export const WDCC_CANONICAL_BLOB_STORE_ID="store_cNUyQRVlXtyvZQ5N";

const staleFacadeAliases=new Set([
  "https://wdcc-cpx-launch-cpxagency.vercel.app",
  "https://wdcc-cpx-launch.vercel.app"
]);

export function canonicalDealerBackend(){
  const explicit=(process.env.WDCC_CANONICAL_AUTHORITY_URL||"").trim().replace(/\/$/,"");
  if(explicit)return explicit;
  const legacy=(process.env.WDCC_DEALER_BACKEND_URL||"").trim().replace(/\/$/,"");
  if(legacy&&!staleFacadeAliases.has(legacy))return legacy;
  return WDCC_CANONICAL_BACKEND_DEFAULT;
}

export function blobAuthority(){
  const storeId=(process.env.BLOB_STORE_ID||WDCC_CANONICAL_BLOB_STORE_ID).trim();
  const explicitOidc=(process.env.VERCEL_OIDC_TOKEN||"").trim();
  if(explicitOidc&&storeId)return {mode:"oidc" as const,options:{oidcToken:explicitOidc,storeId}};

  // @vercel/blob 2.8 resolves deployment OIDC from Vercel's request context.
  // Passing the stale BLOB_READ_WRITE_TOKEN explicitly would override that path,
  // so deployed backend runtimes provide only storeId and let the SDK resolve OIDC.
  const role=String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();
  const project=String(process.env.VERCEL_PROJECT_ID||"").trim();
  const vercelBackendRuntime=
    role==="backend"||role==="api"||role==="canonical"||
    project===WDCC_PHOENIX_PROJECT_ID||project===WDCC_DEALER_PROJECT_ID;
  if(vercelBackendRuntime&&storeId)return {mode:"oidc-auto" as const,options:{storeId}};

  // Local/CI maintenance jobs have no Vercel request context, so they retain the
  // static-token fallback used by controlled backup/CAS cleanup tooling.
  const token=(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(token)return {mode:"token" as const,options:{token}};
  return {mode:"missing" as const,options:{}};
}
