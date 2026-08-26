"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createdAtOf,sourceLabel,stageLabels,stageOf,when,type LeadRecord} from "../crmFilters";

const stages=["new","contacted","engaged","qualified","appointment","showed","deal_working","approved","sold","lost","nurture"];
const tabs=[
  ["all","All Leads"],
  ["new","New"],
  ["contacted","Contacted"],
  ["qualified","Qualified"],
  ["converted","Converted"],
] as const;

function initials(name:any){
  const parts=String(name||"?").trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?").slice(0,2);
}
function matchesTab(lead:LeadRecord,tab:string){
  const stage=stageOf(lead);
  if(tab==="all")return true;
  if(tab==="new")return stage==="new";
  if(tab==="contacted")return ["contacted","engaged"].includes(stage);
  if(tab==="qualified")return ["qualified","appointment","showed","deal_working","approved"].includes(stage);
  if(tab==="converted")return stage==="sold";
  return true;
}

export default function DealerLeads(){
  const[items,setItems]=useState<LeadRecord[]>([]);
  const[message,setMessage]=useState("Loading leads…");
  const[tab,setTab]=useState("all");
  const[busy,setBusy]=useState("");

  async function load(){
    const r=await fetch("/api/crm/dashboard",{cache:"no-store",credentials:"include"});
    if(r.status===401){location.href="/dealer";return}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||"Lead list failed");
    setItems(Array.isArray(j.leads)?j.leads:[]);
    setMessage("");
  }
  useEffect(()=>{load().catch(e=>setMessage(e.message||"Lead list failed"))},[]);

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

  const filtered=useMemo(()=>[...items]
    .sort((a,b)=>new Date(createdAtOf(b)||0).getTime()-new Date(createdAtOf(a)||0).getTime())
    .filter(x=>matchesTab(x,tab)),[items,tab]);
  const counts=useMemo(()=>Object.fromEntries(tabs.map(([key])=>[key,items.filter(x=>matchesTab(x,key)).length])),[items]);

  return <main className="targetLeadShell">
    <aside className="targetLeadSide">
      <Link href="/dealer" className="targetLeadBrand"><img src="/wdcc-official-logo.webp" alt="WDCC"/><div><b>WDCC</b><span>DEALER PORTAL</span></div></Link>
      <nav>
        <Link href="/dealer">⌂ Dashboard</Link>
        <strong>INVENTORY</strong>
        <Link href="/dealer/inventory">▣ All Vehicles</Link>
        <Link href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link>
        <strong>OPERATIONS</strong>
        <Link className="active" href="/dealer/leads">♙ Leads</Link>
        <Link href="/dealer/leads?view=appointments">▣ Appointments</Link>
        <Link href="/dealer/leads?view=appointments">◉ Test Drives</Link>
        <Link href="/dealer/leads">◎ Customers</Link>
        <Link href="/dealer/leads">▤ Applications</Link>
        <Link href="/dealer/leads">✉ Messages</Link>
        <Link href="/dealer/inventory/logs">▥ Reports</Link>
        <Link href="/dealer">⚙ Settings</Link>
      </nav>
      <div className="targetLeadHelp"><small>CALL SEAN</small><a href="tel:18135164752">813-516-4752</a></div>
    </aside>

    <section className="targetLeadWorkspace">
      <header className="targetLeadTop">
        <div><img src="/wdcc-official-logo.webp" alt=""/><span><b>WDCC · DEALER PORTAL</b><small>CRM & Lead Management</small></span></div>
        <a href="tel:18135164752">☎ (813) 516-4752</a>
        <span>Sean · Sales Manager</span>
      </header>

      <div className="targetLeadContent">
        <div className="targetLeadTitle"><div><h1>Leads</h1><p>Track every customer opportunity from first click to sold.</p></div><Link href="/dealer">Dashboard →</Link></div>
        <div className="targetLeadTabs">{tabs.map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}<b>{counts[key]||0}</b></button>)}</div>
        {message&&<div className="targetLeadNotice">{message}</div>}

        <section className="targetLeadTable">
          <div className="targetLeadHead"><span>LEAD</span><span>SOURCE</span><span>VEHICLE</span><span>STATUS</span><span>RECEIVED</span><span>ACTIONS</span></div>
          {filtered.map(lead=>{
            const id=String(lead.id||"");
            const name=String(lead.name||lead.customerName||"Unnamed Buyer");
            const phone=String(lead.phone||"");
            return <article key={id} className="targetLeadRow">
              <div className="targetLeadPerson"><i>{initials(name)}</i><span><Link href={`/dealer/crm/${encodeURIComponent(id)}`}>{name}</Link><small>{phone||lead.email||"No contact info"}</small></span></div>
              <span className="targetLeadSource">{sourceLabel(lead)||"Website"}</span>
              <span className="targetLeadVehicle">{lead.vehicleInterest||lead.vehicle||"General inquiry"}</span>
              <select value={stageOf(lead)} disabled={busy===id} onChange={e=>update(id,e.target.value)}>{stages.map(stage=><option value={stage} key={stage}>{stageLabels[stage]||stage}</option>)}</select>
              <span className="targetLeadReceived">{when(createdAtOf(lead))||"—"}</span>
              <div className="targetLeadActions"><Link className="open" href={`/dealer/crm/${encodeURIComponent(id)}`}>OPEN</Link>{phone&&<a href={`tel:${phone}`}>CALL</a>}{phone&&<a href={`sms:${phone}`}>TEXT</a>}</div>
            </article>
          })}
          {!filtered.length&&!message&&<div className="targetLeadEmpty">No leads in this view.</div>}
        </section>
      </div>

      <nav className="targetLeadMobile"><Link href="/dealer">⌂<span>Dashboard</span></Link><Link href="/dealer/inventory">▣<span>Inventory</span></Link><Link className="add" href="/dealer/inventory/new">＋<span>Add Vehicle</span></Link><Link className="active" href="/dealer/leads">♙<span>Leads</span></Link><Link href="/dealer">•••<span>More</span></Link></nav>
    </section>
    <style jsx global>{css}</style>
  </main>;
}

