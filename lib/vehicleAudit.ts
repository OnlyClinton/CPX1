import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {recordAnalyticsEvent} from "./analyticsAudit";

export type VehicleAuditEvent={
  action:string;outcome:"ok"|"failed"|"denied";requestId:string;tenantId?:string|null;listingId?:string|null;listingVersion?:string|number|null;vehicleId?:string|null;actorId?:string|null;actorRole?:string|null;year?:number|null;make?:string|null;model?:string|null;mileage?:number|null;stock?:string|null;status?:string|null;photoCount?:number|null;detail?:string|null;
};
const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};const clean=(value:unknown,max=240)=>String(value??"").trim().slice(0,max);
export async function recordVehicleAudit(input:VehicleAuditEvent){
  const at=new Date().toISOString();const id=crypto.randomUUID();
  const record={id,at,action:clean(input.action,100),outcome:input.outcome,requestId:clean(input.requestId,160),tenantId:clean(input.tenantId||"wdcc",100)||"wdcc",listingId:input.listingId?clean(input.listingId,160):null,listingVersion:input.listingVersion==null?null:clean(input.listingVersion,80),vehicleId:input.vehicleId?clean(input.vehicleId,160):null,actorId:input.actorId?clean(input.actorId,160):null,actorRole:input.actorRole?clean(input.actorRole,80):null,year:Number.isFinite(Number(input.year))?Number(input.year):null,make:input.make?clean(input.make,80):null,model:input.model?clean(input.model,80):null,mileage:Number.isFinite(Number(input.mileage))?Number(input.mileage):null,stock:input.stock?clean(input.stock,80):null,status:input.status?clean(input.status,40):null,photoCount:Number.isFinite(Number(input.photoCount))?Number(input.photoCount):null,detail:input.detail?clean(input.detail,500):null};
  const pathname=`private/logs/vehicle/${at.slice(0,10)}/${at.replace(/[:.]/g,"-")}-${id}.json`;
  try{await put(pathname,JSON.stringify(record,null,2)+"\n",{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/json",...opt()})}catch(error){console.error("WDCC_VEHICLE_AUDIT_WRITE_FAILED",JSON.stringify({requestId:record.requestId,action:record.action,error:error instanceof Error?error.message:"unknown"}))}
  try{await recordAnalyticsEvent({tenantId:record.tenantId,dedupeKey:`vehicle:${record.requestId}:${record.action}:${record.outcome}`,event:record.action,at,vehicleId:record.vehicleId,source:"dealer-portal",medium:"dealer-ui",channel:"inventory",metadata:{outcome:record.outcome,requestId:record.requestId,listingId:record.listingId,listingVersion:record.listingVersion,actorId:record.actorId,actorRole:record.actorRole,year:record.year,make:record.make,model:record.model,mileage:record.mileage,stock:record.stock,status:record.status,photoCount:record.photoCount,detail:record.detail}})}catch(error){console.error("WDCC_VEHICLE_ANALYTICS_WRITE_FAILED",JSON.stringify({requestId:record.requestId,action:record.action,error:error instanceof Error?error.message:"unknown"}))}
  console.log("WDCC_VEHICLE_EVENT",JSON.stringify(record));return record;
}
export async function readRecentVehicleAudit(max=100){
  const wanted=Math.max(1,Math.min(Number(max)||100,200));const blobs:any[]=[];let cursor:string|undefined;
  do{const result:any=await list({prefix:"private/logs/vehicle/",limit:1000,...(cursor?{cursor}:{}),...opt()});blobs.push(...(result.blobs||[]));cursor=result.hasMore&&result.cursor?String(result.cursor):undefined}while(cursor&&blobs.length<5000);
  blobs.sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));const items:any[]=[];
  for(const blob of blobs){if(items.length>=wanted)break;try{const response=await get(blob.pathname,{access:"private",useCache:false,...opt()});if(!response||response.statusCode!==200||!response.stream)continue;const chunks:Uint8Array[]=[];for await(const chunk of response.stream as any)chunks.push(chunk);items.push(JSON.parse(Buffer.concat(chunks).toString("utf8")))}catch{}}
  return items.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
}
