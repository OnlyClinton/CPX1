import {get} from "@vercel/blob";
import {blobAuthority} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const p=new URL(req.url).searchParams.get("p")||"";
  if(!p.startsWith("media/wdcc/"))return new Response("Not found",{status:404});
  const authority:any=blobAuthority();
  if(authority.mode==="missing")return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});

  if(authority.mode==="cloudflare-do"){
    try{
      const r=await fetch(`${authority.options.stateServiceUrl}/media/${encodeURIComponent(p)}`,{
        headers:{Authorization:`Bearer ${authority.options.stateServiceToken}`},
        cache:"no-store"
      });
      if(r.status===404)return new Response("Not found",{status:404});
      if(!r.ok)return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
      const headers=new Headers();
      headers.set("Content-Type",r.headers.get("content-type")||"application/octet-stream");
      headers.set("Cache-Control","public,max-age=3600,stale-while-revalidate=86400");
      headers.set("X-WDCC-Media-Provider","cloudflare-do");
      return new Response(r.body,{status:200,headers});
    }catch(error){
      console.error("WDCC_CLOUDFLARE_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");
      return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
    }
  }

  try{
    const r=await get(p,{access:"private",useCache:true,...authority.options});
    if(!r||r.statusCode!==200||!r.stream)return new Response("Not found",{status:404});
    return new Response(r.stream as any,{headers:{"Content-Type":r.blob.contentType||"application/octet-stream","Cache-Control":"public,max-age=3600"}});
  }catch(error){
    console.error("WDCC_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");
    return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
