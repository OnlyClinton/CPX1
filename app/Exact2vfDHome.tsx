"use client";

import Link from "next/link";
import type {CSSProperties} from "react";
import {useEffect,useMemo,useState} from "react";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string};
type IconName="check"|"wallet"|"key"|"shield"|"form"|"phone"|"car"|"drive"|"handshake"|"clarity"|"pin";

const fallback:Vehicle[]=[
 {id:"2004-nissan-350z",slug:"2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,image:"/assets/cars/2004-nissan-350z-1.webp",bodyStyle:"Car",drivetrain:"RWD",badges:["Great Value"]},
 {id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,image:"/assets/cars/2016-ford-f150-limited-1.webp",bodyStyle:"Truck",transmission:"Automatic",badges:["Low Miles"]},
 {id:"2019-honda-pilot",slug:"2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,image:"/assets/cars/2019-honda-pilot-1.webp",bodyStyle:"SUV",transmission:"Automatic",badges:["Best Seller"]},
 {id:"2019-kia-sportage",slug:"2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,image:"/assets/cars/2019-kia-sportage-1.webp",bodyStyle:"SUV",transmission:"Automatic",badges:["Great Value"]},
 {id:"2019-toyota-rav4",slug:"2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,image:"/assets/cars/2019-toyota-rav4-1.webp",bodyStyle:"SUV",transmission:"Automatic",badges:["Family Ready"]}
];

function LineIcon({name}:{name:IconName}){
 const props={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
 if(name==="check")return <svg {...props}><path d="M5 12.5 9.2 17 19 7"/><path d="M12 2.8a9.2 9.2 0 1 0 9.2 9.2"/></svg>;
 if(name==="wallet")return <svg {...props}><path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v8.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.2V7.5Z"/><path d="M4.5 7.5 16 4.2a1.4 1.4 0 0 1 1.8 1.3v2"/><path d="M15.5 12h4.2v3h-4.2a1.5 1.5 0 1 1 0-3Z"/></svg>;
 if(name==="key")return <svg {...props}><circle cx="8" cy="12" r="4"/><path d="m11.3 9.7 8-5.1M15 7.4l2.1 2.1M17.2 6l2.1 2.1"/></svg>;
 if(name==="shield")return <svg {...props}><path d="M12 3 19 6v5.4c0 4.3-2.6 7.8-7 9.6-4.4-1.8-7-5.3-7-9.6V6l7-3Z"/><path d="m8.8 12 2.1 2.2 4.5-4.7"/></svg>;
 if(name==="form")return <svg {...props}><path d="M6 3.5h9l3 3V20H6V3.5Z"/><path d="M15 3.5V7h3M9 11h6M9 15h6"/></svg>;
 if(name==="phone")return <svg {...props}><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg>;
 if(name==="car")return <svg {...props}><path d="m4 15 1.8-5.2A2 2 0 0 1 7.7 8.5h8.6a2 2 0 0 1 1.9 1.3L20 15"/><path d="M3 15h18v4H3zM6 19v1.5M18 19v1.5M6.5 15l1-2h9l1 2"/></svg>;
 if(name==="drive")return <svg {...props}><path d="M4 16.5h16M6 16.5l1.5-6h9l1.5 6M9 10.5 10 7h4l1 3.5"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>;
 if(name==="handshake")return <svg {...props}><path d="m4 9 4-3 4 2 4-2 4 3-4 6-4 2-4-2-4-6Z"/><path d="m8 10 4 3 4-3"/></svg>;
 if(name==="clarity")return <svg {...props}><path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 15 2 2 3-4"/></svg>;
 return <svg {...props}><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>;
}
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());const stock=String(v?.stock||v?.stock_id||"").toUpperCase();return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST")}
function photo(v:Vehicle){if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;return v.primary_image_url||v.image||"/wdcc-hero-v2.webp"}
function href(v:Vehicle){if(String(v.status||"").toLowerCase()==="published"&&v.id)return `/vehicle/${encodeURIComponent(String(v.id))}`;const label=`${v.year} ${v.make} ${v.model}${v.trim?` ${v.trim}`:""}`;return `/schedule-test-drive?source=featured-fallback&vehicle=${encodeURIComponent(label)}`}
function badge(v:Vehicle){return String(v.badges?.[0]||"Available")}
function badgeTone(label:string){const x=label.toLowerCase();if(x.includes("mile"))return"blue";if(x.includes("seller"))return"purple";if(x.includes("family"))return"orange";return"green"}
function Wordmark(){return <span className="wdcc-wordmark" aria-hidden="true"><span className="wdcc-mark"><b>WD</b><i>CC</i></span><small>WE DON'T CARE CARS</small></span>}

export default function Exact2vfDHome(){
 const[phase,setPhase]=useState<"impact"|"reveal"|"done">("impact"),[open,setOpen]=useState(false),[active,setActive]=useState(0),[items,setItems]=useState<Vehicle[]>(fallback);
 useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{const live=(j.items||j.inventory||[]).filter(customerVisible).slice(0,8);if(live.length)setItems(live)}).catch(()=>{})},[]);
 useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}const a=setTimeout(()=>setPhase("reveal"),1150),b=setTimeout(()=>setPhase("done"),2850);return()=>{clearTimeout(a);clearTimeout(b)}},[]);
 const visible=useMemo(()=>items.slice(0,8),[items]);
 const featured=useMemo(()=>visible.length<=4?visible:Array.from({length:4},(_,i)=>visible[(active+i)%visible.length]),[visible,active]);
 const move=(n:number)=>setActive(v=>(v+n+visible.length)%visible.length),skip=()=>setPhase("done");
 return <div className="wdcc-app screenshotContract premiumNine">
  {phase!=="done"&&<div className={`intro-sequence intro-${phase}`} aria-label="WDCC opening animation" onWheel={skip} onTouchMove={skip} onClick={skip}>
    <div className="intro-scene" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}/><div className="intro-smoke smoke-one"/><div className="intro-smoke smoke-two"/>
    <div className="intro-badge"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></div><p className="intro-tagline">Tampa Bay · Drive today</p>
  </div>}

  <div className="header-shell home-header-shell">
    <div className="utility-bar"><span><LineIcon name="pin"/> Tampa Bay</span><span>In-house financing</span><span>Straight answers</span><span className="utility-call">Talk to Sean <b>(813) 516-4752</b></span></div>
    <header className="site-header">
      <button className="mobile-menu" aria-expanded={open} aria-label={open?"Close navigation":"Open navigation"} onClick={()=>setOpen(v=>!v)}><span aria-hidden="true"><i/><i/><i/></span></button>
      <Link className="logo-button" aria-label="WDCC home" href="/"><Wordmark/></Link>
      <nav className={`main-nav${open?" open":""}`} aria-label="Main navigation"><Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/#how-it-works">How It Works</Link><Link href="/#reviews">Why WDCC</Link><Link href="/#about">About Us</Link><Link href="/contact">Contact</Link></nav>
      <a className="header-phone" href="tel:+18135164752"><LineIcon name="phone"/><span>(813) 516-4752</span></a>
      <Link className="header-apply" href="/get-approved?source=header-get-approved">Get Pre-Approved</Link>
      <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean"><LineIcon name="phone"/></a>
    </header>
  </div>

  <section className="hero screenshotHero" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}>
    <div className="hero-shade"/>
    <div className="hero-copy"><p className="hero-kicker">Tampa Bay <span>›</span> Drive today</p><h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1><p className="hero-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
      <div className="hero-actions screenshotHeroActions"><Link className="btn btn-primary hero-cta-test" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link><Link className="btn btn-outline hero-cta-qualify" href="/inventory?source=hero-browse-inventory">Browse inventory <span>→</span></Link></div>
      <a className="screenshotCallSean" href="tel:+18135164752"><LineIcon name="phone"/><span>Talk to Sean</span><b>813-516-4752</b></a>
    </div><div className="hero-car-glow"/>
  </section>

  <section className="benefit-strip screenshotBenefits"><article><span className="icon"><LineIcon name="check"/></span><div><strong>Fast decisions</strong><span>Quick, straightforward approvals.</span></div></article><article><span className="icon"><LineIcon name="wallet"/></span><div><strong>Flexible starting options</strong><span>Clear numbers built around real buyers.</span></div></article><article><span className="icon"><LineIcon name="key"/></span><div><strong>Drive today</strong><span>Move from interest to the road faster.</span></div></article><article><span className="icon"><LineIcon name="shield"/></span><div><strong>Credit-building options</strong><span>Ask what programs may fit your situation.</span></div></article></section>

  <section className="inventory-showcase screenshotInventory"><div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Real inventory. Clear cash price. Clear starting numbers.</p></div><Link className="text-link" href="/inventory">View all inventory <span>→</span></Link></div>
    <div className="featured-carousel"><button className="carousel-arrow carousel-prev" onClick={()=>move(-1)} aria-label="Previous vehicles">‹</button><div className="featured-grid">{featured.map((v,i)=>{const down=Number(v.downPayment??v.down_payment??0),tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3),label=badge(v);return <div className={`featured-slide${i===0?" active":""}`} key={`${String(v.id||v.slug||i)}-${active}`}><article className="vehicle-card"><Link className="vehicle-image" href={href(v)}><img src={photo(v)} alt={`${v.year} ${v.make} ${v.model}`}/><span className="card-badges"><span className={badgeTone(label)}>{label}</span></span></Link><div className="vehicle-card-body"><p className="eyebrow">{v.year} {v.make}</p><Link className="vehicle-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><div className="vehicle-price-row"><strong className="vehicle-price">${Number(v.price||0).toLocaleString()}</strong>{down>0&&<span className="down-summary">${down.toLocaleString()} down</span>}</div><p className="vehicle-payment">{Number(v.mileage||0).toLocaleString()} miles</p><div className="spec-pills">{tags.map((t,j)=><span key={j}>{String(t)}</span>)}</div><Link className="vehicle-card-cta" href={href(v)}>View vehicle <span>→</span></Link></div></article></div>})}</div><button className="carousel-arrow carousel-next" onClick={()=>move(1)} aria-label="Next vehicles">›</button></div>
  </section>

  <section className="how-section screenshotHow" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">A simple path from application to keys</span><h2>In-house financing <strong>made easy.</strong></h2></div><Link className="startApproval" href="/get-approved?source=how-it-works">Start pre-approval <span>→</span></Link></div><div className="steps-grid"><article><span className="step-number">01</span><span className="step-icon"><LineIcon name="form"/></span><div><h3>Apply online</h3><p>Send the basics securely in a few minutes.</p></div></article><article><span className="step-number">02</span><span className="step-icon"><LineIcon name="phone"/></span><div><h3>Talk to Sean</h3><p>Confirm your budget, down payment and vehicle fit.</p></div></article><article><span className="step-number">03</span><span className="step-icon"><LineIcon name="car"/></span><div><h3>Choose your car</h3><p>Shop real inventory online or in person.</p></div></article><article><span className="step-number">04</span><span className="step-icon"><LineIcon name="drive"/></span><div><h3>Drive today</h3><p>Schedule your test drive or pickup.</p></div></article></div></section>

  <section className="whyWdcc premiumTrust" id="reviews"><div className="trust-heading"><span className="section-kicker">Why WDCC</span><h2>Less runaround.<br/><strong>More straight answers.</strong></h2><p>Built around clear numbers, real inventory and direct help when you need it.</p></div><article><span><LineIcon name="handshake"/></span><div><b>We work with you</b><small>Options for a wide range of credit situations.</small></div></article><article><span><LineIcon name="clarity"/></span><div><b>Clear from the start</b><small>Cash price, estimated down payment and vehicle details upfront.</small></div></article><article><span><LineIcon name="pin"/></span><div><b>Tampa Bay focused</b><small>Local inventory and a direct path to the person helping you.</small></div></article><article className="talkSean"><span className="sean-badge">SE</span><div><b>Talk to Sean</b><small>Real answers from a real person.</small><a href="tel:+18135164752">813-516-4752 →</a></div></article></section>

  <footer className="site-footer screenshotFooter" id="about"><div className="footer-brand-lock"><Wordmark/><p>Used cars and in-house financing for Tampa Bay.</p></div><div className="footer-copy"><strong>Drive today. Build from here.</strong><span>Real inventory · Clear starting numbers · Direct help</span></div><div className="footer-actions"><a href="tel:+18135164752"><LineIcon name="phone"/> (813) 516-4752</a><Link href="/get-approved?source=footer-get-approved">Get pre-approved <span>→</span></Link></div><span className="footer-links"><Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/#how-it-works">How It Works</Link><Link href="/#reviews">Why WDCC</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>

  <div className="mobile-action-bar" aria-label="Quick actions"><Link className="mobile-dock-drive" href="/schedule-test-drive?source=mobile-sticky-test-drive"><LineIcon name="key"/>Test Drive</Link><Link className="mobile-dock-qualify" href="/get-approved?source=mobile-sticky-get-approved"><LineIcon name="form"/>Get Approved</Link><a className="mobile-dock-contact" href="tel:+18135164752" aria-label="Call Sean"><LineIcon name="phone"/>Call Sean</a></div>
 </div>
}
