import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {blobAuthority} from "./wdccAuthority";
import {postgresStateConfigured,readPostgresState,writePostgresState} from "./postgresState";

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
export type StateProvider="blob"|"postgres";

export function selectedStateProvider():StateProvider{
  const value=String(process.env.WDCC_STATE_PROVIDER||"blob").trim().toLowerCase();
  if(value==="postgres"||value==="neon")return "postgres";
  if(!value||value==="blob"||value==="vercel")return "blob";
  throw Error(`STATE_PROVIDER_INVALID:${value}`);
}

const PATH="private/state/platform-v3.json";
// All historical WDCC backup families live under this shared prefix. Do not
// narrow this to platform-v3-r*: newer recovery/certification backups use
// platform-v3-pre-*, platform-v3-login-reset-*, and similar names.
const BACKUP_PREFIX="private/state/backups/platform-v3-";
const BACKUP_LIST_PAGE_SIZE=250;
const opt=()=>blobAuthority().options as any;

// Collapse burst reads from auth/dashboard/acceptance into one provider request and
// fail fast on provider/account suspension so a single 403 cannot fan out into
// list + backup reads. Bounds are intentionally small and environment-tunable.
const boundedInt=(raw:string|undefined,fallback:number,min:number,max:number)=>{
  const value=Number(raw);
  return Number.isFinite(value)?Math.max(min,Math.min(max,Math.trunc(value))):fallback;
};
const READ_CACHE_TTL_MS=boundedInt(process.env.WDCC_STATE_CACHE_TTL_MS,2000,0,10000);
const PROVIDER_BACKOFF_MS=boundedInt(process.env.WDCC_STATE_PROVIDER_BACKOFF_MS,60000,5000,300000);
const BACKUP_READ_LIMIT=boundedInt(process.env.WDCC_STATE_BACKUP_READ_LIMIT,5,1,20);
const BACKUP_SCAN_MAX_PAGES=boundedInt(process.env.WDCC_STATE_BACKUP_SCAN_MAX_PAGES,4,1,8);

let stateCache:{state:State;expiresAt:number}|null=null;
let readInFlight:Promise<State>|null=null;
let providerBlockedUntil=0;
let driftReported=false;

function cloneState(state:State):State{
  return structuredClone(state);
}
function cacheState(state:State){
  stateCache={state:cloneState(state),expiresAt:Date.now()+READ_CACHE_TTL_MS};
}
function providerAccessBlocked(error:unknown){
  const message=String(error instanceof Error?error.message:error||"").toLowerCase();
  return message.includes("403")||message.includes("forbidden")||message.includes("quota")||message.includes("usage limit")||message.includes("paused")||message.includes("suspended")||message.includes("blocked");
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
  if(!Number.isFinite(state.revision)||state.revision<0)throw Error(`STATE_BLOB_INVALID:${pathname}`);
  if(!Array.isArray(state.users)||!Array.isArray(state.leads)||!Array.isArray(state.vehicles))throw Error(`STATE_BLOB_CONTRACT_INVALID:${pathname}`);
  return state;
}

function backupRevisionHint(pathname:string){
  const matches=[...String(pathname||"").matchAll(/(?:^|[-_])r(\d+)(?=[-_.]|$)/gi)];
  return matches.length?Number(matches[matches.length-1][1]||0):0;
}

async function listBackupCandidates(){
  const blobs:any[]=[];
  let cursor:string|undefined;
  let pages=0;
  do{
    const result:any=await list({
      prefix:BACKUP_PREFIX,
      limit:BACKUP_LIST_PAGE_SIZE,
      cursor,
      ...opt()
    });
    blobs.push(...(Array.isArray(result?.blobs)?result.blobs:[]));
    cursor=String(result?.cursor||"").trim()||undefined;
    pages++;
  }while(cursor&&pages<BACKUP_SCAN_MAX_PAGES);

  if(cursor){
    console.warn("WDCC_STATE_BACKUP_SCAN_CAPPED",JSON.stringify({prefix:BACKUP_PREFIX,pages,count:blobs.length,maxPages:BACKUP_SCAN_MAX_PAGES}));
  }

  return blobs.sort((a:any,b:any)=>{
    const revisionDelta=backupRevisionHint(String(b?.pathname||""))-backupRevisionHint(String(a?.pathname||""));
    if(revisionDelta)return revisionDelta;
    return String(b?.uploadedAt||"").localeCompare(String(a?.uploadedAt||""));
  });
}

