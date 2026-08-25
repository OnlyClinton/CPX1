"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const img=(v:any)=>v.image||v.photo||v.primaryPhotoUrl||v.primaryPhoto||v.imageUrl||"";
const readiness=(v:any)=>{if(String(v.status||"").toLowerCase()==="archived")return 0;let n=45;if(v.year&&v.make&&v.model)n+=20;if(Number(v.price)>0)n+=15;if(img(v))n+=15;if(v.description)n+=5;return Math.min(100,n)};

export default function DealerInventory(){
  const[items,setItems]=useState<any[]>([]);
  const[message,setMessage]=useState("Loading inventory…");
  const[query,setQuery]=useState("");
  const[status,setStatus]=useState("all");
  async function load(){const r=await fetch("/api/inventory",{cache:"no-store",credentials:"include"});if(r.status===401){location.href="/dealer";return}const j=await r.json();if(!r.ok)throw Error(j.error||"Inventory list failed");setItems(j.items||[]);setMessage("")}
  useEffect(()=>{load().catch(e=>setMessage(e.message||"Inventory list failed"))},[]);
  const shown=useMemo(()=>items.filter(v=>{const hay=`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""} ${v.stock||""}`.toLowerCase();return (!query||hay.includes(query.toLowerCase()))&&(status==="all"||String(v.status||"").toLowerCase()===status)}),[items,query,status]);
  const published=items.filter(v=>String(v.status||"").toLowerCase()==="published").length;
  const drafts=items.filter(v=>String(v.status||"").toLowerCase()==="draft").length;
  const attention=items.filter(v=>readiness(v)<80&&String(v.status||"").toLowerCase()!=="archived").length;

  return <main className="refDealerShell">
    <aside className="refDealerSide">
      <Link href="/dealer" className="refDealerBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC</b><span>DEALER PORTAL</span></div></Link>
      <nav><Link href="/dealer">Dashboard</Link><div className="refDealerLabel">INVENTORY</div><Link className="active" href="/dealer/inventory">All Vehicles</Link><Link href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><div className="refDealerLabel">OPERATIONS</div><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
      <div className="refDealerHelp"><span>NEED HELP?</span><b>Call Sean anytime.</b><a href="tel:18135164752">813-516-4752</a></div>
    </aside>

    <section className="refDealerBody">
      <header className="refDealerTop"><div className="refDealerTopBrand"><img src="/wdcc-logo-transparent.webp" alt=""/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span></header>
      <div className="refDealerContent">
        <div className="refDealerTitle"><div><h1>All Vehicles</h1><p>Manage your dealership inventory.</p></div><div className="refDealerTitleActions"><Link className="primary" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><button>⇧ Import</button><button>⇧ Export</button></div></div>
        <div className="refDealerStats"><article><span>Total Vehicles</span><b>{items.length}</b></article><article><span>Published</span><b>{published}</b><em>{items.length?Math.round(published/items.length*100):0}%</em></article><article><span>Drafts</span><b>{drafts}</b></article><article><span>Needs Attention</span><b>{attention}</b></article><article><span>Sold This Week</span><b>0</b></article></div>
        <div className="refDealerFilters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by make, model, year, or stock #…"/><select><option>All Makes</option></select><select><option>All Models</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><button>☷ Filters</button><button>⇅ Sort</button></div>
        {message&&<div className="refDealerNotice">{message}</div>}
        <div className="refDealerTableHead"><span>VEHICLE</span><span>PRICE</span><span>MILES</span><span>STATUS</span><span>READINESS</span><span>ACTIONS</span></div>
        <div className="refDealerRows">{shown.map(v=>{const r=readiness(v);const s=String(v.status||"draft").toLowerCase();return <article key={v.id} className="refDealerVehicleRow"><div className="refDealerVehicle"><div className="refDealerThumb">{img(v)?<img src={img(v)} alt=""/>:<span>WDCC</span>}</div><div><strong>{v.year||"—"} {v.make||"Unknown"} {v.model||"Vehicle"} {v.trim||""}</strong><small>Stock #{v.stock||String(v.id).slice(-8)}</small><div><i>{Number(v.mileage||0).toLocaleString()} MILES</i>{v.trim&&<i>{String(v.trim).toUpperCase()}</i>}</div></div></div><div><strong>{money(v.price)}</strong><small>{Number(v.downPayment||0)>0?`${money(v.downPayment)} Down`:"Cash price"}</small></div><span>{Number(v.mileage||0).toLocaleString()}</span><b className={`refStatus ${s}`}>{s.toUpperCase()}</b><div className="refReady"><span>Ready {r}%</span><div><i style={{width:`${r}%`}}/></div></div><div className="refDealerActions"><Link href={`/dealer/inventory/new?edit=${encodeURIComponent(v.id)}`}>✎<small>Edit</small></Link><Link href={`/vehicle/${v.id}`}>◉<small>Preview</small></Link><Link href={`/vehicle/${v.id}`}>▣<small>View</small></Link><button>•••<small>More</small></button></div></article>})}{!shown.length&&!message&&<div className="refDealerEmpty">No vehicles match this view.</div>}</div>
        <div className="refDealerFooter"><span>Showing {shown.length} of {items.length} vehicles</span><div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div><span>Rows per page&nbsp; 10⌄</span></div>
      </div>
      <nav className="refDealerMobileNav"><Link href="/dealer">⌂<span>Dashboard</span></Link><Link className="active" href="/dealer/inventory">▣<span>All Vehicles</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
    </section>
  </main>;
}
