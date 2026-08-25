"use client";

import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";

type Lead=Record<string,any>;
type Vehicle=Record<string,any>;
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const sourceName=(lead:Lead)=>String(lead.source||lead.sourceName||lead.utmSource||lead.kind||"Website").trim()||"Website";
const vehicleName=(v:Vehicle)=>`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""}`.replace(/\s+/g," ").trim()||"Vehicle";

export default function DealerDashboard(){
  const[session,setSession]=useState<any>(null);
  const[data,setData]=useState<any>(null);
  const[username,setUsername]=useState("Dealer");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function loadDashboard(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    setData(r.ok?j:{summary:{},leads:[],inventory:[],error:j?.error||`Dashboard ${r.status}`});
  }
  async function loadSession(){
    const r=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(j?.authenticated){setSession(j);await loadDashboard();}else setSession(null);
  }
  useEffect(()=>{loadSession().catch(()=>setSession(null))},[]);

  async function login(e:FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setMessage("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({username:username.trim(),email:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok)throw Error(r.status===401?"Login or password is incorrect.":j?.error||"Sign-in failed.");
      await loadSession();setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed.");}
    finally{setBusy(false)}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include",cache:"no-store"}).catch(()=>{});setSession(null);setData(null);setPassword("");}

  if(!session?.authenticated)return <main className="dealerLoginPage">
    <form className="dealerLoginCard" onSubmit={login}>
      <div className="dealerLoginBrand"><span>WDCC</span><h1>Dealer Sign In</h1><p>Inventory, leads and vehicle operations.</p></div>
      <label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required/></label>
      <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
      <button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button>
      {message&&<div className="dealerLoginError">{message}</div>}
      <div className="dealerLoginHint">Usernames are case-insensitive. Passwords are case-sensitive.</div>
    </form>
    <style jsx global>{loginCss}</style>
  </main>;

  const summary=data?.summary||{};
  const leads:Lead[]=Array.isArray(data?.leads)?data.leads:[];
  const inventory:Vehicle[]=Array.isArray(data?.inventory)?data.inventory:[];
  const totalVehicles=inventory.length||num(summary.totalVehicles);
  const published=inventory.filter(v=>String(v.status||"").toLowerCase()==="published").length||num(summary.published);
  const drafts=inventory.filter(v=>String(v.status||"").toLowerCase()==="draft").length||num(summary.drafts);
  const sold=inventory.filter(v=>String(v.status||"").toLowerCase()==="sold").length||num(summary.sold);
  const newLeads=num(summary.newToday||summary.newLeads||summary.totalLeads||leads.length);
  const appointments=num(summary.appointments||leads.filter(l=>/appointment|test.?drive/i.test(String(l.kind||l.type||l.pipelineStage||""))).length);
  const applications=num(summary.applications||leads.filter(l=>/application|pre.?approv/i.test(String(l.kind||l.type||""))).length);
  const messages=num(summary.messages||summary.unreadMessages||0);
  const recentVehicles=inventory.slice(0,5);
  const sourceCounts=useMemo(()=>{
    const m=new Map<string,number>();for(const lead of leads){const k=sourceName(lead);m.set(k,(m.get(k)||0)+1)}
    const rows=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);if(!rows.length)return [["Website",46],["Phone",24],["Walk-in",18],["Referral",12]] as [string,number][];
    const total=rows.reduce((s,r)=>s+r[1],0)||1;return rows.map(([k,v])=>[k,Math.round(v/total*100)] as [string,number]);
  },[leads]);
  const invTotal=Math.max(totalVehicles,1),pubPct=Math.round(published/invTotal*100),draftPct=Math.round(drafts/invTotal*100),soldPct=Math.max(0,100-pubPct-draftPct);
  const invGradient=`conic-gradient(#28a36a 0 ${pubPct}%,#f1b84b ${pubPct}% ${Math.min(pubPct+draftPct,100)}%,#94a3b8 ${Math.min(pubPct+draftPct,100)}% 100%)`;

  return <main className="dealerOps">
    <header className="dealerTop">
      <div className="dealerBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div>
      <a className="dealerPhone" href="tel:18135164752">☎ (813) 516-4752</a><span className="manager">Sean · Sales Manager</span><button className="signOut" onClick={logout}>Sign Out</button>
    </header>
    <div className="dealerFrame">
      <aside className="dealerSide">
        <nav><Link className="active" href="/dealer">⌂ <span>Dashboard</span></Link><strong>INVENTORY</strong><Link href="/dealer/inventory">▣ <span>All Vehicles</span></Link><Link href="/dealer/inventory/new">＋ <span>Add / Edit Vehicle</span></Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
        <div className="dealerHelp"><small>NEED HELP?</small><span>Call Sean anytime.</span><a href="tel:18135164752">813-516-4752</a></div>
      </aside>
      <section className="dealerMain">
        <div className="titleRow"><div><h1>Dashboard</h1><p>Overview of your inventory and operations.</p></div><div className="titleActions"><Link className="primaryAction" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link className="textAction" href="/dealer/inventory">View inventory →</Link></div></div>
        {data?.error&&<div className="notice">Signed in. Some dashboard data is unavailable: {data.error}</div>}
        <div className="statGrid">
          <article><span>Total Vehicles</span><b>{totalVehicles}</b></article><article><span>Published</span><b className="green">{published}</b></article><article><span>Drafts</span><b>{drafts}</b></article><article><span>Sold</span><b>{sold}</b></article><article><span>Leads</span><b className="red">{newLeads}</b></article><article><span>Appointments</span><b className="blue">{appointments}</b></article>
        </div>
        <div className="overviewGrid">
          <section className="panel"><header><div><h2>Inventory Overview</h2><p>Current listing mix.</p></div></header><div className="inventoryOverview"><div className="donut" style={{background:invGradient}}><span><b>{totalVehicles}</b><small>Total</small></span></div><div className="legend"><div><i className="lgPub"/><span>Published</span><b>{published} ({pubPct}%)</b></div><div><i className="lgDraft"/><span>Drafts</span><b>{drafts} ({draftPct}%)</b></div><div><i className="lgSold"/><span>Sold</span><b>{sold} ({soldPct}%)</b></div></div></div></section>
          <section className="panel"><header><div><h2>Recent Vehicles</h2><p>Latest inventory activity.</p></div><Link href="/dealer/inventory">View all</Link></header><div className="recentList">{recentVehicles.length?recentVehicles.map((v,i)=><div key={v.id||i}><div className="vehicleThumb">{(v.primaryImageUrl||v.primary_image_url||v.image)?<img src={v.primaryImageUrl||v.primary_image_url||v.image} alt=""/>:<span>CAR</span>}</div><strong>{vehicleName(v)}</strong><b>${num(v.price).toLocaleString()}</b><em className={String(v.status||"").toLowerCase()==="published"?"published":"draft"}>{String(v.status||"draft")}</em></div>):<p className="empty">No vehicles yet.</p>}</div></section>
          <section className="panel activity"><header><div><h2>Recent Activity</h2><p>Dealer-side events.</p></div></header><div className="activityList">{leads.slice(0,5).map((l,i)=><div key={l.id||i}><i>•</i><span><b>{l.name||l.customerName||"New lead"}</b><small>{l.vehicleInterest||l.kind||l.status||"Customer activity"}</small></span></div>)}{!leads.length&&<p className="empty">No recent activity.</p>}</div></section>
        </div>
        <div className="opsCards">
          <Link href="/dealer/leads"><span>Leads</span><b>{newLeads}</b><small>New leads</small></Link><Link href="/dealer/leads"><span>Appointments</span><b>{appointments}</b><small>Upcoming</small></Link><Link href="/dealer/leads"><span>Applications</span><b>{applications}</b><small>Pending</small></Link><Link href="/dealer/leads"><span>Messages</span><b>{messages}</b><small>Unread</small></Link>
        </div>
      </section>
    </div>
    <nav className="mobileNav"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
    <style jsx global>{dashboardCss}</style>
  </main>;
}

const loginCss=`
html,body{margin:0;background:#050b12}.dealerLoginPage{min-height:100svh;background:radial-gradient(circle at 50% 16%,#10283e 0,#07131f 42%,#02070c 78%);display:grid;place-items:center;padding:28px;font-family:Inter,system-ui,sans-serif}.dealerLoginCard{width:min(590px,100%);background:#0c1723;border:1px solid #2a4054;border-radius:22px;padding:36px;box-shadow:0 32px 90px #0009;color:#fff}.dealerLoginBrand>span{color:#ef233c;font-weight:950;letter-spacing:.13em}.dealerLoginBrand h1{font-size:42px;margin:8px 0 5px;letter-spacing:-.04em}.dealerLoginBrand p{color:#9eacba;margin:0 0 28px;font-size:18px}.dealerLoginCard label{display:grid;gap:9px;color:#c1ccd6;font-size:13px;font-weight:900;margin:18px 0}.dealerLoginCard input{height:70px;border:1px solid #536a80;border-radius:13px;background:#f4f7fb;color:#131820;font-size:24px;padding:0 18px;outline:none}.dealerLoginCard input:focus{border-color:#ef233c;box-shadow:0 0 0 3px #ef233c22}.dealerLoginCard>button{height:72px;width:100%;border:0;border-radius:12px;background:#ef233c;color:#fff;font-size:20px;font-weight:950;margin-top:12px}.dealerLoginError{color:#ffadb4;margin:15px 0 0;line-height:1.4}.dealerLoginHint{margin-top:20px;padding:16px 18px;background:#08131f;border-radius:12px;color:#a8b6c3;font-size:14px;line-height:1.55}@media(max-width:600px){.dealerLoginPage{padding:24px}.dealerLoginCard{padding:28px 20px}.dealerLoginBrand h1{font-size:34px}.dealerLoginCard input{height:62px;font-size:21px}.dealerLoginCard>button{height:62px}}
`;

const dashboardCss=`
*{box-sizing:border-box}html,body{margin:0;background:#f3f5f7;color:#111820}.dealerOps{min-height:100svh;font-family:Inter,system-ui,sans-serif;background:#f3f5f7;color:#111820}.dealerTop{height:72px;background:#06111c;color:#fff;border-bottom:1px solid #1d3348;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:18px;padding:0 24px;position:sticky;top:0;z-index:30}.dealerBrand{display:flex;align-items:center;gap:11px}.dealerBrand img{width:74px;height:50px;object-fit:contain}.dealerBrand b,.dealerBrand span{display:block}.dealerBrand b{font-size:13px}.dealerBrand span{font-size:10px;color:#9aabb9;margin-top:3px}.dealerPhone,.signOut{border:1px solid #36506a;border-radius:7px;padding:10px 14px;color:#fff;background:transparent;font:800 12px Inter,system-ui}.manager{font-size:12px;color:#d7dee5}.dealerFrame{display:grid;grid-template-columns:202px minmax(0,1fr);min-height:calc(100svh - 72px)}.dealerSide{background:#071522;color:#cbd5df;border-right:1px solid #1d3348;padding:14px 12px 18px;display:flex;flex-direction:column}.dealerSide nav{display:grid;gap:2px}.dealerSide nav strong{font-size:10px;color:#8fa1b1;letter-spacing:.08em;padding:16px 10px 7px}.dealerSide nav a{padding:10px 11px;border-radius:6px;font-size:12px;color:#dce5ec;text-decoration:none}.dealerSide nav a:hover{background:#102437}.dealerSide nav a.active{background:#ed1c2e;color:#fff;font-weight:900}.dealerHelp{margin-top:auto;border:1px solid #29435a;background:#0b1b2a;border-radius:9px;padding:13px}.dealerHelp small,.dealerHelp span,.dealerHelp a{display:block}.dealerHelp small{font-size:9px;color:#91a5b6}.dealerHelp span{font-size:11px;margin-top:5px}.dealerHelp a{color:#ff3a4a;font-weight:900;font-size:13px;margin-top:5px}.dealerMain{padding:28px;min-width:0}.titleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.titleRow h1{font-size:28px;letter-spacing:-.03em;margin:0}.titleRow p{color:#697682;margin:5px 0 0;font-size:13px}.titleActions{display:flex;align-items:center;gap:14px}.primaryAction{background:#ed1c2e;color:#fff!important;border-radius:7px;padding:12px 16px;font-size:12px;font-weight:900;text-decoration:none}.textAction{color:#243b53!important;font-size:12px;font-weight:800;text-decoration:none}.notice{background:#fff4d6;border:1px solid #f2d48a;color:#7b5a0b;border-radius:8px;padding:11px 13px;margin-bottom:16px;font-size:12px}.statGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:16px}.statGrid article{background:#fff;border:1px solid #dfe5ea;border-radius:8px;padding:16px;min-height:92px;box-shadow:0 3px 12px #1020300a}.statGrid span{display:block;color:#677581;font-size:11px}.statGrid b{display:block;font-size:26px;margin-top:9px}.statGrid .green{color:#239764}.statGrid .red{color:#df2536}.statGrid .blue{color:#1479d8}.overviewGrid{display:grid;grid-template-columns:1fr 1.25fr .78fr;gap:14px}.panel{background:#fff;border:1px solid #dfe5ea;border-radius:9px;padding:16px;min-width:0;box-shadow:0 3px 12px #1020300a}.panel header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding-bottom:13px;border-bottom:1px solid #edf0f2}.panel h2{font-size:14px;margin:0}.panel header p{font-size:10px;color:#7a8792;margin:4px 0 0}.panel header a{font-size:10px;font-weight:800;color:#1774bb;text-decoration:none}.inventoryOverview{display:flex;align-items:center;gap:20px;padding:22px 4px}.donut{width:132px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;position:relative}.donut:after{content:"";position:absolute;width:74px;aspect-ratio:1;border-radius:50%;background:#fff}.donut span{z-index:1;text-align:center}.donut b,.donut small{display:block}.donut b{font-size:24px}.donut small{font-size:10px;color:#7a8792}.legend{display:grid;gap:12px;flex:1}.legend div{display:grid;grid-template-columns:10px 1fr auto;gap:8px;align-items:center;font-size:11px}.legend i{width:9px;height:9px;border-radius:50%}.lgPub{background:#28a36a}.lgDraft{background:#f1b84b}.lgSold{background:#94a3b8}.recentList{display:grid}.recentList>div{display:grid;grid-template-columns:42px minmax(0,1fr) auto 74px;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid #eef1f3;font-size:10px}.vehicleThumb{width:42px;height:30px;border-radius:5px;overflow:hidden;background:#dfe5ea;display:grid;place-items:center;font-size:8px;font-weight:900;color:#73808c}.vehicleThumb img{width:100%;height:100%;object-fit:cover}.recentList strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recentList em{text-align:center;border-radius:999px;padding:4px 6px;font-style:normal;font-weight:800;text-transform:capitalize}.recentList em.published{background:#e7f6ee;color:#228253}.recentList em.draft{background:#fff3d6;color:#a46b00}.activityList{display:grid;gap:4px;padding-top:8px}.activityList>div{display:grid;grid-template-columns:10px 1fr;gap:8px;padding:9px 0;border-bottom:1px solid #eef1f3}.activityList i{color:#ed1c2e}.activityList b,.activityList small{display:block}.activityList b{font-size:10px}.activityList small{font-size:9px;color:#7a8792;margin-top:2px}.empty{color:#81909c;font-size:11px}.opsCards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.opsCards a{background:#fff;border:1px solid #dfe5ea;border-radius:9px;padding:15px;color:#111820;text-decoration:none;box-shadow:0 3px 12px #1020300a}.opsCards span,.opsCards b,.opsCards small{display:block}.opsCards span{font-size:11px;font-weight:900}.opsCards b{font-size:23px;margin:8px 0 3px}.opsCards small{font-size:9px;color:#74818c}.mobileNav{display:none}
@media(max-width:980px){.dealerTop{grid-template-columns:1fr auto;padding:0 16px}.manager,.signOut{display:none}.dealerPhone{font-size:0;padding:10px}.dealerPhone:before{content:"☎";font-size:18px}.dealerFrame{display:block}.dealerSide{display:none}.dealerMain{padding:18px 14px 84px}.titleRow{align-items:center}.titleActions .textAction{display:none}.statGrid{grid-template-columns:repeat(3,1fr)}.overviewGrid{grid-template-columns:1fr}.panel.activity{display:none}.opsCards{grid-template-columns:repeat(2,1fr)}.mobileNav{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;background:#06111c;border-top:1px solid #20374c;z-index:50}.mobileNav a{height:68px;color:#c9d5de;text-decoration:none;display:grid;place-items:center;align-content:center;gap:2px;font-size:17px}.mobileNav a span{font-size:9px}.mobileNav a.active{color:#ed1c2e}.mobileNav a.add{background:#ed1c2e;color:#fff}.dealerBrand img{width:54px}.dealerBrand b{font-size:11px}.dealerBrand span{font-size:8px}}
@media(max-width:600px){.dealerTop{height:64px}.dealerFrame{min-height:calc(100svh - 64px)}.dealerMain{padding:16px 12px 82px}.titleRow h1{font-size:24px}.titleRow p{font-size:11px}.primaryAction{padding:10px 12px;font-size:10px}.statGrid{gap:8px}.statGrid article{padding:12px;min-height:78px}.statGrid b{font-size:21px}.inventoryOverview{gap:14px;padding:18px 0}.donut{width:108px}.donut:after{width:62px}.recentList>div{grid-template-columns:38px minmax(0,1fr) auto}.recentList>div em{display:none}.opsCards{gap:8px}}
`;
