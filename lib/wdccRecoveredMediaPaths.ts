// Same-origin, preview-safe derivatives of the five verified first-party
// recovery photos. Static URLs avoid Android WebView data-URI decode failures.
export const WDCC_RECOVERED_MEDIA_PATHS={
  nissan350z:"/wdcc-recovered-media/2004-nissan-350z.webp",
  fordF150:"/wdcc-recovered-media/2016-ford-f150.webp",
  hondaPilot:"/wdcc-recovered-media/2019-honda-pilot.webp",
  kiaSportage:"/wdcc-recovered-media/2019-kia-sportage.webp",
  toyotaRav4:"/wdcc-recovered-media/2019-toyota-rav4.webp"
} as const;

const LEGACY_VEHICLE_BLOB_HOST="xgbsyv0ovelnac0u.public.blob.vercel-storage.com";
const identityPart=(value:unknown)=>String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"");

const WDCC_RECOVERED_MEDIA_BY_VEHICLE:Record<string,string>={
  "2004:nissan:350z":WDCC_RECOVERED_MEDIA_PATHS.nissan350z,
  "2016:ford:f150":WDCC_RECOVERED_MEDIA_PATHS.fordF150,
  "2019:honda:pilot":WDCC_RECOVERED_MEDIA_PATHS.hondaPilot,
  "2019:kia:sportage":WDCC_RECOVERED_MEDIA_PATHS.kiaSportage,
  "2019:toyota:rav4":WDCC_RECOVERED_MEDIA_PATHS.toyotaRav4
};

export type WdccLegacyMediaCandidate={
  id?:unknown;
  year?:unknown;
  make?:unknown;
  model?:unknown;
  primaryImageUrl?:unknown;
  mediaPathnames?:unknown[];
};

/**
 * Replaces only the retired WDCC vehicle-blob URLs for the five recovered,
 * identity-allowlisted baseline vehicles. All dealer-upload and unknown media
 * URLs pass through unchanged.
 */
export function normalizeWdccLegacyVehicleMedia(candidate:WdccLegacyMediaCandidate){
  const original=String(candidate.primaryImageUrl??"").trim();
  if(!original)return original;
  let url:URL;
  try{url=new URL(original);}catch{return original;}
  if(url.protocol!=="https:"||url.hostname.toLowerCase()!==LEGACY_VEHICLE_BLOB_HOST||
    !/^\/wdcc\/vehicles\/[^/]+\.jpe?g$/i.test(url.pathname))return original;
  const identity=`${Math.trunc(Number(candidate.year))}:${identityPart(candidate.make)}:${identityPart(candidate.model)}`;
  return WDCC_RECOVERED_MEDIA_BY_VEHICLE[identity]||original;
}

export function resolveWdccVehiclePrimaryMedia(candidate:WdccLegacyMediaCandidate){
  const vehicleId=String(candidate.id??"").trim();
  const dealerMediaPrefix=`media/wdcc/${vehicleId}/`;
  const storedPrimary=String(candidate.primaryImageUrl??"").trim();
  const mediaPathnames=Array.isArray(candidate.mediaPathnames)?candidate.mediaPathnames.map(value=>String(value??"").trim()).filter(Boolean):[];
  const uploadedPrimary=(storedPrimary.startsWith(dealerMediaPrefix)?storedPrimary:mediaPathnames.find(pathname=>pathname.startsWith(dealerMediaPrefix)))||"";
  const primary=uploadedPrimary||normalizeWdccLegacyVehicleMedia(candidate);
  const isMediaPathname=Boolean(primary)&&!/^https?:\/\//i.test(primary)&&!primary.startsWith("/");
  return {
    primaryPhotoPathname:isMediaPathname?primary:null,
    primaryImageUrl:primary||null,
    directImageUrl:primary&&!isMediaPathname?primary:null
  };
}
