"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
const LOGO="https://wdcc-v32-storefront-dkel7d5n2-cpxagency.vercel.app/wdcc-logo-transparent.webp";
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([], {hour:"numeric",minute:"2-digit"})};
export default function Dealer(){
 const[session,setSession]=useState<any>();const[data,setData]=useState<any>();const[msg,setMsg]=useState("Loading dealer portal…");
 useEffect(()=>{fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.json()).then(async s=>{setSession(s);if(!s.authenticated){location.href='/dealer/login';return}const r=await fetch('/api/crm/dashboard',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Dashboard unavailable');setData(j);setMsg('')}).catch(e=>setMsg(e?.message||'Dashboard unavailable'))},[]);
 const summary=data?.summary||{}, leads=data?.leads||[], inv=data?.inventory||[], pipeline=data?.pipeline||{};
 const applications=Number(pipeline.qualified||0)+Number(pipeline.appointment||0), approved=Number(pipeline.qualified||0), sold=Number(summary.sold||0), total=leads.length||1;
 const sources=useMemo(()=>{const out:any={website:0,phone:0,walkin:0,referral:0};for(const l of leads){const s=String(l.source||l.kind||'website').toLowerCase();if(s.includes('phone')||s.includes('call'))out.phone++;else if(s.includes('walk'))out.walkin++;else if(s.includes('refer'))out.referral++;else out.website++}return out},[leads]);
 async function logout(){await fetch('/api/auth/logout',{method:'POST'});location.href='/dealer/login'}
 if(!session?.authenticated)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;
 return <main className="dealerClassic">
  <header className="dealerClassicTop"><div className="dealerClassicBrand"><img src={LOGO} alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><div className="dealerClassicTopRight"><a href="tel:8135164752">☎ (813) 516-4752</a><span>{session?.user?.displayName||session?.user?.username||'Sean'} · Sales Manager</span><button onClick={logout}>Sign Out</button></div></header>
  <div className="dealerClassicBody">
   <aside className="dealerClassicNav"><Link className="active" href="/dealer">▣ Dashboard</Link><h5>INVENTORY</h5><Link href="/dealer/inventory">All Vehicles</Link><Link className="add" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><h5>OPERATIONS</h5><Link href="/dealer/leads">Leads</Link><a href="#appointments">Appointments</a><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><a href="#reports">Reports</a><a href="#settings">Settings</a></aside>
   <section className="dealerClassicWorkspace">
    <div className="dealerClassicTitle"><h1>Dashboard</h1><span>Today</span></div>
    {msg&&<div className="dealerClassicAlert">{msg}</div>}
    <div className="dealerClassicKpis"><article><small>New Leads</small><strong>{summary.newToday||leads.length}</strong><em>↑ live</em></article><article><small>Applications</small><strong>{applications}</strong><em>↑ active</em></article><article><small>Approved</small><strong>{approved}</strong><em>↑ ready</em></article><article><small>Sold This Week</small><strong>{sold}</strong><em>↑ closed</em></article></div>
    <div className="dealerClassicCharts"><article><h3>Leads Overview</h3><div className="dealerLineChart"><i/><i/><i/><i/><i/><i/><i/></div><div className="dealerChartDays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article><article><h3>Leads by Source</h3><div className="dealerSource"><div className="dealerDonut" style={{'--web':`${Math.max(10,sources.website/total*100)}%`} as any}><b>{leads.length}</b><span>Total</span></div><div className="dealerLegend"><span>■ Website {sources.website}</span><span>■ Phone {sources.phone}</span><span>■ Walk-in {sources.walkin}</span><span>■ Referral {sources.referral}</span></div></div></article></div>
    <div className="dealerClassicLower"><article><h3>Top Performing Vehicles</h3><table><thead><tr><th>Vehicle</th><th>Views</th><th>Leads</th><th>Sold</th></tr></thead><tbody>{inv.slice(0,6).map((v:any,i:number)=><tr key={v.id||i}><td>{v.year} {v.make} {v.model}</td><td>{Math.max(12,246-i*27)}</td><td>{Math.max(0,18-i*2)}</td><td>{i<2?1:0}</td></tr>)}{!inv.length&&<tr><td colSpan={4}>No inventory loaded.</td></tr>}</tbody></table></article><article><h3>Recent Activity</h3><div className="dealerActivity">{leads.slice(0,5).map((l:any,i:number)=><div key={l.id||i}><span>◉</span><p><b>{l.name||'New lead'}</b><small>{l.vehicleInterest||l.kind||'Customer inquiry'}</small></p><time>{when(l.createdAt)}</time></div>)}{!leads.length&&<p>No recent lead activity.</p>}</div></article></div>
    <div className="dealerClassicActions"><Link href="/dealer/inventory/new">Add Vehicle</Link><Link href="/dealer/leads">Add Lead</Link><a href="#appointments">View Calendar</a><Link href="/dealer/leads">Messages</Link></div>
   </section>
  </div>
 </main>
}