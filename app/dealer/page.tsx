"use client";

import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";

const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const ago=(v:any)=>{if(!v)return "";const ms=Date.now()-new Date(v).getTime();if(!Number.isFinite(ms))return "";const m=Math.max(0,Math.round(ms/60000));if(m<60)return `${m}m ago`;const h=Math.round(m/60);return h<24?`${h}h ago`:`${Math.round(h/24)}d ago`;};
const image=(v:any)=>v.image||v.primaryPhotoUrl||v.primaryPhoto||v.photo||v.imageUrl||"";

export default function DealerDashboard(){
  const[session,setSession]=useState<any>(null);
  const[crm,setCrm]=useState<any>({summary:{},leads:[]});
  const[inventory,setInventory]=useState<any[]>([]);
  const[username,setUsername]=useState("Dealer");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function load(){
    const s=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
    const sj=await s.json().catch(()=>({}));
    if(!s.ok||!sj?.authenticated){setSession(null);return;}
    setSession(sj);
    const [cr,ir]=await Promise.all([
      fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"}),
      fetch("/api/inventory",{cache:"no-store",credentials:"include"})
    ]);
    const [cj,ij]=await Promise.all([cr.json().catch(()=>({})),ir.json().catch(()=>({}))]);
    setCrm(cr.ok?cj:{summary:{},leads:[],error:cj?.error||`CRM ${cr.status}`});
    setInventory(ir.ok&&Array.isArray(ij?.items)?ij.items:[]);
    if(!ir.ok)setMessage(`Inventory connection: ${ij?.error||ir.status}`);
  }
  useEffect(()=>{load().catch(()=>setSession(null))},[]);

  async function signIn(e:FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setMessage("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({username:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok)throw Error(r.status===401?"Login or password is incorrect.":j?.error||"Sign-in failed.");
      await load();setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed.");}
    finally{setBusy(false)}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>{});setSession(null);setCrm({summary:{},leads:[]});setInventory([]);setPassword("");}

  if(!session?.authenticated)return <main className="dpLogin"><section className="dpLoginCard">
    <div className="dpLoginBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div>
    <span className="dpRed">WDCC</span><h1>Dealer Sign In</h1><p>Inventory, CRM, photos and vehicle management.</p>
    <form onSubmit={signIn}><label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required/></label><label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label><button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button></form>
    <div className="dpLoginMsg">{message}</div><small>Authorized dealer access. Passwords are case-sensitive.</small>
  </section><style jsx global>{css}</style></main>;

  const leads=Array.isArray(crm?.leads)?crm.leads:[];
  const published=inventory.filter(v=>String(v.status||"").toLowerCase()==="published").length;
  const drafts=inventory.filter(v=>String(v.status||"").toLowerCase()==="draft").length;
  const sold=inventory.filter(v=>["sold","archived"].includes(String(v.status||"").toLowerCase())).length;
  const appointments=leads.filter((l:any)=>String(l.pipelineStage||l.status||"").toLowerCase()==="appointment").length;
  const applications=leads.filter((l:any)=>["application","deal_working","approved"].includes(String(l.pipelineStage||l.status||"").toLowerCase())||String(l.kind||"").toLowerCase().includes("application")).length;
  const unread=Number(crm?.summary?.unreadMessages||crm?.summary?.messages||0);
  const total=Math.max(1,inventory.length);
  const pubPct=Math.round(published/total*100);const draftPct=Math.round(drafts/total*100);const soldPct=Math.max(0,100-pubPct-draftPct);
  const recentVehicles=[...inventory].sort((a,b)=>new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime()).slice(0,5);
  const recentLeads=[...leads].sort((a:any,b:any)=>new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime()).slice(0,5);

  return <main className="dpApp"><aside className="dpSide">
    <Link className="dpBrand" href="/dealer"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></Link>
    <nav><Link className="active" href="/dealer">⌂ Dashboard</Link><strong>INVENTORY</strong><Link href="/dealer/inventory">All Vehicles</Link><Link href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
  </aside><section className="dpWork">
    <header className="dpTop"><div><img src="/wdcc-logo-transparent.webp" alt=""/><span><b>WDCC · DEALER PORTAL</b><small>Inventory Operations</small></span></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span><button onClick={logout}>Sign Out</button></header>
    <div className="dpCanvas"><div className="dpTitle"><div><h1>Dashboard</h1><p>Overview of your inventory and operations.</p></div><span>LIVE DATA</span></div>
    {(message||crm?.error)&&<div className="dpNotice">{message||crm.error}</div>}
    <div className="dpMetrics"><Metric n={inventory.length} label="Total Vehicles"/><Metric n={published} label="Published" tone="green"/><Metric n={drafts} label="Drafts"/><Metric n={sold} label="Sold"/><Metric n={leads.length} label="Leads" tone="red"/><Metric n={appointments} label="Appointments" tone="blue"/></div>
    <div className="dpMainGrid"><section className="dpCard"><div className="dpCardHead"><b>Inventory Overview</b></div><div className="dpInventoryOverview"><div className="dpDonut" style={{background:`conic-gradient(#22a25a 0 ${pubPct}%,#e5a120 ${pubPct}% ${pubPct+draftPct}%,#89939d ${pubPct+draftPct}% 100%)`}}><i/></div><div><p><span className="greenDot"/>Published <b>{published} ({pubPct}%)</b></p><p><span className="amberDot"/>Drafts <b>{drafts} ({draftPct}%)</b></p><p><span className="grayDot"/>Sold / Archived <b>{sold} ({soldPct}%)</b></p></div></div></section>
      <section className="dpCard"><div className="dpCardHead"><b>Recent Vehicles</b><Link href="/dealer/inventory">View All</Link></div><div className="dpVehicles">{recentVehicles.map(v=><div key={v.id}><div className="dpThumb">{image(v)?<img src={image(v)} alt=""/>:<span>WDCC</span>}</div><span><b>{v.year} {v.make} {v.model} {v.trim||""}</b><small>{money(v.price)}</small></span><em className={String(v.status).toLowerCase()}>{String(v.status||"draft")}</em></div>)}{!recentVehicles.length&&<small>No inventory yet.</small>}</div></section>
      <section className="dpCard dpActivity"><div className="dpCardHead"><b>Recent Activity</b></div>{recentLeads.map((l:any)=><div key={l.id}><span><b>{l.name||"New lead"}</b><small>{l.vehicleInterest||l.source||"Website"}</small></span><em>{ago(l.updatedAt||l.createdAt)}</em></div>)}{!recentLeads.length&&<small>No recent activity.</small>}</section></div>
    <div className="dpOps"><OpCard title="Leads" n={leads.length} sub="New customer opportunities" href="/dealer/leads" c="red"/><OpCard title="Appointments" n={appointments} sub="Upcoming" href="/dealer/leads" c="blue"/><OpCard title="Applications" n={applications} sub="Pending / in progress" href="/dealer/leads" c="blue"/><OpCard title="Messages" n={unread} sub="Unread" href="/dealer/leads" c="blue"/></div>
    </div><nav className="dpBottom"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>Menu</span></Link></nav>
  </section><style jsx global>{css}</style></main>;
}
function Metric({n,label,tone=""}:{n:number,label:string,tone?:string}){return <article className={`dpMetric ${tone}`}><strong>{n}</strong><span>{label}</span></article>}
function OpCard({title,n,sub,href,c}:{title:string,n:number,sub:string,href:string,c:string}){return <article className="dpOp"><header><b>{title}</b><i className={c}>○</i></header><strong>{n}</strong><span>{sub}</span><Link href={href}>View {title}</Link></article>}