async function loadBlobState():Promise<State>{
  const authority=blobAuthority();
  try{
    const state=await readBlobState(PATH);
    providerBlockedUntil=0;
    cacheState(state);
    return state;
  }catch(primaryError){
    if(providerAccessBlocked(primaryError)){
      providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
      console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:PATH,authority:authority.mode,storeId:authority.storeId,backoffMs:PROVIDER_BACKOFF_MS,error:primaryError instanceof Error?primaryError.message:"unknown"}));
      throw Error("STATE_PROVIDER_BLOCKED");
    }
    try{
      const backups=await listBackupCandidates();
      let best:{state:State;pathname:string}|null=null;
      for(const blob of backups.slice(0,BACKUP_READ_LIMIT)){
        try{
          const recovered=await readBlobState(blob.pathname);
          if(!best||recovered.revision>best.state.revision){
            best={state:recovered,pathname:blob.pathname};
          }
        }catch(backupReadError){
          if(providerAccessBlocked(backupReadError)){
            providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
            console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:blob.pathname,authority:authority.mode,storeId:authority.storeId,backoffMs:PROVIDER_BACKOFF_MS,error:backupReadError instanceof Error?backupReadError.message:"unknown"}));
            throw Error("STATE_PROVIDER_BLOCKED");
          }
        }
      }
      if(best){
        providerBlockedUntil=0;
        cacheState(best.state);
        console.warn("WDCC_STATE_RECOVERED_FROM_BACKUP",JSON.stringify({pathname:best.pathname,revision:best.state.revision,authority:authority.mode,storeId:authority.storeId,primaryError:primaryError instanceof Error?primaryError.message:"unknown"}));
        return best.state;
      }
    }catch(backupError){
      if(providerAccessBlocked(backupError)){
        providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
        console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:BACKUP_PREFIX,authority:authority.mode,storeId:authority.storeId,backoffMs:PROVIDER_BACKOFF_MS,error:backupError instanceof Error?backupError.message:"unknown"}));
        throw Error("STATE_PROVIDER_BLOCKED");
      }
      console.error("WDCC_STATE_BACKUP_SCAN_FAILED",JSON.stringify({authority:authority.mode,storeId:authority.storeId,error:backupError instanceof Error?backupError.message:"unknown"}));
    }
    console.error("WDCC_STATE_READ_FAILED",JSON.stringify({path:PATH,authority:authority.mode,storeId:authority.storeId,error:primaryError instanceof Error?primaryError.message:"unknown"}));
    throw Error("STATE_READ_FAILED");
  }
}

export async function readState():Promise<State>{
  const provider=selectedStateProvider();
  if(provider==="postgres"){
    if(!postgresStateConfigured())throw Error("STATE_POSTGRES_URL_MISSING");
    return readPostgresState();
  }

  const authority=blobAuthority();
  if(authority.drift&&!driftReported){
    driftReported=true;
    console.warn("WDCC_STATE_CONNECTED_STORE_DRIFT_IGNORED",JSON.stringify({connectedStoreId:authority.connectedStoreId,canonicalStoreId:authority.storeId,authority:authority.mode}));
  }
  if(authority.mode==="missing"){
    console.error("WDCC_STATE_AUTHORITY_MISSING",JSON.stringify({hasBlobToken:false,hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),canonicalStoreId:authority.storeId,connectedStoreId:authority.connectedStoreId}));
    throw Error("STATE_AUTHORITY_MISSING");
  }
  if(stateCache&&Date.now()<stateCache.expiresAt)return cloneState(stateCache.state);
  if(providerBackoffActive())throw Error("STATE_PROVIDER_BLOCKED");
  if(!readInFlight)readInFlight=loadBlobState().finally(()=>{readInFlight=null;});
  return cloneState(await readInFlight);
}

export async function writeState(input:State){
  const provider=selectedStateProvider();
  if(provider==="postgres"){
    if(!postgresStateConfigured())throw Error("STATE_POSTGRES_URL_MISSING");
    return writePostgresState(input);
  }

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
      console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:PATH,authority:authority.mode,storeId:authority.storeId,operation:"write",backoffMs:PROVIDER_BACKOFF_MS,error:error instanceof Error?error.message:"unknown"}));
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

export function isInternalVehicleRecord(vehicle:any){
  const visibility=String(vehicle?.visibility||vehicle?.listingVisibility||"").trim().toLowerCase();
  return vehicle?.internalOnly===true||visibility==="internal"||visibility==="dealer_only";
}

export function publicVehicles(state:State){
  const nextYear=new Date().getUTCFullYear()+1;
  return state.vehicles.filter(vehicle=>
    String(vehicle.status||"").toLowerCase()==="published"&&
    Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&
    Boolean(String(vehicle.make||"").trim())&&
    Boolean(String(vehicle.model||"").trim())&&
    Number(vehicle.price||vehicle.cashPrice)>0&&
    !isQaVehicleRecord(vehicle)&&
    !isInternalVehicleRecord(vehicle)
  );
}
