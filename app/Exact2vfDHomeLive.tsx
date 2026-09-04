"use client";

import Link from "next/link";
import type {CSSProperties} from "react";
import {useEffect,useMemo,useState} from "react";
import {PUBLIC_INVENTORY_FALLBACK} from "../lib/publicInventoryFallback";

type Vehicle={
  id?:string;
  slug?:string;
  year:number;
  make:string;
  model:string;
  trim?:string;
  price:number;
  downPayment?:number;
  down_payment?:number;
  mileage?:number;
  primaryPhotoPathname?:string;
  photoPathnames?:string[];
  primary_image_url?:string;
  image?:string;
  photoPending?:boolean;
  status?:string;
  stock?:string;
  stock_id?:string;
  badges?:string[];
  bodyStyle?:string;
  body_style?:string;
  transmission?:string;
  drivetrain?:string;
};

const fallback:Vehicle[]=PUBLIC_INVENTORY_FALLBACK;
const recoveredKeys=new Set(PUBLIC_INVENTORY_FALLBACK.map(vehicle=>vehicle.id));

function customerVisible(v:any){
  const status=String(v?.status||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());
  const stock=String(v?.stock||v?.stock_id||"").toUpperCase();
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST");
}

function recoveryKey(v:Vehicle){
  return String(v.id||v.slug||"").toLowerCase().replace(/^recovered-/,"").replace(/^recovery-/,"");
}

function recoveredPhoto(v:Vehicle){
  const key=recoveryKey(v);
  return recoveredKeys.has(key)?`/assets/cars/${key}-1.webp`:"/wdcc-logo-transparent.webp";
}

function photo(v:Vehicle){
  const pathname=v.primaryPhotoPathname||v.photoPathnames?.[0];
  if(pathname)return `/api/media?p=${encodeURIComponent(pathname)}`;
  return v.primary_image_url||v.image||recoveredPhoto(v);
}

function href(v:Vehicle){
  return `/vehicle/${encodeURIComponent(String(v.id||v.slug||""))}`;
}

function PhoneIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg>}
function CalendarIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m8 15 2 2 5-5"/></svg>}
function ApprovalIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 14l2 2 4-4"/></svg>}

