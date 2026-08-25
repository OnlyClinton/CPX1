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
      setSession(j);
      await loadDashboard();
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

  if(!session?.authenticated)return <main className="wdccPortalLogin">
    <section className="wdccPortalHero">
      <div className="wdccPortalHeroShade"/>
      <img className="wdccPortalLogo" src="/wdcc-official-logo.webp" alt="We Don't Care Cars"/>
      <div className="wdccPortalHeroCopy"><span>{mode==="admin"?"WDCC ADMIN PORTAL":"WDCC DEALER PORTAL"}</span><h1>{mode==="admin"?"ADMIN CONTROL":"DEALER CONTROL"}</h1><p>{mode==="admin"?"Platform oversight, users, leads and inventory.":"Inventory, leads and sales operations."}</p></div>
    </section>
    <section className="wdccPortalLoginBody">
      <form onSubmit={submit} className="wdccPortalLoginCard">
        <div className="wdccPortalLoginHead"><span>SECURE ACCESS</span><h2>{mode==="admin"?"Admin Sign In":"Dealer Sign In"}</h2></div>
        <label>LOGIN<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" placeholder={mode==="admin"?"admin":"dealer login"} required/></label>
        <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
        <button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button>
        <div className="wdccPortalLoginMessage">{message}</div>
      </form>
    </section>
  </main>;

  const summary=data?.summary||{};
  const leads=data?.leads||[];
  const inventory=data?.inventory||[];
  const hot=useMemo(()=>[...(data?.hotLeads||leads)].slice(0,5),[data,leads]);
  return <main className="wdccPortalApp">
    <header className="wdccPortalTopbar">
      <div className="wdccPortalBrand"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><strong>{mode==="admin"?"WDCC ADMIN PORTAL":"WDCC DEALER PORTAL"}</strong><span>{session?.user?.displayName||session?.user?.username||"Authorized user"}</span></div></div>
      <button onClick={logout}>SIGN OUT</button>
    </header>
    <div className="wdccPortalWorkspace">
      <aside className="wdccPortalSide">
        <span className="active">OVERVIEW</span><span>LEADS</span><span>INVENTORY</span><span>ANALYTICS</span>{mode==="admin"&&<span>USERS</span>}
      </aside>
      <section className="wdccPortalMain">
        <div className="wdccPortalTitle"><div><span>{mode==="admin"?"PLATFORM CONTROL":"DEALER OPERATIONS"}</span><h1>{mode==="admin"?"Admin Overview":"Dealer Overview"}</h1></div><b>LIVE</b></div>
        {data?.error&&<div className="wdccPortalNotice">Signed in successfully. Dashboard authorization is still being repaired: {data.error}</div>}
        <div className="wdccPortalStats"><article><span>NEW LEADS</span><strong>{summary.newToday||0}</strong></article><article><span>HOT BUYERS</span><strong>{summary.hotLeads||0}</strong></article><article><span>LIVE VEHICLES</span><strong>{summary.publishedInventory||inventory.length||0}</strong></article><article><span>SOLD</span><strong>{summary.sold||0}</strong></article></div>
        <section className="wdccPortalPanel">
          <div className="wdccPortalPanelHead"><div><span>SALES PIPELINE</span><h2>Priority Leads</h2></div><button>VIEW ALL</button></div>
          <div className="wdccPortalRows">{hot.map((lead:any)=><div key={lead.id} className="wdccPortalRow"><div><strong>{lead.name||"Unnamed buyer"}</strong><span>{lead.vehicleInterest||lead.kind||"General inquiry"}</span></div><span>{when(lead.createdAt)}</span><b>{String(lead.pipelineStage||lead.status||"new").toUpperCase()}</b></div>)}{!hot.length&&<div className="wdccPortalEmpty">No priority leads yet.</div>}</div>
        </section>
        <section className="wdccPortalPanel">
          <div className="wdccPortalPanelHead"><div><span>INVENTORY</span><h2>Vehicles Ready</h2></div><button>+ ADD VEHICLE</button></div>
          <div className="wdccPortalVehicleGrid">{inventory.slice(0,6).map((v:any)=><article key={v.id}><div className="wdccPortalVehiclePhoto">{v.image||v.photo?<img src={v.image||v.photo} alt=""/>:<span>WDCC</span>}</div><strong>{v.year} {v.make} {v.model}</strong><span>{money(v.price)} · {Number(v.mileage||0).toLocaleString()} mi</span><b>{String(v.status||"live").toUpperCase()}</b></article>)}{!inventory.length&&<div className="wdccPortalEmpty">No inventory records available.</div>}</div>
        </section>
      </section>
    </div>
  </main>;
}
