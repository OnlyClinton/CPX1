type VehiclePhotoRecord=Record<string,unknown>;

const directPhotoKeys=[
  "image",
  "photo",
  "primaryPhotoUrl",
  "primaryPhoto",
  "imageUrl",
  "primary_image_url",
] as const;

function directPhoto(value:unknown){
  const source=String(value??"").trim();
  if(!source)return"";
  if(/wdcc-(?:official-)?logo|wdcc-logo-transparent/i.test(source))return"";
  return source.startsWith("/")||/^https?:\/\//i.test(source)?source:"";
}

export function vehiclePhotoSources(vehicle:VehiclePhotoRecord|null|undefined){
  if(!vehicle)return[];
  const pathnames=[vehicle.primaryPhotoPathname,...(Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames:[])];
  const privatePhotos=pathnames.map(value=>String(value??"").trim()).filter(Boolean).map(pathname=>`/api/media?p=${encodeURIComponent(pathname)}`);
  const directPhotos=directPhotoKeys.map(key=>directPhoto(vehicle[key])).filter(Boolean);
  return [...new Set([...privatePhotos,...directPhotos])];
}

export function primaryVehiclePhoto(vehicle:VehiclePhotoRecord|null|undefined){
  return vehiclePhotoSources(vehicle)[0]||"";
}