const css=`
*{box-sizing:border-box}.targetLeadShell{min-height:100svh;background:#07131f;color:#e8edf2;display:grid;grid-template-columns:205px minmax(0,1fr);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.targetLeadSide{background:#06111b;border-right:1px solid #193047;padding:14px 10px;display:flex;flex-direction:column;min-height:100svh}.targetLeadBrand{display:flex;align-items:center;gap:9px;padding:4px 5px 18px;border-bottom:1px solid #1a3247}.targetLeadBrand img{width:64px;height:52px;object-fit:contain}.targetLeadBrand b,.targetLeadBrand span{display:block}.targetLeadBrand b{font-size:11px;color:#fff}.targetLeadBrand span{font-size:8px;color:#8296a8;margin-top:3px}.targetLeadSide nav{display:grid;padding-top:12px}.targetLeadSide nav strong{font-size:8px;color:#7890a4;letter-spacing:.12em;padding:16px 9px 7px}.targetLeadSide nav a{font-size:10px;padding:10px 9px;border-radius:5px;color:#c7d1da}.targetLeadSide nav a:hover{background:#0c2234;color:#fff}.targetLeadSide nav a.active{background:#ed1c2e;color:#fff;font-weight:900}.targetLeadHelp{margin-top:auto;border:1px solid #29445a;background:#0a1b2a;border-radius:8px;padding:12px}.targetLeadHelp small,.targetLeadHelp a{display:block}.targetLeadHelp small{font-size:8px;color:#8497a8}.targetLeadHelp a{color:#ff4d5e;font-weight:950;margin-top:5px;font-size:13px}.targetLeadWorkspace{min-width:0}.targetLeadTop{height:70px;background:#050d15;border-bottom:1px solid #1c3042;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:18px;padding:0 22px}.targetLeadTop>div{display:flex;align-items:center;gap:9px}.targetLeadTop img{width:52px;height:44px;object-fit:contain}.targetLeadTop b,.targetLeadTop small{display:block}.targetLeadTop b{font-size:10px}.targetLeadTop small{font-size:8px;color:#8294a5;margin-top:2px}.targetLeadTop>a{border:1px solid #71323a;color:#ff6a76;padding:9px 13px;border-radius:5px;font-size:10px;font-weight:900}.targetLeadTop>span{font-size:9px;color:#bdc9d3}.targetLeadContent{padding:24px}.targetLeadTitle{display:flex;align-items:end;justify-content:space-between;gap:18px}.targetLeadTitle h1{font-size:30px;margin:0;letter-spacing:-.035em}.targetLeadTitle p{color:#8093a4;font-size:11px;margin:5px 0 0}.targetLeadTitle>a{font-size:9px;color:#88b9ea;font-weight:900}.targetLeadTabs{display:flex;gap:6px;margin:16px 0;overflow-x:auto;scrollbar-width:none}.targetLeadTabs::-webkit-scrollbar{display:none}.targetLeadTabs button{flex:0 0 auto;border:1px solid #243d51;background:#0a1926;color:#91a3b3;padding:10px 13px;border-radius:6px;font-size:9px;font-weight:900;cursor:pointer}.targetLeadTabs button b{margin-left:7px;display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 5px;border-radius:999px;background:#10283b;color:#b8ccdc}.targetLeadTabs button.active{background:#ed1c2e;border-color:#ed1c2e;color:#fff}.targetLeadTabs button.active b{background:#fff2;color:#fff}.targetLeadNotice{background:#382d0d;border:1px solid #795f22;color:#ffe29a;padding:10px 12px;border-radius:7px;margin-bottom:10px;font-size:10px}.targetLeadTable{background:#071722;border:1px solid #20384b;border-radius:10px;overflow:hidden}.targetLeadHead,.targetLeadRow{display:grid;grid-template-columns:1.45fr .7fr 1.05fr .72fr .72fr 1fr;gap:12px;align-items:center;padding:12px 14px}.targetLeadHead{background:#0b1b28;color:#73899b;font-size:8px;font-weight:950;letter-spacing:.08em;border-bottom:1px solid #20384b}.targetLeadRow{min-height:72px;border-bottom:1px solid #142b3d;font-size:10px}.targetLeadRow:last-of-type{border-bottom:0}.targetLeadRow:hover{background:#0a1b29}.targetLeadPerson{display:flex;align-items:center;gap:10px;min-width:0}.targetLeadPerson>i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#102c43;border:1px solid #2b506d;color:#fff;font-style:normal;font-size:10px;font-weight:950;flex:none}.targetLeadPerson span{min-width:0}.targetLeadPerson a{display:block;color:#fff;font-size:11px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.targetLeadPerson small{display:block;color:#778c9d;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.targetLeadSource,.targetLeadVehicle,.targetLeadReceived{color:#a9b9c6;line-height:1.25}.targetLeadRow select{height:34px;border:1px solid #30495c;border-radius:5px;background:#0c1c29;color:#eef3f7;padding:0 7px;font-size:9px}.targetLeadActions{display:flex;gap:5px;flex-wrap:wrap}.targetLeadActions a{min-height:31px;border:1px solid #2d4a60;background:#0b1c29;color:#c1d0db;border-radius:5px;padding:0 8px;display:grid;place-items:center;font-size:8px;font-weight:950}.targetLeadActions .open{background:#ed1c2e;border-color:#ed1c2e;color:#fff}.targetLeadEmpty{text-align:center;color:#8296a7;padding:44px}.targetLeadMobile{display:none}
@media(max-width:900px){.targetLeadShell{display:block;padding-bottom:78px}.targetLeadSide{display:none}.targetLeadTop{height:64px;grid-template-columns:minmax(0,1fr) auto;padding:0 13px}.targetLeadTop>span{display:none}.targetLeadTop img{width:64px}.targetLeadTop b,.targetLeadTop small{display:none}.targetLeadContent{padding:14px}.targetLeadTitle h1{font-size:26px}.targetLeadHead{display:none}.targetLeadTable{background:transparent;border:0;display:grid;gap:9px}.targetLeadRow{background:#081924;border:1px solid #20384b;border-radius:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:13px;min-height:0}.targetLeadPerson{grid-column:1}.targetLeadRow select{grid-column:2;grid-row:1}.targetLeadSource,.targetLeadVehicle,.targetLeadReceived{font-size:9px}.targetLeadSource:before{content:"Source: ";color:#687f91}.targetLeadVehicle:before{content:"Vehicle: ";color:#687f91}.targetLeadReceived:before{content:"Received: ";color:#687f91}.targetLeadActions{grid-column:1/-1}.targetLeadActions a{flex:1}.targetLeadMobile{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;background:#050e16;border-top:1px solid #263d50;z-index:100;padding:7px 4px max(9px,env(safe-area-inset-bottom))}.targetLeadMobile a{display:grid;place-items:center;gap:2px;font-size:18px;color:#94a6b5}.targetLeadMobile a span{font-size:7px}.targetLeadMobile a.active{color:#ed1c2e}.targetLeadMobile .add{width:56px;height:56px;background:#ed1c2e;border-radius:50%;color:#fff;justify-self:center;margin-top:-25px;font-size:28px}.targetLeadMobile .add span{position:absolute;margin-top:76px;color:#fff}}
`;
