"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import DealerNav,{type DealerNavKey} from "./DealerNav";

type ModuleKey="appointments"|"test-drives"|"customers"|"applications"|"messages"|"reports"|"settings";
type RecordRow=Record<string,any>;

const configs:Record<ModuleKey,{title:string;subtitle:string;empty:string}>={
  appointments:{title:"Appointments",subtitle:"Scheduled customer follow-ups and dealership appointments.",empty:"No appointments are currently scheduled."},
  "test-drives":{title:"Test Drives",subtitle:"Vehicle test-drive requests and scheduled drives.",empty:"No test drives are currently scheduled."},
  customers:{title:"Customers",subtitle:"Customer records created from real dealership lead activity.",empty:"No customer records are available yet."},
  applications:{title:"Applications",subtitle:"Financing and pre-approval requests in the sales pipeline.",empty:"No financing applications are available yet."},
  messages:{title:"Messages",subtitle:"Customer contact requests and conversation follow-up.",empty:"No customer messages are available yet."},
  reports:{title:"Reports",subtitle:"Operational inventory and lead summary for the dealership.",empty:"Reporting data is not available from the current provider."},
  settings:{title:"Settings",subtitle:"Dealer profile, security and application configuration.",empty:"Advanced provider-backed settings are not available in this environment."}
};
const text=(v:any)=>String(v??"").trim();
const lower=(v:any)=>text(v).toLowerCase();
const stage=(v:RecordRow)=>lower(v.pipelineStage||v.stage||v.status||"new");
const kind=(v:RecordRow)=>lower(v.kind||v.type||v.source||"");
const when=(v:any)=>{const d=new Date(v||0);return Number.isFinite(d.getTime())&&d.getTime()>0?d.toLocaleString():"—"};
const customerKey=(v:RecordRow)=>lower(v.email)||lower(v.phone)||lower(v.name||v.customerName)||String(v.id||"");

export default function DealerOperationsModule({module}:{module:ModuleKey}){
  const[ready,setReady]=useState(false),[data,setData]=useState<any>(null),[message,setMessage]=useState("Loading module…");
  const config=configs[module];
  useEffect(()=>{
    let live=true;
    (async()=>{
      const sr=await fetch("/api/auth/session",{cache:"no-store",credentials:"include"}),sj=await sr.json().catch(()=>({}));
      if(!sj?.authenticated){location.href="/dealer";return}
      if(!live)return;setReady(true);
      const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"}),j=await r.json().catch(()=>({}));
      if(!live)return;
      if(!r.ok){setData({summary:{},leads:[],inventory:[]});setMessage(j.error||`Module provider unavailable (${r.status}).`);return}
      setData(j);setMessage("");
    })().catch(e=>{if(live){setReady(true);setData({summary:{},leads:[],inventory:[]});setMessage(e instanceof Error?e.message:"Module provider unavailable.")}});
    return()=>{live=false};
  },[module]);

  const leads:RecordRow[]=Array.isArray(data?.leads)?data.leads:[];
  const inventory:RecordRow[]=Array.isArray(data?.inventory)?data.inventory:[];
  const rows=useMemo(()=>{
    if(module==="appointments")return leads.filter(v=>kind(v).includes("appointment")||kind(v).includes("schedule")||["appointment","showed"].includes(stage(v)));
    if(module==="test-drives")return leads.filter(v=>kind(v).includes("test")||kind(v).includes("drive")||stage(v)==="showed");
    if(module==="applications")return leads.filter(v=>kind(v).includes("application")||kind(v).includes("approval")||stage(v)==="approved");
    if(module==="messages")return leads.filter(v=>kind(v).includes("message")||kind(v).includes("contact")||kind(v).includes("call")||text(v.message));
    if(module==="customers"){
      const seen=new Set<string>();return leads.filter(v=>{const k=customerKey(v);if(!k||seen.has(k))return false;seen.add(k);return true});
    }
    return [];
  },[leads,module]);

  if(!ready)return <main className="wdccGate">Checking secure dealer session…</main>;
  const summary=data?.summary||{};
  const published=inventory.filter(v=>lower(v.status)==="published").length;
  const drafts=inventory.filter(v=>lower(v.status)==="draft").length;
  return <main className="dcPage dealerModulePage">
    <header className="dcTop"><Link className="brand" href="/dealer"><img src="/wdcc-official-logo.webp" alt="WDCC"/><span><b>WDCC · DEALER PORTAL</b><small>Dealership Operations</small></span></Link><div className="moduleTopActions"><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span><Link className="dcButton" href="/dealer/settings">Settings</Link></div></header>
    <div className="dcShell"><aside className="dcSide"><DealerNav active={module as DealerNavKey}/></aside><section className="dcContent moduleContent">
      <div className="dcTitle"><div><h1>{config.title}</h1><p>{config.subtitle}</p></div><Link className="dcButton" href="/dealer">Dashboard</Link></div>
      {message&&<div className="dcError">{message} This module is not being disguised as complete.</div>}
      {module==="reports"?<div className="moduleReportGrid"><article className="dcCard"><span>Total Vehicles</span><b>{inventory.length}</b></article><article className="dcCard"><span>Published</span><b>{published}</b></article><article className="dcCard"><span>Drafts</span><b>{drafts}</b></article><article className="dcCard"><span>Leads</span><b>{leads.length}</b></article><article className="dcCard"><span>Appointments</span><b>{Number(summary.appointments??leads.filter(v=>kind(v).includes("appointment")||kind(v).includes("schedule")).length)}</b></article><article className="dcCard"><span>Applications</span><b>{Number(summary.applications??leads.filter(v=>kind(v).includes("application")||kind(v).includes("approval")).length)}</b></article></div>
      :module==="settings"?<section className="dcCard moduleSettings"><h2>Dealer Profile</h2><div><span>Dealership</span><b>We Don&apos;t Care Cars</b></div><div><span>Market</span><b>Tampa Bay</b></div><div><span>Sales contact</span><b>Sean · (813) 516-4752</b></div><div><span>Authentication</span><b>Secure dealer session</b></div><p>Provider-managed user permissions, notification provisioning and advanced settings remain explicit unavailable states until their backend services are healthy.</p></section>
      :<section className="dcCard moduleTable"><div className="moduleHead"><span>CUSTOMER</span><span>VEHICLE / CONTEXT</span><span>STATUS</span><span>RECEIVED</span><span>ACTION</span></div>{rows.map((row,i)=>{const id=String(row.id||i),name=text(row.name||row.customerName)||"Customer",context=text(row.vehicleInterest||row.vehicle||row.message||row.source)||config.title;return <article key={id}><div><b>{name}</b><small>{text(row.phone||row.email)||"Contact information unavailable"}</small></div><span>{context}</span><em>{stage(row).replaceAll("_"," ")}</em><time>{when(row.createdAt||row.updatedAt)}</time><Link href={`/dealer/crm/${encodeURIComponent(id)}`}>Open</Link></article>})}{!rows.length&&!message&&<div className="moduleEmpty">{config.empty}</div>}</section>}
    </section></div>
    <nav className="moduleMobileNav"><Link href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link href="/dealer/leads">♙<span>Leads</span></Link><Link className="active" href="/dealer/settings">•••<span>More</span></Link></nav>
    <style jsx global>{css}</style>
  </main>;
}

