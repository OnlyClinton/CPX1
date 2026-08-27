type R2ObjectBodyLike={
  body:ReadableStream<Uint8Array>;
  httpMetadata?:{contentType?:string};
  uploaded?:Date;
  etag?:string;
  text?:()=>Promise<string>;
  arrayBuffer?:()=>Promise<ArrayBuffer>;
};

type R2BucketLike={
  get:(key:string)=>Promise<R2ObjectBodyLike|null>;
  put:(key:string,value:string|ArrayBuffer|Uint8Array|ReadableStream,options?:any)=>Promise<any>;
  list:(options?:{prefix?:string;limit?:number;cursor?:string})=>Promise<{objects:Array<{key:string;uploaded?:Date;etag?:string}>;truncated?:boolean;cursor?:string}>;
};

type OpenNextCloudflareContext={env?:Record<string,unknown>};

const contextSymbol=Symbol.for("__cloudflare-context__");

function cloudflareContext():OpenNextCloudflareContext|null{
  try{return ((globalThis as any)[contextSymbol]||null) as OpenNextCloudflareContext|null}catch{return null}
}

export function cloudflareDataBucket():R2BucketLike|null{
  const env=cloudflareContext()?.env as any;
  const bucket=env?.WDCC_DATA;
  return bucket&&typeof bucket.get==="function"&&typeof bucket.put==="function"&&typeof bucket.list==="function"?bucket as R2BucketLike:null;
}

export function cloudflareDataAvailable(){return Boolean(cloudflareDataBucket())}

export async function r2Text(key:string){
  const bucket=cloudflareDataBucket();
  if(!bucket)return null;
  const object=await bucket.get(key);
  if(!object)return null;
  if(typeof object.text==="function")return object.text();
  if(typeof object.arrayBuffer==="function")return Buffer.from(await object.arrayBuffer()).toString("utf8");
  const chunks:Uint8Array[]=[];
  for await(const chunk of object.body as any)chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function r2PutText(key:string,text:string,contentType="application/json"){
  const bucket=cloudflareDataBucket();
  if(!bucket)throw Error("R2_BINDING_MISSING");
  return bucket.put(key,text,{httpMetadata:{contentType}});
}

export async function r2List(prefix:string,limit=1000){
  const bucket=cloudflareDataBucket();
  if(!bucket)throw Error("R2_BINDING_MISSING");
  const out:Array<{key:string;uploaded?:Date;etag?:string}>=[];
  let cursor:string|undefined;
  do{
    const page=await bucket.list({prefix,limit:Math.min(1000,Math.max(1,limit-out.length)),cursor});
    out.push(...(page.objects||[]));
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor&&out.length<limit);
  return out.slice(0,limit);
}

export async function r2GetObject(key:string){
  const bucket=cloudflareDataBucket();
  if(!bucket)return null;
  return bucket.get(key);
}

export async function r2PutObject(key:string,value:ArrayBuffer|Uint8Array|ReadableStream,contentType:string){
  const bucket=cloudflareDataBucket();
  if(!bucket)throw Error("R2_BINDING_MISSING");
  return bucket.put(key,value,{httpMetadata:{contentType}});
}
