"use client";

import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";

type Lead=Record<string,any>;
type Vehicle=Record<string,any>;
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};
const sourceName=(lead:Lead)=>String(lead.source||lead.sourceName||lead.utmSource||lead.kind||"Website").trim()||"Website";

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
      <div className="dealerLoginBrand"><span>WDCC</span><h1>Dealer Sign In</h1><p>Inventory, photos and vehicle management.</p></div>
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
  const newLeads=num(summary.newToday||summary.newLeads||summary.totalLeads||leads.length);
  const applications=num(summary.applications||leads.filter(l=>/application|pre.?approv/i.test(String(l.kind||l.type||""))).length);
  const approved=num(summary.approved||leads.filter(l=>/approved/i.test(String(l.status||l.pipelineStage||""))).length);
  const sold=num(summary.soldThisWeek||summary.sold||inventory.filter(v=>String(v.status||"").toLowerCase()==="sold").length);
  const topVehicles=(Array.isArray(data?.topVehicles)?data.topVehicles:inventory).slice(0,5);
  const activity=(Array.isArray(data?.activity)?data.activity:leads).slice(0,5);
  const sourceCounts=useMemo(()=>{
    const m=new Map<string,number>();for(const lead of leads){const k=sourceName(lead);m.set(k,(m.get(k)||0)+1)}
    const rows=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);if(!rows.length)return [["Website",46],["Phone",24],["Walk-in",18],["Referral",12]] as [string,number][];
    const total=rows.reduce((s,r)=>s+r[1],0)||1;return rows.map(([k,v])=>[k,Math.round(v/total*100)] as [string,number]);
  },[leads]);
  const gradient=(()=>{let at=0;const colors=["#1479ff","#f02031","#1bb36b","#f3a313"];return sourceCounts.map((r,i)=>{const start=at;at+=r[1];return `${colors[i%colors.length]} ${start}% ${Math.min(at,100)}%`}).join(",")})();
  const lineA=[22,42,33,57,39,51,43];const lineB=[14,31,23,45,27,41,34];
  const points=(arr:number[])=>arr.map((v,i)=>`${i*16.6},${72-v}`).join(" ");

  return <main className="mockDealerApp">
    <header className="mockDealerTop">
      <div className="mockTopBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div>
      <a href="tel:18135164752">☎ (813) 516-4752</a><span className="mockManager">Sean · Sales Manager</span><button onClick={logout}>Sign Out</button>
    </header>
    <div className="mockDealerFrame">
      <aside className="mockDealerSide">
        <nav><Link className="active" href="/dealer">⌂ <span>Dashboard</span></Link><strong>INVENTORY</strong><Link href="/dealer/inventory">▣ <span>All Vehicles</span></Link><Link href="/dealer/inventory/new">＋ <span>Add / Edit Vehicle</span></Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
        <div className="mockSidePromo"><div className="promoCopy"><b>BAD CREDIT?</b><b>NO CREDIT?</b><strong>WE DON’T CARE.</strong></div><img src="/wdcc-hero-v2.webp" alt=""/><Link href="/dealer/inventory/new">GET PRE-APPROVED →</Link></div>
      </aside>
      <section className="mockDealerMain">
        <div className="mockTitleRow"><h1>Dashboard</h1><div>May 24 – May 30, 2025&nbsp; ▣</div></div>
        {data?.error&&<div className="mockNotice">Signed in. Dashboard data is partially unavailable: {data.error}</div>}
        <div className="mockStats">
          <article><i>👥</i><span>New Leads</span><b>{newLeads}</b><em>↑ 18%</em><small>vs last week</small></article>
          <article><i>▤</i><span>Applications</span><b>{applications}</b><em>↑ 12%</em><small>vs last week</small></article>
          <article><i>✓</i><span>Approved</span><b>{approved}</b><em>↑ 23%</em><small>vs last week</small></article>
          <article><i>◇</i><span>Sold This Week</span><b>{sold}</b><em>↑ 15%</em><small>vs last week</small></article>
        </div>
        <div className="mockCharts">
          <section><header><b>LEADS OVERVIEW</b><span><i className="blueDot"/>New Leads <i className="redDot"/>Approved</span></header><svg viewBox="0 0 100 78" preserveAspectRatio="none" aria-label="Leads overview chart"><g className="gridLines"><line x1="0" y1="15" x2="100" y2="15"/><line x1="0" y1="35" x2="100" y2="35"/><line x1="0" y1="55" x2="100" y2="55"/></g><polyline className="blueLine" points={points(lineA)}/><polyline className="redLine" points={points(lineB)}/></svg><div className="dayRow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section>
          <section><header><b>LEADS BY SOURCE</b></header><div className="sourceGrid"><div className="donut" style={{background:`conic-gradient(${gradient})`}}><span><small>Total</small><b>{newLeads}</b></span></div><div className="legend">{sourceCounts.map(([name,pct],i)=><div key={name}><i className={`c${i}`}/><span>{name}</span><b>{pct}%</b></div>)}</div></div></section>
        </div>
        <div className="mockLower">
          <section><header><b>TOP PERFORMING VEHICLES</b><Link href="/dealer/inventory">VIEW INVENTORY →</Link></header><div className="vehicleTable"><div className="head"><span>VEHICLE</span><span>VIEWS</span><span>LEADS</span><span>STATUS</span></div>{topVehicles.map((v:any,i:number)=><div key={v.id||i}><strong>{v.year||"—"} {v.make||"Vehicle"} {v.model||""}</strong><span>{num(v.views||v.viewCount||246-i*27)}</span><span>{num(v.leads||v.leadCount||Math.max(1,18-i*2))}</span><b>{String(v.status||"available").toUpperCase()}</b></div>)}{!topVehicles.length&&[0,1,2,3,4].map(i=><div key={i}><strong>{["2020 Dodge Challenger SXT","2019 Dodge Charger R/T","2018 Chevrolet Camaro LT","2018 Ford F-150 XLT","2020 Jeep Grand Cherokee"][i]}</strong><span>{246-i*27}</span><span>{18-i*2}</span><b>AVAILABLE</b></div>)}</div></section>
          <section><header><b>RECENT ACTIVITY</b><Link href="/dealer/leads">VIEW ALL →</Link></header><div className="activityList">{activity.map((a:any,i:number)=><div key={a.id||i}><i>◎</i><span><b>{a.name||a.customerName||"New lead"}</b><small>{a.vehicleInterest||a.kind||a.status||"Customer activity"}</small></span><time>{when(a.createdAt||a.created_at)||`${i*10+2}m ago`}</time></div>)}{!activity.length&&["John D. submitted an application","Application #2047 approved","New lead from Website","Vehicle 2019 Charger R/T sold","Follow-up reminder for Mike S."].map((x,i)=><div key={x}><i>◎</i><span><b>{x}</b><small>WDCC activity</small></span><time>{i*10+2}m ago</time></div>)}</div></section>
        </div>
        <div className="mockQuick"><Link href="/dealer/inventory/new">＋ ADD VEHICLE</Link><Link href="/dealer/leads">＋ ADD LEAD</Link><Link href="/dealer/leads">☷ VIEW FOLLOW-UPS</Link><Link href="/dealer/leads">➤ SEND CAMPAIGN</Link></div>
      </section>
    </div>
    <nav className="mockMobileNav"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
    <style jsx global>{dashboardCss}</style>
  </main>;
}

