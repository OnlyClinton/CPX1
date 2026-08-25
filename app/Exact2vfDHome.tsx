"use client";

import Link from "next/link";
import type {CSSProperties} from "react";
import {useEffect,useMemo,useState} from "react";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string};
const fallback:Vehicle[]=[{id:"2004-nissan-350z",slug:"2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,image:"/assets/cars/2004-nissan-350z-1.webp",bodyStyle:"Car",drivetrain:"RWD"},{id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,image:"/assets/cars/2016-ford-f150-limited-1.webp",bodyStyle:"Truck",transmission:"Automatic"},{id:"2019-honda-pilot",slug:"2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,image:"/assets/cars/2019-honda-pilot-1.webp",bodyStyle:"SUV",transmission:"Automatic"}];
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());const stock=String(v?.stock||v?.stock_id||"").toUpperCase();return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST")}
function photo(v:Vehicle){if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;return v.primary_image_url||v.image||"/wdcc-hero-v2.webp"}
function href(v:Vehicle){return v.slug?`/inventory/${v.slug}`:`/vehicle/${encodeURIComponent(String(v.id||""))}`}

export default function Exact2vfDHome(){
 const[phase,setPhase]=useState<"impact"|"reveal"|"done">("impact"),[open,setOpen]=useState(false),[active,setActive]=useState(0),[items,setItems]=useState<Vehicle[]>(fallback);
 useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{const live=(j.items||j.inventory||[]).filter(customerVisible).slice(0,5);if(live.length)setItems(live)}).catch(()=>{})},[]);
 useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}const a=setTimeout(()=>setPhase("reveal"),1150),b=setTimeout(()=>setPhase("done"),2850);return()=>{clearTimeout(a);clearTimeout(b)}},[]);
 const visible=useMemo(()=>items.slice(0,5),[items]),move=(n:number)=>setActive(v=>(v+n+visible.length)%visible.length),skip=()=>setPhase("done");
 return <div className="wdcc-app screenshotContract">
  {phase!=="done"&&<div className={`intro-sequence intro-${phase}`} aria-label="WDCC opening animation" onWheel={skip} onTouchMove={skip} onClick={skip}>
    <div className="intro-scene" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}/><div className="intro-smoke smoke-one"/><div className="intro-smoke smoke-two"/>
    <div className="intro-badge"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></div><p className="intro-tagline">Tampa Bay · Drive today</p>
  </div>}

  <div className="header-shell home-header-shell">
    <div className="utility-bar"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span></div>
    <header className="site-header">
      <button className="mobile-menu" aria-expanded={open} aria-label="Open navigation" onClick={()=>setOpen(v=>!v)}><span aria-hidden="true"><i/><i/><i/></span></button>
      <Link className="logo-button" aria-label="WDCC home" href="/"><img className="header-logo-image" src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link>
      <nav className={`main-nav${open?" open":""}`} aria-label="Main navigation"><Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/#how-it-works">How It Works</Link><Link href="/reviews">Reviews</Link><Link href="/about">About Us</Link></nav>
      <Link className="header-apply" href="/get-approved?source=header-get-approved">Get Pre-Approved</Link>
      <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean"><svg viewBox="0 0 24 24"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg></a>
    </header>
  </div>

  <section className="hero screenshotHero" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}>
    <div className="hero-shade"/>
    <div className="hero-copy"><p className="hero-kicker">Tampa Bay · Drive today</p><h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1><p className="hero-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
      <div className="hero-actions screenshotHeroActions"><Link className="btn btn-primary hero-cta-test" href="/schedule-test-drive?source=hero-test-drive">Schedule a test drive <span>→</span></Link><Link className="btn btn-outline hero-cta-qualify" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link></div>
      <a className="screenshotCallSean" href="tel:+18135164752">☎ <span>CALL SEAN</span> <b>813-516-4752</b></a>
    </div><div className="hero-car-glow"/>
  </section>

  <section className="benefit-strip screenshotBenefits"><article><span className="icon">✓</span><div><strong>Fast approvals</strong><span>Quick, straightforward decisions.</span></div></article><article><span className="icon">$</span><div><strong>Low down payments</strong><span>Options designed around real buyers.</span></div></article><article><span className="icon">▣</span><div><strong>Drive today</strong><span>Move from interest to the road.</span></div></article><article><span className="icon">◇</span><div><strong>Build your credit</strong><span>Ask what programs may apply.</span></div></article></section>

  <section className="inventory-showcase screenshotInventory"><div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Cash price and down payment shown clearly.</p></div><Link className="text-link" href="/inventory">View all inventory →</Link></div>
    <div className="featured-carousel"><button className="carousel-arrow carousel-prev" onClick={()=>move(-1)} aria-label="Previous vehicle">‹</button><div className="featured-grid">{visible.map((v,i)=>{const down=Number(v.downPayment??v.down_payment??0),tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3);return <div className={`featured-slide${i===active?" active":""}`} key={String(v.id||v.slug||i)}><article className="vehicle-card"><Link className="vehicle-image" href={href(v)}><img src={photo(v)} alt={`${v.year} ${v.make} ${v.model}`}/><span className="card-badges"><span className="green">Available</span></span></Link><div className="vehicle-card-body"><p className="eyebrow">{v.year} {v.make}</p><Link className="vehicle-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="vehicle-price">${Number(v.price||0).toLocaleString()}</strong><p className="vehicle-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"} • {Number(v.mileage||0).toLocaleString()} miles</p><div className="spec-pills">{tags.map((t,j)=><span key={j}>{String(t)}</span>)}</div></div></article></div>})}</div><button className="carousel-arrow carousel-next" onClick={()=>move(1)} aria-label="Next vehicle">›</button></div>
  </section>

  <section className="how-section screenshotHow" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div><Link className="startApproval" href="/get-approved?source=how-it-works">Start pre-approval →</Link></div><div className="steps-grid"><article><span>01</span><h3>Apply online</h3><p>Send basic details securely.</p></article><article><span>02</span><h3>Talk to Sean</h3><p>Confirm down payment and vehicle fit.</p></article><article><span>03</span><h3>Choose your car</h3><p>Shop our inventory online or in person.</p></article><article><span>04</span><h3>Drive today</h3><p>Schedule pickup or test drive.</p></article></div></section>

  <section className="whyWdcc" id="reviews"><strong>WHY WDCC?</strong><article><span>♢</span><div><b>We Work With You</b><small>Solutions for all credit situations.</small></div></article><article><span>⌁</span><div><b>Straight Answers</b><small>No runaround. No hidden-fee maze.</small></div></article><article><span>♨</span><div><b>Local & Trusted</b><small>Serving Tampa Bay and beyond.</small></div></article><article><span>◇</span><div><b>Built for You</b><small>Your approval. Your future.</small></div></article><article className="talkSean"><span>SE</span><div><b>TALK TO SEAN</b><small>Real answers from a real person.</small></div></article></section>

  <footer className="site-footer screenshotFooter" id="about"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>WDCC · We Don't Care Cars</strong><span>Serving Tampa Bay</span></div><a href="tel:+18135164752">☎ (813) 516-4752</a><span className="footer-links"><Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/reviews">Reviews</Link><Link href="/about">About Us</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>

  <div className="mobile-action-bar" aria-label="Quick actions"><Link className="mobile-dock-drive" href="/schedule-test-drive?source=mobile-sticky-test-drive"><span>▣</span>Test Drive</Link><Link className="mobile-dock-qualify" href="/get-approved?source=mobile-sticky-get-approved"><span>▱</span>Get Approved</Link><a className="mobile-dock-contact" href="tel:+18135164752" aria-label="Call Sean"><span>☎</span>Call Sean</a></div>
 </div>
}
