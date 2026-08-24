import crypto from "node:crypto";
import {get,put} from "@vercel/blob";

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
const opt=()=>process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{};

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

export async function readState():Promise<State>{
  const response=await get(PATH,{access:"private",useCache:false,...opt()});
  if(!response||response.statusCode!==200||!response.stream)throw Error("STATE_READ_FAILED");
  const chunks:Uint8Array[]=[];
  for await(const chunk of response.stream as any)chunks.push(chunk);
  return normalizeState(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export async function writeState(input:State){
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

export function publicVehicles(state:State){
  const nextYear=new Date().getUTCFullYear()+1;
  return state.vehicles.filter(vehicle=>{
    const badges=Array.isArray(vehicle.badges)?vehicle.badges.map((value:any)=>String(value).toUpperCase()):[];
    const visibility=String(vehicle.visibility||"public").toLowerCase();
    return String(vehicle.status||"").toLowerCase()==="published"&&
      visibility!=="internal"&&vehicle.internalOnly!==true&&
      Number(vehicle.year)>1900&&Number(vehicle.year)<=nextYear&&
      Boolean(String(vehicle.make||"").trim())&&
      Boolean(String(vehicle.model||"").trim())&&
      Number(vehicle.price||vehicle.cashPrice)>0&&
      !String(vehicle.stock||"").toUpperCase().startsWith("R36TEST-")&&
      !badges.includes("R36-TEST");
  });
}
