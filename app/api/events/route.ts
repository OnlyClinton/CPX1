import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {readState,writeState} from "../../../lib/store";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
export const dynamic="force-dynamic";

export async function POST(req:Request){
  if(!isDealerRuntime(req))return proxyDealer(req,"/api/events");
  try{
    const body=await req.json().catch(()=>({}));
    const state=await readState();
    state.audit=Array.isArray(state.audit)?state.audit:[];
    state.audit.push({
      id:crypto.randomUUID(),
      at:new Date().toISOString(),
      action:String((body as any)?.event??(body as any)?.type??"client.event").slice(0,120),
      actor:null,
      meta:body
    });
    if(state.audit.length>5000)state.audit=state.audit.slice(-5000);
    await writeState(state);
    return NextResponse.json({ok:true});
  }catch(error){
    console.error("WDCC_EVENT_WRITE_ERROR",error);
    return NextResponse.json({ok:false,error:"event_write_failed"},{status:500});
  }
}
