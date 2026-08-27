from pathlib import Path
import json

Path('lib/cloudflareR2.ts').write_text(r'''const cloudflareContextSymbol=Symbol.for("__cloudflare-context__");

type CloudflareContextShape={env?:Record<string,unknown>};

export function cloudflareEnv(){
  const context=(globalThis as any)[cloudflareContextSymbol] as CloudflareContextShape|undefined;
  if(!context?.env)throw Error("CLOUDFLARE_CONTEXT_MISSING");
  return context.env as Record<string,any>;
}

export function cloudflareDataBucket(){
  const bucket=cloudflareEnv().WDCC_DATA;
  if(!bucket)throw Error("R2_BINDING_MISSING:WDCC_DATA");
  return bucket as any;
}
''')

Path('lib/store.ts').write_text(r'''import crypto from "node:crypto";
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
''')

Path('app/api/upload/route.ts').write_text(r'''import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {currentUser} from "../../../lib/auth";
import {cloudflareDataBucket} from "../../../lib/cloudflareR2";
import {isDealerRuntime,requestId} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState} from "../../../lib/store";
import {recordVehicleAudit} from "../../../lib/vehicleAudit";

export const dynamic="force-dynamic";
const editorRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAX_BYTES=15*1024*1024;
function json(body:any,status:number,rid:string){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-WDCC-Request-ID":rid}})}

export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/upload");
  const rid=requestId(request);
  try{
    const user=await currentUser();if(!user||!editorRoles.has(String(user.role||"").toLowerCase()))return json({ok:false,error:"Unauthorized",requestId:rid},401,rid);
    const form=await request.formData();const file=form.get("file") as any;const vehicleId=String(form.get("vehicleId")||"").trim();const correlationId=String(form.get("requestId")||rid).slice(0,160)||rid;
    if(!vehicleId||!file||typeof file.stream!=="function")return json({ok:false,error:"invalid_upload",requestId:rid},400,rid);
    const contentType=String(file.type||"").toLowerCase(),size=Number(file.size||0);if(!allowedTypes.has(contentType)||size<=0||size>MAX_BYTES)return json({ok:false,error:"invalid_file",requestId:rid},400,rid);
    const state=await readState();const vehicle:any=state.vehicles.find(item=>item.id===vehicleId);if(!vehicle)return json({ok:false,error:"Vehicle not found",requestId:rid},404,rid);
    if(String(user.role).toLowerCase()!=="platform_admin"&&String(vehicle.tenantId||"wdcc")!==String(user.tenantId||"wdcc"))return json({ok:false,error:"Forbidden",requestId:rid},403,rid);
    if(String(vehicle.status||"").toLowerCase()==="archived")return json({ok:false,error:"Vehicle archived",requestId:rid},409,rid);
    const safe=String(file.name||"photo").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"photo";const pathname=`media/wdcc/${vehicleId}/${crypto.randomUUID()}-${safe}`;
    await recordVehicleAudit({action:"vehicle.photo_authorize",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,status:vehicle.status,photoCount:Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames.length:0,detail:pathname}).catch(()=>{});
    await cloudflareDataBucket().put(pathname,file.stream(),{httpMetadata:{contentType,cacheControl:"public,max-age=3600"},customMetadata:{vehicleId,userId:String(user.id||""),tenantId:String(user.tenantId||"wdcc"),requestId:correlationId}});
    await recordVehicleAudit({action:"vehicle.photo_uploaded",outcome:"ok",requestId:correlationId,vehicleId,actorId:user.id,actorRole:user.role,year:vehicle.year,make:vehicle.make,model:vehicle.model,mileage:vehicle.mileage,stock:vehicle.stock,detail:pathname}).catch(()=>{});
    return json({ok:true,pathname,size,contentType,requestId:correlationId},201,rid);
  }catch(error){const detail=error instanceof Error?error.message:"upload_failed";await recordVehicleAudit({action:"vehicle.photo_upload",outcome:"failed",requestId:rid,detail}).catch(()=>{});console.error("WDCC_R2_UPLOAD_FAILED",JSON.stringify({requestId:rid,error:detail}));return json({ok:false,error:detail,requestId:rid},500,rid)}
}
''')