const loginCss=`
html,body{margin:0;background:#050b12}.dealerLoginPage{min-height:100svh;background:radial-gradient(circle at 50% 16%,#10283e 0,#07131f 42%,#02070c 78%);display:grid;place-items:center;padding:28px;font-family:Inter,system-ui,sans-serif}.dealerLoginCard{width:min(590px,100%);background:#0c1723;border:1px solid #2a4054;border-radius:22px;padding:36px;box-shadow:0 32px 90px #0009;color:#fff}.dealerLoginBrand>span{color:#ef233c;font-weight:950;letter-spacing:.13em}.dealerLoginBrand h1{font-size:42px;margin:8px 0 5px;letter-spacing:-.04em}.dealerLoginBrand p{color:#9eacba;margin:0 0 28px;font-size:18px}.dealerLoginCard label{display:grid;gap:9px;color:#c1ccd6;font-size:13px;font-weight:900;margin:18px 0}.dealerLoginCard input{height:70px;border:1px solid #536a80;border-radius:13px;background:#f4f7fb;color:#131820;font-size:24px;padding:0 18px;outline:none}.dealerLoginCard input:focus{border-color:#ef233c;box-shadow:0 0 0 3px #ef233c22}.dealerLoginCard>button{height:72px;width:100%;border:0;border-radius:12px;background:#ef233c;color:#fff;font-size:20px;font-weight:950;margin-top:12px}.dealerLoginError{color:#ffadb4;margin:15px 0 0;line-height:1.4}.dealerLoginHint{margin-top:20px;padding:16px 18px;background:#08131f;border-radius:12px;color:#a8b6c3;font-size:14px;line-height:1.55}@media(max-width:600px){.dealerLoginPage{padding:28px}.dealerLoginCard{padding:28px 20px;border-radius:20px}.dealerLoginBrand h1{font-size:34px}.dealerLoginBrand p{font-size:17px}.dealerLoginCard input{height:64px;font-size:22px}.dealerLoginCard>button{height:64px}}
`;

