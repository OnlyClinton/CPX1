// Cloudflare dealer front door and customer lead facade use this authority map while Phoenix remains the canonical data backend.
// The Cloudflare dealer front door is the production authority for auth, state,
// inventory, media, and leads.  Do not fall back to the retired Vercel/Blob
// origin: it can return Blob 403s even while the canonical service is healthy.
export const WDCC_CANONICAL_BACKEND_DEFAULT="https://dealer.wedontcarecars.com";
export const WDCC_DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
export const WDCC_PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export const WDCC_STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h";

// WDCC state is intentionally pinned to the proven canonical v10 ledger store.
// BLOB_STORE_ID is a Vercel connection detail and must not silently redefine
// data authority when another empty/new store is connected to the project.
// A deliberate migration can override this only with the WDCC-specific variable.
export const WDCC_CANONICAL_BLOB_STORE_ID="store_cNUyQRVlXtyvZQ5N";

export function canonicalDealerBackend(){
  return (process.env.WDCC_DEALER_BACKEND_URL||WDCC_CANONICAL_BACKEND_DEFAULT).trim().replace(/\/$/,"");
}

export function canonicalBlobStoreId(){
  return (process.env.WDCC_CANONICAL_BLOB_STORE_ID||WDCC_CANONICAL_BLOB_STORE_ID).trim();
}

export function blobAuthority(){
  const oidcToken=(process.env.VERCEL_OIDC_TOKEN||"").trim();
  const canonicalStoreId=canonicalBlobStoreId();
  const connectedStoreId=(process.env.BLOB_STORE_ID||"").trim();

  // Prefer short-lived OIDC and pair it with the pinned WDCC store. This avoids
  // stale static-token precedence and prevents project connection drift from
  // moving canonical state reads/writes to an empty replacement store.
  if(oidcToken&&canonicalStoreId)return {
    mode:"oidc" as const,
    options:{oidcToken,storeId:canonicalStoreId},
    storeId:canonicalStoreId,
    connectedStoreId,
    drift:Boolean(connectedStoreId&&connectedStoreId!==canonicalStoreId)
  };

  // Static token remains a compatibility fallback for non-Vercel/local tooling.
  // Tokens are store-scoped, so callers using this mode must supply the token for
  // the canonical store explicitly.
  const token=(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  if(token)return {
    mode:"token" as const,
    options:{token},
    storeId:canonicalStoreId,
    connectedStoreId,
    drift:false
  };

  return {
    mode:"missing" as const,
    options:{},
    storeId:canonicalStoreId,
    connectedStoreId,
    drift:Boolean(connectedStoreId&&connectedStoreId!==canonicalStoreId)
  };
}
