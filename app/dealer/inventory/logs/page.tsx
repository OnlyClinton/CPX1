"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const when=(v:any)=>v?new Date(v).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit"}):"Unknown time";
const human=(v:any)=>String(v||"").replace(/[._-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase());

export default function VehicleLogs(){
  const[data,setData]=useState<any>();
  const[message,setMessage]=useState("Loading vehicle logs…");
  const[filter,setFilter]=useState("all");
  async function load(){
    const r=await fetch("/api/dealer/vehicle-logs",{cache:"no-store"});
    if(r.status===401){location.href="/dealer";return}
    const j=await r.json();if(!r.ok)throw Error(j.error||"Vehicle logs failed");setData(j);setMessage("");
  }
  useEffect(()=>{load().catch(e=>setMessage(e.message||"Vehicle logs failed"))},[]);
  const durable=data?.durable||[];
  const shown=useMemo(()=>durable.filter((e:any)=>filter==="all"?true:e.outcome===filter),[durable,filter]);
  return <main className="crmShell"><aside className="crmSidebar"><Link className="crmLogo" href="/dealer"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><span>SALES COMMAND</span></Link><nav><Link href="/dealer">Today</Link><Link href="/dealer/leads">Leads</Link><Link href="/dealer/inventory">Inventory</Link><Link href="/dealer/inventory/new">+ Add Vehicle</Link><Link className="active" href="/dealer/inventory/logs">Vehicle Logs</Link><Link href="/">View Website</Link></nav></aside><section className="crmMain">
    <div className="leadInboxHeader"><div><span className="crmKicker">IMMUTABLE VEHICLE AUDIT</span><h1>Vehicle Logs</h1><p className="muted">Drafts, photo authorization, completed uploads, checkpoints, publish actions and storefront verification. No passwords, cookies or customer PII are stored here.</p></div><div style={{display:"flex",gap:8}}><button className="addVehicleQuick" style={{margin:0,padding:"0 14px"}} onClick={()=>load().catch(e=>setMessage(e.message))}>Refresh</button><Link className="addVehicleQuick" style={{margin:0,padding:"0 14px"}} href="/dealer/inventory">Inventory</Link></div></div>
    <div className="leadInboxTabs">{[["all","All"],["ok","Success"],["failed","Failed"],["denied","Denied"]].map(([k,l])=><button key={k} className={filter===k?"active":""} onClick={()=>setFilter(k)}>{l} · {k==="all"?durable.length:durable.filter((e:any)=>e.outcome===k).length}</button>)}</div>
    {data&&<div className="crmAlert">Canonical ledger revision: <strong>{data.revision??"unknown"}</strong> · Durable events: <strong>{durable.length}</strong> · Canonical vehicle audit events: <strong>{(data.ledger||[]).length}</strong></div>}
    {message&&<div className="crmAlert">{message}</div>}
    <div className="leadCards">{shown.map((e:any)=><article className="leadCardPro" key={e.id||`${e.at}-${e.requestId}-${e.action}`}><div className="leadScore" style={{fontSize:11}}>{String(e.outcome||"?").toUpperCase()}</div><div><h3>{e.year||"—"} {e.make||"Vehicle"} {e.model||""}</h3><p><strong>{human(e.action)}</strong>{Number.isFinite(Number(e.mileage))?` · ${Number(e.mileage).toLocaleString()} mi`:""}{e.stock?` · Stock ${e.stock}`:""}</p><div className="leadMeta"><span>{when(e.at)}</span>{e.status&&<span>{String(e.status).toUpperCase()}</span>}{e.photoCount!=null&&<span>{e.photoCount} photo{Number(e.photoCount)===1?"":"s"}</span>}</div>{e.detail&&<p style={{marginTop:8}}>{e.detail}</p>}<details style={{marginTop:8}}><summary>Trace details</summary><p style={{fontSize:11}}>Request ID: {e.requestId||"—"}<br/>Vehicle ID: {e.vehicleId||"—"}<br/>Actor ID: {e.actorId||"—"}</p></details></div></article>)}{!shown.length&&!message&&<div className="crmEmpty">No vehicle events in this view.</div>}</div>
  </section></main>;
}