const css=`
.dealerModulePage .moduleTopActions{display:flex;align-items:center;gap:9px}.dealerModulePage .moduleTopActions>span{font-size:9px;color:#bdc8d0}.moduleContent{max-width:1320px;width:100%;margin:auto}.moduleReportGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.moduleReportGrid article{min-height:110px}.moduleReportGrid span,.moduleSettings span{display:block;color:#697681;font-size:10px}.moduleReportGrid b{display:block;margin-top:12px;font-size:31px}.moduleSettings{max-width:760px}.moduleSettings h2{margin-top:0}.moduleSettings>div{display:grid;grid-template-columns:170px 1fr;gap:14px;padding:12px 0;border-top:1px solid #e0e5e8}.moduleSettings>div b{font-size:12px}.moduleSettings p{margin:18px 0 0;color:#687680;line-height:1.5}.moduleTable{padding:0!important;overflow:hidden}.moduleHead,.moduleTable>article{display:grid;grid-template-columns:1.2fr 1.3fr .65fr .8fr .45fr;gap:12px;align-items:center}.moduleHead{padding:11px 14px;background:#f5f7f8;border-bottom:1px solid #dfe4e7;color:#697680;font-size:8px;font-weight:950}.moduleTable>article{min-height:72px;padding:10px 14px;border-bottom:1px solid #e6eaed}.moduleTable article b,.moduleTable article small{display:block}.moduleTable article b{font-size:11px}.moduleTable article small{font-size:8px;color:#73808a;margin-top:4px}.moduleTable article>span,.moduleTable article>time{font-size:9px;color:#55636e}.moduleTable article>em{font-style:normal;text-transform:uppercase;font-size:7px;font-weight:900;color:#166f46;background:#e8f6ee;border-radius:999px;padding:5px 7px;width:max-content}.moduleTable article>a{display:grid;place-items:center;min-height:34px;border-radius:5px;background:#f21f32;color:#fff;font-size:8px;font-weight:950}.moduleEmpty{padding:38px;text-align:center;color:#687680}.moduleMobileNav{display:none}
@media(max-width:760px){.dealerModulePage{padding-bottom:82px}.dealerModulePage .moduleTopActions>span,.dealerModulePage .moduleTopActions>a:first-child{display:none}.moduleReportGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.moduleHead{display:none}.moduleTable{background:transparent;border:0;box-shadow:none;display:grid;gap:9px}.moduleTable>article{background:#fff;border:1px solid #dde3e7;border-radius:8px;display:grid;grid-template-columns:1fr auto;gap:7px;padding:12px;min-height:0}.moduleTable article>div{grid-column:1}.moduleTable article>span{grid-column:1/-1}.moduleTable article>time{grid-column:1}.moduleTable article>em{grid-column:2;grid-row:1}.moduleTable article>a{grid-column:2;grid-row:3}.moduleSettings>div{grid-template-columns:1fr}.moduleMobileNav{position:fixed;left:0;right:0;bottom:0;z-index:80;display:grid;grid-template-columns:repeat(5,1fr);background:#06121d;border-top:1px solid #203548;padding:7px 4px max(9px,env(safe-area-inset-bottom));color:#aebbc5}.moduleMobileNav a{display:grid;place-items:center;gap:2px;font-size:18px;color:#aebbc5}.moduleMobileNav span{font-size:7px}.moduleMobileNav .active{color:#f21f32}.moduleMobileNav .add{width:56px;height:56px;background:#f21f32;color:#fff;border-radius:50%;justify-self:center;margin-top:-25px;font-size:28px}.moduleMobileNav .add span{position:absolute;margin-top:76px;color:#fff}}
`;