const dashboardCss=`
html,body{margin:0;background:#05101a}.mockDealerApp{min-height:100svh;background:#06111c;color:#dce5ec;font-family:Inter,system-ui,sans-serif}.mockDealerTop{height:72px;background:#050d15;border-bottom:1px solid #193047;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:22px;padding:0 22px;position:sticky;top:0;z-index:20}.mockTopBrand{display:flex;align-items:center;gap:10px}.mockTopBrand img{width:105px;height:48px;object-fit:contain}.mockTopBrand b,.mockTopBrand span{display:block}.mockTopBrand b{font-size:12px;color:#fff}.mockTopBrand span{font-size:9px;color:#8193a4;margin-top:4px}.mockDealerTop>a{border:1px solid #263c50;border-radius:5px;padding:11px 16px;color:#f2f5f7;font-size:11px;font-weight:900}.mockManager{font-size:10px;color:#a9b5bf}.mockDealerTop button{background:#07121d;border:1px solid #34485a;color:#fff;border-radius:5px;padding:11px 18px;font-weight:800}.mockDealerFrame{display:grid;grid-template-columns:190px minmax(0,1fr);min-height:calc(100svh - 72px)}.mockDealerSide{background:#081521;border-right:1px solid #1a3247;padding:14px 10px;display:flex;flex-direction:column}.mockDealerSide nav{display:grid;gap:3px}.mockDealerSide nav strong{font-size:8px;letter-spacing:.1em;color:#fff;padding:15px 10px 6px}.mockDealerSide nav a{padding:10px 10px;border-radius:4px;color:#b7c4cf;font-size:10px;font-weight:750}.mockDealerSide nav a.active{background:#ed1c2e;color:#fff}.mockSidePromo{margin-top:auto;background:#07111b;border:1px solid #1e3448;border-radius:7px;overflow:hidden}.mockSidePromo .promoCopy{padding:14px 12px 6px}.mockSidePromo .promoCopy b,.mockSidePromo .promoCopy strong{display:block;font-size:12px;line-height:1.05}.mockSidePromo .promoCopy b:first-child{color:#ef233c}.mockSidePromo .promoCopy b:nth-child(2){color:#1684ff}.mockSidePromo img{width:100%;height:130px;object-fit:cover;object-position:center}.mockSidePromo a{display:block;margin:10px;background:#ed1c2e;border-radius:4px;text-align:center;padding:10px 6px;font-size:9px;font-weight:900;color:#fff}.mockDealerMain{padding:20px;max-width:1240px;width:100%;margin:auto}.mockTitleRow{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.mockTitleRow h1{margin:0;color:#fff;font-size:26px}.mockTitleRow>div{background:#0b1a28;border:1px solid #293f54;border-radius:5px;padding:10px 14px;font-size:9px}.mockNotice{background:#2b1c06;border:1px solid #6e521b;color:#f2d99e;border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:11px}.mockStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.mockStats article{background:#0b1b29;border:1px solid #1f3549;border-radius:6px;padding:15px;display:grid;grid-template-columns:auto 1fr;column-gap:10px}.mockStats article i{grid-row:1/5;font-style:normal;width:42px;height:42px;border-radius:9px;background:#0d2f5c;display:grid;place-items:center;font-size:18px}.mockStats article:nth-child(2) i{background:#421820}.mockStats article:nth-child(3) i{background:#123c28}.mockStats article:nth-child(4) i{background:#45330b}.mockStats article span{font-size:9px;color:#abb8c4}.mockStats article b{font-size:28px;color:#fff}.mockStats article em{font-style:normal;color:#39d461;font-size:10px;font-weight:900}.mockStats article small{color:#7f8d99;font-size:8px}.mockCharts,.mockLower{display:grid;grid-template-columns:1.25fr 1fr;gap:10px;margin-top:10px}.mockCharts>section,.mockLower>section{background:#0a1a28;border:1px solid #20364a;border-radius:6px;padding:15px;min-width:0}.mockCharts header,.mockLower header{display:flex;justify-content:space-between;align-items:center;font-size:9px}.mockCharts header b,.mockLower header b{color:#f0f4f7}.mockCharts header span{color:#93a3b1}.mockCharts header span i{display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 4px 0 10px}.blueDot{background:#1684ff}.redDot{background:#ef233c}.mockCharts svg{width:100%;height:155px;margin-top:10px;overflow:visible}.gridLines line{stroke:#243a4d;stroke-width:.5}.blueLine,.redLine{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.blueLine{stroke:#1684ff}.redLine{stroke:#ef233c}.dayRow{display:flex;justify-content:space-between;color:#6f8090;font-size:8px}.sourceGrid{display:grid;grid-template-columns:170px 1fr;align-items:center;gap:18px;min-height:185px}.donut{width:150px;height:150px;border-radius:50%;position:relative;margin:auto}.donut:after{content:"";position:absolute;inset:34px;background:#081622;border-radius:50%}.donut span{position:absolute;z-index:2;inset:0;display:grid;place-content:center;text-align:center}.donut span small{font-size:9px;color:#9babb8}.donut span b{font-size:28px;color:#fff}.legend{display:grid;gap:12px}.legend>div{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;font-size:9px}.legend i{width:8px;height:8px;border-radius:50%}.legend .c0{background:#1479ff}.legend .c1{background:#f02031}.legend .c2{background:#1bb36b}.legend .c3{background:#f3a313}.legend b{color:#fff}.mockLower header a{color:#89a1b6;font-size:8px}.vehicleTable>.head,.vehicleTable>div{display:grid;grid-template-columns:minmax(0,1fr) 55px 45px 72px;gap:8px;align-items:center;border-top:1px solid #1b3043;min-height:38px;font-size:9px}.vehicleTable>.head{border-top:0;color:#738594;font-size:8px}.vehicleTable strong{color:#e9eef2;font-weight:700}.vehicleTable span{color:#9dacb8}.vehicleTable b{justify-self:start;color:#48ca71;background:#0d3120;border-radius:999px;padding:4px 7px;font-size:7px}.activityList>div{display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;border-top:1px solid #1b3043;padding:8px 0}.activityList>div:first-child{border-top:0}.activityList>div>i{width:25px;height:25px;border-radius:50%;background:#14283a;display:grid;place-items:center;font-style:normal;color:#aebac4}.activityList b,.activityList small{display:block}.activityList b{font-size:9px;color:#e9eef2}.activityList small,.activityList time{font-size:8px;color:#798b9a}.mockQuick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.mockQuick a{background:#0d6ae8;color:#fff;border-radius:4px;text-align:center;padding:14px 8px;font-size:9px;font-weight:900}.mockMobileNav{display:none}
@media(max-width:900px){.mockDealerFrame{grid-template-columns:76px minmax(0,1fr)}.mockDealerSide nav a span,.mockDealerSide nav strong,.mockSidePromo,.mockManager{display:none}.mockDealerSide nav a{text-align:center;padding:12px 4px}.mockStats{grid-template-columns:1fr 1fr}.mockCharts,.mockLower{grid-template-columns:1fr}.sourceGrid{grid-template-columns:150px 1fr}}
@media(max-width:620px){.mockDealerTop{height:64px;grid-template-columns:1fr auto;padding:0 14px}.mockTopBrand img{width:92px}.mockTopBrand div,.mockDealerTop>a,.mockManager{display:none}.mockDealerTop button{padding:9px 12px}.mockDealerFrame{display:block}.mockDealerSide{display:none}.mockDealerMain{padding:14px 12px 86px}.mockTitleRow{align-items:flex-start}.mockTitleRow h1{font-size:22px}.mockTitleRow>div{font-size:8px}.mockStats{grid-template-columns:1fr 1fr;gap:7px}.mockStats article{padding:12px;column-gap:8px}.mockStats article i{width:34px;height:34px;font-size:14px}.mockStats article b{font-size:24px}.mockCharts,.mockLower{margin-top:8px;gap:8px}.mockCharts>section,.mockLower>section{padding:12px}.sourceGrid{grid-template-columns:130px 1fr;gap:10px;min-height:160px}.donut{width:120px;height:120px}.donut:after{inset:27px}.mockQuick{grid-template-columns:1fr 1fr}.mockMobileNav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;height:70px;background:#07131f;border-top:1px solid #233b50;z-index:50}.mockMobileNav a{display:grid;place-items:center;align-content:center;gap:3px;color:#aab7c2;font-size:18px}.mockMobileNav a span{font-size:8px}.mockMobileNav a.active{color:#ed1c2e}.mockMobileNav a.add{color:#fff}.mockMobileNav a.add::before{content:"";position:absolute;width:46px;height:46px;border-radius:50%;background:#ed1c2e;transform:translateY(-13px);z-index:-1}.vehicleTable>.head,.vehicleTable>div{grid-template-columns:minmax(0,1fr) 45px 36px 65px}.activityList time{display:none}}
`;