Path('app/api/media/route.ts').write_text(r'''import {get} from "@vercel/blob";
import {cloudflareDataBucket} from "../../../lib/cloudflareR2";
import {blobAuthority} from "../../../lib/wdccAuthority";
export const dynamic="force-dynamic";
export async function GET(req:Request){const p=new URL(req.url).searchParams.get("p")||"";if(!p.startsWith("media/wdcc/"))return new Response("Not found",{status:404});const provider=String(process.env.WDCC_MEDIA_PROVIDER||process.env.WDCC_STATE_PROVIDER||"blob").trim().toLowerCase();if(provider==="r2"||provider==="cloudflare"){try{const object=await cloudflareDataBucket().get(p);if(!object||!("body" in object))return new Response("Not found",{status:404});return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType||"application/octet-stream","Cache-Control":object.httpMetadata?.cacheControl||"public,max-age=3600","ETag":object.httpEtag||object.etag||""}})}catch(error){console.error("WDCC_R2_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}})}}const authority=blobAuthority();if(authority.mode==="missing")return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}});try{const r=await get(p,{access:"private",useCache:true,...authority.options});if(!r||r.statusCode!==200||!r.stream)return new Response("Not found",{status:404});return new Response(r.stream as any,{headers:{"Content-Type":r.blob.contentType||"application/octet-stream","Cache-Control":"public,max-age=3600"}})}catch(error){console.error("WDCC_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");return new Response("Media unavailable",{status:503,headers:{"Cache-Control":"no-store"}})}}
''')

Path('app/api/health/route.ts').write_text(r'''import {NextResponse} from "next/server";
import {backendHealth} from "../../../lib/dealerProxy";
import {readState,selectedStateProvider} from "../../../lib/store";
import {blobAuthority,WDCC_PHOENIX_PROJECT_ID} from "../../../lib/wdccAuthority";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};
function canonicalRuntime(){const role=String(process.env.WDCC_RUNTIME_ROLE||"").trim().toLowerCase();return process.env.VERCEL_PROJECT_ID===WDCC_PHOENIX_PROJECT_ID||role==="backend"||role==="api"||role==="canonical"}
function provider(){if(String(process.env.WDCC_STATE_PROVIDER||"").toLowerCase()==="r2")return "cloudflare";if(process.env.RAILWAY_DEPLOYMENT_ID||process.env.RAILWAY_GIT_COMMIT_SHA)return "railway";if(process.env.VERCEL_PROJECT_ID)return "vercel";return "portable"}
function integrations(){const email=Boolean((process.env.RESEND_API_KEY||"").trim());const sms=Boolean((process.env.TWILIO_ACCOUNT_SID||"").trim()&&(process.env.TWILIO_AUTH_TOKEN||"").trim()&&(process.env.TWILIO_FROM_NUMBER||"").trim()&&(process.env.WDCC_LEAD_NOTIFICATION_PHONE||"").trim());const webhook=Boolean((process.env.WDCC_LEAD_WEBHOOK_URL||"").trim());return{email:{configured:email},sms:{configured:sms},webhook:{configured:webhook},dashboard:{configured:true}}}
export async function GET(){const commit=process.env.WDCC_RELEASE_SHA||process.env.VERCEL_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT_SHA||process.env.CF_PAGES_COMMIT_SHA||null;if(canonicalRuntime()){let stateProvider:"blob"|"r2";try{stateProvider=selectedStateProvider()}catch(error){return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",storage:"invalid",state:"unverified",error:error instanceof Error?error.message:"state_provider_invalid",provider:provider(),commit},{status:503,headers})}const blob=blobAuthority();const storage=stateProvider==="r2"?"r2":blob.mode;const session=Boolean((process.env.SESSION_SECRET||"").trim());const notificationIntegrations=integrations();if((stateProvider==="blob"&&blob.mode==="missing")||!session)return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-CLOUDFLARE-R2",backend:"local",storage,stateProvider,session:session?"configured":"missing",state:"unverified",integrations:notificationIntegrations,provider:provider(),commit},{status:503,headers});try{const state=await readState();return NextResponse.json({ok:true,degraded:false,service:"wdcc-canonical-backend",release:"WDCC-CLOUDFLARE-R2",backend:"local",storage,stateProvider,session:"configured",state:"readable",revision:state.revision,integrations:notificationIntegrations,provider:provider(),commit},{status:200,headers})}catch(error){return NextResponse.json({ok:false,degraded:true,service:"wdcc-canonical-backend",release:"WDCC-CLOUDFLARE-R2",backend:"local",storage,stateProvider,session:"configured",state:"unreadable",integrations:notificationIntegrations,error:error instanceof Error?error.message:"state_read_failed",provider:provider(),commit},{status:503,headers})}}try{const {response,json}=await backendHealth();const ok=response.ok&&json?.ok===true&&json?.state!=="unreadable";const notificationIntegrations=json?.integrations||integrations();return NextResponse.json({ok,degraded:!ok,service:"wdcc-hardened-dealer-facade",release:"WDCC-CLOUDFLARE-R2",backend:ok?"healthy":"degraded",backendState:json?.state||null,backendStorage:json?.storage||null,integrations:notificationIntegrations,integrationReadinessSource:json?.integrations?"canonical-backend":"facade-runtime",provider:provider(),commit},{status:ok?200:503,headers})}catch(error){return NextResponse.json({ok:false,degraded:true,service:"wdcc-hardened-dealer-facade",release:"WDCC-CLOUDFLARE-R2",backend:"unreachable",integrations:integrations(),integrationReadinessSource:"facade-runtime",error:error instanceof Error?error.message:"backend_health_failed",commit},{status:503,headers})}}
''')

