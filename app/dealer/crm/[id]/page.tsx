"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import styles from "./customer.module.css";

const stageNames:any={new:"New",contacted:"Contacted",engaged:"Engaged",qualified:"Qualified",appointment:"Appointment",showed:"Showed",deal:"Deal Working",sold:"Sold",lost:"Lost"};
function tel(phone?:string){return `tel:${String(phone||"").replace(/[^+\d]/g,"")}`}
function sms(phone?:string){return `sms:${String(phone||"").replace(/[^+\d]/g,"")}`}
function when(value?:string){if(!value)return "Unknown";const d=new Date(value);return Number.isNaN(d.valueOf())?"Unknown":d.toLocaleString()}

export default function Customer360(){
  const params=useParams<{id:string}>();const id=decodeURIComponent(String(params?.id||""));
  const[data,setData]=useState<any>(null);const[error,setError]=useState("");
  useEffect(()=>{fetch("/api/crm/dashboard",{cache:"no-store"}).then(async r=>{if(r.status===401){location.href="/dealer";return}const j=await r.json();if(!r.ok)throw Error(j.error||"CRM failed to load");setData(j)}).catch(e=>setError(e.message||"CRM failed to load"))},[]);
  const lead=useMemo(()=>data?.leads?.find((x:any)=>String(x.id)===id),[data,id]);
  const matches=useMemo(()=>{if(!lead||!data?.inventory)return[];const interest=String(lead.vehicleInterest||"").toLowerCase();if(!interest)return data.inventory.slice(0,3);const words=interest.split(/[^a-z0-9]+/).filter((w:string)=>w.length>2);return [...data.inventory].map((v:any)=>({v,score:words.filter((w:string)=>`${v.year} ${v.make} ${v.model} ${v.trim||""}`.toLowerCase().includes(w)).length})).sort((a:any,b:any)=>b.score-a.score).filter((x:any)=>x.score>0).slice(0,3).map((x:any)=>x.v)},[data,lead]);
  if(!data&&!error)return <main className={styles.loading}>Loading Customer 360…</main>;
  if(error)return <main className={styles.loading}>{error}</main>;
  if(!lead)return <main className={styles.loading}><div><h1>Lead not found</h1><Link href="/dealer/crm">Back to CRM</Link></div></main>;
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/dealer/crm">← CRM</Link><div><span>CUSTOMER 360</span><h1>{lead.name||"Unnamed lead"}</h1></div><b>{stageNames[lead.pipelineStage]||lead.pipelineStage||"New"}</b></header>
    <section className={styles.hero}><div><span className={styles.kicker}>NEXT BEST ACTION</span><h2>{lead.nextAction||"Make contact"}</h2><p>Based on the actual request type, current stage and recency of this lead.</p><div className={styles.actions}>{lead.phone&&<a className={styles.primary} href={tel(lead.phone)}>Call now</a>}{lead.phone&&<a href={sms(lead.phone)}>Text</a>}{lead.email&&<a href={`mailto:${lead.email}`}>Email</a>}</div></div><div className={styles.score}><span>ACTION PRIORITY</span><strong>{lead.priority??"—"}</strong><small>Rule-based until outcome history is sufficient for predictive scoring.</small></div></section>
    <section className={styles.grid}><article className={styles.panel}><span className={styles.label}>CONTACT</span><dl><div><dt>Phone</dt><dd>{lead.phone||"Not provided"}</dd></div><div><dt>Email</dt><dd>{lead.email||"Not provided"}</dd></div><div><dt>Source</dt><dd>{lead.source||"Unknown"}</dd></div><div><dt>Created</dt><dd>{when(lead.createdAt)}</dd></div></dl></article><article className={styles.panel}><span className={styles.label}>BUYER REQUEST</span><dl><div><dt>Type</dt><dd>{lead.kind||"Lead"}</dd></div><div><dt>Vehicle</dt><dd>{lead.vehicleInterest||"Open to options"}</dd></div><div><dt>Preferred time</dt><dd>{lead.preferredTime||"Not specified"}</dd></div><div><dt>Status</dt><dd>{stageNames[lead.pipelineStage]||lead.status||"New"}</dd></div></dl></article><article className={`${styles.panel} ${styles.note}`}><span className={styles.label}>LATEST NOTE</span><p>{lead.message||"No note was submitted with this lead."}</p></article></section>
    <section className={styles.panel}><div className={styles.sectionHead}><div><span className={styles.label}>INVENTORY MATCH</span><h2>Vehicles to discuss</h2></div><Link href="/dealer/inventory">All inventory →</Link></div><div className={styles.cars}>{matches.length?matches.map((v:any)=><article key={v.id}><div className={styles.photo}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt=""/>:<span>PHOTO PENDING</span>}</div><div><small>{v.year} {v.make}</small><strong>{v.model} {v.trim||""}</strong><b>${Number(v.price||0).toLocaleString()}</b><span>{Number(v.mileage||0).toLocaleString()} mi · ${Number(v.downPayment||0).toLocaleString()} down</span></div><Link href={`/vehicle/${v.id}`}>View →</Link></article>):<p>No direct vehicle match yet. Open the inventory to choose one.</p>}</div></section>
    <section className={styles.panel}><div className={styles.sectionHead}><div><span className={styles.label}>TIMELINE</span><h2>What we know</h2></div></div><div className={styles.timeline}><div><i/><strong>Lead captured</strong><span>{when(lead.createdAt)}</span></div>{lead.notifications&&<div><i/><strong>Notification routing</strong><span>Email: {lead.notifications.email||"unknown"} · Webhook: {lead.notifications.webhook||"unknown"}</span></div>}<div><i/><strong>Current stage</strong><span>{stageNames[lead.pipelineStage]||lead.pipelineStage||"New"}</span></div></div></section>
  </main>;
}
