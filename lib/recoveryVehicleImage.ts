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
  return key?`/assets/cars/${key}-1.webp`:"";
}

export function vehicleImageSource(vehicle:any){
  const pathname=String(vehicle?.primaryPhotoPathname||vehicle?.photoPathnames?.[0]||"").trim();
  if(pathname)return `/api/media?p=${encodeURIComponent(pathname)}`;
  const direct=String(vehicle?.primary_image_url||vehicle?.image||vehicle?.photo||vehicle?.primaryPhotoUrl||vehicle?.primaryPhoto||vehicle?.imageUrl||"").trim();
  return direct||recoveryVehicleImage(vehicle);
}
