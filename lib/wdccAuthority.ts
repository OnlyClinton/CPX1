// Customer/dealer frontends must write through the immutable healthy Phoenix ledger authority.
export const WDCC_CANONICAL_BACKEND_DEFAULT="https://wdcc-cpx-launch-qhcvflfih-cpxagency.vercel.app";
export const WDCC_DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
export const WDCC_PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export const WDCC_STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h";

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
  const token=(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(token)return {mode:"token" as const,options:{token}};
  const oidcToken=(process.env.VERCEL_OIDC_TOKEN||"").trim();
  const storeId=(process.env.BLOB_STORE_ID||"").trim();
  if(oidcToken&&storeId)return {mode:"oidc" as const,options:{oidcToken,storeId}};
  return {mode:"missing" as const,options:{}};
}
