const RECOVERY_VEHICLE_IDS=new Set([
  "2004-nissan-350z",
  "2016-ford-f150-limited",
  "2019-honda-pilot",
  "2019-kia-sportage",
  "2019-toyota-rav4"
]);

function recoveryKey(value:unknown){
  return String(value||"").trim().toLowerCase().replace(/^recovered-/,"").replace(/^recovery-/,"");
}

export function recoveryVehicleImage(vehicle:any){
  const key=[vehicle?.slug,vehicle?.id].map(recoveryKey).find(value=>RECOVERY_VEHICLE_IDS.has(value));
  // The recovery card assets are served by the public storefront, not the
  // separately deployed dealer/admin application. Keep this immutable origin
  // only for the five named recovery IDs; never use it for arbitrary media.
  return key?`https://wedontcarecars.com/assets/cars/${key}-1.webp`:"";
}

export function vehicleImageSource(vehicle:any){
  const pathname=String(vehicle?.primaryPhotoPathname||vehicle?.photoPathnames?.[0]||"").trim();
  if(pathname)return `/api/media?p=${encodeURIComponent(pathname)}`;
  const direct=String(vehicle?.primary_image_url||vehicle?.image||vehicle?.photo||vehicle?.primaryPhotoUrl||vehicle?.primaryPhoto||vehicle?.imageUrl||"").trim();
  // Canonical records may still carry a relative static image path from the
  // storefront. A dealer-page host has no local copy of those static files.
  if(direct.startsWith("/assets/cars/") && direct.endsWith(".webp") && !direct.includes(".."))
    return "https://wedontcarecars.com"+direct;
  return direct||recoveryVehicleImage(vehicle);
}
