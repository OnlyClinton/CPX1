"use client";

import {upload} from "@vercel/blob/client";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const MAX_BYTES=15*1024*1024;
let capabilityRequest:Promise<"vercel-blob-client"|"e2e-local-capture">|null=null;

function extension(contentType:string){return contentType==="image/jpeg"?"jpg":contentType.split("/")[1]||"jpg";}
function safeStem(value:string){
  const stem=String(value||"photo").replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100);
  return stem||"photo";
}
function pathname(vehicleId:string,file:File){
  if(!/^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,127})$/.test(vehicleId))throw Error("Invalid vehicle ID");
  return `media/wdcc/${vehicleId}/${crypto.randomUUID()}-${safeStem(file.name)}.${extension(file.type)}`;
}
async function sha256(file:File){
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function uploadMode(){
  if(!capabilityRequest)capabilityRequest=(async()=>{
    const response=await fetch("/api/upload?capabilities=1",{credentials:"include",cache:"no-store"});
    const result:any=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result?.error||`Photo upload unavailable (${response.status})`);
    if(result?.access!=="private")throw Error("Private vehicle media storage is unavailable");
    return result?.mode==="e2e-local-capture"?"e2e-local-capture":"vercel-blob-client";
  })().catch(error=>{capabilityRequest=null;throw error;});
  return capabilityRequest;
}

export async function uploadVehiclePhoto({vehicleId,requestId,file}:{vehicleId:string;requestId:string;file:File}){
  if(!allowedTypes.has(file.type)||file.size<=0||file.size>MAX_BYTES)throw Error("Use a JPG, PNG, WEBP or AVIF photo under 15 MB");
  const target=pathname(vehicleId,file),hash=await sha256(file),mode=await uploadMode();
  if(mode==="e2e-local-capture"){
    const form=new FormData();
    form.set("vehicleId",vehicleId);form.set("requestId",requestId);form.set("pathname",target);form.set("file",file,file.name);
    const response=await fetch("/api/upload?capture=1",{method:"POST",credentials:"include",body:form,headers:{"X-WDCC-Request-ID":requestId}});
    const result:any=await response.json().catch(()=>({}));
    if(!response.ok||result?.ok!==true||!result?.pathname)throw Error(result?.error||`Photo upload failed (${response.status})`);
    return {pathname:String(result.pathname),provider:String(result.provider||mode),sha256:String(result.sha256||hash),contentType:String(result.contentType||file.type),size:Number(result.size||file.size),url:String(result.url||"")};
  }
  const blob=await upload(target,file,{
    access:"private",
    contentType:file.type,
    multipart:false,
    handleUploadUrl:"/api/upload",
    clientPayload:JSON.stringify({vehicleId,requestId,contentType:file.type,size:file.size,sha256:hash}),
    headers:{"X-WDCC-Request-ID":requestId}
  });
  return {pathname:blob.pathname,provider:"vercel-blob",sha256:hash,contentType:blob.contentType||file.type,size:file.size,url:blob.url,downloadUrl:blob.downloadUrl};
}

type VehiclePhotoUpload=Awaited<ReturnType<typeof uploadVehiclePhoto>>;

export async function uploadVehiclePhotos({
  vehicleId,requestId,files,onStart,maxConcurrency=3,uploader=uploadVehiclePhoto
}:{
  vehicleId:string;
  requestId:string;
  files:readonly File[];
  onStart?:(index:number,total:number)=>void;
  maxConcurrency?:number;
  uploader?:(input:{vehicleId:string;requestId:string;file:File})=>Promise<VehiclePhotoUpload>;
}){
  if(!files.length)return [];
  const results=new Array<VehiclePhotoUpload>(files.length);
  const workerCount=Math.min(3,Math.max(1,Math.trunc(maxConcurrency)||1),files.length);
  let cursor=0,failed=false,firstFailure:unknown;
  const workers=Array.from({length:workerCount},async()=>{
    while(!failed){
      const index=cursor++;
      if(index>=files.length)return;
      onStart?.(index,files.length);
      try{
        const uploaded=await uploader({vehicleId,requestId,file:files[index]});
        if(!uploaded?.pathname)throw Error(`Photo ${index+1} upload failed`);
        results[index]=uploaded;
      }catch(error){
        if(!failed){failed=true;firstFailure=error;}
        return;
      }
    }
  });
  await Promise.all(workers);
  if(failed)throw firstFailure;
  return results;
}
