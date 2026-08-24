"use client";
import Link from"next/link";
import{useEffect,useState}from"react";
import TrackedCallLink from"./TrackedCallLink";

export function Intro(){
  const[phase,setPhase]=useState<"reveal"|"dock"|"exit"|"done">("reveal");
  useEffect(()=>{
    const forceReplay=new URLSearchParams(window.location.search).get("intro")==="1";
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if((!forceReplay&&sessionStorage.getItem("wdcc_intro_seen"))||reduced){setPhase("done");return}
    sessionStorage.setItem("wdcc_intro_seen","1");
    const dock=window.setTimeout(()=>setPhase(p=>p==="reveal"?"dock":p),1850);
    const exit=window.setTimeout(()=>setPhase(p=>p==="done"?p:"exit"),2500);
    const done=window.setTimeout(()=>setPhase("done"),3000);
    return()=>{window.clearTimeout(dock);window.clearTimeout(exit);window.clearTimeout(done)};
  },[]);
  const dismiss=()=>{setPhase(p=>p==="done"?p:"exit");window.setTimeout(()=>setPhase("done"),420)};
  if(phase==="done")return null;
  return <div className={`intro-sequence intro-${phase}`} aria-label="WDCC opening animation" onWheel={dismiss} onTouchMove={dismiss}>
    <div className="intro-scene" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as React.CSSProperties}/>
    <div className="intro-smoke smoke-one"/>
    <div className="intro-smoke smoke-two"/>
    <div className="intro-badge"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></div>
    <p className="intro-tagline">Tampa Bay · Drive today</p>
    <button className="intro-skip" type="button" onClick={dismiss}>Skip intro</button>
  </div>;
}

export function Header(){
  const[open,setOpen]=useState(false);
  return <>
    <div className="commandStrip"><div className="wrap"><span>● TAMPA BAY</span><span>IN-HOUSE FINANCING</span><span>SEAN · <b>813-516-4752</b></span></div></div>
    <header className="premiumHeader"><div className="wrap nav">
      <Link className="brand logoBrand" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link>
      <button className="mobileMenuButton" type="button" aria-expanded={open} aria-controls="mobileHeaderMenu" onClick={()=>setOpen(v=>!v)}>{open?"CLOSE":"☰"}</button>
      <TrackedCallLink className="mobileCallButton" source="header-mobile-phone" label="Call Sean">☎</TrackedCallLink>
      <div className="navlinks">
        <Link href="/inventory">INVENTORY</Link>
        <Link href="/schedule-test-drive?source=header-test-drive">TEST DRIVE</Link>
        <Link href="/get-approved?source=header-financing">FINANCING</Link>
        <Link href="/#how-it-works">HOW IT WORKS</Link>
        <Link href="/dealer/login">DEALER PORTAL</Link>
        <Link href="/contact?source=header-contact">CONTACT</Link>
        <TrackedCallLink className="premiumPhone" source="header-phone">☎ <b>813-516-4752</b></TrackedCallLink>
        <Link className="premiumApply" href="/get-approved?source=header-get-approved">GET PRE-APPROVED</Link>
      </div>
    </div>
    {open&&<nav id="mobileHeaderMenu" className="mobileHeaderMenu">
      <Link href="/inventory" onClick={()=>setOpen(false)}>INVENTORY</Link>
      <Link href="/schedule-test-drive?source=mobile-test-drive" onClick={()=>setOpen(false)}>TEST DRIVE</Link>
      <Link href="/get-approved?source=mobile-financing" onClick={()=>setOpen(false)}>FINANCING</Link>
      <Link href="/#how-it-works" onClick={()=>setOpen(false)}>HOW IT WORKS</Link>
      <Link href="/dealer/login" onClick={()=>setOpen(false)}>DEALER PORTAL</Link>
      <Link href="/contact?source=mobile-contact" onClick={()=>setOpen(false)}>CONTACT</Link>
    </nav>}
    </header>
    <div className="stickyCtaBar" aria-label="Quick actions">
      <Link className="stickyPrimary" href="/schedule-test-drive?source=sticky-test-drive">TEST DRIVE</Link>
      <Link className="stickySecondary" href="/get-approved?source=sticky-get-approved">GET APPROVED</Link>
      <TrackedCallLink className="stickyContact" source="sticky-call-sean" label="Call Sean">CALL SEAN</TrackedCallLink>
    </div>
  </>
}

export function Footer(){
  return <footer className="premiumFooter"><div className="wrap premiumFooterRow">
    <div className="footerBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>WE DON'T CARE CARS</strong><br/><small>Tampa Bay · Real inventory · Direct help</small></div></div>
    <div><TrackedCallLink source="footer-phone">813-516-4752</TrackedCallLink> · <Link href="/contact?source=footer-contact">Contact</Link></div>
  </div></footer>
}

function customerVisible(v:any){
  const status=String(v?.status||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());
  const stock=String(v?.stock||v?.stock_id||"").toUpperCase();
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST");
}

export function VehicleGrid({limit}:{limit?:number}){
  const[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>setItems((j.items||j.inventory||[]).filter(customerVisible))).catch(()=>{}).finally(()=>setLoading(false))},[]);
  const shown=limit?items.slice(0,limit):items;
  if(loading)return <div className="grid">{[1,2,3,4,5].map(i=><div className="card" key={i}><div className="photo">LOADING VEHICLE…</div><div className="cardBody"><div className="carTitle">Inventory loading</div></div></div>)}</div>;
  return <div className="grid">{shown.length?shown.map(v=><article className="card" key={v.id}>
    <Link className="photo" href={`/vehicle/${v.id}`} aria-label={`View ${v.year} ${v.make} ${v.model}`}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt={`${v.year} ${v.make} ${v.model}`}/>:v.primary_image_url?<img src={v.primary_image_url} alt={`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</Link>
    <div className="cardBody"><div className="carTitle">{v.year} {v.make}<br/><b>{v.model}</b></div>
      <div className="facts"><span>{Number(v.mileage||0).toLocaleString()} MILES</span></div>
      <div className="price">${Number(v.price||0).toLocaleString()}</div>
      {(v.downPayment??v.down_payment)!=null&&<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} DOWN</div>}
      <div className="cardButtons"><Link href={`/vehicle/${v.id}`}><span>VIEW VEHICLE</span></Link><Link href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(v.id)}`}><span>GET APPROVED</span></Link></div>
    </div>
  </article>):<div className="emptyInventory"><h3>Inventory is being updated.</h3><p>Call or text Sean for vehicles being prepared now.</p></div>}</div>
}
