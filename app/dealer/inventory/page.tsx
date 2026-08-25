"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const statusClass=(s:any)=>String(s||"draft").toLowerCase();
const readiness=(v:any)=>{let n=0;if(v.year&&v.make&&v.model)n+=30;if(Number(v.price)>0)n+=20;if(Number(v.mileage)>=0)n+=10;if(v.description)n+=15;if(v.primaryPhotoUrl||v.imageUrl||v.photoUrl||v.primaryPhotoPathname)n+=25;return Math.min(100,n)};
const thumb=(v:any)=>v.primaryPhotoUrl||v.imageUrl||v.photoUrl||v.image||"/wdcc-hero-v2.webp";

export default function DealerInventory(){
  const[items,setItems]=useState<any[]>([]);
  const[message,setMessage]=useState("Loading inventory…");
  const[status,setStatus]=useState("all");
  const[query,setQuery]=useState("");
  const[make,setMake]=useState("all");
  const[sort,setSort]=useState("newest");

  async function load(){const r=await fetch("/api/inventory",{cache:"no-store"});if(r.status===401){location.href="/dealer/login";return}const j=await r.json();if(!r.ok)throw Error(j.error||"Inventory list failed");setItems(j.items||[]);setMessage("")}
  useEffect(()=>{load().catch(e=>setMessage(e.message||"Inventory list failed"))},[]);

  const makes=useMemo(()=>Array.from(new Set(items.map(v=>String(v.make||"").trim()).filter(Boolean))).sort(),[items]);
  const shown=useMemo(()=>{
    let out=items.filter(v=>status==="all"||String(v.status||"").toLowerCase()===status);
    if(make!=="all")out=out.filter(v=>String(v.make||"")===make);
    if(query.trim()){const q=query.toLowerCase();out=out.filter(v=>`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""} ${v.stock||""}`.toLowerCase().includes(q))}
    out=[...out].sort((a,b)=>sort==="price-low"?Number(a.price||0)-Number(b.price||0):sort==="price-high"?Number(b.price||0)-Number(a.price||0):new Date(b.createdAt||b.created_at||0).getTime()-new Date(a.createdAt||a.created_at||0).getTime());
    return out;
  },[items,status,query,make,sort]);

  const published=items.filter(v=>String(v.status||"").toLowerCase()==="published").length;
  const drafts=items.filter(v=>String(v.status||"").toLowerCase()==="draft").length;
  const attention=items.filter(v=>readiness(v)<80&&String(v.status||"").toLowerCase()!=="archived").length;

  return <main className="wdccDealer"><div className="wdccDealerShell">
    <aside className="wdccDealerAside"><div className="wdccDealerBrand"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><b>DEALER PORTAL</b><small>INVENTORY OPERATIONS</small></div></div><div className="wdccDealerNavLabel">INVENTORY</div><nav className="wdccDealerNav"><Link href="/dealer">Dashboard</Link><Link className="active" href="/dealer/inventory">All Vehicles</Link><Link href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory/logs">Vehicle Logs</Link></nav><div className="wdccDealerNavLabel">OPERATIONS</div><nav className="wdccDealerNav"><Link href="/dealer/leads">Leads</Link><Link href="/dealer">Appointments</Link><Link href="/dealer">Applications</Link><Link href="/">View Website</Link></nav><div className="wdccDealerAsideFoot"><small>NEED HELP?</small><b>Call Sean anytime.</b><a href="tel:18135164752">813-516-4752</a></div></aside>
    <section className="wdccDealerMain"><header className="wdccDealerTop"><div className="wdccDealerTopTitle"><div><strong>WDCC · DEALER PORTAL</strong><span>Inventory Operations</span></div></div><a className="wdccDealerPhone" href="tel:18135164752">☎ (813) 516-4752</a></header>
      <div className="wdccDealerContent"><div className="wdccPageHead"><div><h1>All Vehicles</h1><p>Manage dealership inventory, readiness, publishing and traceability.</p></div><div className="wdccActionRow"><Link className="wdccBtn primary" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link className="wdccBtn" href="/dealer/inventory/logs">Vehicle Logs</Link></div></div>
      <section className="wdccStats"><article className="wdccStat"><span>Total Vehicles</span><strong>{items.length}</strong></article><article className="wdccStat"><span>Published</span><strong>{published}</strong></article><article className="wdccStat"><span>Drafts</span><strong>{drafts}</strong></article><article className="wdccStat"><span>Needs Attention</span><strong>{attention}</strong></article><article className="wdccStat"><span>Visible Rate</span><strong>{items.length?Math.round(published/items.length*100):0}%</strong></article></section>
      <div className="wdccToolbar"><input aria-label="Search inventory" placeholder="Search by make, model, year, or stock #…" value={query} onChange={e=>setQuery(e.target.value)}/><select value={make} onChange={e=>setMake(e.target.value)}><option value="all">All Makes</option>{makes.map(m=><option key={m} value={m}>{m}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="price-low">Price: Low</option><option value="price-high">Price: High</option></select><Link className="wdccBtn" href="/dealer/inventory/new">Import</Link><button className="wdccBtn" onClick={()=>{setQuery("");setMake("all");setStatus("all")}}>Clear</button></div>
      {message&&<div className="crmAlert">{message}</div>}
      <section className="wdccInventoryTable"><div className="wdccInventoryHead"><span>VEHICLE</span><span>PRICE</span><span>MILES</span><span>STATUS</span><span>READINESS</span><span>ACTIONS</span></div>{shown.map(v=>{const r=readiness(v);return <article className="wdccInventoryRow" key={v.id}><div className="wdccVehicleCell"><div className="wdccVehicleThumb" style={{backgroundImage:`url(${thumb(v)})`}}/><div><h3>{v.year||"—"} {v.make||"Unknown"} {v.model||"Vehicle"} {v.trim||""}</h3><p>{v.stock?`Stock #${v.stock}`:"No stock number"}</p><p>{v.transmission||""} {v.drivetrain||""}</p></div></div><div className="wdccPrice"><strong>{money(v.price)}</strong><small>{Number(v.downPayment||0)>0?`${money(v.downPayment)} down`:"Price entered"}</small></div><div><strong>{Number(v.mileage||0).toLocaleString()}</strong></div><div><span className={`wdccPill ${statusClass(v.status)}`}>{v.status||"draft"}</span></div><div className="wdccReady"><b>Ready {r}%</b><div className="wdccReadyTrack"><i style={{width:`${r}%`}}/></div></div><div className="wdccRowActions"><Link href={`/dealer/inventory/new?clone=${encodeURIComponent(v.id)}`}>Edit</Link><Link href={`/vehicle/${v.id}`}>Preview</Link><Link href="/dealer/inventory/logs">Logs</Link></div></article>})}{!shown.length&&!message&&<div className="crmEmpty">No vehicles match this view.</div>}</section>
      </div></section>
  </div></main>;
}
