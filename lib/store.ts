import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {blobAuthority} from "./wdccAuthority";

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
const BACKUP_PREFIX="private/state/backups/platform-v3-r";
const opt=()=>blobAuthority().options as any;

// Burst reads from dashboard/auth/acceptance used to hit Blob independently and,
// on a provider 403, each failure could fan out into backup-list + backup-read
// requests. Keep consistency tight while collapsing that amplification.
const boundedInt=(raw:string|undefined,fallback:number,min:number,max:number)=>{
  const value=Number(raw);
  return Number.isFinite(value)?Math.max(min,Math.min(max,Math.trunc(value))):fallback;
};
const READ_CACHE_TTL_MS=boundedInt(process.env.WDCC_STATE_CACHE_TTL_MS,2000,0,10000);
const PROVIDER_BACKOFF_MS=boundedInt(process.env.WDCC_STATE_PROVIDER_BACKOFF_MS,60000,5000,300000);
const BACKUP_READ_LIMIT=boundedInt(process.env.WDCC_STATE_BACKUP_READ_LIMIT,5,1,20);

let stateCache:{state:State;expiresAt:number}|null=null;
let readInFlight:Promise<State>|null=null;
let providerBlockedUntil=0;

function cloneState(state:State):State{
  return structuredClone(state);
}
function cacheState(state:State){
  stateCache={state:cloneState(state),expiresAt:Date.now()+READ_CACHE_TTL_MS};
}
function providerAccessBlocked(error:unknown){
  const message=String(error instanceof Error?error.message:error||"").toLowerCase();
  return message.includes("403")||message.includes("forbidden")||message.includes("quota")||message.includes("usage limit")||message.includes("paused")||message.includes("suspended");
}
function providerBackoffActive(){return Date.now()<providerBlockedUntil;}

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

async function readBlobState(pathname:string):Promise<State>{
  const response=await get(pathname,{access:"private",useCache:false,...opt()});
  if(!response||response.statusCode!==200||!response.stream)throw Error(`STATE_BLOB_READ_FAILED:${pathname}`);
  const chunks:Uint8Array[]=[];
  for await(const chunk of response.stream as any)chunks.push(chunk);
  const raw=Buffer.concat(chunks).toString("utf8");
  const parsed=JSON.parse(raw);
  const state=normalizeState(parsed);
  if(!Number.isFinite(state.revision))throw Error(`STATE_BLOB_INVALID:${pathname}`);
  return state;
}

async function loadState():Promise<State>{
  const authority=blobAuthority();
  try{
    const state=await readBlobState(PATH);
    providerBlockedUntil=0;
    cacheState(state);
    return state;
  }catch(primaryError){
    // A provider/account 403 is not state corruption. Do not turn one blocked
    // primary read into a list request plus many doomed backup reads.
    if(providerAccessBlocked(primaryError)){
      providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
      console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:PATH,authority:authority.mode,backoffMs:PROVIDER_BACKOFF_MS,error:primaryError instanceof Error?primaryError.message:"unknown"}));
      throw Error("STATE_PROVIDER_BLOCKED");
    }
    try{
      const result=await list({prefix:BACKUP_PREFIX,limit:100,...opt()});
      const backups=[...result.blobs].sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));
      for(const blob of backups.slice(0,BACKUP_READ_LIMIT)){
        try{
          const recovered=await readBlobState(blob.pathname);
          cacheState(recovered);
          console.warn("WDCC_STATE_RECOVERED_FROM_BACKUP",JSON.stringify({pathname:blob.pathname,revision:recovered.revision,authority:authority.mode,primaryError:primaryError instanceof Error?primaryError.message:"unknown"}));
          return recovered;
        }catch(backupReadError){
          if(providerAccessBlocked(backupReadError)){
            providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
            console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:blob.pathname,authority:authority.mode,backoffMs:PROVIDER_BACKOFF_MS,error:backupReadError instanceof Error?backupReadError.message:"unknown"}));
            throw Error("STATE_PROVIDER_BLOCKED");
          }
        }
      }
    }catch(backupError){
      if(providerAccessBlocked(backupError)){
        providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
        console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:BACKUP_PREFIX,authority:authority.mode,backoffMs:PROVIDER_BACKOFF_MS,error:backupError instanceof Error?backupError.message:"unknown"}));
        throw Error("STATE_PROVIDER_BLOCKED");
      }
      console.error("WDCC_STATE_BACKUP_SCAN_FAILED",JSON.stringify({authority:authority.mode,error:backupError instanceof Error?backupError.message:"unknown"}));
    }
    console.error("WDCC_STATE_READ_FAILED",JSON.stringify({path:PATH,authority:authority.mode,error:primaryError instanceof Error?primaryError.message:"unknown"}));
    throw Error("STATE_READ_FAILED");
  }
}

export async function readState():Promise<State>{
  const authority=blobAuthority();
  if(authority.mode==="missing"){
    console.error("WDCC_STATE_AUTHORITY_MISSING",JSON.stringify({hasBlobToken:false,hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
    throw Error("STATE_AUTHORITY_MISSING");
  }
  if(stateCache&&Date.now()<stateCache.expiresAt)return cloneState(stateCache.state);
  if(providerBackoffActive())throw Error("STATE_PROVIDER_BLOCKED");
  if(!readInFlight)readInFlight=loadState().finally(()=>{readInFlight=null;});
  return cloneState(await readInFlight);
}

export async function writeState(input:State){
  const authority=blobAuthority();
  if(authority.mode==="missing")throw Error("STATE_AUTHORITY_MISSING");
  if(providerBackoffActive())throw Error("STATE_PROVIDER_BLOCKED");
  const state=normalizeState(input);
  state.revision=Number(state.revision||0)+1;
  state.updatedAt=new Date().toISOString();
  const body=JSON.stringify(state,null,2)+"\n";
  const backupPath=`private/state/backups/platform-v3-r${state.revision}-${crypto.randomUUID()}.json`;

  try{
    await put(backupPath,body,{
      access:"private",
      addRandomSuffix:false,
      allowOverwrite:false,
      contentType:"application/json",
      ...opt()
    });
    await put(PATH,body,{
      access:"private",
      addRandomSuffix:false,
      allowOverwrite:true,
      contentType:"application/json",
      ...opt()
    });
  }catch(error){
    if(providerAccessBlocked(error)){
      providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
      console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:PATH,authority:authority.mode,operation:"write",backoffMs:PROVIDER_BACKOFF_MS,error:error instanceof Error?error.message:"unknown"}));
      throw Error("STATE_PROVIDER_BLOCKED");
    }
    throw error;
  }
  providerBlockedUntil=0;
  cacheState(state);
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
