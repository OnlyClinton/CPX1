import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {blobAuthority} from "./wdccAuthority";
import {cloudflareDataAvailable,r2List,r2PutText,r2Text} from "./cloudflareR2";

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
const READ_CACHE_MS=2500;
const PROVIDER_BACKOFF_MS=60_000;
const BACKUP_RECOVERY_LIMIT=6;
const opt=()=>blobAuthority().options as any;

let readCache:{state:State;expiresAt:number}|null=null;
let readInFlight:Promise<State>|null=null;
let providerBlockedUntil=0;

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

function cloneState(state:State):State{return normalizeState(JSON.parse(JSON.stringify(state)))}
function errorText(error:unknown){return error instanceof Error?error.message:String(error||"unknown")}
function providerAccessBlocked(error:unknown){return /(403|forbidden|suspend|blocked|billing|quota|limit|unauthori[sz]ed|invalid\s+token|token\s+expired)/i.test(errorText(error))}
function remember(state:State){readCache={state:cloneState(state),expiresAt:Date.now()+READ_CACHE_MS};providerBlockedUntil=0}

function parseState(raw:string,source:string){
  const state=normalizeState(JSON.parse(raw));
  if(!Number.isFinite(state.revision))throw Error(`STATE_INVALID:${source}`);
  return state;
}

async function readR2State(pathname:string):Promise<State>{
  const raw=await r2Text(pathname);
  if(raw==null)throw Error(`STATE_R2_NOT_FOUND:${pathname}`);
  return parseState(raw,`r2:${pathname}`);
}

async function readBlobState(pathname:string):Promise<State>{
  const response=await get(pathname,{access:"private",useCache:false,...opt()});
  if(!response||response.statusCode!==200||!response.stream)throw Error(`STATE_BLOB_READ_FAILED:${pathname}`);
  const chunks:Uint8Array[]=[];
  for await(const chunk of response.stream as any)chunks.push(chunk);
  return parseState(Buffer.concat(chunks).toString("utf8"),`blob:${pathname}`);
}

async function readFromR2():Promise<State>{
  try{
    const state=await readR2State(PATH);
    remember(state);
    return state;
  }catch(primaryError){
    try{
      const backups=(await r2List(BACKUP_PREFIX,1000)).sort((a,b)=>String(b.uploaded||"").localeCompare(String(a.uploaded||"")));
      for(const object of backups.slice(0,BACKUP_RECOVERY_LIMIT)){
        try{
          const recovered=await readR2State(object.key);
          remember(recovered);
          console.warn("WDCC_STATE_R2_RECOVERED_FROM_BACKUP",JSON.stringify({key:object.key,revision:recovered.revision,primaryError:errorText(primaryError)}));
          return recovered;
        }catch{}
      }
    }catch(backupError){console.error("WDCC_STATE_R2_BACKUP_SCAN_FAILED",JSON.stringify({error:errorText(backupError)}))}
    console.error("WDCC_STATE_R2_READ_FAILED",JSON.stringify({path:PATH,error:errorText(primaryError)}));
    throw Error("STATE_READ_FAILED");
  }
}

async function readFromLegacyBlob():Promise<State>{
  const authority=blobAuthority();
  if(authority.mode==="missing"){
    console.error("WDCC_STATE_AUTHORITY_MISSING",JSON.stringify({cloudflareR2:false,hasBlobToken:Boolean((process.env.BLOB_READ_WRITE_TOKEN||"").trim()),hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
    throw Error("STATE_AUTHORITY_MISSING");
  }
  try{
    const state=await readBlobState(PATH);remember(state);return state;
  }catch(primaryError){
    if(providerAccessBlocked(primaryError)){
      providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;
      console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({path:PATH,authority:authority.mode,backoffMs:PROVIDER_BACKOFF_MS,error:errorText(primaryError)}));
      throw Error("STATE_PROVIDER_BLOCKED");
    }
    try{
      const result=await list({prefix:BACKUP_PREFIX,limit:1000,...opt()});
      const backups=[...result.blobs].sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));
      for(const blob of backups.slice(0,BACKUP_RECOVERY_LIMIT)){
        try{
          const recovered=await readBlobState(blob.pathname);remember(recovered);return recovered;
        }catch(backupReadError){if(providerAccessBlocked(backupReadError)){providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;break}}
      }
    }catch(backupError){if(providerAccessBlocked(backupError))providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS}
    throw Error("STATE_READ_FAILED");
  }
}

async function readStateFresh():Promise<State>{
  if(cloudflareDataAvailable())return readFromR2();
  return readFromLegacyBlob();
}

export async function readState():Promise<State>{
  const now=Date.now();
  if(readCache&&readCache.expiresAt>now)return cloneState(readCache.state);
  if(providerBlockedUntil>now)throw Error("STATE_PROVIDER_BACKOFF");
  if(!readInFlight)readInFlight=readStateFresh().finally(()=>{readInFlight=null});
  return cloneState(await readInFlight);
}

export async function writeState(input:State){
  const state=normalizeState(input);
  state.revision=Number(state.revision||0)+1;
  state.updatedAt=new Date().toISOString();
  const body=JSON.stringify(state,null,2)+"\n";
  const backupPath=`private/state/backups/platform-v3-r${state.revision}-${crypto.randomUUID()}.json`;

  if(cloudflareDataAvailable()){
    await r2PutText(backupPath,body);
    await r2PutText(PATH,body);
    remember(state);
    return cloneState(state);
  }

  const authority=blobAuthority();
  if(authority.mode==="missing")throw Error("STATE_AUTHORITY_MISSING");
  await put(backupPath,body,{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/json",...opt()});
  await put(PATH,body,{access:"private",addRandomSuffix:false,allowOverwrite:true,contentType:"application/json",...opt()});
  remember(state);
  return cloneState(state);
}

export function isQaVehicleRecord(vehicle:any){
  const stock=String(vehicle?.stock||vehicle?.stock_id||"").trim().toUpperCase();
  const id=String(vehicle?.id||"").trim().toUpperCase();
  const description=String(vehicle?.description||"").toLowerCase();
  const badges=Array.isArray(vehicle?.badges)?vehicle.badges.map((value:any)=>String(value||"").toUpperCase()):[];
  return vehicle?.qa===true||/^R36TEST[-_]/.test(stock)||/^WDCC[-_]QA[-_]/.test(stock)||/^QA[-_]/.test(stock)||/^TEST[-_]/.test(stock)||/^WDCC[-_]QA[-_]/.test(id)||/^QA[-_]/.test(id)||badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"))||description.includes("automated temporary qa vehicle")||description.includes("automated dealer workflow certification")||description.includes("automated recovery certification vehicle")||description.includes("synthetic upload acceptance")||description.includes("dealer upload qa");
}

export function isInternalVehicleRecord(vehicle:any){
  const visibility=String(vehicle?.visibility||vehicle?.listingVisibility||"").trim().toLowerCase();
  return vehicle?.internalOnly===true||visibility==="internal"||visibility==="dealer_only";
}

export function publicVehicles(state:State){
  const nextYear=new Date().getUTCFullYear()+1;
  return state.vehicles.filter(vehicle=>String(vehicle.status||"").toLowerCase()==="published"&&Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&Boolean(String(vehicle.make||"").trim())&&Boolean(String(vehicle.model||"").trim())&&Number(vehicle.price||vehicle.cashPrice)>0&&!isQaVehicleRecord(vehicle)&&!isInternalVehicleRecord(vehicle));
}
