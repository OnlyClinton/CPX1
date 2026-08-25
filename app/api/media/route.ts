import {get} from "@vercel/blob";
import {blobAuthority} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const p=new URL(req.url).searchParams.get("p")||"";
  if(!p.startsWith("media/wdcc/"))return new Response("Not found",{status:404});
  const authority=blobAuthority();
  if(authority.mode==="missing"){
    console.error("WDCC_MEDIA_AUTHORITY_MISSING");
    return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});
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
