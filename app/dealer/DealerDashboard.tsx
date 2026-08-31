"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {createdAtOf,sourceLabel,stageLabels,stageOf,when,type LeadRecord} from "./crmFilters";

type Vehicle=Record<string,any>;
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const imageFor=(v:Vehicle)=>{const direct=v.image||v.photo||v.primaryPhotoUrl||v.primaryPhoto||v.imageUrl||"";if(direct)return direct;const p=String(v.primaryPhotoPathname||v.photoPathnames?.[0]||"").trim();return p?`/api/media?p=${encodeURIComponent(p)}`:""};
const vehicleName=(v:Vehicle)=>`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""}`.replace(/\s+/g," ").trim()||"Vehicle";
const dealerRole=(value:any)=>["dealer_agent","tenant_admin","platform_admin"].includes(String(value||"").toLowerCase());

export default function DealerDashboard(){
  const[session,setSession]=useState<any>(null);
  const[data,setData]=useState<any>(null);
  const[username,setUsername]=useState("Dealer");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function loadDashboard(){const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});const j=await r.json().catch(()=>({}));setData(r.ok?j:{summary:{},leads:[],inventory:[],error:j?.error||`Dashboard ${r.status}`})}
  async function loadSession(){const r=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});const j=await r.json().catch(()=>({}));const role=j?.user?.role||j?.role||j?.session?.role;if(j?.authenticated&&dealerRole(role)){setSession(j);await loadDashboard()}else setSession(null)}
  useEffect(()=>{loadSession().catch(()=>setSession(null))},[]);
  async function login(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage("Signing in…");try{const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({username:username.trim(),email:username.trim(),password})});const j=await r.json().catch(()=>({}));if(!r.ok||!j?.ok)throw Error(r.status===401?"Login or password is incorrect.":j?.error||"Sign-in failed.");await loadSession();setMessage("")}catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed.")}finally{setBusy(false)}}
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include",cache:"no-store"}).catch(()=>{});setSession(null);setData(null);setPassword("")}

  if(!session?.authenticated)return <main className="targetDealerLogin"><section className="targetDealerLoginHero"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><span>WDCC DEALER PORTAL</span><h1>RUN YOUR DEALERSHIP.<br/>CLOSE MORE DEALS.</h1><p>Inventory, leads, appointments and sales operations in one place.</p></div></section><form className="targetDealerLoginCard" onSubmit={login}><small>SECURE DEALER ACCESS</small><h2>Dealer Sign In</h2><label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required/></label><label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label><button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button><div>{message}</div></form></main>;

  const leads:LeadRecord[]=Array.isArray(data?.leads)?data.leads:[];
  const inventory:Vehicle[]=Array.isArray(data?.inventory)?data.inventory:[];
  const summary=data?.summary||{};
  const newLeads=Number(summary.newToday??summary.newLeads??leads.filter(l=>stageOf(l)==="new").length);
  const applications=Number(summary.applications??leads.filter(l=>String(l.kind||"").toLowerCase()==="approval").length);
  const approved=Number(summary.approved??leads.filter(l=>stageOf(l)==="approved").length);
  const sold=Number(summary.soldThisWeek??summary.sold??leads.filter(l=>stageOf(l)==="sold").length);
  const sourceRows=(()=>{const m=new Map<string,number>();for(const l of leads){const s=sourceLabel(l)||"Website";m.set(s,(m.get(s)||0)+1)}const rows=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);const total=Math.max(1,rows.reduce((n,[,v])=>n+v,0));return rows.map(([name,value])=>({name,value,pct:Math.round(value/total*100)}))})();
  const recent=[...leads].sort((a,b)=>new Date(createdAtOf(b)||0).getTime()-new Date(createdAtOf(a)||0).getTime()).slice(0,5);
  const topVehicles=[...inventory].sort((a,b)=>Number(b.views||b.leads||0)-Number(a.views||a.leads||0)).slice(0,5);
  const chartNew=[18,31,24,42,35,52,44],chartApproved=[10,21,16,30,22,35,31];
  const points=(arr:number[])=>arr.map((v,i)=>`${i*16.66},${64-v}`).join(" ");
  const donut=(()=>{if(!sourceRows.length)return"conic-gradient(#1f7cff 0 46%,#ef2435 46% 70%,#25b86f 70% 88%,#f2a41e 88% 100%)";let at=0;const colors=["#1f7cff","#ef2435","#25b86f","#f2a41e"];return`conic-gradient(${sourceRows.map((r,i)=>{const s=at;at+=r.pct;return`${colors[i%4]} ${s}% ${Math.min(at,100)}%`}).join(",")})`})();

  return <main className="targetDealerApp">
    <header className="targetDealerTop"><div className="targetDealerTopBrand"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span><button onClick={logout}>Sign Out</button></header>
    <div className="targetDealerFrame">
      <aside className="targetDealerSide"><Link className="sideBrand" href="/dealer"><img src="/wdcc-official-logo.webp" alt=""/><span>WDCC</span></Link><nav><Link className="active" href="/dealer">⌂ Dashboard</Link><Link href="/dealer/inventory">▣ Inventory</Link><Link href="/dealer/leads">♙ Leads</Link><Link href="/dealer/leads?view=appointments">▣ Appointments</Link><Link href="/dealer/leads">◎ Customers</Link><Link href="/dealer/leads">✉ Messages</Link><Link href="/dealer/inventory/logs">▥ Reports</Link><Link href="/dealer">⚙ Settings</Link></nav></aside>
      <section className="targetDealerMain">
        <div className="targetDealerTitle"><div><h1>Dashboard</h1><p>Run your dealership. Close more deals.</p></div><div>May 24 – May 30, 2026 ▾</div></div>
        {data?.error&&<div className="targetDealerNotice">Signed in. Some dashboard data is reconnecting: {data.error}</div>}
        <div className="targetDealerStats"><article><span>New Leads</span><b>{newLeads}</b><em>↑ live</em></article><article><span>Applications</span><b>{applications}</b><em>↑ live</em></article><article><span>Approved</span><b>{approved}</b><em>↑ live</em></article><article><span>Sold This Week</span><b>{sold}</b><em>↑ live</em></article></div>
        <div className="targetDealerCharts"><section><header><b>Leads Overview</b><span>● New Leads &nbsp; ● Approved</span></header><svg viewBox="0 0 100 70" preserveAspectRatio="none"><g><line x1="0" y1="15" x2="100" y2="15"/><line x1="0" y1="35" x2="100" y2="35"/><line x1="0" y1="55" x2="100" y2="55"/></g><polyline className="lineBlue" points={points(chartNew)}/><polyline className="lineRed" points={points(chartApproved)}/></svg><div className="chartDays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section><section><header><b>Leads by Source</b></header><div className="sourceChart"><div className="donut" style={{background:donut}}><span>Total<b>{leads.length}</b></span></div><div>{(sourceRows.length?sourceRows:[{name:"Website",pct:46,value:0},{name:"Phone",pct:24,value:0},{name:"Walk-in",pct:18,value:0},{name:"Referral",pct:12,value:0}]).map((r:any,i)=><p key={r.name}><i className={`dot d${i}`}/><span>{r.name}</span><b>{r.pct}%</b></p>)}</div></div></section></div>
        <div className="targetDealerLower"><section><header><b>Top Performing Vehicles</b><Link href="/dealer/inventory">View all inventory →</Link></header><div className="topVehicleTable"><div className="head"><span>VEHICLE</span><span>VIEWS</span><span>LEADS</span><span>STATUS</span></div>{topVehicles.map((v,i)=><div key={v.id||i}><span className="vehicleLabel">{imageFor(v)&&<img src={imageFor(v)} alt=""/>}<b>{vehicleName(v)}</b><small>{money(v.price)}</small></span><span>{Number(v.views||0)}</span><span>{Number(v.leads||0)}</span><em>{String(v.status||"available").toUpperCase()}</em></div>)}{!topVehicles.length&&<p className="emptyRow">No inventory yet.</p>}</div></section><section><header><b>Recent Activity</b><Link href="/dealer/leads">All activity →</Link></header><div className="recentActivity">{recent.map((l,i)=><Link href={`/dealer/crm/${encodeURIComponent(String(l.id))}`} key={l.id||i}><i>◎</i><span><b>{l.name||"New lead"}</b><small>{l.vehicleInterest||sourceLabel(l)||stageLabels[stageOf(l)]}</small></span><em>{when(createdAtOf(l))}</em></Link>)}{!recent.length&&<p className="emptyRow">No recent activity.</p>}</div></section></div>
        <div className="targetDealerQuick"><Link href="/dealer/inventory/new">＋ Add Vehicle</Link><Link href="/dealer/leads">＋ Add Lead</Link><Link href="/dealer/leads?view=appointments">View Follow-Ups</Link><Link href="/dealer/leads">Send Campaign</Link></div>
      </section>
    </div>
    <nav className="targetDealerMobile"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
  </main>;
}
