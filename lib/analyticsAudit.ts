import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";

export type AnalyticsEvent={
  event:string;at?:string;tenantId?:string|null;dedupeKey?:string|null;sessionId?:string|null;anonymousUserId?:string|null;leadId?:string|null;vehicleId?:string|null;
  source?:string|null;medium?:string|null;campaign?:string|null;content?:string|null;term?:string|null;clickId?:string|null;
  referralCode?:string|null;pagePath?:string|null;landingPath?:string|null;referrer?:string|null;channel?:string|null;cta?:string|null;
  metadata?:Record<string,unknown>|null;
};

const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};
const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function recordAnalyticsEvent(input:AnalyticsEvent){
  const at=input.at&&Number.isFinite(Date.parse(input.at))?new Date(input.at).toISOString():new Date().toISOString();
  const automaticDedupe=String(input.event||"")==="lead.persisted"&&input.leadId?`lead.persisted:${clean(input.leadId,160)}`:"";
  const dedupeKey=input.dedupeKey?clean(input.dedupeKey,300):automaticDedupe;
  const id=dedupeKey?crypto.createHash("sha256").update(dedupeKey).digest("hex").slice(0,32):crypto.randomUUID();
  const record={id,at,tenantId:clean(input.tenantId||"wdcc",100)||"wdcc",event:clean(input.event,100)||"unknown",sessionId:input.sessionId?clean(input.sessionId,160):null,anonymousUserId:input.anonymousUserId?clean(input.anonymousUserId,160):null,leadId:input.leadId?clean(input.leadId,160):null,vehicleId:input.vehicleId?clean(input.vehicleId,160):null,source:input.source?clean(input.source,120):null,medium:input.medium?clean(input.medium,120):null,campaign:input.campaign?clean(input.campaign,160):null,content:input.content?clean(input.content,160):null,term:input.term?clean(input.term,160):null,clickId:input.clickId?clean(input.clickId,220):null,referralCode:input.referralCode?clean(input.referralCode,160):null,pagePath:input.pagePath?clean(input.pagePath,300):null,landingPath:input.landingPath?clean(input.landingPath,300):null,referrer:input.referrer?clean(input.referrer,700):null,channel:input.channel?clean(input.channel,80):null,cta:input.cta?clean(input.cta,100):null,metadata:input.metadata&&typeof input.metadata==="object"?input.metadata:null};
  const pathname=dedupeKey?`private/logs/analytics/dedupe/${id}.json`:`private/logs/analytics/${at.slice(0,10)}/${at.replace(/[:.]/g,"-")}-${id}.json`;
  let lastError:unknown;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await put(pathname,JSON.stringify(record)+"\n",{access:"private",addRandomSuffix:false,allowOverwrite:Boolean(dedupeKey),contentType:"application/json",...opt()});
      console.log("WDCC_ANALYTICS_EVENT",JSON.stringify({...record,attempt}));
      return record;
    }catch(error){lastError=error;if(attempt<3)await sleep(attempt*150);}
  }
  console.error("WDCC_ANALYTICS_EVENT_EXHAUSTED",JSON.stringify({id,event:record.event,dedupeKey,error:lastError instanceof Error?lastError.message:"unknown"}));
  throw lastError instanceof Error?lastError:new Error("analytics_persist_failed");
}

export async function readRecentAnalyticsEvents(max=200,tenantId?:string|null){
  const wanted=Math.max(1,Math.min(Number(max)||200,500));
  const blobs:any[]=[];
  let cursor:string|undefined;
  do{
    const result:any=await list({prefix:"private/logs/analytics/",limit:1000,...(cursor?{cursor}:{}),...opt()});
    blobs.push(...(result.blobs||[]));
    cursor=result.hasMore&&result.cursor?String(result.cursor):undefined;
  }while(cursor&&blobs.length<5000);
  blobs.sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));
  const items:any[]=[];
  for(const blob of blobs){
    if(items.length>=wanted)break;
    try{const response=await get(blob.pathname,{access:"private",useCache:false,...opt()});if(!response||response.statusCode!==200||!response.stream)continue;const chunks:Uint8Array[]=[];for await(const chunk of response.stream as any)chunks.push(chunk);const item=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(tenantId&&String(item?.tenantId||"wdcc")!==String(tenantId))continue;items.push(item);}catch{}
  }
  return items.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
}
