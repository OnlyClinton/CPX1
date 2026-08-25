"use client";

import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";

type Mode="dealer"|"admin";
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};
const sourceName=(v:any)=>String(v?.source||v?.leadSource||v?.utmSource||v?.channel||"Website").trim()||"Website";

export default function PortalExperience({mode}:{mode:Mode}){
  const[session,setSession]=useState<any>(null);
  const[data,setData]=useState<any>(null);
  const[username,setUsername]=useState("");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function loadDashboard(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(r.ok)setData(j);else setData({summary:{},leads:[],inventory:[],error:j?.error||`Dashboard ${r.status}`});
  }
  async function loadSession(){
    const r=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(j?.authenticated){
      const role=String(j?.user?.role||"").toLowerCase();
      if(mode==="admin"&&!role.includes("admin")){setSession(null);setMessage("Admin account required");return;}
      setSession(j);await loadDashboard();
    }else setSession(null);
  }
  useEffect(()=>{loadSession().catch(()=>setSession(null))},[]);

  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setMessage("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({username:username.trim(),email:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok)throw Error(j?.error==="invalid_credentials"?"Login or password is incorrect.":j?.error||"Sign-in failed");
      const role=String(j?.role||j?.user?.role||"").toLowerCase();
      if(mode==="admin"&&!role.includes("admin"))throw Error("Admin account required");
      await loadSession();setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed");}
    finally{setBusy(false)}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include"});setSession(null);setData(null);setPassword("");}

  const summary=data?.summary||{};
  const leads:any[]=Array.isArray(data?.leads)?data.leads:[];
  const inventory:any[]=Array.isArray(data?.inventory)?data.inventory:[];
  const applications=Number(summary.applications??leads.filter(x=>String(x.kind||x.type||"").toLowerCase().includes("application")).length||0);
  const approved=Number(summary.approved??leads.filter(x=>String(x.status||x.pipelineStage||"").toLowerCase().includes("approved")).length||0);
  const newLeads=Number(summary.newLeads??summary.newToday??leads.filter(x=>["new","open",""] .includes(String(x.status||x.pipelineStage||"").toLowerCase())).length||leads.length||0);
  const sold=Number(summary.soldThisWeek??summary.sold??inventory.filter(x=>String(x.status||"").toLowerCase()==="sold").length||0);
  const topVehicles=useMemo(()=>[...inventory].sort((a,b)=>Number(b.views||b.viewCount||0)-Number(a.views||a.viewCount||0)).slice(0,5),[inventory]);
  const recent=useMemo(()=>Array.isArray(data?.recentActivity)?data.recentActivity.slice(0,5):leads.slice(0,5).map((lead:any)=>({id:lead.id,label:`New lead from ${sourceName(lead)}`,detail:lead.name||lead.vehicleInterest||"Buyer inquiry",at:lead.createdAt||lead.created_at})),[data,leads]);
  const sources=useMemo(()=>{
    const map=new Map<string,number>();
    leads.forEach(x=>{const k=sourceName(x);map.set(k,(map.get(k)||0)+1)});
    const items=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
    if(!items.length)return [["Website",46],["Phone",24],["Walk-in",18],["Referral",12]] as [string,number][];
    const total=items.reduce((n,[,v])=>n+v,0)||1;return items.map(([k,v])=>[k,Math.round(v/total*100)]) as [string,number][];
  },[leads]);

  if(!session?.authenticated)return <><style jsx global>{portalCss}</style><main className="wdccSignInPage">
    <form className="wdccSignInCard" onSubmit={submit}>
      <span className="wdccSignInKicker">WDCC</span>
      <h1>{mode==="admin"?"Admin Sign In":"Dealer Sign In"}</h1>
      <p>{mode==="admin"?"Platform control, users and dealership oversight.":"Inventory, photos and vehicle management."}</p>
      <label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder={mode==="admin"?"Admin":"Dealer"} required/></label>
      <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
      <button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button>
      {message&&<div className="wdccSignInMessage">{message}</div>}
      <div className="wdccSignInHint">Usernames are case-insensitive. Passwords are case-sensitive.</div>
    </form>
  </main></>;

  return <><style jsx global>{portalCss}</style><main className="dealerDashShell">
    <aside className="dealerDashSide">
      <div className="dealerDashBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>{mode==="admin"?"WDCC · ADMIN PORTAL":"WDCC · DEALER PORTAL"}</b><span>{mode==="admin"?"Platform Operations":"Inventory Operations"}</span></div></div>
      <nav>
        <Link className="active" href={mode==="admin"?"/admin":"/dealer"}>⌂ Dashboard</Link>
        <Link href="/dealer/inventory">▣ Inventory</Link>
        <Link href="/dealer/leads">♙ Leads</Link>
        <Link href="/dealer/leads">▢ Appointments</Link>
        <Link href="/dealer/leads">▤ Test Drives</Link>
        <Link href="/dealer/leads">♧ Customers</Link>
        <Link href="/dealer/leads">▧ Applications</Link>
        <Link href="/dealer/leads">◌ Messages</Link>
        <Link href="/dealer/inventory/logs">▥ Reports</Link>
        <Link href={mode==="admin"?"/admin":"/dealer"}>⚙ Settings</Link>
      </nav>
      <div className="dealerDashPromo"><b><span>BAD CREDIT?</span><em>NO CREDIT?</em><strong>WE DON’T CARE.</strong></b><img src="/wdcc-hero-v2.webp" alt=""/><Link href="/dealer/inventory/new">GET PRE-APPROVED →</Link></div>
    </aside>

    <section className="dealerDashBody">
      <header className="dealerDashTop"><div><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>{mode==="admin"?"WDCC · ADMIN PORTAL":"WDCC · DEALER PORTAL"}</b><span>{mode==="admin"?"Platform Operations":"Inventory Operations"}</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>{session?.user?.displayName||"Sean · Sales Manager"}</span><button onClick={logout}>Sign Out</button></header>
      <div className="dealerDashContent">
        <div className="dealerDashHeading"><h1>Dashboard</h1><button>May 24 – May 30, 2025&nbsp; ◫</button></div>
        {data?.error&&<div className="dealerDashNotice">Signed in. Live CRM data is still reconnecting: {data.error}</div>}

        <div className="dealerDashStats">
          <article><i className="blue">♙</i><div><span>New Leads</span><strong>{newLeads}</strong><em>↑ 18%</em><small>vs last week</small></div></article>
          <article><i className="red">▧</i><div><span>Applications</span><strong>{applications}</strong><em>↑ 12%</em><small>vs last week</small></div></article>
          <article><i className="green">✓</i><div><span>Approved</span><strong>{approved}</strong><em>↑ 23%</em><small>vs last week</small></div></article>
          <article><i className="gold">◆</i><div><span>Sold This Week</span><strong>{sold}</strong><em>↑ 15%</em><small>vs last week</small></div></article>
        </div>

        <div className="dealerDashCharts">
          <section className="dashPanel"><div className="dashPanelHead"><b>LEADS OVERVIEW</b><span><i className="dot blueDot"/> New Leads&nbsp;&nbsp; <i className="dot redDot"/> Approved</span></div><svg className="leadChart" viewBox="0 0 620 230" preserveAspectRatio="none"><g className="gridLines"><path d="M0 45H620M0 90H620M0 135H620M0 180H620"/></g><path className="lineBlue" d="M10 175 L95 118 L180 145 L265 70 L350 126 L435 84 L520 54 L610 94"/><path className="lineRed" d="M10 194 L95 151 L180 172 L265 109 L350 161 L435 126 L520 112 L610 136"/></svg><div className="chartDays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section>
          <section className="dashPanel sourcePanel"><b>LEADS BY SOURCE</b><div className="sourceBody"><div className="sourceDonut" style={{background:`conic-gradient(#1776ff 0 ${sources[0]?.[1]||46}%,#ef202c ${sources[0]?.[1]||46}% ${(sources[0]?.[1]||46)+(sources[1]?.[1]||24)}%,#14a655 ${(sources[0]?.[1]||46)+(sources[1]?.[1]||24)}% ${(sources[0]?.[1]||46)+(sources[1]?.[1]||24)+(sources[2]?.[1]||18)}%,#f0a113 0)`}}><div><small>Total</small><strong>{newLeads}</strong></div></div><ul>{sources.map(([name,pct],i)=><li key={name}><i className={`src${i}`}/><span>{name}</span><b>{pct}%</b></li>)}</ul></div></section>
        </div>

        <div className="dealerDashLower">
          <section className="dashPanel"><div className="dashPanelHead"><b>TOP PERFORMING VEHICLES</b><Link href="/dealer/inventory">VIEW INVENTORY →</Link></div><div className="vehiclePerf"><div className="vehiclePerfHead"><span>VEHICLE</span><span>VIEWS</span><span>LEADS</span><span>STATUS</span></div>{topVehicles.map((v:any)=><div className="vehiclePerfRow" key={v.id}><span>{v.year} {v.make} {v.model}</span><span>{Number(v.views||v.viewCount||0)}</span><span>{Number(v.leads||v.leadCount||0)}</span><b>{String(v.status||"available").toUpperCase()}</b></div>)}{!topVehicles.length&&<div className="dashEmpty">No vehicle performance data yet.</div>}</div></section>
          <section className="dashPanel"><div className="dashPanelHead"><b>RECENT ACTIVITY</b><span>VIEW ALL →</span></div><div className="activityList">{recent.map((a:any,index:number)=><div key={a.id||index}><i>♙</i><p><b>{a.label||a.action||"Dealer activity"}</b><span>{a.detail||""}</span></p><time>{when(a.at||a.createdAt||a.created_at)||"now"}</time></div>)}{!recent.length&&<div className="dashEmpty">No recent activity yet.</div>}</div></section>
        </div>

        <div className="dealerQuickActions"><Link href="/dealer/inventory/new">＋ ADD VEHICLE</Link><Link href="/dealer/leads">＋ ADD LEAD</Link><Link href="/dealer/leads">☷ VIEW FOLLOW-UPS</Link><Link href="/dealer/leads">⌁ SEND CAMPAIGN</Link></div>
      </div>
      <nav className="dealerMobileBottom"><Link className="active" href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="plus" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
    </section>
  </main></>;
}

const portalCss=`
:root{--wdccRed:#ef1f2d;--wdccNavy:#071522;--wdccPanel:#0c1b29;--wdccLine:#1b3348;--wdccText:#f5f7f9;--wdccMuted:#8da0b1}.wdccSignInPage{min-height:100svh;background:radial-gradient(circle at 50% 0,#11273a 0,#071522 35%,#02070c 72%);display:grid;place-items:center;padding:28px;color:#fff;font-family:Inter,system-ui,sans-serif}.wdccSignInCard{width:min(590px,100%);background:#0c1825;border:1px solid #2b4053;border-radius:22px;padding:38px 34px;box-shadow:0 30px 90px #0008}.wdccSignInKicker{color:#ef233c;font-weight:950;letter-spacing:.12em}.wdccSignInCard h1{font-size:42px;letter-spacing:-.04em;margin:8px 0 6px}.wdccSignInCard>p{color:#91a1b1;font-size:18px;margin:0 0 28px}.wdccSignInCard label{display:grid;gap:9px;color:#c7d0d9;font-weight:900;font-size:12px;margin:18px 0}.wdccSignInCard input{height:72px;border-radius:13px;border:1px solid #cbd5df;background:#f2f6ff;color:#17202a;padding:0 18px;font-size:23px}.wdccSignInCard button{width:100%;height:72px;border:0;border-radius:13px;background:#ef233c;color:#fff;font-size:20px;font-weight:950;margin-top:10px}.wdccSignInMessage{color:#ffb1b7;margin-top:14px}.wdccSignInHint{margin-top:18px;background:#08131e;border-radius:13px;padding:18px;color:#9cabb8;font-size:13px;line-height:1.5}.dealerDashShell{min-height:100svh;background:#06111b;color:#fff;display:grid;grid-template-columns:214px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.dealerDashSide{background:#071522;border-right:1px solid #1a3348;padding:18px 12px;min-height:100svh;display:flex;flex-direction:column}.dealerDashBrand{display:flex;align-items:center;gap:10px;padding:2px 6px 18px;border-bottom:1px solid #173047}.dealerDashBrand img{width:64px;height:50px;object-fit:contain}.dealerDashBrand b,.dealerDashBrand span{display:block}.dealerDashBrand b{font-size:11px}.dealerDashBrand span{color:#8799a9;font-size:8px;margin-top:4px}.dealerDashSide nav{display:grid;gap:2px;padding-top:12px}.dealerDashSide nav a{padding:11px 12px;border-radius:5px;color:#b6c2cc;font-size:10px;font-weight:750}.dealerDashSide nav a.active{background:#b91a24;color:#fff}.dealerDashPromo{margin-top:auto;padding-top:22px}.dealerDashPromo>b{display:block;font-style:normal;line-height:1.05}.dealerDashPromo>b span{display:block;color:#ef233c}.dealerDashPromo>b em{display:block;color:#2c91ff;font-style:normal}.dealerDashPromo>b strong{display:block;color:#fff}.dealerDashPromo img{width:100%;height:115px;object-fit:cover;object-position:center;border-radius:6px;margin:10px 0}.dealerDashPromo a{display:block;text-align:center;background:#ef233c;padding:10px;border-radius:4px;font-size:9px;font-weight:950}.dealerDashBody{min-width:0}.dealerDashTop{height:72px;background:#050d15;border-bottom:1px solid #183149;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:20px;padding:0 22px}.dealerDashTop>div{display:flex;align-items:center;gap:10px}.dealerDashTop img{width:54px;height:42px;object-fit:contain}.dealerDashTop b,.dealerDashTop span{display:block}.dealerDashTop b{font-size:11px}.dealerDashTop>div span{font-size:8px;color:#8ca0b1;margin-top:3px}.dealerDashTop>a{border:1px solid #a63239;padding:9px 16px;border-radius:5px;font-size:11px;font-weight:900}.dealerDashTop>span{font-size:10px;color:#c4ced6}.dealerDashTop>button{background:transparent;border:1px solid #314558;color:#fff;border-radius:5px;padding:9px 15px;font-size:10px}.dealerDashContent{padding:20px 24px 30px;max-width:1240px;margin:auto}.dealerDashHeading{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.dealerDashHeading h1{font-size:30px;margin:0;letter-spacing:-.04em}.dealerDashHeading button{background:#0b1a28;color:#c4ced7;border:1px solid #263d50;border-radius:5px;padding:10px 14px}.dealerDashNotice{background:#3a2710;border:1px solid #6b4a19;color:#f5ca83;padding:11px 13px;border-radius:6px;margin-bottom:12px;font-size:11px}.dealerDashStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dealerDashStats article{background:#0c1b29;border:1px solid #1a3448;border-radius:7px;padding:16px;display:flex;gap:13px;align-items:flex-start}.dealerDashStats article>i{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;font-style:normal;font-weight:950;font-size:18px}.dealerDashStats .blue{background:#0b3c7d;color:#2f8cff}.dealerDashStats .red{background:#551b24;color:#ff3441}.dealerDashStats .green{background:#123f2b;color:#3edb6c}.dealerDashStats .gold{background:#5e4413;color:#ffb51e}.dealerDashStats span,.dealerDashStats small{display:block}.dealerDashStats span{font-size:9px;color:#bac6cf}.dealerDashStats strong{display:block;font-size:28px;margin:2px 0}.dealerDashStats em{display:block;color:#43cf69;font-style:normal;font-size:9px;font-weight:900}.dealerDashStats small{color:#708598;font-size:8px;margin-top:2px}.dealerDashCharts,.dealerDashLower{display:grid;grid-template-columns:1.2fr .9fr;gap:10px;margin-top:10px}.dashPanel{background:#0c1b29;border:1px solid #1a3448;border-radius:7px;padding:15px;min-width:0}.dashPanelHead{display:flex;justify-content:space-between;align-items:center;gap:12px}.dashPanelHead b,.sourcePanel>b{font-size:10px;color:#dce5eb}.dashPanelHead span,.dashPanelHead a{font-size:8px;color:#879bac}.dot{display:inline-block;width:7px;height:7px;border-radius:50%}.blueDot{background:#1677ff}.redDot{background:#ed2432}.leadChart{height:180px;width:100%;margin-top:7px}.gridLines path{stroke:#21384a;stroke-width:1}.lineBlue,.lineRed{fill:none;stroke-width:3}.lineBlue{stroke:#1677ff}.lineRed{stroke:#ed2432}.chartDays{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;color:#71869a;font-size:8px}.sourceBody{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:16px;min-height:220px}.sourceDonut{width:170px;height:170px;border-radius:50%;margin:auto;display:grid;place-items:center}.sourceDonut>div{width:94px;height:94px;border-radius:50%;background:#0c1b29;display:grid;place-items:center;text-align:center}.sourceDonut small{font-size:9px;color:#8093a3}.sourceDonut strong{display:block;font-size:29px}.sourceBody ul{list-style:none;padding:0;margin:0}.sourceBody li{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;margin:13px 0;font-size:9px}.sourceBody li i{width:8px;height:8px;border-radius:50%}.src0{background:#1776ff}.src1{background:#ef202c}.src2{background:#14a655}.src3{background:#f0a113}.sourceBody li span{color:#acbbc7}.vehiclePerfHead,.vehiclePerfRow{display:grid;grid-template-columns:minmax(0,1fr) 60px 60px 80px;gap:10px;align-items:center}.vehiclePerfHead{color:#63798d;font-size:8px;padding:10px 0}.vehiclePerfRow{min-height:42px;border-top:1px solid #183047;font-size:9px}.vehiclePerfRow>b{color:#43c768;background:#123728;border-radius:999px;padding:5px 7px;font-size:7px;text-align:center}.activityList>div{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:48px;border-top:1px solid #183047}.activityList>div:first-child{border-top:0}.activityList i{width:25px;height:25px;border-radius:50%;background:#182a38;display:grid;place-items:center;font-style:normal;color:#ccd5db}.activityList p{margin:0}.activityList p b,.activityList p span{display:block}.activityList p b{font-size:9px}.activityList p span{font-size:8px;color:#72879a;margin-top:3px}.activityList time{font-size:8px;color:#708396}.dashEmpty{color:#71879a;padding:18px 0;font-size:10px}.dealerQuickActions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.dealerQuickActions a{min-height:48px;border-radius:4px;background:#1265d8;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:950}.dealerMobileBottom{display:none}
@media(max-width:760px){.wdccSignInPage{padding:18px}.wdccSignInCard{padding:28px 20px;border-radius:20px}.wdccSignInCard h1{font-size:38px}.wdccSignInCard>p{font-size:16px}.wdccSignInCard input{height:68px}.dealerDashShell{display:block;padding-bottom:76px}.dealerDashSide{display:none}.dealerDashTop{height:70px;grid-template-columns:1fr auto;padding:0 16px}.dealerDashTop>div>div,.dealerDashTop>a,.dealerDashTop>span{display:none}.dealerDashTop img{width:88px}.dealerDashTop button{font-size:0;width:43px;height:43px;border-radius:50%;background:#ef233c;border:0;position:relative}.dealerDashTop button:after{content:'↪';font-size:17px}.dealerDashContent{padding:16px 14px 22px}.dealerDashHeading{align-items:center}.dealerDashHeading h1{font-size:23px}.dealerDashHeading button{font-size:9px;padding:9px}.dealerDashStats{grid-template-columns:1fr 1fr;gap:6px}.dealerDashStats article{padding:12px;gap:8px}.dealerDashStats article>i{width:30px;height:30px;font-size:14px}.dealerDashStats strong{font-size:24px}.dealerDashCharts,.dealerDashLower{grid-template-columns:1fr;gap:7px;margin-top:7px}.dashPanel{padding:12px}.leadChart{height:145px}.sourceBody{grid-template-columns:1fr 1fr;min-height:190px}.sourceDonut{width:135px;height:135px}.sourceDonut>div{width:74px;height:74px}.sourceDonut strong{font-size:25px}.dealerQuickActions{grid-template-columns:repeat(4,1fr);gap:6px}.dealerQuickActions a{min-height:62px;text-align:center;padding:7px;font-size:8px}.dealerMobileBottom{position:fixed;z-index:50;bottom:0;left:0;right:0;height:68px;background:#071522;border-top:1px solid #21384a;display:grid;grid-template-columns:repeat(5,1fr);align-items:end;padding:5px 5px 7px}.dealerMobileBottom a{display:grid;place-items:center;gap:3px;color:#b7c2ca;font-size:17px}.dealerMobileBottom a span{font-size:7px}.dealerMobileBottom a.active{color:#ef233c}.dealerMobileBottom a.plus{width:54px;height:54px;border-radius:50%;background:#ef233c;color:#fff;margin:-19px auto 0;align-self:start;box-shadow:0 5px 15px #0008}.dealerMobileBottom a.plus span{margin-top:-5px}}
`;
