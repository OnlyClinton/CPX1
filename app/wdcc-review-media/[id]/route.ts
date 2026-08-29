import {NextResponse} from "next/server";

const RECOVERED_MEDIA_COMMIT="8f9e0ef574fe2b1213e22641e72975a3518eb4a1";
const SOURCES:Record<string,string>={
  nissan350z:"nissan350z",
  fordF150:"fordF150",
  hondaPilot:"hondaPilot",
  kiaSportage:"kiaSportage",
  toyotaRav4:"toyotaRav4",
};

function decodeBase64Text(value:string){
  const binary=atob(value.replace(/\s+/g,""));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function recoveredSourceText(file:string){
  const raw=`https://raw.githubusercontent.com/OnlyClinton/CPX1/${RECOVERED_MEDIA_COMMIT}/app/recoveredVisualMedia/${file}.ts`;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(`${raw}?wdcc-recovery-attempt=${attempt}`,{cache:"no-store"});
      if(response.ok){
        const text=await response.text();
        if(text.includes("data:image/webp;base64,"))return{text,source:"raw"};
      }
    }catch{}
  }

  const api=`https://api.github.com/repos/OnlyClinton/CPX1/contents/app/recoveredVisualMedia/${file}.ts?ref=${RECOVERED_MEDIA_COMMIT}`;
  try{
    const response=await fetch(api,{cache:"no-store",headers:{Accept:"application/vnd.github+json","User-Agent":"wdcc-preview-recovery"}});
    if(response.ok){
      const payload:any=await response.json();
      if(payload?.encoding==="base64"&&typeof payload?.content==="string"&&payload.content.trim()){
        const text=decodeBase64Text(payload.content);
        if(text.includes("data:image/webp;base64,"))return{text,source:"contents-api"};
      }
    }
  }catch{}

  return null;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const file=SOURCES[id];
  if(!file)return new NextResponse(null,{status:404});

  const recovered=await recoveredSourceText(file);
  if(!recovered)return NextResponse.json({ok:false,error:"recovered_media_source_unavailable",id},{status:502,headers:{"Cache-Control":"no-store"}});

  const match=recovered.text.match(/const image=\"data:image\/webp;base64,([^\"]+)\"/);
  if(!match)return NextResponse.json({ok:false,error:"recovered_media_parse_failed",id},{status:502,headers:{"Cache-Control":"no-store"}});

  try{
    const binary=atob(match[1]);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new NextResponse(bytes,{status:200,headers:{
      "Content-Type":"image/webp",
      "Cache-Control":"public, max-age=604800, immutable",
      "X-WDCC-Media-Truth":"verified-first-party-recovery",
      "X-WDCC-Media-Source-SHA":RECOVERED_MEDIA_COMMIT,
      "X-WDCC-Media-Fetch":recovered.source,
    }});
  }catch{
    return NextResponse.json({ok:false,error:"recovered_media_decode_failed",id},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
