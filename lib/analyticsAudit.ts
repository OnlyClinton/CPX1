import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";

export type AnalyticsEvent={
  event:string;at?:string;sessionId?:string|null;anonymousUserId?:string|null;leadId?:string|null;vehicleId?:string|null;
  source?:string|null;medium?:string|null;campaign?:string|null;content?:string|null;term?:string|null;clickId?:string|null;
  referralCode?:string|null;pagePath?:string|null;landingPath?:string|null;referrer?:string|null;channel?:string|null;cta?:string|null;
  metadata?:Record<string,unknown>|null;
};

const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};
const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);

export async function recordAnalyticsEvent(input:AnalyticsEvent){
  const at=input.at&&Number.isFinite(Date.parse(input.at))?new Date(input.at).toISOString():new Date().toISOString();
  const id=crypto.randomUUID();
  const record={id,at,event:clean(input.event,100)||"unknown",sessionId:input.sessionId?clean(input.sessionId,160):null,anonymousUserId:input.anonymousUserId?clean(input.anonymousUserId,160):null,leadId:input.leadId?clean(input.leadId,160):null,vehicleId:input.vehicleId?clean(input.vehicleId,160):null,source:input.source?clean(input.source,120):null,medium:input.medium?clean(input.medium,120):null,campaign:input.campaign?clean(input.campaign,160):null,content:input.content?clean(input.content,160):null,term:input.term?clean(input.term,160):null,clickId:input.clickId?clean(input.clickId,220):null,referralCode:input.referralCode?clean(input.referralCode,160):null,pagePath:input.pagePath?clean(input.pagePath,300):null,landingPath:input.landingPath?clean(input.landingPath,300):null,referrer:input.referrer?clean(input.referrer,700):null,channel:input.channel?clean(input.channel,80):null,cta:input.cta?clean(input.cta,100):null,metadata:input.metadata&&typeof input.metadata==="object"?input.metadata:null};
  const pathname=`private/logs/analytics/${at.slice(0,10)}/${at.replace(/[:.]/g,"-")}-${id}.json`;
  await put(pathname,JSON.stringify(record)+"\n",{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:"application/json",...opt()});
  console.log("WDCC_ANALYTICS_EVENT",JSON.stringify(record));
  return record;
}

export async function readRecentAnalyticsEvents(max=200){
  const wanted=Math.max(1,Math.min(Number(max)||200,500));
  const result=await list({prefix:"private/logs/analytics/",limit:1000,...opt()});
  const blobs=[...result.blobs].sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||""))).slice(0,wanted);
  const items:any[]=[];
  for(const blob of blobs){try{const response=await get(blob.pathname,{access:"private",useCache:false,...opt()});if(!response||response.statusCode!==200||!response.stream)continue;const chunks:Uint8Array[]=[];for await(const chunk of response.stream as any)chunks.push(chunk);items.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));}catch{}}
  return items.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
}
