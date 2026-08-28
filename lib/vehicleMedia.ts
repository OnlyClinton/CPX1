import crypto from "node:crypto";
import path from "node:path";
import {mkdir,readFile,stat,writeFile} from "node:fs/promises";
import {BlobNotFoundError,get,head,type GetBlobResult,type HeadBlobResult} from "@vercel/blob";

export const VEHICLE_MEDIA_PREFIX="media/wdcc";
export const VEHICLE_PHOTO_MAX_BYTES=15*1024*1024;
export const VEHICLE_PHOTO_CONTENT_TYPES=["image/jpeg","image/png","image/webp","image/avif"] as const;
const VEHICLE_MEDIA_PUBLISH_VERIFY_TIMEOUT_MS=5_000;

const contentTypes=new Set<string>(VEHICLE_PHOTO_CONTENT_TYPES);
const vehicleIdPattern=/^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,127})$/;
const filenamePattern=/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,179})\.(?:jpe?g|png|webp|avif)$/i;

export type VehicleMediaMetadata={
  pathname:string;
  contentType:string;
  size:number;
  etag?:string;
  url?:string;
  sha256?:string;
  provider:"vercel-blob"|"e2e-local-capture";
};

export type VehicleMediaAccessSubject={role?:unknown;tenantId?:unknown;dealerId?:unknown};

function mediaQaVehicle(vehicle:any){
  const stock=String(vehicle?.stock??vehicle?.stock_id??"").trim().toUpperCase();
  const labels=[...(Array.isArray(vehicle?.tags)?vehicle.tags:[]),...(Array.isArray(vehicle?.badges)?vehicle.badges:[])]
    .map(value=>String(value||"").trim().toUpperCase());
  return /^(R36TEST|WDCC[-_]?QA|QA|TEST)[-_]/.test(stock)||labels.some(value=>value==="QA"||value==="TEST"||value==="R36-TEST"||value.includes("CERTIFICATION"));
}

export function vehicleMediaIsPublic(vehicle:any){
  const status=String(vehicle?.status||"").trim().toLowerCase();
  const visibility=String(vehicle?.visibility||"").trim().toLowerCase();
  return !mediaQaVehicle(vehicle)&&["available","published"].includes(status)&&vehicle?.internalOnly!==true&&visibility==="public";
}

export function canStaffReadVehicleMedia(vehicle:any,subject:VehicleMediaAccessSubject|null|undefined){
  const role=String(subject?.role||"").trim().toLowerCase();
  if(role==="platform_admin")return true;
  if(role!=="dealer_agent")return false;
  const userTenant=String(subject?.tenantId??subject?.dealerId??"").trim();
  const vehicleTenant=String(vehicle?.tenantId??vehicle?.dealerId??"").trim();
  return Boolean(userTenant&&vehicleTenant&&userTenant===vehicleTenant);
}

function blobOptions(){
  const oidcToken=String(process.env.VERCEL_OIDC_TOKEN||"").trim();
  const storeId=String(process.env.BLOB_STORE_ID||"").trim();
  if(oidcToken&&storeId)return {oidcToken,storeId};
  const token=String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();
  return token?{token}:{};
}

export function vehicleBlobReadConfigured(){
  return Boolean(
    String(process.env.BLOB_READ_WRITE_TOKEN||"").trim()||
    (String(process.env.VERCEL_OIDC_TOKEN||"").trim()&&String(process.env.BLOB_STORE_ID||"").trim())
  );
}

export function vehicleBlobClientUploadToken(){return String(process.env.BLOB_READ_WRITE_TOKEN||"").trim();}

export function vehicleMediaCaptureRoot(){
  if(process.env.NODE_ENV==="production")return null;
  const configured=String(process.env.WDCC_E2E_MEDIA_DIR||"").trim();
  if(!configured)return null;
  if(!path.isAbsolute(configured))throw Error("WDCC_E2E_MEDIA_DIR_MUST_BE_ABSOLUTE");
  return path.resolve(configured);
}

export function parseVehicleMediaPathname(value:unknown){
  const pathname=String(value||"").trim();
  if(pathname.length>360||pathname.includes("\\")||pathname.includes("%")||pathname.includes("\0"))return null;
  const parts=pathname.split("/");
  if(parts.length!==4||parts[0]!=="media"||parts[1]!=="wdcc")return null;
  const vehicleId=parts[2],filename=parts[3];
  if(!vehicleIdPattern.test(vehicleId)||vehicleId==="."||vehicleId===".."||!filenamePattern.test(filename)||filename.includes(".."))return null;
  return {pathname,vehicleId,filename};
}

