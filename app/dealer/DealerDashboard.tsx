"use client";

import Link from"next/link";
import{FormEvent,useEffect,useState}from"react";
import{appointmentIntent,createdAtOf,firstContactDue,leadScore,notificationState,pipelineStages,sameLocalDay,sourceLabel,stageLabels,stageOf,when,type LeadRecord}from"./crmFilters";

type Vehicle=Record<string,any>;

const isQaVehicle=(v:Vehicle)=>{const stock=String(v?.stock||"").trim().toUpperCase(),id=String(v?.id||"").trim().toUpperCase(),badges=Array.isArray(v?.badges)?v.badges.map((x:any)=>String(x||"").toUpperCase()):[];return v?.qa===true||/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||/^(WDCC[-_]QA|QA)[-_]/.test(id)||badges.some((x:string)=>x==="R36-TEST"||x==="QA"||x==="TEST"||x.includes("CERTIFICATION"));};
const customerVisible=(v:Vehicle)=>String(v?.status||"").toLowerCase()==="published"&&!isQaVehicle(v)&&Number(v?.year)>1900&&Boolean(String(v?.make||"").trim())&&Boolean(String(v?.model||"").trim())&&Number(v?.price)>0;

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

  if(!session?.authenticated)return <main className="salesLoginPage"><form className="salesLoginCard" onSubmit={login}>
    <div className="salesLoginBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC</b><span>SALES COMMAND</span></div></div>
    <h1>Dealer Sign In</h1><p>Leads, appointments and inventory in one place.</p>
    <label>USERNAME<input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required/></label>
    <label>PASSWORD<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
    <button disabled={busy}>{busy?"SIGNING IN…":"SIGN IN"}</button>{message&&<div className="salesLoginError">{message}</div>}
  </form><style jsx global>{css}</style></main>;

  const leads:LeadRecord[]=Array.isArray(data?.leads)?data.leads:[];
  const inventory:Vehicle[]=Array.isArray(data?.inventory)?data.inventory:[];
  const newToday=leads.filter(l=>sameLocalDay(createdAtOf(l)));
  const overdue=leads.filter(firstContactDue).sort((a,b)=>new Date(createdAtOf(a)||0).getTime()-new Date(createdAtOf(b)||0).getTime());
  const hotBuyers=leads.filter(l=>leadScore(l)>=70).sort((a,b)=>leadScore(b)-leadScore(a));
  const appointments=leads.filter(appointmentIntent);
  const liveInventory=inventory.filter(customerVisible);
  const notificationGaps=leads.filter(l=>["failed","missing"].includes(notificationState(l).key));
  const next=overdue[0]||hotBuyers[0]||appointments[0]||newToday[0]||leads[0]||null;
  const nextMove=next?(firstContactDue(next)?"Call now — first contact overdue":appointmentIntent(next)?"Confirm appointment":stageOf(next)==="new"?"Make first contact":"Follow up now"):"No priority lead right now";
  const pipeline=Object.fromEntries(pipelineStages.map(stage=>[stage,leads.filter(l=>stageOf(l)===stage)])) as Record<string,LeadRecord[]>;

  const summaryTiles=[
    {label:"NEW TODAY",value:newToday.length,sub:"FRESH OPPORTUNITIES",href:"/dealer/leads?view=new-today",tone:"white"},
    {label:"OVERDUE",value:overdue.length,sub:"FIRST CONTACT >15 MIN",href:"/dealer/leads?view=overdue",tone:"amber"},
    {label:"HOT BUYERS",value:hotBuyers.length,sub:"PRIORITY 70+",href:"/dealer/leads?view=hot",tone:"red"},
    {label:"APPOINTMENTS",value:appointments.length,sub:"TEST DRIVES + APPOINTMENTS",href:"/dealer/leads?view=appointments",tone:"blue"},
    {label:"CUSTOMER LIVE",value:liveInventory.length,sub:"ACTUALLY VISIBLE TO SHOPPERS",href:"/dealer/inventory?status=live",tone:"green"},
    {label:"NOTIFY GAPS",value:notificationGaps.length,sub:"EMAIL / SMS NEED ATTENTION",href:"/dealer/leads",tone:"amber"}
  ];

  return <main className="salesCommandApp">
    <header className="salesCommandTop">
      <Link className="salesBrand" href="/dealer"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><span>SALES COMMAND</span></Link>
      <nav className="salesTopActions" aria-label="Dealer quick navigation"><Link href="/dealer/leads" aria-label="Lead table">☷</Link><Link href="/dealer/inventory" aria-label="Inventory">▣</Link><Link className="salesAdd" href="/dealer/inventory/new" aria-label="Add vehicle">＋</Link></nav>
    </header>

    <div className="salesCommandBody">
      {data?.error&&<div className="salesNotice">Dashboard data is reconnecting: {data.error}</div>}
      <section className="salesSummary" aria-label="Sales command summary">
        {summaryTiles.map(tile=><Link key={tile.label} href={tile.href} className={`salesMetric tone-${tile.tone}`} aria-label={`${tile.label}: ${tile.value}. Open records`}>
          <span>{tile.label}</span><strong>{tile.value}</strong><small>{tile.sub}</small><i aria-hidden="true">↗</i>
        </Link>)}
      </section>

      <section className="salesPanel nextPanel">
        <header><div><span className="panelKicker">DO THIS NOW</span><h2>NEXT BEST MOVE</h2></div>{next&&<b className="priorityPill">{firstContactDue(next)?"OVERDUE":`${leadScore(next)} PRIORITY`}</b>}</header>
        {next?<div className="nextLead"><div className="hotFlag">{firstContactDue(next)?"DUE":"HOT"}</div><div className="nextLeadCopy"><Link href={`/dealer/crm/${encodeURIComponent(next.id)}`}>{next.name||next.customerName||"Unnamed buyer"}</Link><p>{next.vehicleInterest||sourceLabel(next)}</p><div className="nextMeta"><span>{stageLabels[stageOf(next)]||stageOf(next)}</span><span>{when(createdAtOf(next))}</span><span>{notificationState(next).label}</span></div><div className="recommendation"><small>WDCC RECOMMENDS</small><strong>{nextMove}</strong><p>{firstContactDue(next)?"This lead has crossed the 15-minute first-contact SLA. Call before working lower-priority records.":"Open the account and act while the buyer intent is still fresh."}</p></div><div className="nextActions"><Link href={`/dealer/crm/${encodeURIComponent(next.id)}`}>OPEN ACCOUNT</Link>{next.phone&&<a href={`tel:${next.phone}`}>CALL</a>}{next.phone&&<a href={`sms:${next.phone}`}>TEXT</a>}</div></div></div>:<div className="salesEmpty">No lead needs immediate action.</div>}
      </section>

      <section className="salesPanel pipelinePanel">
        <header><div><span className="panelKicker">LEAD TO CLOSE</span><h2>AUTOMOTIVE PIPELINE</h2></div><Link href="/dealer/leads">VIEW ALL LEADS →</Link></header>
        <div className="pipelineGrid">
          {pipelineStages.map(stage=>{const rows=pipeline[stage]||[];return <Link key={stage} href={`/dealer/leads?stage=${stage}`} className={`pipelineTile stage-${stage}`} aria-label={`${rows.length} ${stageLabels[stage]}. Open those records`}><strong>{rows.length}</strong><span>{stageLabels[stage]}</span><i>VIEW →</i></Link>})}
        </div>
      </section>

      <section className="salesPanel hotPanel">
        <header><div><span className="panelKicker">PRIORITY QUEUE</span><h2>HOT BUYERS</h2></div><Link href="/dealer/leads?view=hot">ALL HOT BUYERS →</Link></header>
        <div className="hotList">{hotBuyers.slice(0,6).map(lead=><Link href={`/dealer/crm/${encodeURIComponent(lead.id)}`} key={lead.id} className="hotRow"><b>{leadScore(lead)}</b><span><strong>{lead.name||lead.customerName||"Unnamed buyer"}</strong><small>{lead.vehicleInterest||sourceLabel(lead)}</small></span><em>{stageLabels[stageOf(lead)]||stageOf(lead)} · {when(createdAtOf(lead))} · {notificationState(lead).label}</em><i>→</i></Link>)}{!hotBuyers.length&&<div className="salesEmpty">No buyers are currently scored 70+.</div>}</div>
      </section>
    </div>

    <nav className="salesMobileNav" aria-label="Dealer navigation"><Link className="active" href="/dealer">⌂<span>HOME</span></Link><Link href="/dealer/leads">☷<span>LEADS</span></Link><Link className="mobileAdd" href="/dealer/inventory/new">＋<span>ADD</span></Link><Link href="/dealer/inventory">▣<span>INVENTORY</span></Link></nav>
    <style jsx global>{css}</style>
  </main>;
}

