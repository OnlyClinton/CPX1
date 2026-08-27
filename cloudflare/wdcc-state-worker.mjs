const STATE_KEY="state";
const BOOTSTRAP_KEY="bootstrap_consumed";
const BACKUP_PREFIX="backup:";
const SELFTEST_PREFIX="selftest:";
const MEDIA_META_PREFIX="media-meta:";
const MEDIA_CHUNK_PREFIX="media-chunk:";
const MAX_MEDIA_BYTES=15*1024*1024;
const MEDIA_CHUNK_BYTES=1536*1024;
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex, nofollow"};

function normalizeState(value){
  return {
    ...value,
    revision:Number(value?.revision||0),
    tenants:Array.isArray(value?.tenants)?value.tenants:[],
    users:Array.isArray(value?.users)?value.users:[],
    vehicles:Array.isArray(value?.vehicles)?value.vehicles:[],
    leads:Array.isArray(value?.leads)?value.leads:[],
    audit:Array.isArray(value?.audit)?value.audit:[]
  };
}

function validState(value){
  const state=normalizeState(value);
  return Number.isFinite(state.revision)&&state.revision>=0&&Array.isArray(state.users)&&Array.isArray(state.vehicles)&&Array.isArray(state.leads);
}

function serviceAuthorized(request,env){
  const expected=String(env.WDCC_STATE_SERVICE_TOKEN||"");
  const supplied=String(request.headers.get("authorization")||"");
  return Boolean(expected)&&supplied===`Bearer ${expected}`;
}

