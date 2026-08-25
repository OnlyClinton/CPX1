"use client";

import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";

const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const age=(v:any)=>{if(!v)return "";const ms=Date.now()-new Date(v).getTime();if(!Number.isFinite(ms))return "";const m=Math.max(0,Math.round(ms/60000));if(m<60)return `${m}m ago`;const h=Math.round(m/60);if(h<24)return `${h}h ago`;return `${Math.round(h/24)}d ago`;};
const sourceName=(v:any)=>String(v||"Website").replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function DealerDashboard(){
  const[session,setSession]=useState<any>(null);
  const[data,setData]=useState<any>(null);
  const[username,setUsername]=useState("Dealer");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function load(){
    const s=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
    const sj=await s.json().catch(()=>({}));
    if(!s.ok||!sj?.authenticated){setSession(null);return;}
    setSession(sj);
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    setData(r.ok?j:{summary:{},leads:[],inventory:[],error:j?.error||`Dashboard ${r.status}`});
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
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>{});setSession(null);setData(null);setPassword("");}

  if(!session?.authenticated)return <main className="dealerLoginPage">
    <section className="dealerLoginCard">
      <div className="loginWordmark"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC</b><span>DEALER PORTAL</span></div></div>
      <span className="redKicker">WDCC</span><h1>Dealer Sign In</h1><p>Inventory, photos and vehicle management.</p>
      <form onSubmit={signIn}><label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required/></label><label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label><button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button></form>
      <div className="loginMessage" role="status">{message}</div><small>Authorized dealer access. Usernames are case-insensitive; passwords are case-sensitive.</small>
    </section><style jsx global>{css}</style>
  </main>;

  const summary=data?.summary||{};
  const leads=Array.isArray(data?.leads)?data.leads:[];
  const inventory=Array.isArray(data?.inventory)?data.inventory:[];
  const newLeads=Number(summary.newToday??leads.filter((x:any)=>String(x.pipelineStage||x.status||"new").toLowerCase()==="new").length);
  const applications=Number(summary.applications??leads.filter((x:any)=>["application","deal_working"].includes(String(x.pipelineStage||"").toLowerCase())).length);
  const approved=Number(summary.approved??leads.filter((x:any)=>String(x.pipelineStage||"").toLowerCase()==="approved").length);
  const sold=Number(summary.sold??leads.filter((x:any)=>String(x.pipelineStage||"").toLowerCase()==="sold").length);
  const sources=useMemo(()=>{const map=new Map<string,number>();for(const l of leads){const key=sourceName(l.source);map.set(key,(map.get(key)||0)+1)}return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)},[leads]);
  const totalSources=Math.max(1,sources.reduce((n,[,v])=>n+v,0));
  const topVehicles=[...inventory].sort((a:any,b:any)=>Number(b.views||b.leads||0)-Number(a.views||a.leads||0)).slice(0,5);
  const recent=[...leads].sort((a:any,b:any)=>new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime()).slice(0,5);

  return <main className="dealerApp"><aside className="dealerSide">
    <Link className="dealerBrand" href="/dealer"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>INVENTORY OPERATIONS</span></div></Link>
    <nav><Link className="active" href="/dealer">⌂ Dashboard</Link><strong>INVENTORY</strong><Link href="/dealer/inventory">All Vehicles</Link><Link href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
    <div className="sidePromo"><b>BAD CREDIT?</b><b>NO CREDIT?</b><strong>WE DON'T CARE.</strong><img src="/wdcc-hero-v2.webp" alt=""/><Link href="/dealer/inventory/new">ADD VEHICLE →</Link></div>
  </aside><section className="dealerWorkspace">
    <header className="dealerTop"><div className="topIdentity"><img src="/wdcc-logo-transparent.webp" alt=""/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span><button onClick={logout}>Sign Out</button></header>
    <div className="dashboardWrap"><div className="dashboardTitle"><h1>Dashboard</h1><button>May 24 – May 30, 2025 ▾</button></div>
    {data?.error&&<div className="dashboardNotice">Signed in. Dashboard data is still reconnecting: {data.error}</div>}
    <div className="metricGrid"><Metric label="New Leads" value={newLeads}/><Metric label="Applications" value={applications}/><Metric label="Approved" value={approved}/><Metric label="Sold This Week" value={sold}/></div>
    <div className="dashboardGrid"><section className="dashCard chartCard"><div className="cardHead"><b>LEADS OVERVIEW</b><span>● New Leads&nbsp;&nbsp; ● Approved</span></div><svg viewBox="0 0 600 210" role="img" aria-label="Lead trend"><g stroke="#203246" strokeWidth="1"><path d="M40 35H570M40 85H570M40 135H570M40 185H570"/></g><polyline fill="none" stroke="#1677ff" strokeWidth="5" points="45,165 125,95 205,125 285,65 365,125 445,80 565,105"/><polyline fill="none" stroke="#ed1c2e" strokeWidth="5" points="45,180 125,135 205,155 285,105 365,150 445,115 565,135"/></svg><div className="days">Mon Tue Wed Thu Fri Sat Sun</div></section>
      <section className="dashCard sourceCard"><div className="cardHead"><b>LEADS BY SOURCE</b></div><div className="donutRow"><div className="donut"><span>Total<strong>{leads.length}</strong></span></div><div className="sourceList">{sources.length?sources.map(([k,v],i)=><div key={k}><i className={`dot d${i}`}/><span>{k}</span><b>{Math.round(v/totalSources*100)}%</b></div>):<small>No source data yet.</small>}</div></div></section>
      <section className="dashCard"><div className="cardHead"><b>TOP PERFORMING VEHICLES</b><Link href="/dealer/inventory">VIEW INVENTORY →</Link></div><div className="vehicleRows">{topVehicles.map((v:any)=><div key={v.id}><span>{v.year} {v.make} {v.model} {v.trim||""}</span><b>{Number(v.views||0)}</b><b>{Number(v.leads||0)}</b><em>{String(v.status||"available").toUpperCase()}</em></div>)}{!topVehicles.length&&<small>No inventory performance yet.</small>}</div></section>
      <section className="dashCard"><div className="cardHead"><b>RECENT ACTIVITY</b><Link href="/dealer/leads">VIEW ALL →</Link></div><div className="activityRows">{recent.map((l:any)=><div key={l.id}><i>◉</i><span><b>{l.name||"New lead"}</b><small>{l.vehicleInterest||sourceName(l.source)}</small></span><em>{age(l.updatedAt||l.createdAt)}</em></div>)}{!recent.length&&<small>No recent activity yet.</small>}</div></section></div>
    <div className="quickActions"><Link href="/dealer/inventory/new">＋ ADD VEHICLE</Link><Link href="/dealer/leads">＋ ADD LEAD</Link><Link href="/dealer/leads">☷ VIEW FOLLOW-UPS</Link><Link href="/dealer/leads">✈ SEND CAMPAIGN</Link></div>
    </div><nav className="dealerBottom"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="bigAdd" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
  </section><style jsx global>{css}</style></main>;
}

