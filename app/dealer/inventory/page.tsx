"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const when=(v:any)=>v?new Date(v).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"Unknown time";
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});

export default function DealerInventory(){
  const[items,setItems]=useState<any[]>([]);
  const[message,setMessage]=useState("Loading inventory…");
  const[filter,setFilter]=useState("all");
  async function load(){const r=await fetch("/api/inventory",{cache:"no-store"});if(r.status===401){location.href="/dealer/login";return}const j=await r.json();if(!r.ok)throw Error(j.error||"Inventory list failed");setItems(j.items||[]);setMessage("")}
  useEffect(()=>{load().catch(e=>setMessage(e.message||"Inventory list failed"))},[]);
  const shown=useMemo(()=>items.filter(v=>filter==="all"?true:String(v.status||"").toLowerCase()===filter),[items,filter]);
  return <main className="crmShell"><aside className="crmSidebar"><Link className="crmLogo" href="/dealer"><img src="/wdcc-official-logo.webp" alt="WDCC"/><span>SALES COMMAND</span></Link><nav><Link href="/dealer">Today</Link><Link href="/dealer/leads">Leads</Link><Link className="active" href="/dealer/inventory">Inventory</Link><Link href="/dealer/inventory/new">+ Add Vehicle</Link><Link href="/">View Website</Link></nav></aside><section className="crmMain">
    <div className="leadInboxHeader"><div><span className="crmKicker">VEHICLE INVENTORY</span><h1>Inventory Command</h1><p className="muted">Vehicle identity first. Upload source and time second. Internal IDs stay trace-only.</p></div><Link className="addVehicleQuick" style={{margin:0,padding:"0 14px"}} href="/dealer/inventory/new">+ Add Vehicle</Link></div>
    <div className="leadInboxTabs">{[["all","All"],["published","Published"],["draft","Draft"],["archived","Archived"]].map(([k,l])=><button key={k} className={filter===k?"active":""} onClick={()=>setFilter(k)}>{l} · {k==="all"?items.length:items.filter(v=>String(v.status||"").toLowerCase()===k).length}</button>)}</div>
    {message&&<div className="crmAlert">{message}</div>}
    <div className="leadCards">{shown.map(v=><article className="leadCardPro" key={v.id}><div><h3>{v.year||"—"} {v.make||"Unknown make"} {v.model||"Unknown model"}</h3><p><strong>{Number(v.mileage||0).toLocaleString()} mi</strong> · <strong>{money(v.price)}</strong>{(v.trim||"").trim()?` · ${v.trim}`:""}</p><p>{v.stock?`Stock ${v.stock}`:"No stock #"} · {String(v.status||"unknown").toUpperCase()} · Uploaded {when(v.createdAt||v.created_at)}</p>{v.description&&<p style={{marginTop:8}}>{v.description}</p>}<details style={{marginTop:8}}><summary>Trace details</summary><p style={{fontSize:11}}>Vehicle ID: {v.id} · Tenant: {v.tenantId||"wdcc"}</p></details></div><div className="leadCardActions"><Link className="primary" href={`/vehicle/${v.id}`}>View</Link><Link href={`/dealer/inventory/new?clone=${encodeURIComponent(v.id)}`}>Duplicate</Link></div></article>)}{!shown.length&&!message&&<div className="crmEmpty">No vehicles in this view.</div>}</div>
  </section></main>;
}