export function isVehicleMediaPathname(vehicleId:string,value:unknown){
  const parsed=parseVehicleMediaPathname(value);
  return Boolean(parsed&&parsed.vehicleId===vehicleId);
}

export function contentTypeForVehicleMediaPathname(pathname:string){
  const lower=pathname.toLowerCase();
  if(lower.endsWith(".jpg")||lower.endsWith(".jpeg"))return "image/jpeg";
  if(lower.endsWith(".png"))return "image/png";
  if(lower.endsWith(".webp"))return "image/webp";
  if(lower.endsWith(".avif"))return "image/avif";
  return "application/octet-stream";
}

export function resolveVehicleMediaCaptureFile(pathnameValue:unknown){
  const root=vehicleMediaCaptureRoot(),parsed=parseVehicleMediaPathname(pathnameValue);
  if(!root||!parsed)return null;
  const captureFile=path.resolve(root,...parsed.pathname.split("/"));
  if(captureFile!==root&&!captureFile.startsWith(`${root}${path.sep}`))return null;
  return {root,captureFile,...parsed};
}

export async function captureVehicleMedia(pathname:string,body:Uint8Array,contentType:string){
  const target=resolveVehicleMediaCaptureFile(pathname);
  if(!target)throw Error("E2E_MEDIA_CAPTURE_DISABLED");
  if(!contentTypes.has(contentType)||body.byteLength<=0||body.byteLength>VEHICLE_PHOTO_MAX_BYTES)throw Error("INVALID_VEHICLE_PHOTO");
  await mkdir(path.dirname(target.captureFile),{recursive:true});
  await writeFile(target.captureFile,body,{flag:"wx"});
  return {
    pathname:target.pathname,
    contentType,
    size:body.byteLength,
    sha256:crypto.createHash("sha256").update(body).digest("hex"),
    provider:"e2e-local-capture" as const
  };
}

export async function readCapturedVehicleMedia(pathname:string){
  const target=resolveVehicleMediaCaptureFile(pathname);
  if(!target)return null;
  try{
    const info=await stat(target.captureFile);
    if(!info.isFile()||info.size<=0||info.size>VEHICLE_PHOTO_MAX_BYTES)return null;
    const body=await readFile(target.captureFile);
    return {body:new Uint8Array(body),metadata:{pathname:target.pathname,contentType:contentTypeForVehicleMediaPathname(target.pathname),size:info.size,provider:"e2e-local-capture" as const}};
  }catch{return null;}
}

function validReadableBlob(pathname:string,result:GetBlobResult,access:"private"|"public"){
  if(result.statusCode!==200)return null;
  const contentType=String(result.blob.contentType||"").split(";",1)[0].trim().toLowerCase();
  if(result.blob.pathname!==pathname||!contentTypes.has(contentType)||result.blob.size<=0||result.blob.size>VEHICLE_PHOTO_MAX_BYTES)return null;
  return {
    stream:result.stream,
    metadata:{pathname,contentType,size:result.blob.size,etag:result.blob.etag,url:result.blob.url,provider:"vercel-blob" as const},
    access
  };
}

export async function readVehicleMediaPathname(pathname:string,{allowPublicFallback=false}:{allowPublicFallback?:boolean}={}){
  const parsed=parseVehicleMediaPathname(pathname);
  if(!parsed)return null;
  const captured=await readCapturedVehicleMedia(parsed.pathname);
  if(captured)return {stream:captured.body,metadata:captured.metadata,access:"private" as const};
  if(!vehicleBlobReadConfigured())throw Error("WDCC_VEHICLE_MEDIA_AUTHORITY_UNAVAILABLE");

  let privateError:unknown=null,privateMissing=false;
  try{
    const result=await get(parsed.pathname,{...blobOptions(),access:"private",useCache:true});
    if(result){
      const valid=validReadableBlob(parsed.pathname,result,"private");
      if(valid)return valid;
      throw Error("WDCC_VEHICLE_MEDIA_METADATA_INVALID");
    }else privateMissing=true;
  }catch(error){privateError=error;}

  if(privateMissing)return null;

  // Public fallback is deliberately limited to media on an actively public
  // listing. It keeps previously-published Blob objects readable while every
  // new dealer upload is stored privately.
  if(allowPublicFallback){
    try{
      const result=await get(parsed.pathname,{...blobOptions(),access:"public",useCache:true});
      if(result){
        const valid=validReadableBlob(parsed.pathname,result,"public");
        if(valid)return valid;
        throw Error("WDCC_VEHICLE_MEDIA_METADATA_INVALID");
      }
      return null;
    }catch(error){
      if(privateError)throw privateError;
      throw error;
    }
  }
  if(privateError)throw privateError;
  return null;
}

