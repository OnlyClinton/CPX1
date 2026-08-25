"use client";

import Link from "next/link";
import type {CSSProperties} from "react";
import {useEffect,useMemo,useState} from "react";

type Vehicle={
  id?:string; slug?:string; year:number; make:string; model:string; trim?:string;
  price:number; downPayment?:number; down_payment?:number; mileage?:number;
  primaryPhotoPathname?:string; primary_image_url?:string; image?:string;
  status?:string; stock?:string; stock_id?:string; badges?:string[];
  bodyStyle?:string; body_style?:string; transmission?:string; drivetrain?:string;
};

const fallback:Vehicle[]=[
  {id:"2004-nissan-350z",slug:"2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,image:"/assets/cars/2004-nissan-350z-1.webp",bodyStyle:"Car",drivetrain:"RWD"},
  {id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,image:"/assets/cars/2016-ford-f150-limited-1.webp",bodyStyle:"Truck",transmission:"Automatic"},
  {id:"2019-honda-pilot",slug:"2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,image:"/assets/cars/2019-honda-pilot-1.webp",bodyStyle:"SUV",transmission:"Automatic"},
  {id:"2019-kia-sportage",slug:"2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,image:"/assets/cars/2019-kia-sportage-1.webp",bodyStyle:"SUV",transmission:"Automatic"},
  {id:"2019-toyota-rav4",slug:"2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,image:"/assets/cars/2019-toyota-rav4-1.webp",bodyStyle:"SUV",transmission:"Automatic"}
];

function customerVisible(v:any){
  const status=String(v?.status||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());
  const stock=String(v?.stock||v?.stock_id||"").toUpperCase();
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST");
}

function photo(v:Vehicle){
  if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;
  return v.primary_image_url||v.image||"/wdcc-hero-v2.webp";
}
function href(v:Vehicle){return v.slug?`/inventory/${v.slug}`:`/vehicle/${encodeURIComponent(String(v.id||""))}`}

export default function Exact2vfDHome(){
  const[phase,setPhase]=useState<"reveal"|"dock"|"done">("reveal");
  const[open,setOpen]=useState(false);
  const[active,setActive]=useState(0);
  const[items,setItems]=useState<Vehicle[]>(fallback);
  const[dock,setDock]=useState({x:0,y:0,scale:.5});

  useEffect(()=>{
    fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{
      const live=(j.items||j.inventory||[]).filter(customerVisible).slice(0,5);
      if(live.length)setItems(live);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduced){setPhase("done");return}
    const measure=()=>{
      const target=document.querySelector(".home-header-shell .logo-button .brand-logo") as HTMLElement|null;
      const badge=document.querySelector(".intro-badge") as HTMLElement|null;
      if(!target||!badge)return;
      const tr=target.getBoundingClientRect();
      const br=badge.getBoundingClientRect();
      const bx=br.left+br.width/2,by=br.top+br.height/2;
      setDock({x:tr.left+tr.width/2-bx,y:tr.top+tr.height/2-by,scale:Math.max(.25,Math.min(.8,tr.width/(badge.offsetWidth||300)))});
    };
    const raf=requestAnimationFrame(measure);
    window.addEventListener("resize",measure);
    const a=window.setTimeout(()=>setPhase("dock"),1850);
    const b=window.setTimeout(()=>setPhase("done"),3000);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);clearTimeout(a);clearTimeout(b)};
  },[]);

  const appClass=`wdcc-app intro-state-${phase}`;
  const badgeStyle={"--intro-dock-x":`${dock.x}px`,"--intro-dock-y":`${dock.y}px`,"--intro-dock-scale":dock.scale} as CSSProperties;
  const visible=useMemo(()=>items.slice(0,5),[items]);
  const move=(n:number)=>setActive(v=>(v+n+visible.length)%visible.length);

  return <div className={appClass}>
    {phase!=="done"&&<div className={`intro-sequence intro-${phase}`} aria-hidden="true" onWheel={()=>setPhase("done")} onTouchMove={()=>setPhase("done")}>
      <div className="intro-scene" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}/>
      <div className="intro-smoke smoke-one"/><div className="intro-smoke smoke-two"/>
      <div className="intro-badge" style={badgeStyle}><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></div>
      <p className="intro-tagline">Tampa Bay · Drive today</p>
      <button className="intro-skip" type="button" onClick={()=>setPhase("done")}>Skip intro</button>
    </div>}

    <div className="header-shell home-header-shell">
      <div className="utility-bar"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span></div>
      <header className="site-header">
        <button className="mobile-menu" aria-expanded={open} aria-label="Open navigation" onClick={()=>setOpen(v=>!v)}><span aria-hidden="true"><i/><i/><i/></span></button>
        <Link className="logo-button" aria-label="WDCC home" href="/"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></Link>
        <nav className={`main-nav${open?" open":""}`} aria-label="Main navigation">
          <Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/#how-it-works">How it works</Link><Link href="/reviews">Reviews</Link><Link href="/about">About us</Link>
        </nav>
        <Link id="apply" className="btn btn-primary header-cta" href="/get-approved?source=header-get-approved">Get pre-approved</Link>
        <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg><span><small>Call</small>Sean</span></a>
      </header>
    </div>

    <section className="hero" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}>
      <div className="hero-shade"/><div className="hero-copy"><p className="hero-kicker">Tampa Bay · Drive today</p>
        <h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1>
        <p className="hero-lead">In-house financing. Listed down payments.<br/>Direct answers from Sean.<br/>Get on the road without the runaround.</p>
        <div className="hero-actions" aria-label="Choose your next step">
          <Link className="btn btn-primary hero-cta-test" href="/schedule-test-drive?source=schedule-test-drive">Schedule a test drive <span>→</span></Link>
          <Link className="btn btn-outline hero-cta-qualify" href="/get-approved?source=get-approved">Get qualified <span>→</span></Link>
          <Link className="hero-call hero-cta-contact" aria-label="Contact WDCC" href="/contact?source=call-sean"><span><small>Questions or ready?</small><strong>Contact us</strong></span><b aria-hidden="true">→</b></Link>
        </div>
      </div><div className="hero-car-glow"/>
    </section>

    <section className="benefit-strip" aria-label="WDCC benefits">
      <article><span className="icon" aria-hidden="true">◴</span><div><strong>Fast answers</strong><span>Talk directly to Sean</span></div></article>
      <article><span className="icon" aria-hidden="true">$</span><div><strong>Listed down payments</strong><span>See the number before you call</span></div></article>
      <article><span className="icon" aria-hidden="true">▣</span><div><strong>Schedule a test drive</strong><span>Choose a time and confirm</span></div></article>
      <article><span className="icon" aria-hidden="true">◇</span><div><strong>Financing options</strong><span>Final terms are subject to approval</span></div></article>
    </section>

    <section className="inventory-showcase">
      <div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Cash price and down payment shown clearly.</p></div><Link className="text-link" href="/inventory">View all inventory →</Link></div>
      <div className="featured-carousel" aria-roledescription="carousel" aria-label="Featured vehicles">
        <button className="carousel-arrow carousel-prev" aria-label="Previous featured vehicle" onClick={()=>move(-1)}>‹</button>
        <div className="featured-grid">{visible.map((v,i)=>{
          const down=Number(v.downPayment??v.down_payment??0); const tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3);
          return <div className={`featured-slide${i===active?" active":""}`} key={String(v.id||v.slug||i)}><article className="vehicle-card">
            <Link className="vehicle-image" aria-label={`View ${v.year} ${v.make} ${v.model}`} href={href(v)}><img src={photo(v)} alt={`${v.year} ${v.make} ${v.model} ${v.trim||""}`}/><span className="image-count">1/1</span><span className="card-badges"><span className="green">Available</span></span></Link>
            <div className="vehicle-card-body"><p className="eyebrow">{v.year} {v.make}</p><Link className="vehicle-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="vehicle-price">${Number(v.price||0).toLocaleString()}</strong><p className="vehicle-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"} <b>•</b> {Number(v.mileage||0).toLocaleString()} miles</p><div className="spec-pills">{(tags.length?tags:["Call for details"]).map((t,j)=><span key={j}>{String(t)}</span>)}</div></div>
          </article></div>})}</div>
        <button className="carousel-arrow carousel-next" aria-label="Next featured vehicle" onClick={()=>move(1)}>›</button>
        <div className="carousel-dots" role="tablist" aria-label="Choose featured vehicle">{visible.map((v,i)=><button key={String(v.id||i)} className={i===active?"active":""} aria-label={`Show ${v.year} ${v.make} ${v.model}`} aria-selected={i===active} role="tab" onClick={()=>setActive(i)}/>)}</div>
      </div>
    </section>

    <section className="how-section" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div></div><div className="steps-grid">
      <article><span>01</span><h3>Start online</h3><p>Prepare the basics, review the text on your phone, then send it to Sean.</p></article><article><span>02</span><h3>Talk to Sean</h3><p>Confirm your down payment and find the right vehicle fit.</p></article><article><span>03</span><h3>Choose your car</h3><p>Shop our inventory online or see it in person.</p></article><article><span>04</span><h3>Drive today</h3><p>Schedule pickup or a test drive and leave with confidence.</p></article>
    </div></section>

    <section className="about-section trust-grid" id="reviews"><article><span className="trust-icon">☆</span><div><h3>Tampa Bay proud</h3><p>Local dealer. Local community.</p></div></article><article><span className="trust-icon">•••</span><div><h3>Straight answers</h3><p>Ask directly about pricing, fees and terms.</p></div></article><article><span className="trust-avatar">SE</span><div><h3>Real people</h3><p>Talk to Sean. Not a call center.</p></div></article><article><span className="trust-icon">✓</span><div><h3>Confidence driven</h3><p>We make it happen when others can't.</p></div></article></section>

    <footer className="site-footer" id="about"><span className="brand-logo compact"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span><div><strong>WDCC · We Don't Care Cars</strong><span>Serving Tampa Bay · Confirm availability before visiting</span></div><a href="tel:+18135164752">813-516-4752</a><span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>
    <div className="mobile-action-bar" aria-label="Quick actions"><Link className="mobile-dock-drive" href="/schedule-test-drive?source=schedule-test-drive">Test drive</Link><Link className="mobile-dock-qualify" href="/get-approved?source=get-approved">Get qualified</Link><a className="mobile-dock-contact" href="tel:+18135164752">Call Sean</a></div>
  </div>;
}
