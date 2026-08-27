import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {blobAuthority} from "./wdccAuthority";
import {cloudflareDataBucket} from "./cloudflareR2";

export type User={id:string;email?:string;secondaryEmail?:string;username?:string;loginAlias?:string;aliases?:string[];displayName?:string;role:string;tenantId?:string;status?:string;disabled?:boolean;passwordHash?:string};
export type Vehicle={id:string;[key:string]:any};
export type State={revision:number;tenants:any[];users:User[];vehicles:Vehicle[];leads:any[];audit:any[];updatedAt?:string};
export type StateProvider="blob"|"r2";

export function selectedStateProvider():StateProvider{
  const value=String(process.env.WDCC_STATE_PROVIDER||"blob").trim().toLowerCase();
  if(value==="r2"||value==="cloudflare")return "r2";
  if(!value||value==="blob"||value==="vercel")return "blob";
  throw Error(`STATE_PROVIDER_INVALID:${value}`);
}

const PATH="private/state/platform-v3.json";
const BACKUP_PREFIX="private/state/backups/platform-v3-";
const READ_CACHE_MS=2500;
const PROVIDER_BACKOFF_MS=60_000;
const BACKUP_RECOVERY_LIMIT=6;
const BACKUP_SCAN_MAX_PAGES=4;
const opt=()=>blobAuthority().options as any;

let readCache:{state:State;expiresAt:number}|null=null;
let readInFlight:Promise<State>|null=null;
let providerBlockedUntil=0;

function normalizeState(value:any):State{return {...value,revision:Number(value?.revision||0),tenants:Array.isArray(value?.tenants)?value.tenants:[],users:Array.isArray(value?.users)?value.users:[],vehicles:Array.isArray(value?.vehicles)?value.vehicles:[],leads:Array.isArray(value?.leads)?value.leads:[],audit:Array.isArray(value?.audit)?value.audit:[]}}
function cloneState(state:State):State{return normalizeState(JSON.parse(JSON.stringify(state)))}
function validateState(state:State,source:string){if(!Number.isFinite(state.revision)||state.revision<0)throw Error(`STATE_INVALID:${source}`);if(!Array.isArray(state.users)||!Array.isArray(state.vehicles)||!Array.isArray(state.leads)||!Array.isArray(state.audit))throw Error(`STATE_CONTRACT_INVALID:${source}`);return state}
function errorText(error:unknown){return error instanceof Error?error.message:String(error||"unknown")}
function providerAccessBlocked(error:unknown){return /(403|forbidden|suspend|blocked|billing|quota|limit|unauthori[sz]ed|invalid\s+token|token\s+expired)/i.test(errorText(error))}
function remember(state:State){readCache={state:cloneState(state),expiresAt:Date.now()+READ_CACHE_MS};providerBlockedUntil=0}
function backupRevisionHint(pathname:string){const m=[...String(pathname||"").matchAll(/(?:^|[-_])r(\d+)(?=[-_.]|$)/gi)];return m.length?Number(m[m.length-1][1]||0):0}

async function readBlobState(pathname:string):Promise<State>{const response=await get(pathname,{access:"private",useCache:false,...opt()});if(!response||response.statusCode!==200||!response.stream)throw Error(`STATE_BLOB_READ_FAILED:${pathname}`);const chunks:Uint8Array[]=[];for await(const chunk of response.stream as any)chunks.push(chunk);return validateState(normalizeState(JSON.parse(Buffer.concat(chunks).toString("utf8"))),pathname)}

async function readBlobStateFresh():Promise<State>{
  const authority=blobAuthority();if(authority.mode==="missing")throw Error("STATE_AUTHORITY_MISSING");
  try{const state=await readBlobState(PATH);remember(state);return state}catch(primaryError){
    if(providerAccessBlocked(primaryError)){providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;console.error("WDCC_STATE_PROVIDER_BLOCKED",JSON.stringify({provider:"blob",path:PATH,backoffMs:PROVIDER_BACKOFF_MS,error:errorText(primaryError)}));throw Error("STATE_PROVIDER_BLOCKED")}
    try{const result=await list({prefix:BACKUP_PREFIX,limit:1000,...opt()});const backups=[...result.blobs].sort((a:any,b:any)=>backupRevisionHint(String(b.pathname))-backupRevisionHint(String(a.pathname))||String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));for(const blob of backups.slice(0,BACKUP_RECOVERY_LIMIT)){try{const recovered=await readBlobState(blob.pathname);remember(recovered);return recovered}catch(error){if(providerAccessBlocked(error)){providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS;break}}}}catch(error){if(providerAccessBlocked(error))providerBlockedUntil=Date.now()+PROVIDER_BACKOFF_MS}
    throw Error("STATE_READ_FAILED");
  }
}

