"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";

type Mode="dealer"|"admin";
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};

export default function PortalExperience({mode}:{mode:Mode}){
  const[session,setSession]=useState<any>(null);
  const[data,setData]=useState<any>(null);
  const[username,setUsername]=useState("");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function loadSession(){
    const r=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(j?.authenticated){
      const role=String(j?.user?.role||"").toLowerCase();
      if(mode==="admin"&&!role.includes("admin")){setSession(null);setMessage("Admin account required");return;}
      setSession(j);await loadDashboard();
    }else setSession(null);
  }
  async function loadDashboard(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    const j=await r.json().catch(()=>({}));
    if(r.ok)setData(j);else setData({summary:{},leads:[],inventory:[],error:j?.error||`Dashboard ${r.status}`});
  }
  useEffect(()=>{loadSession().catch(()=>setSession(null))},[]);
  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setMessage("Signing in…");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({email:username.trim(),password})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j?.ok)throw Error(j?.error||"Sign-in failed");
      const role=String(j?.role||j?.user?.role||"").toLowerCase();
      if(mode==="admin"&&!role.includes("admin"))throw Error("Admin account required");
      await loadSession();setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign-in failed");}
    finally{setBusy(false)}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST",credentials:"include"});setSession(null);setData(null);setPassword("");}

  if(!session?.authenticated)return <><style jsx global>{portalCss}</style><main className="wdccPortalLogin">
    <section className="wdccPortalHero">
      <div className="wdccPortalHeroShade"/>
      <img className="wdccPortalLogo" src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/>
      <div className="wdccPortalHeroCopy"><span>{mode==="admin"?"WDCC ADMIN PORTAL":"WDCC DEALER PORTAL"}</span><h1>{mode==="admin"?"ADMIN CONTROL":"DEALER CONTROL"}</h1><p>{mode==="admin"?"Platform oversight, users, leads and inventory.":"Inventory, leads and sales operations."}</p></div>
    </section>
    <section className="wdccPortalLoginBody"><form onSubmit={submit} className="wdccPortalLoginCard">
      <div className="wdccPortalLoginHead"><span>SECURE ACCESS</span><h2>{mode==="admin"?"Admin Sign In":"Dealer Sign In"}</h2></div>
      <label>LOGIN<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" placeholder={mode==="admin"?"admin":"dealer login"} required/></label>
      <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
      <button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button><div className="wdccPortalLoginMessage">{message}</div>
    </form></section>
  </main></>;

  const summary=data?.summary||{};const leads=data?.leads||[];const inventory=data?.inventory||[];const hot=useMemo(()=>[...(data?.hotLeads||leads)].slice(0,5),[data,leads]);
  return <><style jsx global>{portalCss}</style><main className="wdccPortalApp">
    <header className="wdccPortalTopbar"><div className="wdccPortalBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>{mode==="admin"?"WDCC ADMIN PORTAL":"WDCC DEALER PORTAL"}</strong><span>{session?.user?.displayName||session?.user?.username||"Authorized user"}</span></div></div><button onClick={logout}>SIGN OUT</button></header>
    <div className="wdccPortalWorkspace"><aside className="wdccPortalSide"><span className="active">OVERVIEW</span><span>LEADS</span><span>INVENTORY</span><span>ANALYTICS</span>{mode==="admin"&&<span>USERS</span>}</aside>
    <section className="wdccPortalMain"><div className="wdccPortalTitle"><div><span>{mode==="admin"?"PLATFORM CONTROL":"DEALER OPERATIONS"}</span><h1>{mode==="admin"?"Admin Overview":"Dealer Overview"}</h1></div><b>LIVE</b></div>
    {data?.error&&<div className="wdccPortalNotice">Signed in successfully. Dashboard authorization is still being repaired: {data.error}</div>}
    <div className="wdccPortalStats"><article><span>NEW LEADS</span><strong>{summary.newToday||0}</strong></article><article><span>HOT BUYERS</span><strong>{summary.hotLeads||0}</strong></article><article><span>LIVE VEHICLES</span><strong>{summary.publishedInventory||inventory.length||0}</strong></article><article><span>SOLD</span><strong>{summary.sold||0}</strong></article></div>
    <section className="wdccPortalPanel"><div className="wdccPortalPanelHead"><div><span>SALES PIPELINE</span><h2>Priority Leads</h2></div><button>VIEW ALL</button></div><div className="wdccPortalRows">{hot.map((lead:any)=><div key={lead.id} className="wdccPortalRow"><div><strong>{lead.name||"Unnamed buyer"}</strong><span>{lead.vehicleInterest||lead.kind||"General inquiry"}</span></div><span>{when(lead.createdAt)}</span><b>{String(lead.pipelineStage||lead.status||"new").toUpperCase()}</b></div>)}{!hot.length&&<div className="wdccPortalEmpty">No priority leads yet.</div>}</div></section>
    <section className="wdccPortalPanel"><div className="wdccPortalPanelHead"><div><span>INVENTORY</span><h2>Vehicles Ready</h2></div><button>+ ADD VEHICLE</button></div><div className="wdccPortalVehicleGrid">{inventory.slice(0,6).map((v:any)=><article key={v.id}><div className="wdccPortalVehiclePhoto">{v.image||v.photo?<img src={v.image||v.photo} alt=""/>:<span>WDCC</span>}</div><strong>{v.year} {v.make} {v.model}</strong><span>{money(v.price)} · {Number(v.mileage||0).toLocaleString()} mi</span><b>{String(v.status||"live").toUpperCase()}</b></article>)}{!inventory.length&&<div className="wdccPortalEmpty">No inventory records available.</div>}</div></section>
    </section></div>
  </main></>;
}