const css=`
*{box-sizing:border-box}.salesLoginPage,.salesCommandApp{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.salesLoginPage{min-height:100svh;background:radial-gradient(circle at 50% 12%,#11283a 0,#07131e 40%,#02070c 80%);display:grid;place-items:center;padding:24px;color:#fff}.salesLoginCard{width:min(560px,100%);background:#0a1722;border:1px solid #284158;border-radius:20px;padding:32px;box-shadow:0 32px 90px #0009}.salesLoginBrand{display:flex;align-items:center;gap:12px}.salesLoginBrand img{width:80px}.salesLoginBrand b,.salesLoginBrand span{display:block}.salesLoginBrand span{font-size:10px;letter-spacing:.13em;color:#7c91a4}.salesLoginCard h1{font-size:38px;margin:18px 0 4px}.salesLoginCard>p{color:#8fa0ae;margin:0 0 24px}.salesLoginCard label{display:grid;gap:8px;font-size:11px;font-weight:900;margin:14px 0;color:#aebdca}.salesLoginCard input{height:58px;border:1px solid #3a5268;border-radius:10px;background:#f5f7fa;color:#111;font-size:20px;padding:0 16px}.salesLoginCard>button{width:100%;height:58px;border:0;border-radius:10px;background:#ef233c;color:#fff;font-weight:950;font-size:16px}.salesLoginError{color:#ff99a4;margin-top:12px}
.salesCommandApp{min-height:100svh;background:#03080d;color:#f2f5f7;padding-bottom:30px}.salesCommandTop{height:92px;position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,4vw,42px);background:#06111bea;border-bottom:1px solid #183047;backdrop-filter:blur(18px)}.salesBrand{display:flex;align-items:center;gap:14px}.salesBrand img{width:82px;height:82px;object-fit:contain}.salesBrand span{font-size:11px;font-weight:950;letter-spacing:.18em;color:#8094a5}.salesTopActions{display:flex;align-items:center;gap:8px}.salesTopActions a{width:44px;height:44px;border:1px solid transparent;border-radius:10px;display:grid;place-items:center;color:#8ca0b1;font-size:23px}.salesTopActions a:hover{background:#0c1a27;border-color:#243a4d;color:#fff}.salesTopActions .salesAdd{font-size:31px;color:#91a3b2}.salesCommandBody{width:min(1180px,calc(100% - 36px));margin:0 auto;padding:28px 0 40px}.salesNotice{margin-bottom:18px;padding:12px 14px;border:1px solid #755d1c;background:#372c0d;color:#ffe095;border-radius:10px;font-size:12px}.salesSummary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:22px}.salesMetric{position:relative;min-height:156px;padding:22px;border:1px solid #1d3549;border-radius:16px;background:linear-gradient(145deg,#0a1722,#07121c);display:flex;flex-direction:column;justify-content:center;transition:.16s ease}.salesMetric:hover{transform:translateY(-2px);border-color:#36536b;background:#0c1b28}.salesMetric>span{font-size:10px;color:#8193a3}.salesMetric>strong{font-size:44px;line-height:1.05;margin:12px 0 7px;color:#fff}.salesMetric>small{font-size:9px;color:#748897;letter-spacing:.02em}.salesMetric>i{position:absolute;right:15px;top:14px;color:#536b7e;font-style:normal}.salesMetric.tone-red>strong{color:#ff4351}.salesMetric.tone-blue>strong{color:#55a9ff}.salesMetric.tone-green>strong{color:#47db88}.salesMetric.tone-amber>strong{color:#ffd061}.salesPanel{border:1px solid #1d3549;border-radius:16px;background:#07131d;margin-top:22px;overflow:hidden}.salesPanel>header{min-height:96px;padding:24px 30px;border-bottom:1px solid #1b3143;display:flex;align-items:center;justify-content:space-between;gap:20px}.panelKicker{display:block;color:#72aef7;font-size:11px;font-weight:950;letter-spacing:.16em}.salesPanel h2{font-size:26px;line-height:1;margin:7px 0 0;color:#fff}.salesPanel>header>a{font-size:10px;font-weight:950;color:#72aef7}.priorityPill{border:1px solid #7b2632;background:#35151c;color:#ff6874;border-radius:999px;padding:10px 18px;font-size:11px}.nextLead{display:grid;grid-template-columns:60px minmax(0,1fr);gap:20px;padding:30px}.hotFlag{width:54px;height:38px;border-radius:9px;background:#ef233c;display:grid;place-items:center;font-size:10px;font-weight:950}.nextLeadCopy>a{display:block;color:#fff;font-size:28px;font-weight:950;letter-spacing:-.025em}.nextLeadCopy>p{color:#879aaa;margin:7px 0 14px}.nextMeta{display:flex;gap:8px;flex-wrap:wrap}.nextMeta span{border:1px solid #29445a;border-radius:999px;padding:8px 13px;font-size:10px;color:#9fb3c3}.recommendation{margin-top:24px;padding:22px 25px;border-left:5px solid #ef233c;border-radius:0 12px 12px 0;background:#0c1b28}.recommendation small{color:#71889c;font-size:9px}.recommendation strong{display:block;font-size:22px;margin-top:8px}.recommendation p{margin:6px 0 0;color:#879aaa;font-size:12px}.nextActions{display:flex;gap:10px;margin-top:20px}.nextActions a{min-height:42px;display:flex;align-items:center;padding:0 16px;border:1px solid #36526a;border-radius:8px;font-size:10px;font-weight:950}.nextActions a:first-child{background:#ef233c;border-color:#ef233c}.pipelineGrid{display:grid;grid-template-columns:repeat(4,1fr)}.pipelineTile{position:relative;min-height:166px;padding:28px 24px;border-right:1px solid #172c3d;border-bottom:1px solid #172c3d;background:#07131d;display:flex;flex-direction:column;justify-content:center}.pipelineTile:hover{background:#0a1a27}.pipelineTile strong{font-size:48px;line-height:1;color:#fff}.pipelineTile span{margin-top:11px;color:#8295a5;text-transform:uppercase;font-size:10px;font-weight:950}.pipelineTile i{position:absolute;right:14px;bottom:13px;font-size:8px;color:#4f6a7f;font-style:normal;opacity:0;transition:.15s}.pipelineTile:hover i{opacity:1}.pipelineTile.stage-new:after{content:"";position:absolute;height:5px;left:0;right:0;bottom:0;background:linear-gradient(90deg,#ef233c,#1d8fff)}.hotList{display:grid}.hotRow{min-height:88px;display:grid;grid-template-columns:58px minmax(0,1fr) auto 20px;align-items:center;gap:16px;padding:14px 28px;border-bottom:1px solid #142a3b}.hotRow:hover{background:#0a1a27}.hotRow>b{width:52px;height:52px;border:1px solid #7b2632;border-radius:50%;display:grid;place-items:center;color:#ff6370}.hotRow span strong,.hotRow span small{display:block}.hotRow span strong{font-size:14px;color:#fff}.hotRow span small{margin-top:4px;color:#7f93a4;font-size:10px}.hotRow em{font-size:10px;color:#718799;font-style:normal;text-transform:uppercase}.hotRow>i{color:#5b9ee5;font-style:normal}.salesEmpty{padding:32px;color:#8295a5}.salesMobileNav{display:none}
@media(max-width:1100px){.salesSummary{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.salesCommandApp{padding-bottom:78px}.salesCommandTop{height:86px;padding:0 18px}.salesBrand img{width:74px;height:74px}.salesBrand span{font-size:9px}.salesTopActions{gap:1px}.salesTopActions a{width:42px;height:42px;font-size:21px}.salesCommandBody{width:calc(100% - 28px);padding-top:22px}.salesSummary{grid-template-columns:repeat(2,1fr);gap:12px}.salesMetric{aspect-ratio:1.08/1;min-height:0;padding:20px}.salesMetric>strong{font-size:44px}.salesPanel{border-radius:14px}.salesPanel>header{padding:21px 24px;min-height:88px}.salesPanel h2{font-size:23px}.nextLead{padding:25px 22px;grid-template-columns:52px minmax(0,1fr);gap:15px}.nextLeadCopy>a{font-size:23px}.pipelineGrid{grid-template-columns:repeat(2,1fr)}.pipelineTile{aspect-ratio:1.08/1;min-height:0;padding:22px}.pipelineTile strong{font-size:46px}.hotRow{grid-template-columns:54px minmax(0,1fr) 18px;padding:14px 18px}.hotRow em{grid-column:2;grid-row:2}.hotRow>i{grid-column:3;grid-row:1/3}.salesMobileNav{position:fixed;display:grid;grid-template-columns:repeat(4,1fr);left:0;right:0;bottom:0;z-index:100;background:#050e16;border-top:1px solid #20384b;padding:7px 5px max(8px,env(safe-area-inset-bottom))}.salesMobileNav a{min-height:52px;display:grid;place-items:center;gap:1px;color:#8da1b1;font-size:19px}.salesMobileNav a span{font-size:7px;font-weight:900}.salesMobileNav .active{color:#69aef4}.salesMobileNav .mobileAdd{color:#fff;background:#ef233c;border-radius:12px}}
@media(max-width:520px){.salesCommandTop{height:78px;padding:0 14px}.salesBrand img{width:66px;height:66px}.salesBrand span{letter-spacing:.13em}.salesTopActions a{width:38px;height:38px}.salesCommandBody{width:calc(100% - 24px);padding-top:16px}.salesSummary{gap:10px}.salesMetric{padding:17px;border-radius:13px}.salesMetric>strong{font-size:40px}.salesMetric>span{font-size:10px}.salesMetric>small{font-size:8px}.salesPanel>header{padding:18px 18px}.salesPanel>header>a{font-size:8px}.nextLead{padding:21px 17px}.nextLeadCopy>a{font-size:20px}.recommendation{padding:18px}.pipelineTile{padding:18px}.pipelineTile strong{font-size:42px}.pipelineTile span{font-size:9px}}
`;
