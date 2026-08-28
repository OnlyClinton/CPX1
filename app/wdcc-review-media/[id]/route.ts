import {NextResponse} from "next/server";
import nissan350z from "../../recoveredVisualMedia/nissan350z";
import fordF150 from "../../recoveredVisualMedia/fordF150";
import hondaPilot from "../../recoveredVisualMedia/hondaPilot";
import kiaSportage from "../../recoveredVisualMedia/kiaSportage";
import toyotaRav4 from "../../recoveredVisualMedia/toyotaRav4";

const RECOVERED_MEDIA_COMMIT="8f9e0ef574fe2b1213e22641e72975a3518eb4a1";
const SOURCES={
  nissan350z,
  fordF150,
  hondaPilot,
  kiaSportage,
  toyotaRav4,
} as const;

function decodeDataUri(value:string){
  const marker="data:image/webp;base64,";
  if(!value.startsWith(marker))return null;
  try{
    const binary=atob(value.slice(marker.length));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes;
  }catch{
    return null;
  }
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const source=SOURCES[id as keyof typeof SOURCES];
  if(!source)return new NextResponse(null,{status:404});

  const bytes=decodeDataUri(source);
  if(!bytes)return NextResponse.json({ok:false,error:"recovered_media_decode_failed",id},{status:502,headers:{"Cache-Control":"no-store"}});

  return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":"image/webp",
    "Cache-Control":"public, max-age=31536000, immutable",
    "X-WDCC-Media-Truth":"verified-first-party-recovery",
    "X-WDCC-Media-Source-SHA":RECOVERED_MEDIA_COMMIT,
    "X-WDCC-Media-Fetch":"bundled-local",
  }});
}