function validBlobMetadata(pathname:string,blob:HeadBlobResult):VehicleMediaMetadata|null{
  const contentType=String(blob.contentType||"").split(";",1)[0].trim().toLowerCase();
  if(blob.pathname!==pathname||!contentTypes.has(contentType)||blob.size<=0||blob.size>VEHICLE_PHOTO_MAX_BYTES||!/^https:\/\//i.test(blob.url))return null;
  return {pathname,contentType,size:blob.size,etag:blob.etag,url:blob.url,provider:"vercel-blob"};
}

export async function headVehicleMediaPathname(pathname:string):Promise<VehicleMediaMetadata|null>{
  const parsed=parseVehicleMediaPathname(pathname);
  if(!parsed)return null;
  const captured=await readCapturedVehicleMedia(parsed.pathname);
  if(captured)return captured.metadata;
  if(!vehicleBlobReadConfigured())return null;
  try{return validBlobMetadata(parsed.pathname,await head(parsed.pathname,blobOptions()));}catch{return null;}
}

async function headVehicleMediaPathnameForPublish(pathname:string):Promise<VehicleMediaMetadata|null>{
  const parsed=parseVehicleMediaPathname(pathname);
  if(!parsed)return null;
  const captured=await readCapturedVehicleMedia(parsed.pathname);
  if(captured)return captured.metadata;
  if(vehicleMediaCaptureRoot())return null;
  if(!vehicleBlobReadConfigured())throw Error("WDCC_VEHICLE_MEDIA_AUTHORITY_UNAVAILABLE");
  try{
    const metadata=validBlobMetadata(parsed.pathname,await head(parsed.pathname,{...blobOptions(),abortSignal:AbortSignal.timeout(VEHICLE_MEDIA_PUBLISH_VERIFY_TIMEOUT_MS)}));
    if(!metadata)throw Error("WDCC_VEHICLE_MEDIA_METADATA_INVALID");
    return metadata;
  }
  catch(error){if(error instanceof BlobNotFoundError)return null;throw error;}
}

export async function verifyVehicleMediaPathname(vehicleId:string,pathname:string){
  if(!isVehicleMediaPathname(vehicleId,pathname))return null;
  return headVehicleMediaPathname(pathname);
}

export async function verifyVehicleMediaPathnames(vehicleId:string,pathnames:string[]){
  const requested=[...new Set(pathnames.map(value=>String(value||"").trim()).filter(Boolean))];
  const results=await Promise.all(requested.map(async pathname=>({pathname,metadata:await verifyVehicleMediaPathname(vehicleId,pathname)})));
  return {
    ok:results.length>0&&results.every(result=>Boolean(result.metadata)),
    missing:results.filter(result=>!result.metadata).map(result=>result.pathname),
    verified:results.filter(result=>Boolean(result.metadata)).map(result=>result.pathname),
    metadata:results.flatMap(result=>result.metadata?[result.metadata]:[])
  };
}

export async function verifyVehicleMediaPathnamesForPublish(vehicleId:string,pathnames:string[]){
  const requested=[...new Set(pathnames.map(value=>String(value||"").trim()).filter(Boolean))];
  const results=await Promise.all(requested.map(async pathname=>({
    pathname,
    metadata:isVehicleMediaPathname(vehicleId,pathname)?await headVehicleMediaPathnameForPublish(pathname):null
  })));
  return {
    ok:results.length>0&&results.every(result=>Boolean(result.metadata)),
    missing:results.filter(result=>!result.metadata).map(result=>result.pathname),
    verified:results.filter(result=>Boolean(result.metadata)).map(result=>result.pathname),
    metadata:results.flatMap(result=>result.metadata?[result.metadata]:[])
  };
}
