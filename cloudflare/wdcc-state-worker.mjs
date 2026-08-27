const PATH="private/state/platform-v3.json";
const BACKUP_PREFIX="private/state/backups/platform-v3-r";
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

function authorized(request,env){
  const expected=String(env.WDCC_STATE_SERVICE_TOKEN||"");
  const supplied=String(request.headers.get("authorization")||"");
  return Boolean(expected)&&supplied===`Bearer ${expected}`;
}

async function readKey(env,key){
  const object=await env.STATE_BUCKET.get(key);
  if(!object)return null;
  const raw=await object.text();
  const parsed=JSON.parse(raw);
  if(!validState(parsed))throw new Error(`STATE_INVALID:${key}`);
  return {key,raw,state:normalizeState(parsed)};
}

async function readState(env){
  try{
    const primary=await readKey(env,PATH);
    if(primary)return primary;
  }catch(error){
    console.error("WDCC_R2_PRIMARY_READ_FAILED",error instanceof Error?error.message:String(error));
  }
  const listed=await env.STATE_BUCKET.list({prefix:BACKUP_PREFIX,limit:1000});
  const candidates=[...(listed.objects||[])].sort((a,b)=>{
    const bt=b?.uploaded?new Date(b.uploaded).getTime():0;
    const at=a?.uploaded?new Date(a.uploaded).getTime():0;
    return bt-at;
  });
  for(const object of candidates.slice(0,50)){
    try{
      const recovered=await readKey(env,object.key);
      if(recovered)return recovered;
    }catch{}
  }
  throw new Error("STATE_READ_FAILED");
}

function semanticState(value){
  return JSON.stringify(normalizeState(value));
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(request.method==="GET"&&url.pathname==="/health"){
      try{
        const current=await readState(env);
        return Response.json({ok:true,degraded:false,service:"wdcc-state-authority",provider:"cloudflare",storage:"r2",state:"readable",revision:current.state.revision},{status:200,headers:JSON_HEADERS});
      }catch(error){
        return Response.json({ok:false,degraded:true,service:"wdcc-state-authority",provider:"cloudflare",storage:"r2",state:"unreadable",error:error instanceof Error?error.message:"STATE_READ_FAILED"},{status:503,headers:JSON_HEADERS});
      }
    }

    if(url.pathname==="/state"){
      if(!authorized(request,env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});

      if(request.method==="GET"){
        try{
          const current=await readState(env);
          return new Response(current.raw,{status:200,headers:{...JSON_HEADERS,"x-wdcc-state-revision":String(current.state.revision)}});
        }catch(error){
          return Response.json({ok:false,error:error instanceof Error?error.message:"STATE_READ_FAILED"},{status:503,headers:JSON_HEADERS});
        }
      }

      if(request.method==="PUT"){
        let parsed;
        try{parsed=await request.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400,headers:JSON_HEADERS});}
        if(!validState(parsed))return Response.json({ok:false,error:"invalid_state"},{status:400,headers:JSON_HEADERS});
        const next=normalizeState(parsed);

        try{
          const current=await readKey(env,PATH);
          if(current){
            if(next.revision<current.state.revision)return Response.json({ok:false,error:"stale_revision",currentRevision:current.state.revision},{status:409,headers:JSON_HEADERS});
            if(next.revision===current.state.revision){
              if(semanticState(next)===semanticState(current.state))return Response.json({ok:true,idempotent:true,revision:current.state.revision},{status:200,headers:JSON_HEADERS});
              return Response.json({ok:false,error:"revision_conflict",currentRevision:current.state.revision},{status:409,headers:JSON_HEADERS});
            }
          }

          const body=JSON.stringify(next,null,2)+"\n";
          const backupPath=`${BACKUP_PREFIX}${next.revision}-${crypto.randomUUID()}.json`;
          await env.STATE_BUCKET.put(backupPath,body,{httpMetadata:{contentType:"application/json"},customMetadata:{revision:String(next.revision),source:"wdcc-state-worker"}});
          await env.STATE_BUCKET.put(PATH,body,{httpMetadata:{contentType:"application/json"},customMetadata:{revision:String(next.revision),source:"wdcc-state-worker"}});
          return Response.json({ok:true,idempotent:false,revision:next.revision,backupPath},{status:200,headers:JSON_HEADERS});
        }catch(error){
          return Response.json({ok:false,error:error instanceof Error?error.message:"STATE_WRITE_FAILED"},{status:503,headers:JSON_HEADERS});
        }
      }

      return new Response("Method not allowed",{status:405,headers:{"cache-control":"no-store"}});
    }

    if(request.method==="POST"&&url.pathname==="/self-test"){
      if(!authorized(request,env))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:JSON_HEADERS});
      const key=`private/state/self-test/${crypto.randomUUID()}.json`;
      const marker=JSON.stringify({ok:true,at:new Date().toISOString(),nonce:crypto.randomUUID()});
      try{
        await env.STATE_BUCKET.put(key,marker,{httpMetadata:{contentType:"application/json"}});
        const check=await env.STATE_BUCKET.get(key);
        const raw=check?await check.text():"";
        await env.STATE_BUCKET.delete(key);
        if(raw!==marker)throw new Error("R2_SELF_TEST_MISMATCH");
        return Response.json({ok:true,storage:"r2",write:true,read:true,delete:true},{status:200,headers:JSON_HEADERS});
      }catch(error){
        try{await env.STATE_BUCKET.delete(key);}catch{}
        return Response.json({ok:false,error:error instanceof Error?error.message:"R2_SELF_TEST_FAILED"},{status:503,headers:JSON_HEADERS});
      }
    }

    return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  }
};
