import crypto from "node:crypto";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {readState,writeState} from "../../../lib/store";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/events");
  try{const b=await request.json();const now=new Date().toISOString();const state=await readState();state.audit.push({id:crypto.randomUUID(),at:now,action:String(b?.event||"event").slice(0,100),actor:"public",source:String(b?.source||"").slice(0,100),channel:String(b?.channel||"").slice(0,40),path:String(b?.path||"").slice(0,240)});await writeState(state);return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({ok:false,error:"event_failed"},{status:500})}
}
