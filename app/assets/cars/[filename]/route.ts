import {NextResponse} from "next/server";

const LEGACY_FALLBACK_IMAGES=new Set([
  "2004-nissan-350z-1.webp",
  "2016-ford-f150-limited-1.webp",
  "2019-honda-pilot-1.webp",
  "2019-kia-sportage-1.webp",
  "2019-toyota-rav4-1.webp",
]);

export async function GET(_request:Request,{params}:{params:Promise<{filename:string}>}){
  const {filename}=await params;
  if(!LEGACY_FALLBACK_IMAGES.has(filename)){
    return new NextResponse(null,{status:404});
  }
  return NextResponse.redirect(new URL("/wdcc-hero-v2.webp",_request.url),307);
}
