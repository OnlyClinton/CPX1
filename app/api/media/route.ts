import {get} from "@vercel/blob";
import {blobAuthority,mediaAuthority} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const p=new URL(req.url).searchParams.get("p")||"";
  if(!p.startsWith("media/wdcc/"))return new Response("Not found",{status:404});

  const media=mediaAuthority();
  if(media.mode==="cloudflare-do"){
    try{
      const response=await fetch(`${media.options.mediaServiceUrl}/media?p=${encodeURIComponent(p)}`,{
        method:"GET",
        headers:{Authorization:`Bearer ${media.options.mediaServiceToken}`},
        cache:"no-store"
      });
      if(response.status===404)return new Response("Not found",{status:404,headers:{"Cache-Control":"no-store"}});
      if(!response.ok||!response.body)return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
      const headers=new Headers();
      headers.set("Content-Type",response.headers.get("content-type")||"application/octet-stream");
      headers.set("Cache-Control","public,max-age=3600");
      const etag=response.headers.get("etag");if(etag)headers.set("ETag",etag);
      headers.set("X-WDCC-Media-Provider","cloudflare");
      return new Response(response.body,{status:200,headers});
    }catch(error){
      console.error("WDCC_MEDIA_CLOUDFLARE_READ_ERROR",error instanceof Error?error.message:"unknown");
      return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
    }
  }

  const authority=blobAuthority();
  if(authority.mode==="missing"||authority.mode==="cloudflare-do"){
    console.error("WDCC_MEDIA_AUTHORITY_MISSING");
    return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
  }
  try{
    const r=await get(p,{access:"private",useCache:true,...authority.options});
    if(!r||r.statusCode!==200||!r.stream)return new Response("Not found",{status:404});
    return new Response(r.stream as any,{headers:{"Content-Type":r.blob.contentType||"application/octet-stream","Cache-Control":"public,max-age=3600","X-WDCC-Media-Provider":"vercel-blob"}});
  }catch(error){
    console.error("WDCC_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");
    return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
