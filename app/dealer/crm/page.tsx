"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import styles from "./crm.module.css";

const pipelineLabels:any={new:"New",contacted:"Contacted",engaged:"Engaged",qualified:"Qualified",appointment:"Appointment",showed:"Showed",deal:"Deal",sold:"Sold"};

function ageLabel(value?:string){
  if(!value)return "";
  const ms=Date.now()-Date.parse(value);if(!Number.isFinite(ms))return "";
  const min=Math.max(0,Math.floor(ms/60000));
  if(min<60)return `${min}m ago`;
  const hr=Math.floor(min/60);if(hr<24)return `${hr}h ago`;
  return `${Math.floor(hr/24)}d ago`;
}
function phoneHref(phone?:string){return `tel:${String(phone||"").replace(/[^+\d]/g,"")}`}
function smsHref(phone?:string){return `sms:${String(phone||"").replace(/[^+\d]/g,"")}`}

export default function CRM(){
  const[data,setData]=useState<any>(null);const[error,setError]=useState("");const[query,setQuery]=useState("");
  useEffect(()=>{fetch("/api/crm/dashboard",{cache:"no-store"}).then(async r=>{if(r.status===401){location.href="/dealer/login";return}const j=await r.json();if(!r.ok)throw Error(j.error||"CRM failed to load");setData(j)}).catch(e=>setError(e.message||"CRM failed to load"))},[]);
  const leads=useMemo(()=>{const all=data?.leads||[];const q=query.trim().toLowerCase();if(!q)return all;return all.filter((lead:any)=>[lead.name,lead.email,lead.phone,lead.vehicleInterest,lead.kind,lead.status].some(v=>String(v||"").toLowerCase().includes(q)))},[data,query]);
  if(!data&&!error)return <main className={styles.loading}>Loading WDCC CRM…</main>;
  const summary=data?.summary||{};const pipeline=data?.pipeline||{};const hot=data?.hotLeads||[];const inventory=data?.inventory||[];
  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><b>WDCC</b><span>SALES COMMAND</span></div>
      <nav><Link href="/dealer">Dashboard</Link><Link className={styles.active} href="/dealer/crm">CRM</Link><Link href="/dealer/leads">Lead Inbox</Link><Link href="/dealer/inventory">Inventory</Link><Link href="/dealer/inventory/new">+ Add Vehicle</Link><Link href="/">View Website</Link></nav>
    </aside>
    <section className={styles.main}>
      <header className={styles.topbar}><div><span className={styles.kicker}>AUTOMOTIVE SALES CRM</span><h1>My Day</h1><p>Who needs attention, what they want, and what to do next.</p></div><div className={styles.search}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, phone, vehicle…"/></div></header>
      {error&&<div className={styles.error}>{error}</div>}
      <section className={styles.kpis}>
        <article><span>Leads</span><strong>{summary.totalLeads||0}</strong><small>{summary.newToday||0} new today</small></article>
        <article><span>Needs Action</span><strong>{summary.hotLeads||0}</strong><small>prioritized now</small></article>
        <article><span>Appointments</span><strong>{summary.appointments||0}</strong><small>requests / active</small></article>
        <article><span>Live Inventory</span><strong>{summary.publishedInventory||0}</strong><small>{summary.totalInventory||0} total incl. hidden</small></article>
      </section>

      <section className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>DO THIS NOW</span><h2>Priority Buyers</h2></div><Link href="/dealer/leads">View all →</Link></div>
          <div className={styles.priorityList}>{hot.length?hot.slice(0,5).map((lead:any,index:number)=><article className={styles.priorityCard} key={lead.id}>
            <div className={styles.rank}>{index+1}</div><div className={styles.person}><div className={styles.personTop}><strong>{lead.name||"Unnamed lead"}</strong><span>{lead.priority>=70?"HOT":"ACTIVE"}</span></div><p>{lead.vehicleInterest||"General vehicle inquiry"}</p><small>{lead.kind||"lead"} · {ageLabel(lead.createdAt)}</small></div>
            <div className={styles.action}><b>{lead.nextAction}</b><small>{lead.priority!=null?`Priority ${lead.priority}`:"Not scored"}</small><div>{lead.phone&&<a href={phoneHref(lead.phone)}>Call</a>}{lead.phone&&<a href={smsHref(lead.phone)}>Text</a>}<Link href={`/dealer/crm/${encodeURIComponent(lead.id)}`}>360</Link></div></div>
          </article>):<div className={styles.empty}>No active leads yet. New website requests will appear here automatically.</div>}</div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}><div><span>PIPELINE</span><h2>Lead → Close</h2></div><small>Live records only</small></div>
          <div className={styles.pipeline}>{Object.entries(pipelineLabels).map(([stage,label])=><div key={stage}><div><span>{label as string}</span><b>{pipeline[stage]||0}</b></div><i><em style={{width:`${Math.min(100,((pipeline[stage]||0)/Math.max(1,summary.totalLeads||1))*100)}%`}}/></i></div>)}</div>
          <div className={styles.momentum}><span>Momentum</span><strong>{summary.sold?`${summary.sold} sold`:`Learning from live activity`}</strong><small>WDCC will add response, show, close and gross scores as those outcomes are recorded.</small></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>LIVE CRM</span><h2>Customer Queue</h2></div><b>{leads.length} records</b></div>
        <div className={styles.table}>
          <div className={styles.tableHead}><span>Customer</span><span>Stage</span><span>Vehicle</span><span>Request</span><span>Last activity</span><span>Action</span></div>
          {leads.length?leads.map((lead:any)=><div className={styles.row} key={lead.id}><div><strong>{lead.name||"Unnamed"}</strong><small>{lead.phone||lead.email||"No contact"}</small></div><span className={styles.stage}>{pipelineLabels[lead.pipelineStage]||lead.pipelineStage}</span><span>{lead.vehicleInterest||"Open"}</span><span>{lead.kind||"lead"}</span><time>{ageLabel(lead.createdAt)}</time><Link href={`/dealer/crm/${encodeURIComponent(lead.id)}`}>Open 360 →</Link></div>):<div className={styles.empty}>No leads match this search.</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>BUYER × INVENTORY</span><h2>Cars Ready To Sell</h2></div><Link href="/dealer/inventory">Manage inventory →</Link></div>
        <div className={styles.cars}>{inventory.length?inventory.map((v:any)=><article key={v.id}><div className={styles.carImage}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt=""/>:<span>PHOTO PENDING</span>}</div><div><small>{v.year} {v.make}</small><strong>{v.model} {v.trim||""}</strong><b>${Number(v.price||0).toLocaleString()}</b><span>{Number(v.mileage||0).toLocaleString()} mi</span></div><Link href={`/vehicle/${v.id}`}>View vehicle →</Link></article>):<div className={styles.empty}>No customer-visible vehicles.</div>}</div>
      </section>
    </section>
  </main>;
}
