"use client";

import Link from "next/link";
import type {CSSProperties} from "react";
import {useEffect,useMemo,useState} from "react";
import {PUBLIC_INVENTORY_FALLBACK} from "../lib/publicInventoryFallback";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string};

const fallback:Vehicle[]=PUBLIC_INVENTORY_FALLBACK;

function customerVisible(v:any){const status=String(v?.status||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());const stock=String(v?.stock||v?.stock_id||"").toUpperCase();return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST")}
function recoveryKey(v:Vehicle){return String(v.slug||v.id||"").toLowerCase().replace(/^recovered-/,"").replace(/^recovery-/,"")}
function photo(v:Vehicle){if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;const direct=v.primary_image_url||v.image;if(direct)return direct;return `/assets/cars/${recoveryKey(v)}-1.webp`}
function href(v:Vehicle){return `/vehicle/${encodeURIComponent(String(v.slug||v.id||""))}`}

export default function Exact2vfDHomeLive(){
 const[open,setOpen]=useState(false),[active,setActive]=useState(0),[items,setItems]=useState<Vehicle[]>(fallback);
 useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{const live=(j.items||j.inventory||j.vehicles||[]).filter(customerVisible).slice(0,5);if(live.length)setItems(live)}).catch(()=>{})},[]);
 const visible=useMemo(()=>items.slice(0,5),[items]),move=(n:number)=>setActive(v=>(v+n+visible.length)%visible.length);
 return <div className="wdcc-app wdcc-live-polish">
  <style>{`
    .wdcc-live-polish{overflow-x:hidden;background:#f5f7fa;color:#0b1118}
    .wdcc-live-polish .home-header-shell{position:relative;z-index:20;background:#030910}
    .wdcc-live-polish .site-header{position:relative}
    .wdcc-live-polish .logo-button{overflow:visible!important;display:flex!important;align-items:center!important;justify-content:center!important}
    .wdcc-live-polish .logo-button .brand-logo{overflow:visible!important;display:flex!important;align-items:center!important;justify-content:center!important}
    .wdcc-live-polish .logo-button img{object-fit:contain!important;filter:drop-shadow(0 7px 16px rgba(0,0,0,.35))}
    .wdcc-live-polish .hero-kicker{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
    .wdcc-live-polish .hero-copy h1{color:#f51f2d!important}
    .wdcc-live-polish .hero-copy h1 em{color:#168fe8!important;font-style:normal!important}
    .wdcc-live-polish .hero-copy h1 strong{color:#fff!important}
    .wdcc-live-polish .vehicle-image{background:#08131d!important}
    .wdcc-live-polish .vehicle-image img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important}
    .wdcc-live-polish .benefit-strip article,.wdcc-live-polish .vehicle-card{min-width:0}
    @media(max-width:760px){
      .wdcc-live-polish .utility-bar{display:none!important}
      .wdcc-live-polish .site-header{height:94px!important;min-height:94px!important;padding:0 16px!important;display:grid!important;grid-template-columns:62px minmax(0,1fr) 62px!important;align-items:center!important}
      .wdcc-live-polish .mobile-menu,.wdcc-live-polish .mobile-call{width:54px!important;height:54px!important}
      .wdcc-live-polish .logo-button{width:150px!important;height:94px!important;justify-self:center!important}
      .wdcc-live-polish .logo-button .brand-logo{width:150px!important;height:94px!important}
      .wdcc-live-polish .logo-button img{width:148px!important;height:148px!important;max-width:none!important;transform:scale(1.18)!important}
      .wdcc-live-polish .hero{min-height:650px!important;background-position:center center!important}
      .wdcc-live-polish .hero-copy{padding:34px 20px 30px!important;max-width:100%!important}
      .wdcc-live-polish .hero-kicker{font-size:12.5px!important;letter-spacing:1.15px!important;line-height:1.2!important;margin-bottom:14px!important}
      .wdcc-live-polish .hero-copy h1{font-size:clamp(44px,12vw,58px)!important;line-height:.91!important;letter-spacing:-1.8px!important;margin:0 0 18px!important}
      .wdcc-live-polish .hero-lead{font-size:16px!important;line-height:1.48!important;margin:0 0 22px!important;max-width:350px!important}
      .wdcc-live-polish .hero-actions{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;width:100%!important}
      .wdcc-live-polish .hero-actions .btn{width:100%!important;min-height:56px!important;justify-content:center!important;text-align:center!important;font-size:14px!important;font-weight:900!important}
      .wdcc-live-polish .hero-call{width:100%!important;min-height:54px!important;padding:11px 14px!important}
      .wdcc-live-polish .benefit-strip{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:1px!important;background:#d8dee5!important}
      .wdcc-live-polish .benefit-strip article{min-height:112px!important;padding:16px 12px!important;background:#fff!important;display:flex!important;align-items:flex-start!important;gap:10px!important}
      .wdcc-live-polish .benefit-strip .icon{flex:0 0 34px!important}
      .wdcc-live-polish .benefit-strip strong{font-size:12px!important;line-height:1.2!important}
      .wdcc-live-polish .benefit-strip article span:last-child{font-size:11px!important;line-height:1.35!important}
      .wdcc-live-polish .inventory-showcase,.wdcc-live-polish .how-section{padding:38px 16px!important}
      .wdcc-live-polish .section-heading{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:10px!important;margin-bottom:20px!important}
      .wdcc-live-polish .section-heading h2{font-size:34px!important;line-height:1!important;letter-spacing:-1.2px!important;margin:3px 0 7px!important}
      .wdcc-live-polish .section-deck{font-size:16px!important;line-height:1.4!important}
      .wdcc-live-polish .text-link{font-size:13px!important;font-weight:900!important}
      .wdcc-live-polish .featured-carousel{position:relative!important}
      .wdcc-live-polish .featured-grid{gap:12px!important;scroll-snap-type:x mandatory!important}
      .wdcc-live-polish .featured-slide{scroll-snap-align:start!important}
      .wdcc-live-polish .vehicle-image{aspect-ratio:4/3!important;min-height:188px!important}
      .wdcc-live-polish .vehicle-card-body{padding:16px!important}
      .wdcc-live-polish .vehicle-title{font-size:20px!important}
      .wdcc-live-polish .vehicle-price{font-size:27px!important}
      .wdcc-live-polish .steps-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      .wdcc-live-polish .steps-grid article{min-height:176px!important;padding:18px 15px!important}
      .wdcc-live-polish .site-footer{padding-bottom:92px!important}
    }
    @media(min-width:761px){
      .wdcc-live-polish .logo-button{width:118px!important;height:92px!important}
      .wdcc-live-polish .logo-button .brand-logo{width:118px!important;height:92px!important}
      .wdcc-live-polish .logo-button img{width:118px!important;height:118px!important;transform:scale(1.08)!important}
    }
  `}</style>
  <div className="header-shell home-header-shell"><div className="utility-bar"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span></div><header className="site-header"><button className="mobile-menu" aria-expanded={open} aria-label="Open navigation" onClick={()=>setOpen(v=>!v)}><span aria-hidden="true"><i/><i/><i/></span></button><Link className="logo-button" aria-label="WDCC home" href="/"><span className="brand-logo"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></span></Link><nav className={`main-nav${open?" open":""}`}><Link href="/inventory">Inventory</Link><Link href="/get-approved?source=header-get-approved">Financing</Link><Link href="/#how-it-works">How it works</Link><Link href="/schedule-test-drive?source=header-test-drive">Test drive</Link><Link href="/dealer">Dealer Portal</Link></nav><a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean"><svg viewBox="0 0 24 24"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg></a></header></div>
  <section className="hero" style={{"--hero-image":"url(/wdcc-hero-v2.webp)"} as CSSProperties}><div className="hero-shade"/><div className="hero-copy"><p className="hero-kicker">Tampa Bay · Drive today</p><h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1><p className="hero-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p><div className="hero-actions"><Link className="btn btn-primary hero-cta-qualify" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link><Link className="btn btn-outline" href="/inventory">Browse inventory <span>→</span></Link><a className="hero-call hero-cta-contact" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752"><span><small>Ready to talk?</small><strong>Call Sean · 813-516-4752</strong></span><b aria-hidden="true">→</b></a></div></div><div className="hero-car-glow"/></section>
  <section className="benefit-strip"><article><span className="icon">✓</span><div><strong>Fast approvals</strong><span>Quick, straightforward decisions</span></div></article><article><span className="icon">$</span><div><strong>Low down payments</strong><span>Options designed around real buyers</span></div></article><article><span className="icon">▣</span><div><strong>Drive today</strong><span>Move from interest to the road</span></div></article><article><span className="icon">◇</span><div><strong>Build your credit</strong><span>Ask what programs may apply</span></div></article></section>
  <section className="inventory-showcase"><div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Cash price and down payment shown clearly.</p></div><Link className="text-link" href="/inventory">View all inventory →</Link></div><div className="featured-carousel"><button className="carousel-arrow carousel-prev" aria-label="Previous vehicle" onClick={()=>move(-1)}>‹</button><div className="featured-grid">{visible.map((v,i)=>{const down=Number(v.downPayment??v.down_payment??0),tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3);return <div className={`featured-slide${i===active?" active":""}`} key={String(v.id||v.slug||i)}><article className="vehicle-card"><Link className="vehicle-image" href={href(v)}><img src={photo(v)} alt={`${v.year} ${v.make} ${v.model}`}/><span className="card-badges"><span className="green">Available</span></span></Link><div className="vehicle-card-body"><p className="eyebrow">{v.year} {v.make}</p><Link className="vehicle-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="vehicle-price">${Number(v.price||0).toLocaleString()}</strong><p className="vehicle-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"} • {Number(v.mileage||0).toLocaleString()} miles</p><div className="spec-pills">{tags.map((t,j)=><span key={j}>{String(t)}</span>)}</div></div></article></div>})}</div><button className="carousel-arrow carousel-next" aria-label="Next vehicle" onClick={()=>move(1)}>›</button></div></section>
  <section className="how-section" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div></div><div className="steps-grid"><article><span>01</span><h3>Apply online</h3><p>Send the basics securely.</p></article><article><span>02</span><h3>Talk to Sean</h3><p>Confirm down payment and vehicle fit.</p></article><article><span>03</span><h3>Choose your car</h3><p>Shop the actual available inventory.</p></article><article><span>04</span><h3>Drive today</h3><p>Schedule a test drive or pickup.</p></article></div></section>
  <footer className="site-footer"><div><strong>WDCC · We Don't Care Cars</strong><span>Serving Tampa Bay</span></div><a href="tel:+18135164752">813-516-4752</a><span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>
  <div className="mobile-action-bar" aria-label="Quick actions"><Link href="/schedule-test-drive?source=mobile-sticky-test-drive"><span>▣</span>Test Drive</Link><Link href="/get-approved?source=mobile-sticky-get-approved"><span>▱</span>Get Approved</Link><a href="tel:+18135164752" aria-label="Call Sean"><span>☎</span>Call Sean</a></div>
 </div>
}