const portalCss=`
.wdccPortalLogin{min-height:100svh;background:#02060b;color:#fff;display:grid;grid-template-columns:minmax(320px,44%) 1fr;font-family:Inter,system-ui,sans-serif}.wdccPortalHero{min-height:100svh;position:relative;background:url('/wdcc-hero-v2.webp') center/cover no-repeat;overflow:hidden}.wdccPortalHeroShade{position:absolute;inset:0;background:linear-gradient(180deg,#02060b10 0%,#02060b55 58%,#02060bf5 100%)}.wdccPortalLogo{position:absolute;top:24px;left:28px;width:132px;height:auto;z-index:2;filter:drop-shadow(0 10px 24px #0009)}.wdccPortalHeroCopy{position:absolute;z-index:2;left:32px;right:32px;bottom:34px}.wdccPortalHeroCopy>span,.wdccPortalLoginHead span,.wdccPortalTitle span,.wdccPortalPanelHead span{font-size:10px;letter-spacing:.16em;font-weight:900;color:#ef233c}.wdccPortalHeroCopy h1{margin:5px 0 8px;font-size:clamp(36px,5vw,70px);line-height:.88;letter-spacing:-.06em}.wdccPortalHeroCopy p{margin:0;color:#c7d2dc;max-width:420px;font-size:13px}.wdccPortalLoginBody{display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 55% 5%,#122337 0,#06101a 38%,#02060b 76%)}.wdccPortalLoginCard{width:min(430px,100%);background:#0c1723;border:1px solid #22364a;border-radius:14px;padding:28px;box-shadow:0 28px 70px #0009}.wdccPortalLoginHead h2{margin:4px 0 22px;font-size:31px;letter-spacing:-.04em}.wdccPortalLoginCard label{display:grid;gap:7px;margin-top:14px;font-size:10px;font-weight:900;letter-spacing:.08em;color:#c6d1dc}.wdccPortalLoginCard input{height:50px;border:1px solid #34485e;border-radius:7px;background:#fff;color:#111;padding:0 13px;font:inherit;font-size:16px;outline:none}.wdccPortalLoginCard input:focus{border-color:#ef233c;box-shadow:0 0 0 3px #ef233c22}.wdccPortalLoginCard button,.wdccPortalTopbar button,.wdccPortalPanelHead button{border:0;background:#ed1c2e;color:#fff;font-weight:950;letter-spacing:.04em;cursor:pointer}.wdccPortalLoginCard button{width:100%;height:49px;margin-top:20px;border-radius:7px}.wdccPortalLoginMessage{min-height:20px;margin-top:12px;color:#ffb7bd;font-size:12px}.wdccPortalApp{min-height:100svh;background:#eef1f4;color:#101820;font-family:Inter,system-ui,sans-serif}.wdccPortalTopbar{height:72px;background:#06111c;color:#fff;border-bottom:1px solid #173047;display:flex;align-items:center;justify-content:space-between;padding:0 24px}.wdccPortalBrand{display:flex;align-items:center;gap:12px}.wdccPortalBrand img{width:82px;height:56px;object-fit:contain}.wdccPortalBrand strong,.wdccPortalBrand span{display:block}.wdccPortalBrand strong{font-size:12px;letter-spacing:.04em}.wdccPortalBrand span{font-size:10px;color:#8fa1b1;margin-top:3px}.wdccPortalTopbar button{border-radius:5px;padding:10px 14px;font-size:10px}.wdccPortalWorkspace{display:grid;grid-template-columns:190px minmax(0,1fr);min-height:calc(100svh - 72px)}.wdccPortalSide{background:#0b1825;color:#b7c5d1;padding:20px 10px;display:grid;align-content:start;gap:5px}.wdccPortalSide span{padding:12px 13px;border-radius:5px;font-size:10px;font-weight:900;letter-spacing:.06em}.wdccPortalSide span.active{background:#ed1c2e;color:#fff}.wdccPortalMain{padding:28px;max-width:1280px;width:100%;margin:auto}.wdccPortalTitle{display:flex;justify-content:space-between;align-items:end;margin-bottom:18px}.wdccPortalTitle h1{font-size:30px;letter-spacing:-.04em;margin:4px 0 0}.wdccPortalTitle>b{background:#eaf7ed;color:#168344;border-radius:999px;padding:7px 10px;font-size:9px}.wdccPortalNotice{background:#fff5dc;border:1px solid #e3c987;color:#74510c;border-radius:7px;padding:12px 14px;margin-bottom:14px;font-size:12px;font-weight:800}.wdccPortalStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.wdccPortalStats article,.wdccPortalPanel{background:#fff;border:1px solid #d8dfe6;border-radius:8px;box-shadow:0 5px 18px #1220310a}.wdccPortalStats article{padding:16px}.wdccPortalStats span{font-size:9px;letter-spacing:.08em;color:#758391;font-weight:900}.wdccPortalStats strong{display:block;font-size:27px;margin-top:4px}.wdccPortalPanel{padding:18px;margin-bottom:14px}.wdccPortalPanelHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.wdccPortalPanelHead h2{font-size:20px;margin:3px 0 0}.wdccPortalPanelHead button{border-radius:5px;padding:9px 12px;font-size:9px}.wdccPortalRow{display:grid;grid-template-columns:minmax(0,1fr) 150px 100px;gap:12px;align-items:center;min-height:62px;border-top:1px solid #edf0f3;font-size:11px}.wdccPortalRow:first-child{border-top:0}.wdccPortalRow strong,.wdccPortalRow span{display:block}.wdccPortalRow>div span{color:#7a8792;margin-top:4px}.wdccPortalRow>b{justify-self:end;color:#b10f1e;background:#fff0f1;border-radius:999px;padding:6px 8px;font-size:8px}.wdccPortalVehicleGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.wdccPortalVehicleGrid article{border:1px solid #dce2e7;border-radius:7px;padding:10px;position:relative}.wdccPortalVehiclePhoto{height:110px;background:#09131e;border-radius:5px;display:grid;place-items:center;color:#788b9a;margin-bottom:9px;overflow:hidden}.wdccPortalVehiclePhoto img{width:100%;height:100%;object-fit:cover}.wdccPortalVehicleGrid article>strong,.wdccPortalVehicleGrid article>span{display:block}.wdccPortalVehicleGrid article>strong{font-size:12px}.wdccPortalVehicleGrid article>span{font-size:10px;color:#74818d;margin-top:3px}.wdccPortalVehicleGrid article>b{position:absolute;top:17px;right:17px;background:#eaf7ed;color:#148445;border-radius:999px;padding:5px 7px;font-size:7px}.wdccPortalEmpty{padding:18px;color:#81909c;font-size:12px}
@media(max-width:760px){.wdccPortalLogin{display:block}.wdccPortalHero{min-height:42svh}.wdccPortalLoginBody{padding:18px;min-height:58svh;align-items:start}.wdccPortalLoginCard{margin-top:-28px;position:relative;z-index:3}.wdccPortalWorkspace{display:block}.wdccPortalSide{display:flex;overflow:auto;padding:8px}.wdccPortalSide span{flex:none}.wdccPortalMain{padding:14px}.wdccPortalStats{grid-template-columns:1fr 1fr}.wdccPortalVehicleGrid{grid-template-columns:1fr 1fr}.wdccPortalRow{grid-template-columns:1fr auto}.wdccPortalRow>span{display:none}.wdccPortalHeroCopy h1{font-size:38px}.wdccPortalHeroCopy{left:22px;bottom:24px}.wdccPortalLogo{left:22px;top:18px;width:104px}}
`;
