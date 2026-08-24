"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

const LOGO="https://wdcc-v32-storefront-dkel7d5n2-cpxagency.vercel.app/wdcc-logo-transparent.webp";
const sameDay=(v:any)=>{if(!v)return false;const d=new Date(v),n=new Date();return !Number.isNaN(d.getTime())&&d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()};
const txt=(v:any)=>String(v||"").toLowerCase();
const when=(v:any)=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};

export default function DealerHome(){
  const[session,setSession]=useState<any>();
  const[data,setData]=useState<any>();
  const[message,setMessage]=useState("Loading Dealer Command…");

  useEffect(()=>{
    fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(async s=>{
      setSession(s);
      if(!s.authenticated){location.href="/dealer/login";return;}
      const r=await fetch("/api/crm/dashboard",{cache:"no-store"});
      if(r.status===401){location.href="/dealer/login";return;}
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Dealer Command could not be loaded");
      setData(j);setMessage("");
    }).catch(e=>setMessage(e?.message||"Dealer Command could not be loaded"));
  },[]);

  const summary=data?.summary||{};
  const leads=data?.leads||[];
  const latest=leads[0];
  const newToday=Number(summary.newToday||0);
  const hot=Number(summary.hotLeads||0);
  const appointmentsToday=useMemo(()=>leads.filter((l:any)=>sameDay(l.appointmentAt||l.appointment_at||l.scheduledAt||l.scheduled_at||l.testDriveAt||l.test_drive_at)).length,[leads]);
  const testDrives=useMemo(()=>leads.filter((l:any)=>{const s=[l.kind,l.source,l.message,l.vehicleInterest].map(txt).join(" ");return (s.includes("test drive")||s.includes("test-drive")||s.includes("schedule-test-drive"))&&!['sold','lost'].includes(l.pipelineStage)}).length,[leads]);
  const attention=[newToday,appointmentsToday,testDrives,hot].filter(v=>v>0).length;

  if(!session?.authenticated)return <main className="dealerLaunchShell"><div className="dealerLaunchLoading">Checking secure session…</div></main>;

  return <main className="dealerLaunchShell">
    <header className="dealerLaunchHeader">
      <img src={LOGO} alt="We Don't Care Cars"/>
      <div><span>DEALER COMMAND</span><strong>{session?.user?.displayName||session?.user?.username||"Dealer"}</strong></div>
      <Link className="dealerBell" href="/dealer/leads" aria-label="Notifications"><span>●</span><b>{attention}</b></Link>
    </header>

    <section className="dealerLaunchHero">
      <span className="dealerLaunchKicker">WHAT DO YOU NEED TO DO?</span>
      <h1>Keep it simple.</h1>
      <p>Post a vehicle fast or open the full dashboard. Anything that needs attention is right below.</p>
    </section>

    <section className="dealerPrimaryActions">
      <Link className="dealerPrimaryCard post" href="/dealer/inventory/new"><div className="dealerActionIcon">＋</div><div><small>INVENTORY</small><h2>Post a Car</h2><p>Take photos, enter details, save a draft or publish it live.</p></div><b>START →</b></Link>
      <Link className="dealerPrimaryCard dashboard" href="/dealer/dashboard"><div className="dealerActionIcon">▦</div><div><small>SALES COMMAND</small><h2>Dashboard</h2><p>Leads, appointments, pipeline, hot buyers, inventory and follow-up.</p></div><b>OPEN →</b></Link>
    </section>

    <section className="dealerAttention">
      <div className="dealerAttentionHead"><div><span>NOTIFICATIONS</span><h2>Needs Attention</h2></div><Link href="/dealer/leads">View leads →</Link></div>
      <div className="dealerNoticeGrid">
        <Link className={`dealerNotice ${newToday?"live":"quiet"}`} href="/dealer/leads"><i>NEW</i><strong>{newToday}</strong><div><b>New leads today</b><span>{newToday?"Fresh customer requests are waiting.":"No new leads yet today."}</span></div></Link>
        <Link className={`dealerNotice ${appointmentsToday?"live":"quiet"}`} href="/dealer/dashboard"><i>CAL</i><strong>{appointmentsToday}</strong><div><b>Appointments today</b><span>{appointmentsToday?"Protect the appointment and show rate.":"Nothing scheduled for today yet."}</span></div></Link>
        <Link className={`dealerNotice ${testDrives?"live":"quiet"}`} href="/dealer/leads"><i>DRIVE</i><strong>{testDrives}</strong><div><b>Test drive requests</b><span>{testDrives?"Confirm time, vehicle and customer.":"No open test-drive requests."}</span></div></Link>
        <Link className={`dealerNotice ${hot?"hot":"quiet"}`} href="/dealer/leads"><i>HOT</i><strong>{hot}</strong><div><b>Hot buyers</b><span>{hot?"High-intent buyers need a response.":"No high-priority buyers waiting."}</span></div></Link>
      </div>
    </section>

    {latest&&<section className="dealerLatestLead"><div><span>LATEST LEAD</span><h3>{latest.name||"Unnamed buyer"}</h3><p>{latest.vehicleInterest||latest.kind||"General vehicle inquiry"}</p><small>{when(latest.createdAt)}</small></div><div className="dealerLatestActions">{latest.phone&&<a href={`tel:${latest.phone}`}>Call</a>}{latest.phone&&<a href={`sms:${latest.phone}`}>Text</a>}<Link href="/dealer/leads">Open Lead</Link></div></section>}
    {message&&<div className="dealerLaunchMessage">{message}</div>}

    <nav className="dealerQuickNav"><Link href="/dealer">Home</Link><Link href="/dealer/leads">Leads</Link><Link href="/dealer/inventory">Inventory</Link><Link href="/">Website</Link></nav>
  </main>;
}
