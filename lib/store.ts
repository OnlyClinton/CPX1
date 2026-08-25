import crypto from "node:crypto";
import {BlobPreconditionFailedError,get,head,put} from "@vercel/blob";

export type User={
  id:string;
  email?:string;
  secondaryEmail?:string;
  username?:string;
  loginAlias?:string;
  aliases?:string[];
  displayName?:string;
  role:string;
  tenantId?:string;
  status?:string;
  disabled?:boolean;
  passwordHash?:string;
};
export type Vehicle={id:string;[key:string]:any};
export type State={
  revision:number;
  tenants:any[];
  users:User[];
  vehicles:Vehicle[];
  leads:any[];
  audit:any[];
  updatedAt?:string;
};

const PATH="private/state/platform-v3.json";
const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};

function normalizeState(value:any):State{
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

async function readCanonicalSnapshot(){
  for(let attempt=0;attempt<3;attempt++){
    const before=await head(PATH,{...opt()});
    const response=await get(PATH,{access:"private",useCache:false,...opt()});
    if(!response||response.statusCode!==200||!response.stream)throw Error("STATE_READ_FAILED");
    const chunks:Uint8Array[]=[];
    for await(const chunk of response.stream as any)chunks.push(chunk);
    const raw=Buffer.concat(chunks);
    const after=await head(PATH,{...opt()});
    if(before.etag===after.etag)return {state:normalizeState(JSON.parse(raw.toString("utf8"))),raw,etag:after.etag};
  }
  throw Error("STATE_CONCURRENT_READ");
}

export async function readState():Promise<State>{
  return (await readCanonicalSnapshot()).state;
}

export async function writeState(input:State){
  const current=await readCanonicalSnapshot();
  const suppliedRevision=Number(input?.revision||0);
  if(suppliedRevision!==current.state.revision)throw Error(`STATE_REVISION_CONFLICT:${suppliedRevision}:${current.state.revision}`);

  const state=normalizeState(input);
  state.revision=current.state.revision+1;
  state.updatedAt=new Date().toISOString();
  const body=`${JSON.stringify(state,null,2)}\n`;
  const backupPath=`private/state/backups/platform-v3-pre-r${current.state.revision}-${crypto.randomUUID()}.json`;

  // Preserve the exact state that is about to be replaced, then use the
  // canonical blob ETag as an optimistic-concurrency guard against lost writes.
  await put(backupPath,current.raw,{
    access:"private",
    addRandomSuffix:false,
    allowOverwrite:false,
    contentType:"application/json",
    ...opt()
  });
  try{
    await put(PATH,body,{
      access:"private",
      addRandomSuffix:false,
      allowOverwrite:true,
      contentType:"application/json",
      ifMatch:current.etag,
      ...opt()
    });
  }catch(error){
    if(error instanceof BlobPreconditionFailedError)throw Error("STATE_REVISION_CONFLICT");
    throw error;
  }

  // Callers intentionally enrich the same in-memory ledger across sequential
  // persistence checkpoints (for example, lead persistence then sync/notification
  // metadata). Carry the committed revision forward so those later checkpoints
  // remain concurrency-safe instead of being mistaken for stale writers.
  input.revision=state.revision;
  input.updatedAt=state.updatedAt;
  return state;
}

export function isQaVehicleRecord(vehicle:any){
  const stock=String(vehicle?.stock||vehicle?.stock_id||"").trim().toUpperCase();
  const id=String(vehicle?.id||"").trim().toUpperCase();
  const description=String(vehicle?.description||"").toLowerCase();
  const badges=Array.isArray(vehicle?.badges)?vehicle.badges.map((value:any)=>String(value||"").toUpperCase()):[];
  return vehicle?.qa===true||
    /^R36TEST[-_]/.test(stock)||
    /^WDCC[-_]QA[-_]/.test(stock)||
    /^QA[-_]/.test(stock)||
    /^TEST[-_]/.test(stock)||
    /^WDCC[-_]QA[-_]/.test(id)||
    /^QA[-_]/.test(id)||
    badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"))||
    description.includes("automated temporary qa vehicle")||
    description.includes("automated dealer workflow certification")||
    description.includes("automated recovery certification vehicle")||
    description.includes("synthetic upload acceptance")||
    description.includes("dealer upload qa");
}

export function publicVehicles(state:State){
  const nextYear=new Date().getUTCFullYear()+1;
  return state.vehicles.filter(vehicle=>
    String(vehicle.status||"").toLowerCase()==="published"&&
    Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&
    Boolean(String(vehicle.make||"").trim())&&
    Boolean(String(vehicle.model||"").trim())&&
    Number(vehicle.price||vehicle.cashPrice)>0&&
    !isQaVehicleRecord(vehicle)
  );
}
