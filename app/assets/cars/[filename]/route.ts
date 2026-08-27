import {NextResponse} from "next/server";

const RECOVERY_IMAGE_NAMES=new Set([
  "2004-nissan-350z-1.webp",
  "2016-ford-f150-limited-1.webp",
  "2019-honda-pilot-1.webp",
  "2019-kia-sportage-1.webp",
  "2019-toyota-rav4-1.webp",
]);

export async function GET(_request:Request,{params}:{params:Promise<{filename:string}>}){
  const {filename}=await params;
  if(!RECOVERY_IMAGE_NAMES.has(filename))return new NextResponse(null,{status:404});
  return NextResponse.json({ok:false,error:"vehicle_photo_not_recovered",filename},{status:404,headers:{"Cache-Control":"no-store","X-WDCC-Media-Truth":"no-substitution"}});
}
