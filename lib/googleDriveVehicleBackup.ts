import {createHash,createSign} from "node:crypto";

export const WDCC_DRIVE_BACKUP_FOLDER_ID="1VxvgpT9-7rEZBsHyYx7Q2dwK5e3ylqHN";

type BackupInput={
  bytes:ArrayBuffer|Uint8Array;
  contentType:string;
  filename:string;
  vehicleId:string;
  requestId:string;
  sourcePathname:string;
  sha256?:string;
};

export type DriveBackupResult={
  status:"uploaded"|"skipped";
  required:boolean;
  fileId?:string;
  name?:string;
  folderId:string;
  sha256:string;
  reason?:string;
};

const truthy=(value:string|undefined)=>["1","true","yes","required"].includes(String(value||"").trim().toLowerCase());
const b64url=(value:Buffer|string)=>Buffer.from(value).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");

function credentials(){
  const raw=String(process.env.WDCC_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON||"").trim();
  if(raw){
    const parsed=JSON.parse(raw);
    return {clientEmail:String(parsed.client_email||""),privateKey:String(parsed.private_key||"")};
  }
  return {
    clientEmail:String(process.env.WDCC_GOOGLE_DRIVE_CLIENT_EMAIL||"").trim(),
    privateKey:String(process.env.WDCC_GOOGLE_DRIVE_PRIVATE_KEY||"").replace(/\\n/g,"\n").trim()
  };
}

async function accessToken(){
  const {clientEmail,privateKey}=credentials();
  if(!clientEmail||!privateKey)throw Error("drive_backup_credentials_missing");
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=b64url(JSON.stringify({
    iss:clientEmail,
    scope:"https://www.googleapis.com/auth/drive.file",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,
    exp:now+3600
  }));
  const unsigned=`${header}.${claims}`;
  const signer=createSign("RSA-SHA256");
  signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${b64url(signer.sign(privateKey))}`;
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
    cache:"no-store"
  });
  const body:any=await response.json().catch(()=>({}));
  if(!response.ok||!body?.access_token)throw Error(`drive_backup_token_failed:${response.status}:${body?.error||"unknown"}`);
  return String(body.access_token);
}

function safeName(value:string){return String(value||"vehicle-photo").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-140)||"vehicle-photo";}

export async function backupVehiclePhotoToDrive(input:BackupInput):Promise<DriveBackupResult>{
  const required=truthy(process.env.WDCC_DRIVE_BACKUP_REQUIRED);
  const folderId=String(process.env.WDCC_DRIVE_BACKUP_FOLDER_ID||WDCC_DRIVE_BACKUP_FOLDER_ID).trim();
  const bytes=input.bytes instanceof Uint8Array?input.bytes:new Uint8Array(input.bytes);
  const sha256=String(input.sha256||createHash("sha256").update(bytes).digest("hex")).toLowerCase();
  const {clientEmail,privateKey}=credentials();
  if(!clientEmail||!privateKey){
    if(required)throw Error("drive_backup_credentials_missing");
    return {status:"skipped",required,folderId,sha256,reason:"credentials_missing"};
  }
  if(!folderId){
    if(required)throw Error("drive_backup_folder_missing");
    return {status:"skipped",required,folderId,sha256,reason:"folder_missing"};
  }

  const token=await accessToken();
  const boundary=`wdcc-${crypto.randomUUID()}`;
  const filename=`${safeName(input.vehicleId)}-${safeName(input.filename)}`;
  const metadata={
    name:filename,
    parents:[folderId],
    appProperties:{
      wdccVehicleId:String(input.vehicleId).slice(0,124),
      wdccRequestId:String(input.requestId).slice(0,124),
      wdccSha256:sha256,
      wdccSourcePath:String(input.sourcePathname).slice(0,124)
    }
  };
  const prefix=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${input.contentType||"application/octet-stream"}\r\n\r\n`;
  const suffix=`\r\n--${boundary}--`;
  const body=new Blob([prefix,bytes,suffix]);
  const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,parents,size,md5Checksum,appProperties",{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":`multipart/related; boundary=${boundary}`},
    body,
    cache:"no-store"
  });
  const result:any=await response.json().catch(()=>({}));
  if(!response.ok||!result?.id)throw Error(`drive_backup_upload_failed:${response.status}:${result?.error?.message||result?.error||"unknown"}`);
  if(!Array.isArray(result.parents)||!result.parents.includes(folderId))throw Error("drive_backup_parent_mismatch");
  if(String(result?.appProperties?.wdccSha256||"").toLowerCase()!==sha256)throw Error("drive_backup_hash_metadata_mismatch");
  return {status:"uploaded",required,folderId,fileId:String(result.id),name:String(result.name||filename),sha256};
}
