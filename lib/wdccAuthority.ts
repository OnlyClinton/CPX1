// Cloudflare dealer front door and customer lead facade use this authority map while Phoenix remains the canonical data backend.
// The Cloudflare dealer front door is the production authority for auth, state,
// inventory, media, and leads.  Do not fall back to the retired Vercel/Blob
// origin: it can return Blob 403s even while the canonical service is healthy.
export const WDCC_CANONICAL_BACKEND_DEFAULT="https://dealer.wedontcarecars.com";
export const WDCC_DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
export const WDCC_PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export const WDCC_STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h";

export function canonicalDealerBackend(){
  return (process.env.WDCC_DEALER_BACKEND_URL||WDCC_CANONICAL_BACKEND_DEFAULT).trim().replace(/\/$/,"");
}

export function blobAuthority(){
  const token=(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(token)return {mode:"token" as const,options:{token}};
  const oidcToken=(process.env.VERCEL_OIDC_TOKEN||"").trim();
  const storeId=(process.env.BLOB_STORE_ID||"").trim();
  if(oidcToken&&storeId)return {mode:"oidc" as const,options:{oidcToken,storeId}};
  return {mode:"missing" as const,options:{}};
}
