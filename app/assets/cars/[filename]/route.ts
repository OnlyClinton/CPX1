import {NextResponse} from "next/server";

const LEGACY_FALLBACK_IMAGES=new Set([
  "2004-nissan-350z-1.webp",
  "2016-ford-f150-limited-1.webp",
  "2019-honda-pilot-1.webp",
  "2019-kia-sportage-1.webp",
  "2019-toyota-rav4-1.webp",
]);

const DONOR_BASE="https://raw.githubusercontent.com/OnlyClinton/CPX1/recovered-2vfd-source/src/public/assets/cars";

export async function GET(_request:Request,{params}:{params:Promise<{filename:string}>}){
  const {filename}=await params;
  if(!LEGACY_FALLBACK_IMAGES.has(filename)) return new NextResponse(null,{status:404});

  const upstream=await fetch(`${DONOR_BASE}/${encodeURIComponent(filename)}`,{
    cache:"force-cache",
    next:{revalidate:86400},
  });
  if(!upstream.ok||!upstream.body) return new NextResponse(null,{status:upstream.status===404?404:502});

  return new Response(upstream.body,{
    status:200,
    headers:{
      "Content-Type":upstream.headers.get("content-type")||"image/webp",
      "Cache-Control":"public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-WDCC-Media-Source":"recovered-2vfd-source",
    },
  });
}