async function sha256Hex(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function bootstrapAuthorized(request,env,storage){
  const expected=String(env.WDCC_BOOTSTRAP_SHA256||"").trim().toLowerCase();
  const supplied=String(request.headers.get("x-wdcc-bootstrap-token")||"").trim();
  if(!expected||!supplied)return false;
  if(await storage.get(BOOTSTRAP_KEY))return false;
  if(await storage.get(STATE_KEY))return false;
  return (await sha256Hex(supplied))===expected;
}

function semanticState(value){return JSON.stringify(normalizeState(value));}
function backupKey(revision){return `${BACKUP_PREFIX}${String(revision).padStart(12,"0")}:${crypto.randomUUID()}`;}
function mediaMetaKey(pathname){return `${MEDIA_META_PREFIX}${pathname}`;}
function mediaChunkKey(pathname,index){return `${MEDIA_CHUNK_PREFIX}${pathname}:${String(index).padStart(4,"0")}`;}
function validMediaPath(pathname){return /^media\/wdcc\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(pathname)&&pathname.length<=900;}

export class WDCCState {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}

  async readState(){
    const raw=await this.ctx.storage.get(STATE_KEY);
    if(typeof raw==="string"){
      const parsed=JSON.parse(raw);
      if(validState(parsed))return {raw,state:normalizeState(parsed),source:"primary"};
    }
    const backups=await this.ctx.storage.list({prefix:BACKUP_PREFIX,reverse:true,limit:50});
    for(const [,value] of backups){
      try{
        if(typeof value!=="string")continue;
        const parsed=JSON.parse(value);
        if(validState(parsed))return {raw:value,state:normalizeState(parsed),source:"backup"};
      }catch{}
    }
    throw new Error("STATE_READ_FAILED");
  }

  async pruneBackups(){
    const backups=await this.ctx.storage.list({prefix:BACKUP_PREFIX,reverse:true,limit:200});
    const keys=[...backups.keys()];
    if(keys.length>100)await this.ctx.storage.delete(keys.slice(100));
  }

  async deleteMedia(pathname){
    const meta=await this.ctx.storage.get(mediaMetaKey(pathname));
    const chunks=Number(meta?.chunks||0);
    const keys=[mediaMetaKey(pathname)];
    for(let i=0;i<chunks;i++)keys.push(mediaChunkKey(pathname,i));
    for(let i=0;i<keys.length;i+=128)await this.ctx.storage.delete(keys.slice(i,i+128));
    return chunks;
  }

  async putMedia(request,pathname){
    const contentType=String(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
    const allowed=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
    if(!allowed.has(contentType))return Response.json({ok:false,error:"unsupported_media_type"},{status:415,headers:JSON_HEADERS});
    const body=await request.arrayBuffer();
    if(!body.byteLength||body.byteLength>MAX_MEDIA_BYTES)return Response.json({ok:false,error:"invalid_media_size",maxBytes:MAX_MEDIA_BYTES},{status:413,headers:JSON_HEADERS});
    await this.deleteMedia(pathname);
    const bytes=new Uint8Array(body);
    const chunks=Math.ceil(bytes.byteLength/MEDIA_CHUNK_BYTES);
    for(let i=0;i<chunks;i++){
      const start=i*MEDIA_CHUNK_BYTES,end=Math.min(start+MEDIA_CHUNK_BYTES,bytes.byteLength);
      const piece=bytes.slice(start,end);
      await this.ctx.storage.put(mediaChunkKey(pathname,i),piece.buffer);
    }
    const meta={pathname,contentType,size:bytes.byteLength,chunks,createdAt:new Date().toISOString()};
    await this.ctx.storage.put(mediaMetaKey(pathname),meta);
    return Response.json({ok:true,pathname,contentType,size:bytes.byteLength,chunks},{status:201,headers:JSON_HEADERS});
  }

  async getMedia(pathname){
    const meta=await this.ctx.storage.get(mediaMetaKey(pathname));
    if(!meta||!Number(meta.chunks))return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
    const parts=[];
    for(let i=0;i<Number(meta.chunks);i++){
      const value=await this.ctx.storage.get(mediaChunkKey(pathname,i));
      if(!(value instanceof ArrayBuffer))return new Response("Media corrupt",{status:503,headers:{"cache-control":"no-store"}});
      parts.push(value);
    }
    const blob=new Blob(parts,{type:String(meta.contentType||"application/octet-stream")});
    return new Response(blob,{status:200,headers:{"content-type":String(meta.contentType||"application/octet-stream"),"content-length":String(meta.size||blob.size),"cache-control":"public, max-age=3600, stale-while-revalidate=86400","x-wdcc-media-provider":"cloudflare-do"}});
  }

  async fetch(request){
    const url=new URL(request.url);

    if(request.method==="GET"&&url.pathname==="/health"){
      try{
        const current=await this.readState();
        return Response.json({ok:true,degraded:false,service:"wdcc-state-authority",provider:"cloudflare",storage:"durable-object-sqlite",media:"durable-object-chunked",state:"readable",revision:current.state.revision,recoverySource:current.source},{status:200,headers:JSON_HEADERS});
      }catch(error){
        return Response.json({ok:false,degraded:true,service:"wdcc-state-authority",provider:"cloudflare",storage:"durable-object-sqlite",media:"durable-object-chunked",state:"unreadable",error:error instanceof Error?error.message:"STATE_READ_FAILED"},{status:503,headers:JSON_HEADERS});
      }
    }

    if(url.pathname.startsWith("/media/")){
      if(!serviceAuthorized(request,this.env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
      const pathname=decodeURIComponent(url.pathname.slice("/media/".length));
      if(!validMediaPath(pathname))return Response.json({ok:false,error:"invalid_media_path"},{status:400,headers:JSON_HEADERS});
      try{
        if(request.method==="PUT")return await this.putMedia(request,pathname);
        if(request.method==="GET")return await this.getMedia(pathname);
        if(request.method==="DELETE"){
          const chunks=await this.deleteMedia(pathname);
          return Response.json({ok:true,pathname,removedChunks:chunks},{status:200,headers:JSON_HEADERS});
        }
        return new Response("Method not allowed",{status:405,headers:{"cache-control":"no-store"}});
      }catch(error){
        return Response.json({ok:false,error:error instanceof Error?error.message:"MEDIA_OPERATION_FAILED"},{status:503,headers:JSON_HEADERS});
      }
    }

    if(url.pathname==="/state"){
      if(request.method==="GET"){
        if(!serviceAuthorized(request,this.env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
        try{
          const current=await this.readState();
          return new Response(current.raw,{status:200,headers:{...JSON_HEADERS,"x-wdcc-state-revision":String(current.state.revision)}});
        }catch(error){
          return Response.json({ok:false,error:error instanceof Error?error.message:"STATE_READ_FAILED"},{status:503,headers:JSON_HEADERS});
        }
      }

      if(request.method==="PUT"){
        const serviceAuth=serviceAuthorized(request,this.env);
        const bootstrapAuth=serviceAuth?false:await bootstrapAuthorized(request,this.env,this.ctx.storage);
        if(!serviceAuth&&!bootstrapAuth)return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
        let parsed;
        try{parsed=await request.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400,headers:JSON_HEADERS});}
        if(!validState(parsed))return Response.json({ok:false,error:"invalid_state"},{status:400,headers:JSON_HEADERS});
        const next=normalizeState(parsed);
        const body=JSON.stringify(next,null,2)+"\n";
        if(new TextEncoder().encode(body).byteLength>1_900_000)return Response.json({ok:false,error:"state_too_large_for_do"},{status:413,headers:JSON_HEADERS});
        try{
          const currentRaw=await this.ctx.storage.get(STATE_KEY);
          if(typeof currentRaw==="string"){
            const current=normalizeState(JSON.parse(currentRaw));
            if(next.revision<current.revision)return Response.json({ok:false,error:"stale_revision",currentRevision:current.revision},{status:409,headers:JSON_HEADERS});
            if(next.revision===current.revision){
              if(semanticState(next)===semanticState(current))return Response.json({ok:true,idempotent:true,revision:current.revision},{status:200,headers:JSON_HEADERS});
              return Response.json({ok:false,error:"revision_conflict",currentRevision:current.revision},{status:409,headers:JSON_HEADERS});
            }
          }
          const entries={[backupKey(next.revision)]:body,[STATE_KEY]:body};
          if(bootstrapAuth)entries[BOOTSTRAP_KEY]=new Date().toISOString();
          await this.ctx.storage.put(entries);
          await this.pruneBackups();
          return Response.json({ok:true,idempotent:false,revision:next.revision,bootstrap:bootstrapAuth},{status:200,headers:JSON_HEADERS});
        }catch(error){
          return Response.json({ok:false,error:error instanceof Error?error.message:"STATE_WRITE_FAILED"},{status:503,headers:JSON_HEADERS});
        }
      }
      return new Response("Method not allowed",{status:405,headers:{"cache-control":"no-store"}});
    }

    if(request.method==="POST"&&url.pathname==="/self-test"){
      if(!serviceAuthorized(request,this.env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
      const key=`${SELFTEST_PREFIX}${crypto.randomUUID()}`;
      const marker=JSON.stringify({ok:true,at:new Date().toISOString(),nonce:crypto.randomUUID()});
      try{
        await this.ctx.storage.put(key,marker);
        const raw=await this.ctx.storage.get(key);
        await this.ctx.storage.delete(key);
        if(raw!==marker)throw new Error("DO_SELF_TEST_MISMATCH");
        return Response.json({ok:true,storage:"durable-object-sqlite",media:"durable-object-chunked",write:true,read:true,delete:true},{status:200,headers:JSON_HEADERS});
      }catch(error){
        try{await this.ctx.storage.delete(key);}catch{}
        return Response.json({ok:false,error:error instanceof Error?error.message:"DO_SELF_TEST_FAILED"},{status:503,headers:JSON_HEADERS});
      }
    }
    return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  }
}

export default {
  async fetch(request,env){
    const id=env.WDCC_STATE.idFromName("canonical");
    return env.WDCC_STATE.get(id).fetch(request);
  }
};