function Metric({label,value}:{label:string,value:number}){return <article className="metric"><div><span>{label}</span><strong>{Number.isFinite(value)?value:0}</strong></div><em>↑ live</em></article>}

const css=`
*{box-sizing:border-box}.dealerLoginPage{min-height:100svh;background:radial-gradient(circle at 70% 5%,#10263a,#06111c 42%,#02060b 82%);display:grid;place-items:center;padding:24px;color:#fff;font-family:Inter,system-ui,sans-serif}.dealerLoginCard{width:min(600px,100%);background:#0a1622;border:1px solid #294057;border-radius:22px;padding:38px;box-shadow:0 40px 100px #0008}.loginWordmark{display:flex;align-items:center;gap:12px;margin-bottom:30px}.loginWordmark img{width:88px}.loginWordmark b,.loginWordmark span{display:block}.loginWordmark span{font-size:10px;color:#8ba0b4}.redKicker{color:#ef233c;font-size:14px;font-weight:950;letter-spacing:.12em}.dealerLoginCard h1{font-size:42px;margin:5px 0 4px;letter-spacing:-.04em}.dealerLoginCard>p{margin:0 0 25px;color:#97a8b8;font-size:18px}.dealerLoginCard form{display:grid;gap:15px}.dealerLoginCard label{font-size:12px;color:#c4d0db;font-weight:900;display:grid;gap:8px}.dealerLoginCard input{height:64px;border:1px solid #496078;border-radius:12px;background:#f1f5fb;color:#111;font-size:20px;padding:0 18px}.dealerLoginCard button{height:64px;border:0;border-radius:12px;background:#ed1c2e;color:#fff;font-size:18px;font-weight:950}.loginMessage{min-height:25px;color:#ffb4bc;margin-top:12px}.dealerLoginCard small{display:block;background:#07111a;border-radius:12px;padding:16px;color:#9fb0c0;line-height:1.5}
.dealerApp{min-height:100svh;background:#07111b;color:#fff;display:grid;grid-template-columns:200px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.dealerSide{background:#06111c;border-right:1px solid #183047;min-height:100svh;padding:14px 10px;display:flex;flex-direction:column}.dealerBrand{display:flex;gap:9px;align-items:center;padding:4px 4px 17px;border-bottom:1px solid #1d3347}.dealerBrand img{width:62px}.dealerBrand b,.dealerBrand span{display:block}.dealerBrand b{font-size:10px}.dealerBrand span{font-size:7px;color:#8fa0b0;margin-top:3px}.dealerSide nav{display:grid;padding-top:12px}.dealerSide nav strong{font-size:8px;letter-spacing:.08em;padding:15px 8px 7px;color:#fff}.dealerSide nav a{padding:10px 9px;border-radius:4px;font-size:9px;color:#c1ccd6}.dealerSide nav a:hover,.dealerSide nav a.active{background:#ed1c2e;color:#fff}.sidePromo{margin-top:auto;background:#081725;border:1px solid #1d384f;border-radius:8px;padding:12px;overflow:hidden}.sidePromo>b{display:block;font-size:11px;color:#ed1c2e}.sidePromo>b:nth-child(2){color:#1989ff}.sidePromo>strong{display:block;font-size:12px;margin-bottom:8px}.sidePromo img{width:100%;height:100px;object-fit:cover;border-radius:5px}.sidePromo a{display:block;text-align:center;background:#ed1c2e;border-radius:4px;padding:8px;margin-top:8px;font-size:8px;font-weight:900}.dealerWorkspace{min-width:0}.dealerTop{height:72px;background:#040a11;border-bottom:1px solid #1b2d3c;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:22px;padding:0 22px}.topIdentity{display:flex;align-items:center;gap:9px}.topIdentity img{width:52px;height:42px;object-fit:contain}.topIdentity b,.topIdentity span{display:block}.topIdentity b{font-size:10px}.topIdentity span{color:#8799aa;font-size:8px}.dealerTop>a{border:1px solid #7a2a2d;padding:10px 14px;border-radius:4px;color:#ff626c;font-size:10px;font-weight:900}.dealerTop>span{font-size:9px;color:#c5d0da}.dealerTop>button{background:#07111b;color:#fff;border:1px solid #3a4a59;border-radius:5px;padding:10px 15px;font-size:9px}.dashboardWrap{background:#071420;min-height:calc(100svh - 72px);padding:22px}.dashboardTitle{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}.dashboardTitle h1{font-size:26px;margin:0}.dashboardTitle button{background:#0e1b28;color:#cbd6e0;border:1px solid #30455a;border-radius:5px;padding:10px 14px;font-size:9px}.dashboardNotice{background:#49360d;border:1px solid #836519;color:#ffe8a7;padding:10px 12px;border-radius:6px;margin-bottom:12px;font-size:10px}.metricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.metric,.dashCard{background:#0c1a27;border:1px solid #21374b;border-radius:6px;box-shadow:0 8px 30px #0002}.metric{padding:17px;display:flex;justify-content:space-between;align-items:end}.metric span{display:block;color:#9badbd;font-size:9px}.metric strong{display:block;font-size:29px;margin-top:3px}.metric em{font-style:normal;color:#24d15f;font-size:9px}.dashboardGrid{display:grid;grid-template-columns:1.25fr 1fr;gap:12px}.dashCard{padding:15px;min-height:240px}.cardHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.cardHead>b{font-size:10px}.cardHead span,.cardHead a{font-size:8px;color:#95a8b8}.chartCard svg{width:100%;height:165px}.days{word-spacing:37px;color:#74889b;font-size:8px;text-align:center}.donutRow{display:flex;align-items:center;gap:22px;padding-top:10px}.donut{width:150px;height:150px;border-radius:50%;background:conic-gradient(#1677ff 0 46%,#ed1c2e 46% 70%,#1fb968 70% 88%,#ff9e18 88%);position:relative}.donut:after{content:"";position:absolute;inset:34px;background:#0c1a27;border-radius:50%}.donut span{position:absolute;inset:0;display:grid;place-content:center;z-index:1;text-align:center;font-size:9px;color:#99aabb}.donut strong{display:block;color:#fff;font-size:27px}.sourceList{flex:1;display:grid;gap:10px}.sourceList>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;font-size:9px}.dot{width:8px;height:8px;border-radius:50%;background:#1677ff}.d1{background:#ed1c2e}.d2{background:#1fb968}.d3{background:#ff9e18}.vehicleRows>div{display:grid;grid-template-columns:minmax(0,1fr) 50px 45px 75px;gap:8px;align-items:center;padding:10px 0;border-top:1px solid #1c3041;font-size:9px}.vehicleRows>div:first-child{border-top:0}.vehicleRows em{font-style:normal;color:#30c36b;background:#103323;padding:5px 7px;border-radius:999px;font-size:7px;text-align:center}.activityRows>div{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:10px 0;border-top:1px solid #1c3041}.activityRows>div:first-child{border-top:0}.activityRows i{font-style:normal;color:#a7b7c5}.activityRows span b,.activityRows span small{display:block}.activityRows span b{font-size:9px}.activityRows span small,.activityRows em{font-size:8px;color:#8598a8;font-style:normal}.quickActions{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:12px}.quickActions a{background:#1267e9;border-radius:4px;padding:14px;text-align:center;font-size:9px;font-weight:900}.dealerBottom{display:none}
@media(max-width:860px){.dealerApp{display:block}.dealerSide{display:none}.dealerTop{height:66px;grid-template-columns:1fr auto}.dealerTop>span,.dealerTop>a{display:none}.dashboardWrap{padding:14px;padding-bottom:94px}.metricGrid{grid-template-columns:1fr 1fr}.dashboardGrid{grid-template-columns:1fr}.quickActions{grid-template-columns:1fr 1fr}.dealerBottom{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;background:#05101a;border-top:1px solid #263a4b;z-index:50;padding:7px 4px 9px}.dealerBottom a{display:grid;place-items:center;gap:2px;font-size:18px;color:#a8b7c4}.dealerBottom a span{font-size:7px}.dealerBottom a.active{color:#ed1c2e}.dealerBottom .bigAdd{width:56px;height:56px;background:#ed1c2e;border-radius:50%;color:#fff;justify-self:center;margin-top:-25px;font-size:28px}.dealerBottom .bigAdd span{position:absolute;margin-top:76px;color:#fff}.days{word-spacing:18px}.donutRow{gap:14px}.donut{width:130px;height:130px}.metric strong{font-size:25px}}
@media(max-width:520px){.dealerLoginCard{padding:26px}.dealerLoginCard h1{font-size:38px}.metricGrid{gap:7px}.metric{padding:13px}.metric strong{font-size:23px}.dashboardTitle button{font-size:8px;padding:8px}.quickActions{grid-template-columns:1fr 1fr}.chartCard svg{height:145px}}
`;
