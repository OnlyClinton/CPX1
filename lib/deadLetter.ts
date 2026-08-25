import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";

export type DeadLetter={
  category:string;
  stage:string;
  entityType?:string|null;
  entityId?:string|null;
  tenantId?:string|null;
  requestId?:string|null;
  retryable?:boolean;
  attempts?:number;
  error?:string|null;
  nextAttemptAt?:string|null;
  context?:Record<string,unknown>|null;
};

const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};
const clean=(v:unknown,max=600)=>String(v??"").trim().slice(0,max);
const entityKey=(entityType:unknown,entityId:unknown)=>crypto.createHash("sha256").update(`${clean(entityType,80)}:${clean(entityId,180)}`).digest("hex").slice(0,40);

export async function recordDeadLetter(input:DeadLetter){
  const at=new Date().toISOString();
  const id=crypto.randomUUID();
  const attempts=Math.max(1,Math.min(Number(input.attempts)||1,1000));
  const record={
    id,at,
    category:clean(input.category,100)||"unknown",
    stage:clean(input.stage,120)||"unknown",
    entityType:input.entityType?clean(input.entityType,80):null,
    entityId:input.entityId?clean(input.entityId,180):null,
    tenantId:input.tenantId?clean(input.tenantId,180):null,
    requestId:input.requestId?clean(input.requestId,180):null,
    retryable:input.retryable!==false,
    attempts,
    error:input.error?clean(input.error,800):null,
    nextAttemptAt:input.nextAttemptAt&&Number.isFinite(Date.parse(input.nextAttemptAt))?new Date(input.nextAttemptAt).toISOString():null,
    status:"open",
    context:input.context&&typeof input.context==="object"?input.context:null
  };
  const pathname=`private/logs/dead-letter/${at.slice(0,10)}/${at.replace(/[:.]/g,"-")}-${id}.json`;
  await put(pathname,JSON.stringify(record)+"\n",{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/json",...opt()});
  console.error("WDCC_DEAD_LETTER",JSON.stringify(record));
  return record;
}

export async function resolveDeadLettersForEntity(entityType:unknown,entityId:unknown,tenantId?:unknown,detail?:unknown){
  const type=clean(entityType,80);const id=clean(entityId,180);if(!type||!id)return null;
  const resolvedAt=new Date().toISOString();
  const record={entityType:type,entityId:id,tenantId:clean(tenantId||"wdcc",180)||"wdcc",resolvedAt,detail:clean(detail||"recovered",300)};
  const pathname=`private/logs/dead-letter-resolutions/${entityKey(type,id)}.json`;
  await put(pathname,JSON.stringify(record)+"\n",{access:"private",addRandomSuffix:false,allowOverwrite:true,contentType:"application/json",...opt()});
  console.log("WDCC_DEAD_LETTER_RESOLVED",JSON.stringify(record));
  return record;
}

async function readJson(pathname:string){
  const response=await get(pathname,{access:"private",useCache:false,...opt()});
  if(!response||response.statusCode!==200||!response.stream)return null;
  const chunks:Uint8Array[]=[];for await(const chunk of response.stream as any)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function readRecentDeadLetters(max=200){
  const wanted=Math.max(1,Math.min(Number(max)||200,500));
  const [deadResult,resolutionResult]=await Promise.all([
    list({prefix:"private/logs/dead-letter/",limit:1000,...opt()}),
    list({prefix:"private/logs/dead-letter-resolutions/",limit:1000,...opt()})
  ]);
  const resolutions=new Map<string,any>();
  for(const blob of resolutionResult.blobs){try{const item=await readJson(blob.pathname);if(item?.entityType&&item?.entityId)resolutions.set(entityKey(item.entityType,item.entityId),item)}catch{}}
  const blobs=[...deadResult.blobs].sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||""))).slice(0,wanted);
  const items:any[]=[];
  for(const blob of blobs){
    try{
      const item=await readJson(blob.pathname);if(!item)continue;
      const resolution=item.entityType&&item.entityId?resolutions.get(entityKey(item.entityType,item.entityId)):null;
      if(resolution&&String(resolution.resolvedAt||"")>=String(item.at||"")){
        item.status="resolved";item.resolvedAt=resolution.resolvedAt;item.resolutionDetail=resolution.detail||null;
      }
      items.push(item);
    }catch{}
  }
  return items.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
}