editor=Path('app/dealer/inventory/VehicleEditor.tsx')
source=editor.read_text().replace('import {upload} from "@vercel/blob/client";\n','')
old='''        const blob=await upload(`media/wdcc/${id}/${crypto.randomUUID()}-${safe}`,file,{access:"private",handleUploadUrl:"/api/upload",clientPayload:JSON.stringify({vehicleId:id,requestId}),contentType:file.type});\n        if(!blob?.pathname)throw Error(`Photo ${i+1} upload failed`);paths.push(blob.pathname);'''
new='''        const uploadBody=new FormData();\n        uploadBody.append("file",file,safe);\n        uploadBody.append("vehicleId",id);\n        uploadBody.append("requestId",requestId);\n        const uploadResponse=await fetch("/api/upload",{method:"POST",credentials:"include",headers:{"X-WDCC-Request-ID":requestId},body:uploadBody});\n        const blob=await uploadResponse.json().catch(()=>({}));\n        if(!uploadResponse.ok||!blob?.pathname)throw Error(blob?.error||`Photo ${i+1} upload failed`);\n        paths.push(String(blob.pathname));'''
if old not in source: raise SystemExit('VehicleEditor upload block drifted')
editor.write_text(source.replace(old,new))

cfg=json.loads(Path('wrangler.jsonc').read_text())
cfg['vars']={'WDCC_RUNTIME_ROLE':'canonical','WDCC_STATE_PROVIDER':'r2','WDCC_MEDIA_PROVIDER':'r2'}
cfg['r2_buckets']=[{'binding':'WDCC_DATA','bucket_name':'wdcc-platform-prod'}]
cfg['workers_dev']=True
cfg.pop('route',None);cfg.pop('routes',None)
Path('wrangler.jsonc').write_text(json.dumps(cfg,indent=2)+'\n')
