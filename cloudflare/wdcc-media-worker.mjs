const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex, nofollow"};
const MAX_BYTES=15*1024*1024;
const CHUNK_BYTES=512*1024;
const ALLOWED=new Set(["image/jpeg","image/png","image/webp","image/avif"]);

export {WDCCState} from "./wdcc-state-worker.mjs";

function authorized(request,env){const expected=String(env.WDCC_MEDIA_SERVICE_TOKEN||"");return Boolean(expected)&&String(request.headers.get("authorization")||"")===`Bearer ${expected}`;}
function safePath(value){const p=String(value||"").trim();return p.startsWith("media/wdcc/")&&p.length<=700&&!p.includes("..")?p:"";}
function hex(bytes){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");}

export class WDCCMedia{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS media_meta (id INTEGER PRIMARY KEY CHECK(id=1), content_type TEXT NOT NULL, bytes INTEGER NOT NULL, chunks INTEGER NOT NULL, sha256 TEXT NOT NULL, updated_at TEXT NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS media_chunks (idx INTEGER PRIMARY KEY, data BLOB NOT NULL)");
  }
  meta(){return [...this.sql.exec("SELECT content_type,bytes,chunks,sha256,updated_at FROM media_meta WHERE id=1")][0]||null;}
  async fetch(request){
    const url=new URL(request.url);
    if(!authorized(request,this.env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
    if(url.pathname!=="/media")return new Response("Not found",{status:404});

    if(request.method==="PUT"){
      const type=String(request.headers.get("content-type")||"").split(";",1)[0].trim().toLowerCase();
      if(!ALLOWED.has(type))return Response.json({ok:false,error:"unsupported_media_type"},{status:415,headers:JSON_HEADERS});
      const body=await request.arrayBuffer();
      if(!body.byteLength||body.byteLength>MAX_BYTES)return Response.json({ok:false,error:"media_size_invalid",maxBytes:MAX_BYTES},{status:413,headers:JSON_HEADERS});
      const digest=hex(await crypto.subtle.digest("SHA-256",body));
      const bytes=new Uint8Array(body),count=Math.ceil(bytes.byteLength/CHUNK_BYTES);
      try{
        this.ctx.storage.transactionSync(()=>{
          this.sql.exec("DELETE FROM media_chunks");this.sql.exec("DELETE FROM media_meta");
          for(let i=0;i<count;i++){
            const part=bytes.slice(i*CHUNK_BYTES,Math.min(bytes.byteLength,(i+1)*CHUNK_BYTES));
            this.sql.exec("INSERT INTO media_chunks(idx,data) VALUES(?,?)",i,part.buffer);
          }
          this.sql.exec("INSERT INTO media_meta(id,content_type,bytes,chunks,sha256,updated_at) VALUES(1,?,?,?,?,?)",type,bytes.byteLength,count,digest,new Date().toISOString());
        });
        return Response.json({ok:true,bytes:bytes.byteLength,chunks:count,sha256:digest,contentType:type},{status:200,headers:JSON_HEADERS});
      }catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"media_write_failed"},{status:503,headers:JSON_HEADERS});}
    }

    if(request.method==="GET"||request.method==="HEAD"){
      try{
        const meta=this.meta();if(!meta)return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
        const headers={"Content-Type":String(meta.content_type),"Content-Length":String(meta.bytes),"Cache-Control":"public, max-age=3600","ETag":`\"${meta.sha256}\"`,"X-WDCC-Media-SHA256":String(meta.sha256)};
        if(request.method==="HEAD")return new Response(null,{status:200,headers});
        const out=new Uint8Array(Number(meta.bytes));let offset=0,seen=0;
        for(const row of this.sql.exec("SELECT idx,data FROM media_chunks ORDER BY idx ASC")){
          const data=row.data instanceof ArrayBuffer?new Uint8Array(row.data):new Uint8Array(row.data?.buffer||row.data||0);
          out.set(data,offset);offset+=data.byteLength;seen++;
        }
        if(seen!==Number(meta.chunks)||offset!==Number(meta.bytes))throw new Error("media_chunk_mismatch");
        return new Response(out,{status:200,headers});
      }catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"media_read_failed"},{status:503,headers:JSON_HEADERS});}
    }

    if(request.method==="DELETE"){
      try{this.ctx.storage.transactionSync(()=>{this.sql.exec("DELETE FROM media_chunks");this.sql.exec("DELETE FROM media_meta")});return Response.json({ok:true},{status:200,headers:JSON_HEADERS});}
      catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"media_delete_failed"},{status:503,headers:JSON_HEADERS});}
    }
    return new Response("Method not allowed",{status:405});
  }
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/health")return Response.json({ok:true,service:"wdcc-media-authority",provider:"cloudflare",storage:"durable-object-sqlite-chunked",maxBytes:MAX_BYTES},{status:200,headers:JSON_HEADERS});
    const path=safePath(url.searchParams.get("p"));
    if(!path)return Response.json({ok:false,error:"invalid_media_path"},{status:400,headers:JSON_HEADERS});
    const id=env.WDCC_MEDIA.idFromName(path);return env.WDCC_MEDIA.get(id).fetch(request);
  }
};
