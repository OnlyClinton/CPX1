"use client";

import Link from"next/link";
import{useEffect,useMemo,useState}from"react";
import{appointmentIntent,createdAtOf,firstContactDue,leadScore,notificationState,sameLocalDay,slaState,sourceLabel,stageLabels,stageOf,when,type LeadRecord}from"../crmFilters";

const editableStages=["new","contacted","engaged","qualified","appointment","showed","deal_working","approved","sold","lost","nurture"];
const filters=[
  ["all","ALL"],["view:overdue","OVERDUE"],["stage:new","NEW"],["stage:contacted","CONTACTED"],["stage:engaged","ENGAGED"],["stage:qualified","QUALIFIED"],["stage:appointment","APPOINTMENT"],["stage:showed","SHOWED"],["stage:deal_working","DEAL WORKING"],["stage:sold","SOLD"],["view:hot","HOT BUYERS"],["view:new-today","NEW TODAY"],["view:appointments","APPOINTMENTS"]
] as const;

function filterFromLocation(){
  if(typeof window==="undefined")return"all";
  const q=new URLSearchParams(window.location.search),stage=q.get("stage"),view=q.get("view");
  if(stage)return`stage:${stage}`;
  if(view)return`view:${view}`;
  return"all";
}
function titleFor(key:string){
  if(key==="all")return"All Leads";
  const[type,value]=key.split(":");
  if(type==="stage")return`${stageLabels[value]||value} Leads`;
  return value==="overdue"?"Overdue First Contact":value==="hot"?"Hot Buyers":value==="new-today"?"New Today":value==="appointments"?"Appointments":"Leads";
}

