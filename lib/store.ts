import crypto from "node:crypto";
import {get,list,put} from "@vercel/blob";
import {blobAuthority} from "./wdccAuthority";

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
  /** Invalidate every existing session after an access, role, or password change. */
  sessionVersion?:number;
  /** A provisioned or administrator-reset account must choose a permanent password. */
  mustChangePassword?:boolean;
  passwordChangedAt?:string;
  updatedAt?:string;
  /** Opaque, short-lived recovery material. The raw reset link token is never stored. */
  passwordReset?:{
    tokenHash:string;
    requestedAt:string;
    expiresAt:string;
  };
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
const opt=()=>blobAuthority().options as any;

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

async function readBlobState(pathname:string):Promise<State>{
  const response=await get(pathname,{access:"private",useCache:false,...opt()});
  if(!response||response.statusCode!==200||!response.stream)throw Error(`STATE_BLOB_READ_FAILED:${pathname}`);
  const chunks:Uint8Array[]=[];
  for await(const chunk of response.stream as any)chunks.push(chunk);
  const raw=Buffer.concat(chunks).toString("utf8");
  const parsed=JSON.parse(raw);
  const state=normalizeState(parsed);
  if(!Number.isFinite(state.revision))throw Error(`STATE_BLOB_INVALID:${pathname}`);
  return state;
}

export async function readState():Promise<State>{
  const authority=blobAuthority();
  if(authority.mode==="missing"){
    console.error("WDCC_STATE_AUTHORITY_MISSING",JSON.stringify({hasBlobToken:false,hasOidc:Boolean(process.env.VERCEL_OIDC_TOKEN),hasStoreId:Boolean(process.env.BLOB_STORE_ID)}));
    throw Error("STATE_AUTHORITY_MISSING");
  }
  try{
    return await readBlobState(PATH);
  }catch(primaryError){
    try{
      const result=await list({prefix:BACKUP_PREFIX,limit:1000,...opt()});
      const backups=[...result.blobs].sort((a:any,b:any)=>String(b.uploadedAt||"").localeCompare(String(a.uploadedAt||"")));
      for(const blob of backups.slice(0,20)){
        try{
          const recovered=await readBlobState(blob.pathname);
          console.warn("WDCC_STATE_RECOVERED_FROM_BACKUP",JSON.stringify({pathname:blob.pathname,revision:recovered.revision,authority:authority.mode,primaryError:primaryError instanceof Error?primaryError.message:"unknown"}));
          return recovered;
        }catch{}
      }
    }catch(backupError){
      console.error("WDCC_STATE_BACKUP_SCAN_FAILED",JSON.stringify({authority:authority.mode,error:backupError instanceof Error?backupError.message:"unknown"}));
    }
    console.error("WDCC_STATE_READ_FAILED",JSON.stringify({path:PATH,authority:authority.mode,error:primaryError instanceof Error?primaryError.message:"unknown"}));
    throw Error("STATE_READ_FAILED");
  }
}

export async function writeState(input:State){
  const authority=blobAuthority();
  if(authority.mode==="missing")throw Error("STATE_AUTHORITY_MISSING");
  const state=normalizeState(input);
  state.revision=Number(state.revision||0)+1;
  state.updatedAt=new Date().toISOString();
  const body=JSON.stringify(state,null,2)+"\n";
  const backupPath=`private/state/backups/platform-v3-r${state.revision}-${crypto.randomUUID()}.json`;

  await put(backupPath,body,{
    access:"private",
    addRandomSuffix:false,
    allowOverwrite:false,
    contentType:"application/json",
    ...opt()
  });
  await put(PATH,body,{
    access:"private",
    addRandomSuffix:false,
    allowOverwrite:true,
    contentType:"application/json",
    ...opt()
  });
  return state;
}

export function isQaVehicleRecord(vehicle:any){
  const stock=String(vehicle?.stock||vehicle?.stock_id||"").trim().toUpperCase();
  const id=String(vehicle?.id||"").trim().toUpperCase();
  const description=String(vehicle?.description||"").toLowerCase();
  const badges=Array.isArray(vehicle?.badges)?vehicle.badges.map((value:any)=>String(value||"").toUpperCase()):[];
  return vehicle?.qa===true||
    /^R36TEST[-_]/.test(stock)||
    /^WDCC[-_]QA[-_]/.test(stock)||
    /^QA[-_]/.test(stock)||
    /^TEST[-_]/.test(stock)||
    /^WDCC[-_]QA[-_]/.test(id)||
    /^QA[-_]/.test(id)||
    badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"))||
    description.includes("automated temporary qa vehicle")||
    description.includes("automated dealer workflow certification")||
    description.includes("automated recovery certification vehicle")||
    description.includes("synthetic upload acceptance")||
    description.includes("dealer upload qa");
}

export function isInternalVehicleRecord(vehicle:any){
  const visibility=String(vehicle?.visibility||vehicle?.listingVisibility||"").trim().toLowerCase();
  return vehicle?.internalOnly===true||visibility==="internal"||visibility==="dealer_only";
}

export function publicVehicles(state:State){
  const nextYear=new Date().getUTCFullYear()+1;
  return state.vehicles.filter(vehicle=>
    String(vehicle.status||"").toLowerCase()==="published"&&
    Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&
    Boolean(String(vehicle.make||"").trim())&&
    Boolean(String(vehicle.model||"").trim())&&
    Number(vehicle.price||vehicle.cashPrice)>0&&
    !isQaVehicleRecord(vehicle)&&
    !isInternalVehicleRecord(vehicle)
  );
}