async function readR2State(pathname:string):Promise<State>{const object=await cloudflareDataBucket().get(pathname);if(!object||!("body" in object))throw Error(`STATE_R2_READ_FAILED:${pathname}`);return validateState(normalizeState(JSON.parse(await object.text())),pathname)}
async function listR2Backups(){const bucket=cloudflareDataBucket();const found:any[]=[];let cursor:undefined|string;for(let page=0;page<BACKUP_SCAN_MAX_PAGES;page++){const result=await bucket.list({prefix:BACKUP_PREFIX,limit:1000,cursor});found.push(...(Array.isArray(result?.objects)?result.objects:[]));cursor=result?.truncated?String(result.cursor||"")||undefined:undefined;if(!cursor)break}return found.sort((a:any,b:any)=>backupRevisionHint(String(b.key))-backupRevisionHint(String(a.key))||new Date(b.uploaded||0).getTime()-new Date(a.uploaded||0).getTime())}
async function readR2StateFresh():Promise<State>{try{const state=await readR2State(PATH);remember(state);return state}catch(primaryError){try{const backups=await listR2Backups();let best:State|null=null;for(const object of backups.slice(0,BACKUP_RECOVERY_LIMIT)){try{const candidate=await readR2State(object.key);if(!best||candidate.revision>best.revision)best=candidate}catch{}}if(best){remember(best);console.warn("WDCC_STATE_R2_RECOVERED_FROM_BACKUP",JSON.stringify({revision:best.revision,primaryError:errorText(primaryError)}));return best}}catch(error){console.error("WDCC_STATE_R2_BACKUP_SCAN_FAILED",errorText(error))}console.error("WDCC_STATE_R2_UNAVAILABLE",JSON.stringify({path:PATH,error:errorText(primaryError)}));throw Error("STATE_R2_EMPTY_OR_UNREADABLE")}}
async function readStateFresh(){return selectedStateProvider()==="r2"?readR2StateFresh():readBlobStateFresh()}

export async function readState():Promise<State>{const now=Date.now();if(readCache&&readCache.expiresAt>now)return cloneState(readCache.state);if(selectedStateProvider()==="blob"&&providerBlockedUntil>now)throw Error("STATE_PROVIDER_BACKOFF");if(!readInFlight)readInFlight=readStateFresh().finally(()=>{readInFlight=null});return cloneState(await readInFlight)}

async function writeR2State(input:State){const bucket=cloudflareDataBucket();const current=await bucket.get(PATH);if(!current||!("body" in current))throw Error("STATE_R2_NOT_SEEDED");const currentRaw=await current.text();const currentState=validateState(normalizeState(JSON.parse(currentRaw)),PATH);if(Number(currentState.revision)!==Number(input.revision))throw Error("STATE_WRITE_CONFLICT");const state=normalizeState(input);state.revision=Number(state.revision||0)+1;state.updatedAt=new Date().toISOString();const body=JSON.stringify(state,null,2)+"\n";const backupPath=`private/state/backups/platform-v3-r${currentState.revision}-${crypto.randomUUID()}.json`;await bucket.put(backupPath,currentRaw,{httpMetadata:{contentType:"application/json"},customMetadata:{revision:String(currentState.revision),cause:"pre-write"}});const saved=await bucket.put(PATH,body,{onlyIf:{etagMatches:current.etag},httpMetadata:{contentType:"application/json"},customMetadata:{revision:String(state.revision)}});if(!saved)throw Error("STATE_WRITE_CONFLICT");remember(state);return cloneState(state)}
async function writeBlobState(input:State){const authority=blobAuthority();if(authority.mode==="missing")throw Error("STATE_AUTHORITY_MISSING");const state=normalizeState(input);state.revision=Number(state.revision||0)+1;state.updatedAt=new Date().toISOString();const body=JSON.stringify(state,null,2)+"\n";const backupPath=`private/state/backups/platform-v3-r${state.revision}-${crypto.randomUUID()}.json`;await put(backupPath,body,{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/json",...opt()});await put(PATH,body,{access:"private",addRandomSuffix:false,allowOverwrite:true,contentType:"application/json",...opt()});remember(state);return cloneState(state)}
export async function writeState(input:State){return selectedStateProvider()==="r2"?writeR2State(input):writeBlobState(input)}

export function isQaVehicleRecord(vehicle:any){const stock=String(vehicle?.stock||vehicle?.stock_id||"").trim().toUpperCase();const id=String(vehicle?.id||"").trim().toUpperCase();const description=String(vehicle?.description||"").toLowerCase();const badges=Array.isArray(vehicle?.badges)?vehicle.badges.map((value:any)=>String(value||"").toUpperCase()):[];return vehicle?.qa===true||/^R36TEST[-_]/.test(stock)||/^WDCC[-_]QA[-_]/.test(stock)||/^QA[-_]/.test(stock)||/^TEST[-_]/.test(stock)||/^WDCC[-_]QA[-_]/.test(id)||/^QA[-_]/.test(id)||badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"))||description.includes("automated temporary qa vehicle")||description.includes("automated dealer workflow certification")||description.includes("automated recovery certification vehicle")||description.includes("synthetic upload acceptance")||description.includes("dealer upload qa")}
export function isInternalVehicleRecord(vehicle:any){const visibility=String(vehicle?.visibility||vehicle?.listingVisibility||"").trim().toLowerCase();return vehicle?.internalOnly===true||visibility==="internal"||visibility==="dealer_only"}
export function publicVehicles(state:State){const nextYear=new Date().getUTCFullYear()+1;return state.vehicles.filter(vehicle=>String(vehicle.status||"").toLowerCase()==="published"&&Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&Boolean(String(vehicle.make||"").trim())&&Boolean(String(vehicle.model||"").trim())&&Number(vehicle.price||vehicle.cashPrice)>0&&!isQaVehicleRecord(vehicle)&&!isInternalVehicleRecord(vehicle))}