const css=`
*{box-sizing:border-box}.dpLogin{min-height:100svh;background:radial-gradient(circle at 70% 5%,#10263a,#06111c 42%,#02060b 82%);display:grid;place-items:center;padding:22px;color:#fff;font-family:Inter,system-ui,sans-serif}.dpLoginCard{width:min(590px,100%);background:#0a1622;border:1px solid #294057;border-radius:20px;padding:36px;box-shadow:0 38px 90px #0009}.dpLoginBrand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.dpLoginBrand img{width:88px}.dpLoginBrand b,.dpLoginBrand span{display:block}.dpLoginBrand span{font-size:10px;color:#8ba0b4}.dpRed{color:#ef233c;font-weight:950;letter-spacing:.12em}.dpLoginCard h1{font-size:40px;margin:5px 0}.dpLoginCard>p{color:#98a8b8;margin:0 0 24px}.dpLoginCard form{display:grid;gap:14px}.dpLoginCard label{display:grid;gap:7px;font-size:11px;font-weight:900;color:#c7d1da}.dpLoginCard input{height:59px;border:1px solid #486078;border-radius:10px;background:#f2f6fc;color:#111;padding:0 16px;font-size:19px}.dpLoginCard button{height:58px;border:0;border-radius:10px;background:#ed1c2e;color:#fff;font-weight:950;font-size:17px}.dpLoginMsg{min-height:24px;color:#ffb4bc;margin-top:11px}.dpLoginCard small{display:block;background:#06111a;border-radius:10px;padding:14px;color:#9dafbf}.dpApp{min-height:100svh;display:grid;grid-template-columns:190px minmax(0,1fr);background:#071522;font-family:Inter,system-ui,sans-serif;color:#111820}.dpSide{background:#06131f;color:#cad3db;border-right:1px solid #213447;padding:12px 10px;min-height:100svh}.dpBrand{display:flex;align-items:center;gap:8px;padding:4px 4px 15px;border-bottom:1px solid #1d3347}.dpBrand img{width:58px}.dpBrand b,.dpBrand span{display:block}.dpBrand b{font-size:9px;color:#fff}.dpBrand span{font-size:7px;color:#8fa0b0}.dpSide nav{display:grid;padding-top:11px}.dpSide nav strong{font-size:8px;color:#fff;padding:14px 8px 7px}.dpSide nav a{font-size:9px;padding:9px 8px;border-radius:4px}.dpSide nav a.active,.dpSide nav a:hover{background:#ed1c2e;color:#fff}.dpWork{min-width:0}.dpTop{height:68px;background:#06111c;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:19px;align-items:center;padding:0 20px}.dpTop>div{display:flex;align-items:center;gap:8px}.dpTop img{width:50px}.dpTop b,.dpTop small{display:block}.dpTop b{font-size:9px}.dpTop small{font-size:7px;color:#91a2b2}.dpTop>a{border:1px solid #795627;color:#e6b35e;border-radius:5px;padding:9px 13px;font-size:9px;font-weight:900}.dpTop>span{font-size:8px}.dpTop>button{background:transparent;color:#fff;border:1px solid #3a4d5e;border-radius:5px;padding:9px 13px}.dpCanvas{background:#f5f6f7;min-height:calc(100svh - 68px);padding:20px}.dpTitle{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.dpTitle h1{font-size:22px;margin:0}.dpTitle p{font-size:9px;color:#697683;margin:3px 0 0}.dpTitle>span{font-size:8px;font-weight:900;color:#198754;background:#e9f6ed;border-radius:999px;padding:7px 10px}.dpNotice{background:#fff4da;border:1px solid #e4cc8b;color:#735414;padding:10px 12px;border-radius:6px;font-size:10px;margin-bottom:11px}.dpMetrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:12px}.dpMetric{background:#fff;border:1px solid #dce1e6;border-radius:7px;padding:14px;text-align:center}.dpMetric strong{display:block;font-size:24px}.dpMetric span{font-size:8px;color:#5d6975}.dpMetric.green strong{color:#189452}.dpMetric.red strong{color:#ed1c2e}.dpMetric.blue strong{color:#1684dc}.dpMainGrid{display:grid;grid-template-columns:.9fr 1.25fr .7fr;gap:11px}.dpCard{background:#fff;border:1px solid #d9dfe5;border-radius:7px;padding:14px;min-height:240px}.dpCardHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.dpCardHead b{font-size:10px}.dpCardHead a{font-size:8px;color:#167bd4}.dpInventoryOverview{display:flex;align-items:center;gap:17px;padding-top:18px}.dpDonut{width:138px;height:138px;border-radius:50%;position:relative;flex:none}.dpDonut i{position:absolute;inset:31px;background:#fff;border-radius:50%}.dpInventoryOverview p{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;font-size:8px}.dpInventoryOverview p span{width:8px;height:8px;border-radius:50%}.greenDot{background:#22a25a}.amberDot{background:#e5a120}.grayDot{background:#89939d}.dpVehicles{display:grid}.dpVehicles>div{display:grid;grid-template-columns:42px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #edf0f2}.dpVehicles>div:first-child{border-top:0}.dpThumb{width:42px;height:30px;background:#0d1822;border-radius:4px;overflow:hidden;display:grid;place-items:center;color:#8999a7;font-size:6px}.dpThumb img{width:100%;height:100%;object-fit:cover}.dpVehicles b,.dpVehicles small{display:block}.dpVehicles b{font-size:8px}.dpVehicles small{font-size:8px;color:#4a5660;margin-top:2px}.dpVehicles em{font-size:7px;font-style:normal;text-transform:capitalize;color:#198754}.dpVehicles em.draft{color:#d58a00}.dpActivity>div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #edf0f2}.dpActivity>div:first-of-type{border-top:0}.dpActivity b,.dpActivity small{display:block}.dpActivity b{font-size:8px}.dpActivity small,.dpActivity em{font-size:7px;color:#6d7a86;font-style:normal}.dpOps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px}.dpOp{background:#fff;border:1px solid #d9dfe5;border-radius:7px;padding:14px}.dpOp header{display:flex;justify-content:space-between}.dpOp header b{font-size:9px}.dpOp i{font-style:normal}.dpOp i.red{color:#ed1c2e}.dpOp i.blue{color:#1684dc}.dpOp>strong{display:block;font-size:22px;margin-top:8px}.dpOp>span{display:block;font-size:8px;color:#687581;margin:3px 0 14px}.dpOp>a{display:block;text-align:center;border:1px solid #d5dce2;border-radius:4px;padding:8px;font-size:8px;font-weight:800}.dpBottom{display:none}@media(max-width:1000px){.dpMetrics{grid-template-columns:repeat(3,1fr)}.dpMainGrid{grid-template-columns:1fr 1fr}.dpActivity{grid-column:1/-1}}@media(max-width:760px){.dpApp{display:block}.dpSide{display:none}.dpTop{height:65px;grid-template-columns:1fr auto}.dpTop>a,.dpTop>span{display:none}.dpCanvas{padding:13px 13px 92px}.dpMetrics{grid-template-columns:repeat(2,1fr);gap:7px}.dpMetric{padding:12px}.dpMainGrid{grid-template-columns:1fr}.dpActivity{grid-column:auto}.dpOps{grid-template-columns:1fr 1fr}.dpInventoryOverview{justify-content:center}.dpBottom{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(5,1fr);background:#06111c;border-top:1px solid #2a3e50;padding:7px 4px 9px}.dpBottom a{display:grid;place-items:center;gap:2px;color:#a9b7c3;font-size:18px}.dpBottom a span{font-size:7px}.dpBottom a.active{color:#ed1c2e}.dpBottom .add{width:52px;height:52px;border-radius:50%;background:#ed1c2e;color:#fff;justify-self:center;margin-top:-24px}.dpBottom .add span{position:absolute;margin-top:68px;color:#fff}.dpTitle h1{font-size:20px}}
`;