export default function DealerLeads(){
  const[items,setItems]=useState<LeadRecord[]>([]);
  const[message,setMessage]=useState("Loading leads…");
  const[filterKey,setFilterKey]=useState("all");
  const[busy,setBusy]=useState("");

  async function load(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    if(r.status===401){location.href="/dealer";return}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||"Lead list failed");
    setItems(Array.isArray(j.leads)?j.leads:[]);setMessage("");
  }
  useEffect(()=>{setFilterKey(filterFromLocation());load().catch(e=>setMessage(e.message||"Lead list failed"))},[]);

  async function update(id:string,status:string){
    setBusy(id);
    try{
      const r=await fetch(`/api/leads/${encodeURIComponent(id)}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(j.error||"Lead update failed");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Lead update failed")}
    finally{setBusy("")}
  }

  function choose(key:string){
    setFilterKey(key);
    const url=new URL(window.location.href);url.search="";
    if(key.startsWith("stage:"))url.searchParams.set("stage",key.slice(6));
    if(key.startsWith("view:"))url.searchParams.set("view",key.slice(5));
    history.replaceState({},"",url.pathname+url.search);
  }

  const filtered=useMemo(()=>{
    const rows=[...items].sort((a,b)=>new Date(createdAtOf(b)||0).getTime()-new Date(createdAtOf(a)||0).getTime());
    if(filterKey==="all")return rows;
    const[type,value]=filterKey.split(":");
    if(type==="stage")return rows.filter(x=>stageOf(x)===value);
    if(value==="overdue")return rows.filter(firstContactDue).sort((a,b)=>(slaState(b).minutes||0)-(slaState(a).minutes||0));
    if(value==="hot")return rows.filter(x=>leadScore(x)>=70).sort((a,b)=>leadScore(b)-leadScore(a));
    if(value==="new-today")return rows.filter(x=>sameLocalDay(createdAtOf(x)));
    if(value==="appointments")return rows.filter(appointmentIntent);
    return rows;
  },[items,filterKey]);

  function countFor(key:string){
    if(key==="all")return items.length;
    if(key.startsWith("stage:"))return items.filter(x=>stageOf(x)===key.slice(6)).length;
    if(key==="view:overdue")return items.filter(firstContactDue).length;
    if(key==="view:hot")return items.filter(x=>leadScore(x)>=70).length;
    if(key==="view:new-today")return items.filter(x=>sameLocalDay(createdAtOf(x))).length;
    return items.filter(appointmentIntent).length;
  }

  return <main className="leadCommandApp">
    <header className="leadCommandTop"><Link href="/dealer" className="leadCommandBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><span>SALES COMMAND</span></Link><div className="leadTopLinks"><Link href="/dealer">DASHBOARD</Link><Link href="/dealer/inventory">INVENTORY</Link><Link href="/dealer/inventory/new">＋ ADD VEHICLE</Link></div></header>
    <div className="leadCommandBody">
      <div className="leadCommandTitle"><div><span>ACCOUNT TABLE</span><h1>{titleFor(filterKey)} <b>{filtered.length}</b></h1><p>Priority, speed-to-lead and notification delivery are visible in one row.</p></div><Link href="/dealer">← DASHBOARD</Link></div>

      <div className="leadFilterStrip" role="tablist" aria-label="Lead filters">{filters.map(([key,label])=><button key={key} type="button" className={filterKey===key?"active":""} onClick={()=>choose(key)}>{label}<b>{countFor(key)}</b></button>)}</div>

      {message&&<div className="leadCommandNotice">{message}</div>}
      <section className="leadTablePanel">
        <div className="leadTableScroll"><table className="accountTable"><thead><tr><th>NAME</th><th>PHONE</th><th>EMAIL</th><th>SOURCE</th><th>VEHICLE / INTEREST</th><th>STAGE</th><th>PRIORITY</th><th>SLA</th><th>NOTIFY</th><th>RECEIVED</th><th>ACTIONS</th></tr></thead><tbody>{filtered.map(lead=>{const sla=slaState(lead),notify=notificationState(lead);return <tr key={lead.id}>
          <td><Link className="accountName" href={`/dealer/crm/${encodeURIComponent(lead.id)}`}>{lead.name||lead.customerName||"Unnamed buyer"}</Link></td>
          <td>{lead.phone||"—"}</td><td>{lead.email||"—"}</td><td>{sourceLabel(lead)}</td><td>{lead.vehicleInterest||lead.vehicle||"General inquiry"}</td>
          <td><select value={stageOf(lead)} disabled={busy===lead.id} onChange={e=>update(String(lead.id),e.target.value)}>{editableStages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]||stage}</option>)}</select></td>
          <td><span className={`priorityScore ${leadScore(lead)>=70?"hot":""}`}>{leadScore(lead)}</span></td>
          <td><span className={`opsBadge tone-${sla.tone}`}>{sla.label}</span></td><td><span className={`opsBadge tone-${notify.tone}`}>{notify.label}</span></td><td>{when(createdAtOf(lead))||"—"}</td>
          <td><div className="accountActions"><Link href={`/dealer/crm/${encodeURIComponent(lead.id)}`}>OPEN</Link>{lead.phone&&<a href={`tel:${lead.phone}`}>CALL</a>}{lead.phone&&<a href={`sms:${lead.phone}`}>TEXT</a>}</div></td>
        </tr>})}{!filtered.length&&!message&&<tr><td colSpan={11} className="emptyRows">No records match this dashboard tile.</td></tr>}</tbody></table></div>
      </section>
    </div>
    <nav className="leadMobileDock"><Link href="/dealer">⌂<span>HOME</span></Link><Link className="active" href="/dealer/leads">☷<span>LEADS</span></Link><Link href="/dealer/inventory">▣<span>INVENTORY</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>ADD</span></Link></nav>
    <style jsx global>{css}</style>
  </main>;
}

const css=`
*{box-sizing:border-box}.leadCommandApp{min-height:100svh;background:#03080d;color:#e8edf2;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding-bottom:30px}.leadCommandTop{height:84px;position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,4vw,42px);background:#06111bea;border-bottom:1px solid #193047;backdrop-filter:blur(18px)}.leadCommandBrand{display:flex;align-items:center;gap:13px}.leadCommandBrand img{width:76px;height:76px;object-fit:contain}.leadCommandBrand span{color:#8194a4;font-size:10px;font-weight:950;letter-spacing:.17em}.leadTopLinks{display:flex;gap:7px}.leadTopLinks a{min-height:40px;display:flex;align-items:center;padding:0 13px;border:1px solid #20384c;border-radius:8px;color:#aebdca;font-size:9px;font-weight:900}.leadTopLinks a:last-child{background:#ef233c;border-color:#ef233c;color:#fff}.leadCommandBody{width:min(1480px,calc(100% - 36px));margin:0 auto;padding:26px 0 40px}.leadCommandTitle{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.leadCommandTitle>div>span{color:#6faef6;font-size:10px;font-weight:950;letter-spacing:.16em}.leadCommandTitle h1{margin:6px 0 4px;color:#fff;font-size:34px;letter-spacing:-.035em}.leadCommandTitle h1 b{display:inline-grid;place-items:center;min-width:38px;height:32px;padding:0 10px;margin-left:8px;border:1px solid #29455d;border-radius:999px;color:#71b0f7;font-size:15px}.leadCommandTitle p{margin:0;color:#8295a5;font-size:12px}.leadCommandTitle>a{color:#8fb8e3;font-size:10px;font-weight:900}.leadFilterStrip{display:flex;gap:6px;overflow-x:auto;padding:2px 0 14px;scrollbar-width:none}.leadFilterStrip::-webkit-scrollbar{display:none}.leadFilterStrip button{flex:0 0 auto;min-height:42px;border:1px solid #1e3548;border-radius:9px;background:#081520;color:#8fa2b2;padding:0 12px;font-size:9px;font-weight:950;letter-spacing:.03em;cursor:pointer}.leadFilterStrip button b{display:inline-grid;place-items:center;min-width:23px;height:21px;margin-left:7px;padding:0 5px;border-radius:999px;background:#102335;color:#a9c2d8}.leadFilterStrip button.active{background:#102439;border-color:#3470a6;color:#fff}.leadFilterStrip button.active b{background:#1d78ca;color:#fff}.leadCommandNotice{margin-bottom:12px;padding:11px 13px;border:1px solid #765c1c;background:#372d0d;color:#ffe093;border-radius:9px;font-size:11px}.leadTablePanel{border:1px solid #1d3549;border-radius:15px;background:#07131d;overflow:hidden}.leadTableScroll{overflow:auto}.accountTable{width:100%;min-width:1420px;border-collapse:collapse}.accountTable th{height:48px;padding:0 12px;background:#091824;border-bottom:1px solid #1d3549;color:#71889a;text-align:left;font-size:8px;letter-spacing:.08em}.accountTable td{padding:14px 12px;border-bottom:1px solid #142a3b;color:#aebdca;font-size:10px;vertical-align:middle}.accountTable tbody tr:hover{background:#0a1a27}.accountName{color:#fff;font-size:13px;font-weight:950}.accountTable select{height:34px;min-width:120px;border:1px solid #2c465b;border-radius:7px;background:#0a1925;color:#dfe8ef;padding:0 8px;font-size:9px}.priorityScore{width:38px;height:38px;display:grid;place-items:center;border:1px solid #355068;border-radius:50%;color:#8fb1cc;font-weight:950}.priorityScore.hot{border-color:#7f2833;color:#ff6672;background:#31151b}.opsBadge{display:inline-flex;align-items:center;min-height:30px;padding:0 9px;border:1px solid #31495d;border-radius:999px;white-space:nowrap;font-size:8px;font-weight:950}.opsBadge.tone-good{color:#62dd98;border-color:#276347;background:#0d291d}.opsBadge.tone-warn{color:#ffd36a;border-color:#665222;background:#2a230e}.opsBadge.tone-hot{color:#ff707b;border-color:#742c36;background:#32151b}.opsBadge.tone-muted{color:#8799a8;border-color:#314151;background:#101923}.accountActions{display:flex;gap:5px}.accountActions a{min-height:32px;display:flex;align-items:center;padding:0 9px;border:1px solid #2d485e;border-radius:6px;color:#a9bfd0;font-size:8px;font-weight:950}.accountActions a:first-child{background:#1675ca;border-color:#1675ca;color:#fff}.emptyRows{text-align:center!important;padding:50px!important;color:#7f93a4!important}.leadMobileDock{display:none}
@media(max-width:900px){.leadCommandApp{padding-bottom:76px}.leadCommandTop{height:76px;padding:0 14px}.leadCommandBrand img{width:66px;height:66px}.leadCommandBrand span{font-size:8px}.leadTopLinks a:not(:last-child){display:none}.leadTopLinks a:last-child{font-size:0;width:42px;padding:0;justify-content:center}.leadTopLinks a:last-child:before{content:"+";font-size:25px}.leadCommandBody{width:calc(100% - 24px);padding-top:18px}.leadCommandTitle{align-items:flex-start}.leadCommandTitle h1{font-size:28px}.leadCommandTitle p{font-size:10px}.leadCommandTitle>a{font-size:0;width:38px;height:38px;border:1px solid #20384c;border-radius:9px;display:grid;place-items:center}.leadCommandTitle>a:before{content:"←";font-size:18px}.leadFilterStrip button{min-height:40px}.leadTablePanel{border-radius:12px}.accountTable{min-width:1360px}.accountTable td{padding:14px 10px}.leadMobileDock{position:fixed;display:grid;grid-template-columns:repeat(4,1fr);left:0;right:0;bottom:0;z-index:100;background:#050e16;border-top:1px solid #20384b;padding:7px 5px max(8px,env(safe-area-inset-bottom))}.leadMobileDock a{min-height:52px;display:grid;place-items:center;gap:1px;color:#8da1b1;font-size:19px}.leadMobileDock a span{font-size:7px;font-weight:900}.leadMobileDock a.active{color:#69aef4}.leadMobileDock .add{background:#ef233c;border-radius:12px;color:#fff}}
`;
