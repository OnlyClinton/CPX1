"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const labels:any={new:"New",contacted:"Contacted",engaged:"Engaged",qualified:"Qualified",appointment:"Appointment",showed:"Showed",deal_working:"Deal Working",sold:"Sold",lost:"Lost",nurture:"Nurture"};
const stages=["new","contacted","engaged","qualified","appointment","showed","deal_working","sold","lost","nurture"];
const views=["active","new-today","hot","appointments","sold","all"];
const when=(v:any)=>v?new Date(v).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"Unknown time";
const sourceLabel=(v:any)=>String(v||"unknown source").replace(/[-_]+/g," ").replace(/\b\w/g,m=>m.toUpperCase());
const isToday=(x:any)=>{const raw=x?.createdAt||x?.created_at;if(!raw)return false;const d=new Date(raw);return !Number.isNaN(d.getTime())&&d.toDateString()===new Date().toDateString()};
const isAppointment=(x:any)=>x?.pipelineStage==="appointment"||String(x?.kind||"").toLowerCase()==="schedule";

export default function DealerLeads(){
  const[items,setItems]=useState<any[]>([]);const[message,setMessage]=useState("Loading leads…");const[tab,setTab]=useState("active");const[busy,setBusy]=useState("");
  async function load(){const r=await fetch("/api/crm/dashboard",{cache:"no-store"});if(r.status===401){location.href="/dealer/login";return}const j=await r.json();if(!r.ok)throw Error(j.error||"Lead list failed");setItems(j.leads||[]);setMessage("")}
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("view");if(requested&&views.includes(requested))setTab(requested);load().catch(e=>setMessage(e.message||"Lead list failed"))},[]);
  async function update(id:string,status:string){setBusy(id);const r=await fetch(`/api/leads/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});const j=await r.json().catch(()=>({}));if(!r.ok)setMessage(j.error||"Lead update failed");else await load();setBusy("")}
  const matches=(x:any,view:string)=>view==="all"?true:view==="new-today"?isToday(x):view==="hot"?Number(x.priority||0)>=70&&!['sold','lost'].includes(x.pipelineStage):view==="appointments"?isAppointment(x):view==="sold"?x.pipelineStage==="sold":!['sold','lost'].includes(x.pipelineStage);
  const filtered=useMemo(()=>items.filter(x=>matches(x,tab)),[items,tab]);
  const selectTab=(view:string)=>{setTab(view);const url=new URL(window.location.href);url.searchParams.set("view",view);window.history.replaceState({},"",url.toString())};
  return <main className="crmShell"><aside className="crmSidebar"><Link className="crmLogo" href="/dealer"><img src="/wdcc-official-logo.webp" alt="WDCC"/><span>SALES COMMAND</span></Link><nav><Link href="/dealer">Today</Link><Link className="active" href="/dealer/leads">Leads</Link><Link href="/dealer#pipeline">Pipeline</Link><Link href="/dealer/leads?view=appointments">Appointments</Link><Link href="/dealer/inventory?view=published">Inventory</Link><Link href="/dealer/inventory/new">+ Add Vehicle</Link><Link href="/">View Website</Link></nav></aside><section className="crmMain">
    <div className="leadInboxHeader"><div><span className="crmKicker">CUSTOMER LEADS</span><h1>Lead Command</h1><p className="muted">Customer identity first. Source and received time second. Internal IDs stay trace-only.</p></div><Link className="addVehicleQuick" style={{margin:0,padding:"0 14px"}} href="/dealer">Back to My Day</Link></div>
    <div className="leadInboxTabs">{[["active","Active"],["new-today","New Today"],["hot","Hot"],["appointments","Appointments"],["sold","Sold"],["all","All"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>selectTab(k)}>{l} · {items.filter(x=>matches(x,k)).length}</button>)}</div>
    {message&&<div className="crmAlert">{message}</div>}
    <div className="leadCards">{filtered.map(lead=>{const upstream=lead?.sync?.upstream||"unknown";return <article className="leadCardPro" key={lead.id}><div className="leadScore">{Math.round(lead.priority||0)}</div><div><h3>{lead.name||"Unnamed buyer"}</h3><p><strong>{lead.phone||"No phone"}</strong> · <strong>{lead.email||"No email"}</strong></p><p>{sourceLabel(lead.source)} · Received {when(lead.createdAt)}</p><p>{lead.vehicleInterest||"General inquiry"} · {lead.kind||"lead"}</p><div className="leadMeta"><span>{labels[lead.pipelineStage]||lead.pipelineStage}</span><span>{upstream==="synced"?"Data synced":upstream==="pending"?"Sync pending":"Sync unknown"}</span></div>{(lead.message||lead.lastNote)&&<p style={{marginTop:8}}>{lead.message||lead.lastNote}</p>}<details style={{marginTop:8}}><summary>Trace details</summary><p style={{fontSize:11}}>Lead ID: {lead.id}{lead.upstreamLeadId?` · Upstream ID: ${lead.upstreamLeadId}`:""}</p></details></div><select className="leadStageSelect" value={lead.pipelineStage==="deal"?"deal_working":lead.pipelineStage||"new"} disabled={busy===lead.id} onChange={e=>update(lead.id,e.target.value)}>{stages.map(s=><option value={s} key={s}>{labels[s]}</option>)}</select><div className="leadCardActions">{lead.phone&&<a className="primary" href={`tel:${lead.phone}`}>Call</a>}{lead.phone&&<a href={`sms:${lead.phone}`}>Text</a>}{lead.email&&<a href={`mailto:${lead.email}`}>Email</a>}<button onClick={()=>update(lead.id,"appointment")} disabled={busy===lead.id}>Book / Set</button></div></article>})}{!filtered.length&&!message&&<div className="crmEmpty">No leads in this view.</div>}</div>
  </section></main>;
}