export default function Exact2vfDHomeLive({motionReady=false}:{motionReady?:boolean}){
  const[open,setOpen]=useState(false);
  const[active,setActive]=useState(0);
  const[items,setItems]=useState<Vehicle[]>(fallback);

  useEffect(()=>{
    fetch("/api/inventory?scope=public",{cache:"no-store"})
      .then(response=>response.json())
      .then(json=>{
        const live=(json.items||json.inventory||json.vehicles||[]).filter(customerVisible).slice(0,5);
        if(live.length)setItems(live);
      })
      .catch(()=>{});
  },[]);

  const visible=useMemo(()=>items.slice(0,5),[items]);
  const move=(amount:number)=>setActive(value=>(value+amount+visible.length)%visible.length);

  useEffect(()=>{
    if(!motionReady)return;
    const root=document.querySelector(".wdcc-live-polish");
    const nodes=Array.from(root?.querySelectorAll<HTMLElement>("[data-reveal]")||[]);
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window)){
      nodes.forEach(node=>node.classList.add("is-visible"));
      return;
    }
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          (entry.target as HTMLElement).classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.14,rootMargin:"0px 0px -6% 0px"});
    nodes.forEach(node=>observer.observe(node));
    return()=>observer.disconnect();
  },[motionReady,visible.length]);

  return <div className={`wdcc-app wdcc-live-polish${motionReady?" motion-ready":""}`}>
    <div className="header-shell home-header-shell">
      <div className="utility-bar"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span></div>
      <header className="site-header">
        <button className="mobile-menu" aria-expanded={open} aria-label={open?"Close navigation":"Open navigation"} onClick={()=>setOpen(value=>!value)}><span aria-hidden="true"><i/><i/><i/></span></button>
        <Link className="logo-button" aria-label="WDCC home" href="/"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></Link>
        <nav className={`main-nav${open?" open":""}`}><Link href="/inventory">Inventory</Link><Link href="/get-approved?source=header-get-approved">Financing</Link><Link href="/#how-it-works">How it works</Link><Link href="/schedule-test-drive?source=header-test-drive">Test drive</Link><a href="https://dealer.wedontcarecars.com/login">Dealer Portal</a></nav>
        <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean"><PhoneIcon/></a>
      </header>
    </div>

    <section className="hero" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}>
      <div className="hero-shade"/>
      <div className="hero-copy">
        <p className="hero-kicker">Tampa Bay · Drive today</p>
        <h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1>
        <p className="hero-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
        <div className="hero-actions"><Link className="btn btn-primary hero-cta-test" href="/schedule-test-drive?source=hero-test-drive">Schedule a test drive <span>→</span></Link><Link className="btn hero-cta-qualify" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link><a className="hero-call hero-cta-contact" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752"><span><small>Ready to talk?</small><strong>Call Sean · 813-516-4752</strong></span><b aria-hidden="true">→</b></a></div>
      </div>
      <div className="hero-car-glow"/>
    </section>

    <section className="benefit-strip" data-reveal><article><span className="icon">✓</span><div><strong>Fast approvals</strong><span>Quick, straightforward decisions</span></div></article><article><span className="icon">$</span><div><strong>Low down payments</strong><span>Options designed around real buyers</span></div></article><article><span className="icon">▣</span><div><strong>Drive today</strong><span>Move from interest to the road</span></div></article><article><span className="icon">◇</span><div><strong>Build your credit</strong><span>Ask what programs may apply</span></div></article></section>

    <section className="inventory-showcase" data-reveal>
      <div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Cash price and down payment shown clearly.</p></div><Link className="text-link" href="/inventory">View all inventory →</Link></div>
      <div className="featured-carousel">
        <button className="carousel-arrow carousel-prev" aria-label="Previous vehicle" onClick={()=>move(-1)}>‹</button>
        <div className="featured-grid">{visible.map((v,index)=>{
          const down=Number(v.downPayment??v.down_payment??0);
          const tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3);
          return <div className={`featured-slide${index===active?" active":""}`} data-reveal style={{"--reveal-delay":`${index*70}ms`} as CSSProperties} key={String(v.id||v.slug||index)}><article className="vehicle-card"><Link className="vehicle-image" href={href(v)}>{v.photoPending?<span className="vehicle-photo-pending"><img src="/wdcc-logo-transparent.webp" alt=""/><span>Vehicle photos updating</span></span>:<img src={photo(v)} onError={event=>{const fallbackSrc=recoveredPhoto(v);if(!event.currentTarget.src.endsWith(fallbackSrc))event.currentTarget.src=fallbackSrc}} alt={`${v.year} ${v.make} ${v.model}`}/>}<span className="card-badges"><span className="green">Available</span></span></Link><div className="vehicle-card-body"><p className="eyebrow">{v.year} {v.make}</p><Link className="vehicle-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="vehicle-price">${Number(v.price||0).toLocaleString()}</strong><p className="vehicle-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"} • {Number(v.mileage||0).toLocaleString()} miles</p><div className="spec-pills">{tags.map((tag,tagIndex)=><span key={tagIndex}>{String(tag)}</span>)}</div></div></article></div>;
        })}</div>
        <button className="carousel-arrow carousel-next" aria-label="Next vehicle" onClick={()=>move(1)}>›</button>
      </div>
    </section>

    <section className="how-section" id="how-it-works" data-reveal><div className="section-heading"><div><span className="section-kicker">One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div></div><div className="steps-grid"><article data-reveal style={{"--reveal-delay":"0ms"} as CSSProperties}><span>01</span><h3>Apply online</h3><p>Send the basics securely.</p></article><article data-reveal style={{"--reveal-delay":"70ms"} as CSSProperties}><span>02</span><h3>Talk to Sean</h3><p>Confirm down payment and vehicle fit.</p></article><article data-reveal style={{"--reveal-delay":"140ms"} as CSSProperties}><span>03</span><h3>Choose your car</h3><p>Shop the actual available inventory.</p></article><article data-reveal style={{"--reveal-delay":"210ms"} as CSSProperties}><span>04</span><h3>Drive today</h3><p>Schedule a test drive or pickup.</p></article></div></section>

    <footer className="site-footer"><div><strong>WDCC · We Don't Care Cars</strong><span>Serving Tampa Bay</span></div><a href="tel:+18135164752">813-516-4752</a><span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>

    <div className="mobile-action-bar" aria-label="Quick actions"><Link href="/schedule-test-drive?source=mobile-sticky-test-drive"><CalendarIcon/><span>Test Drive</span></Link><Link href="/get-approved?source=mobile-sticky-get-approved"><ApprovalIcon/><span>Get Approved</span></Link><a href="tel:+18135164752" aria-label="Call Sean"><PhoneIcon/><span>Call Sean</span></a></div>
  </div>;
}
