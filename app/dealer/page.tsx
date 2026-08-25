"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const stageLabels:any={new:"New",contacted:"Contacted",engaged:"Engaged",qualified:"Qualified",appointment:"Appointment",showed:"Showed",deal:"Deal Working",deal_working:"Deal Working",sold:"Sold",lost:"Lost"};
const stageOrder=["new","contacted","engaged","qualified","appointment","showed","deal","sold"];
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};
const vehiclePhoto=(v:any)=>{
  const p=v?.primaryPhotoPathname||v?.primaryPhoto||v?.photoPathname||v?.photos?.[0]?.pathname||v?.photos?.[0];
  if(!p)return "";
  const value=String(p);
  return /^https?:\/\//i.test(value)?value:`/api/media?p=${encodeURIComponent(value)}`;
};

export default function Dealer(){
  const[session,setSession]=useState<any>();
  const[data,setData]=useState<any>();
  const[message,setMessage]=useState("Loading sales command…");
  const[busy,setBusy]=useState("");

  async function load(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store"});
    if(r.status===401){location.href="/dealer/login";return;}
    const j=await r.json();
    if(!r.ok)throw Error(j.error||"CRM could not be loaded");
    setData(j);setMessage("");
  }

  useEffect(()=>{fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(v=>{setSession(v);if(!v.authenticated){location.href="/dealer/login";return}return load()}).catch(()=>location.href="/dealer/login")},[]);

  async function moveLead(id:string,status:string){
    setBusy(id+status);
    const r=await fetch(`/api/leads/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)setMessage(j.error||"Lead could not be updated");else await load();
    setBusy("");
  }

  async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/dealer/login"}

  const summary=data?.summary||{};
  const leads=data?.leads||[];
  const hot=data?.hotLeads||[];
  const inventory=data?.inventory||[];
  const next=hot[0];
  const pipeline=data?.pipeline||{};
  const active=useMemo(()=>leads.filter((x:any)=>!["sold","lost"].includes(x.pipelineStage)),[leads]);
  const responseSla=useMemo(()=>{const responded=active.filter((x:any)=>x.dealerFirstResponseAt||x.dealer_first_response_at||["contacted","engaged","qualified","appointment","showed","deal","sold"].includes(x.pipelineStage)).length;return active.length?Math.round(responded/active.length*100):0},[active]);
  const xp=(summary.sold||0)*150+(pipeline.appointment||0)*30+(pipeline.showed||0)*50+(pipeline.qualified||0)*15;

  if(!session?.authenticated)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;

  const kpiLinkStyle:any={position:"absolute",inset:0,zIndex:3,borderRadius:"inherit"};
  const kpiStyle:any={position:"relative",cursor:"pointer"};
  const arrowStyle:any={position:"absolute",right:14,top:12,fontStyle:"normal",fontSize:19,color:"#8293a3",lineHeight:1};

  return <main className="crmShell">
    <aside className="crmSidebar">
      <Link className="crmLogo" href="/dealer"><img src="/wdcc-official-logo.webp" alt="WDCC"/><span>SALES COMMAND</span></Link>
      <nav>
        <Link className="active" href="/dealer">Today</Link>
        <Link href="/dealer/leads">Leads</Link>
        <a href="#pipeline">Pipeline</a>
        <Link href="/dealer/leads?view=appointments">Appointments</Link>
        <Link href="/dealer/inventory?view=published">Inventory</Link>
        <Link href="/dealer/inventory/new">+ Add Vehicle</Link>
        <Link href="/">View Website</Link>
      </nav>
      <button className="crmLogout" onClick={logout}>Log out</button>
    </aside>

    <section className="crmMain">
      <header className="crmTopbar">
        <div><span className="crmKicker">WDCC AUTOMOTIVE CRM</span><h1>My Day</h1><p>{session?.user?.displayName||session?.user?.username||"Sales"} · focus on the buyers closest to action.</p></div>
        <div className="momentum"><span>Momentum</span><strong>{xp} XP</strong><small>{responseSla}% response coverage</small></div>
      </header>

      {message&&<div className="crmAlert">{message}</div>}

      <section className="crmKpis">
        <article style={kpiStyle}><Link href="/dealer/leads?view=new-today" aria-label="View new leads from today" style={kpiLinkStyle}/><em style={arrowStyle}>›</em><span>New today</span><strong>{summary.newToday||0}</strong><small>fresh opportunities</small></article>
        <article style={kpiStyle}><Link href="/dealer/leads?view=hot" aria-label="View hot buyers" style={kpiLinkStyle}/><em style={arrowStyle}>›</em><span>Hot buyers</span><strong>{summary.hotLeads||0}</strong><small>priority 70+</small></article>
        <article style={kpiStyle}><Link href="/dealer/leads?view=appointments" aria-label="View appointments" style={kpiLinkStyle}/><em style={arrowStyle}>›</em><span>Appointments</span><strong>{summary.appointments||0}</strong><small>protect the show rate</small></article>
        <article style={kpiStyle}><Link href="/dealer/inventory?view=published" aria-label="View live inventory" style={kpiLinkStyle}/><em style={arrowStyle}>›</em><span>Live inventory</span><strong>{summary.publishedInventory||0}</strong><small>customer-visible cars</small></article>
        <article style={kpiStyle}><Link href="/dealer/leads?view=sold" aria-label="View sold opportunities" style={kpiLinkStyle}/><em style={arrowStyle}>›</em><span>Sold</span><strong>{summary.sold||0}</strong><small>closed opportunities</small></article>
      </section>

      <div className="crmHeroGrid">
        <section className="nextBestCard">
          <div className="crmSectionHead"><div><span>DO THIS NOW</span><h2>Next Best Move</h2></div>{next&&<b>{Math.round(next.priority||0)} PRIORITY</b>}</div>
          {next?<div className="nextLead">
            <div className="nextIdentity"><span className="hotDot">HOT</span><div><h3>{next.name||"Unnamed buyer"}</h3><p>{next.vehicleInterest||"General vehicle inquiry"}</p></div></div>
            <div className="nextSignals"><span>{next.kind||"lead"}</span><span>{stageLabels[next.pipelineStage]||next.pipelineStage}</span><span>{when(next.createdAt)}</span></div>
            <div className="nextAction"><small>WDCC recommends</small><strong>{next.nextAction||"Make contact"}</strong><p>{next.phone?"Reach the buyer while intent is still fresh.":"Follow up through the available contact channel."}</p></div>
            <div className="nextButtons">{next.phone&&<a className="crmPrimary" href={`tel:${next.phone}`}>Call now</a>}{next.phone&&<a href={`sms:${next.phone}`}>Text</a>}<Link href={`/dealer/leads?view=${next.priority>=70?"hot":"active"}`}>Open lead</Link></div>
          </div>:<div className="crmEmpty">No active leads yet. New website requests will appear here automatically.</div>}
        </section>

        <section className="scoreCard">
          <div className="crmSectionHead"><div><span>TODAY'S SCORE</span><h2>Sales Momentum</h2></div></div>
          <div className="scoreRing"><div><strong>{Math.min(100,responseSla)}</strong><span>coverage</span></div></div>
          <div className="scoreRows"><div><span>Follow-up coverage</span><b>{responseSla}%</b></div><div><span>Qualified</span><b>{pipeline.qualified||0}</b></div><div><span>Shows</span><b>{pipeline.showed||0}</b></div><div><span>Deals working</span><b>{pipeline.deal||0}</b></div></div>
          <p className="scoreNote">XP rewards appointments, shows and sold outcomes — not spam activity.</p>
        </section>
      </div>

      <section className="pipelinePanel" id="pipeline">
        <div className="crmSectionHead"><div><span>LEAD TO CLOSE</span><h2>Automotive Pipeline</h2></div><Link href="/dealer/leads">View all leads →</Link></div>
        <div className="pipelineStages">{stageOrder.map(stage=><div key={stage}><strong>{pipeline[stage]||0}</strong><span>{stageLabels[stage]}</span><i style={{width:`${Math.min(100,(pipeline[stage]||0)*18)}%`}}/></div>)}</div>
      </section>

      <div className="crmLowerGrid">
        <section className="crmPanel">
          <div className="crmSectionHead"><div><span>PRIORITY QUEUE</span><h2>Hot Buyers</h2></div><Link href="/dealer/leads?view=hot">All hot buyers</Link></div>
          <div className="hotList">{hot.slice(0,6).map((lead:any)=><article key={lead.id}>
            <div className="leadScore">{Math.round(lead.priority||0)}</div>
            <div className="hotPerson"><strong>{lead.name||"Unnamed buyer"}</strong><span>{lead.vehicleInterest||"General inquiry"}</span><small>{when(lead.createdAt)}</small></div>
            <div className="hotAction"><b>{lead.nextAction}</b><select value={lead.pipelineStage||"new"} onChange={e=>moveLead(lead.id,e.target.value)} disabled={busy.startsWith(lead.id)}>{stageOrder.filter(s=>s!=="deal").concat(["deal_working","lost"]).map(s=><option key={s} value={s}>{stageLabels[s]||s}</option>)}</select></div>
          </article>)}{!hot.length&&<div className="crmEmpty">No hot leads yet.</div>}</div>
        </section>

        <section className="crmPanel inventoryPulse">
          <div className="crmSectionHead"><div><span>SELL WHAT IS LIVE</span><h2>Inventory Pulse</h2></div><Link href="/dealer/inventory?view=published">Manage →</Link></div>
          <div className="inventoryPulseList">{inventory.slice(0,5).map((v:any)=>{const photo=vehiclePhoto(v);return <Link href={`/vehicle/${v.id}`} key={v.id}>{photo?<img src={photo} alt={`${v.year||""} ${v.make||""} ${v.model||""}`.trim()} style={{width:58,height:44,objectFit:"cover",borderRadius:8,flex:"0 0 auto",background:"#0b1824",border:"1px solid #22394c"}}/>:<span aria-hidden="true" style={{width:58,height:44,borderRadius:8,flex:"0 0 auto",display:"grid",placeItems:"center",background:"#0b1824",border:"1px solid #22394c",fontSize:8,color:"#748698",fontWeight:800}}>NO PHOTO</span>}<div><strong>{v.year} {v.make} {v.model}</strong><span>{money(v.price)} · {Number(v.mileage||0).toLocaleString()} mi</span></div><b>LIVE</b></Link>})}{!inventory.length&&<div className="crmEmpty">No published inventory.</div>}</div>
          <Link className="addVehicleQuick" href="/dealer/inventory/new">+ Add a vehicle</Link>
        </section>
      </div>
    </section>
  </main>;
}
