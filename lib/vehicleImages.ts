const RECOVERED_VEHICLE_IMAGES:Record<string,string>={
  "RECOVERED-2004-NISSAN-350Z":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2004-nissan-350z.jpg",
  "RECOVERED-2016-FORD-F150-LIM":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2016-ford-f150-limited.jpg",
  "RECOVERED-2019-HONDA-PILOT":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-honda-pilot.jpg",
  "RECOVERED-2019-KIA-SPORTAGE":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-kia-sportage.jpg",
  "RECOVERED-2019-TOYOTA-RAV4":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-toyota-rav4.jpg"
};

export function vehicleImage(v:any){
  const pathname=String(v?.primaryPhotoPathname||v?.primary_photo_pathname||"").trim();
  if(pathname)return `/api/media?p=${encodeURIComponent(pathname)}`;
  const direct=String(v?.primary_image_url||v?.primaryImageUrl||v?.photoUrl||v?.image||"").trim();
  if(direct){
    if(direct.startsWith("media/"))return `/api/media?p=${encodeURIComponent(direct)}`;
    return direct;
  }
  const stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase();
  return RECOVERED_VEHICLE_IMAGES[stock]||"/vehicle-placeholder.svg";
}
