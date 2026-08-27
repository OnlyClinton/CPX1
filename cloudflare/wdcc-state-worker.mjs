const STATE_KEY="state";
const BOOTSTRAP_KEY="bootstrap_consumed";
const BACKUP_PREFIX="backup:";
const SELFTEST_PREFIX="selftest:";
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

  async fetch(request){
    const url=new URL(request.url);

    if(request.method==="GET"&&url.pathname==="/health"){
      try{
        const current=await this.readState();
        return Response.json({ok:true,degraded:false,service:"wdcc-state-authority",provider:"cloudflare",storage:"durable-object-sqlite",state:"readable",revision:current.state.revision,recoverySource:current.source},{status:200,headers:JSON_HEADERS});
      }catch(error){
        return Response.json({ok:false,degraded:true,service:"wdcc-state-authority",provider:"cloudflare",storage:"durable-object-sqlite",state:"unreadable",error:error instanceof Error?error.message:"STATE_READ_FAILED"},{status:503,headers:JSON_HEADERS});
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
        return Response.json({ok:true,storage:"durable-object-sqlite",write:true,read:true,delete:true},{status:200,headers:JSON_HEADERS});
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
