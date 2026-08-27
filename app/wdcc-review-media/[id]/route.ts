import {NextResponse} from "next/server";

const RECOVERED_MEDIA_COMMIT="8f9e0ef574fe2b1213e22641e72975a3518eb4a1";
const SOURCES:Record<string,string>={
  nissan350z:"nissan350z",
  fordF150:"fordF150",
  hondaPilot:"hondaPilot",
  kiaSportage:"kiaSportage",
  toyotaRav4:"toyotaRav4",
};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const file=SOURCES[id];
  if(!file)return new NextResponse(null,{status:404});

  const source=`https://raw.githubusercontent.com/OnlyClinton/CPX1/${RECOVERED_MEDIA_COMMIT}/app/recoveredVisualMedia/${file}.ts`;
  try{
    const upstream=await fetch(source,{cache:"force-cache"});
    if(!upstream.ok)return NextResponse.json({ok:false,error:"recovered_media_source_unavailable",id},{status:502,headers:{"Cache-Control":"no-store"}});
    const text=await upstream.text();
    const match=text.match(/const image=\"data:image\/webp;base64,([^\"]+)\"/);
    if(!match)return NextResponse.json({ok:false,error:"recovered_media_parse_failed",id},{status:502,headers:{"Cache-Control":"no-store"}});
    const binary=atob(match[1]);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new NextResponse(bytes,{status:200,headers:{
      "Content-Type":"image/webp",
      "Cache-Control":"public, max-age=604800, immutable",
      "X-WDCC-Media-Truth":"verified-first-party-recovery",
      "X-WDCC-Media-Source-SHA":RECOVERED_MEDIA_COMMIT,
    }});
  }catch{
    return NextResponse.json({ok:false,error:"recovered_media_fetch_failed",id},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
