"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

export default function DealerLeads(){
  const [items,setItems]=useState<any[]>([]);const[message,setMessage]=useState("Loading leads…");
  useEffect(()=>{fetch("/api/leads",{cache:"no-store"}).then(async response=>{
    if(response.status===401){location.href="/dealer/login";return;}
    const json=await response.json();if(!response.ok)throw Error(json.error||"Lead list failed");
    setItems(json.items||[]);setMessage("");
  }).catch(error=>setMessage(error.message||"Lead list failed"));},[]);
  return <main className="dealerShell"><aside className="dealerSidebar">
    <div className="dealerLogo"><b>WDCC</b><span>DEALER COMMAND</span></div><div className="dealerMenuLabel">OPERATIONS</div>
    <nav className="dealerMenu"><Link href="/dealer">Dashboard</Link><Link href="/dealer/inventory">All Vehicles</Link><Link href="/dealer/inventory/new">+ Add Vehicle</Link><Link className="active" href="/dealer/leads">Leads</Link><Link href="/">View Website</Link></nav>
  </aside><section className="dealerMain"><div className="dealerTop"><div><div className="eyebrow">CUSTOMER REQUESTS</div><h1>Lead Inbox</h1></div></div>
    {message&&<div className="dealerMessage">{message}</div>}
    <div className="dealerPanel">{items.length?items.map(lead=><div className="leadRow" key={lead.id}>
      <div><strong>{lead.name}</strong><div className="muted">{lead.email||"No email"} · {lead.phone||"No phone"}</div></div>
      <span className="dealerStatus published">{lead.kind}</span>
      <div><b>{lead.vehicleInterest||"General inquiry"}</b><div className="muted">{lead.message||lead.preferredTime||"No note"}</div></div>
      <time>{lead.createdAt?new Date(lead.createdAt).toLocaleString():""}</time>
    </div>):!message&&<p>No leads yet.</p>}</div>
  </section></main>;
}
