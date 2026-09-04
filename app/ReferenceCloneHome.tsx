"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {PUBLIC_INVENTORY_FALLBACK} from "../lib/publicInventoryFallback";
import {InventoryCard,inventoryCardStyles} from "./InventoryCard";

type Vehicle={
  id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;
  downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;
  photoPathnames?:string[];primary_image_url?:string;image?:string;photoPending?:boolean;
  status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;
  body_style?:string;transmission?:string;drivetrain?:string;
};

const fallback:Vehicle[]=PUBLIC_INVENTORY_FALLBACK;

function customerVisible(v:any){
  const status=String(v?.status||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());
  const stock=String(v?.stock||v?.stock_id||"").toUpperCase();
  const visibility=String(v?.visibility||v?.listingVisibility||"").toLowerCase();
  const hidden=v?.internalOnly===true||v?.qa===true||visibility==="internal"||visibility==="dealer_only"||badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"));
  return status==="published"&&!hidden&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock);
}

function PhoneIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z"/></svg>}
function CalendarIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m8 15 2 2 5-5"/></svg>}
function ApprovalIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 14l2 2 4-4"/></svg>}
function BenefitIcon({kind}:{kind:"check"|"money"|"car"|"shield"}){
  if(kind==="check")return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="m10.5 16.2 3.4 3.5 7.7-8"/></svg>;
  if(kind==="money")return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M19.5 11.7c-1.1-.9-5.9-1.2-5.9 1.5 0 3.7 6.1 1.3 6.1 5 0 2.8-5 2.6-7 1M16 8.7v14.6"/></svg>;
  if(kind==="car")return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 18 2-7h14l2 7v7h-3v-2H10v2H7v-7Z"/><path d="M9 18h14M11 11l2-3h6l2 3M11.5 20.5h.1M20.5 20.5h.1"/></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5 26 8v7.4c0 6.2-4.2 10.1-10 12.1-5.8-2-10-5.9-10-12.1V8l10-3.5Z"/><path d="m11.3 15.7 3.1 3.1 6.5-6.5"/></svg>;
}
function TrustIcon({kind}:{kind:"local"|"answers"|"people"|"finance"}){
  if(kind==="local")return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5 26 8v7.4c0 6.2-4.2 10.1-10 12.1-5.8-2-10-5.9-10-12.1V8l10-3.5Z"/><path d="m11.3 15.7 3.1 3.1 6.5-6.5"/></svg>;
  if(kind==="answers")return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h22v16H14l-6 5v-5H5V6Z"/><path d="M10 14h12M10 18h8"/></svg>;
  if(kind==="people")return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="11" r="5"/><path d="M6.5 27c.8-6 4-9 9.5-9s8.7 3 9.5 9"/></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M19.5 11.7c-1.1-.9-5.9-1.2-5.9 1.5 0 3.7 6.1 1.3 6.1 5 0 2.8-5 2.6-7 1M16 8.7v14.6"/></svg>;
}

export default function ReferenceCloneHome({motionReady=false}:{motionReady?:boolean}){
  const[open,setOpen]=useState(false);
  const[items,setItems]=useState<Vehicle[]>(fallback);

  useEffect(()=>{
    fetch("/api/inventory?scope=public",{cache:"no-store"}).then(async response=>{
      const json=await response.json();
      if(!response.ok)throw Error(json?.error||"Inventory unavailable");
      const source=Array.isArray(json?.items)?json.items:Array.isArray(json?.inventory)?json.inventory:Array.isArray(json?.vehicles)?json.vehicles:null;
      if(!source)throw Error("Invalid inventory response");
      setItems(source.filter(customerVisible).slice(0,5));
    }).catch(()=>{});
  },[]);

  const vehicles=useMemo(()=>items.slice(0,5),[items]);

  useEffect(()=>{
    if(!motionReady)return;
    const nodes=Array.from(document.querySelectorAll<HTMLElement>(".reference-home [data-rh-reveal]"));
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window)){
      nodes.forEach(node=>node.classList.add("rh-visible"));
      return;
    }
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){(entry.target as HTMLElement).classList.add("rh-visible");observer.unobserve(entry.target)}
    }),{threshold:.12,rootMargin:"0px 0px -5% 0px"});
    nodes.forEach(node=>observer.observe(node));
    return()=>observer.disconnect();
  },[motionReady,vehicles]);

  return <main className={`reference-home${motionReady?" rh-motion-ready":""}`}>
    <div className="rh-utility"><div className="rh-utility-inner"><span>Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span></div></div>
    <header className="rh-header"><div className="rh-header-inner">
      <button className="rh-menu" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span aria-hidden="true"><i/><i/><i/></span></button>
      <Link className="rh-logo" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></Link>
      <nav className={`rh-nav${open?" open":""}`}><Link href="/inventory" onClick={()=>setOpen(false)}>Inventory</Link><Link href="/get-approved" onClick={()=>setOpen(false)}>Financing</Link><Link href="/#how-it-works" onClick={()=>setOpen(false)}>How it works</Link><Link href="/#reviews" onClick={()=>setOpen(false)}>Reviews</Link><Link href="/#about-us" onClick={()=>setOpen(false)}>About us</Link></nav>
      <Link className="rh-header-cta" href="/get-approved?source=header-get-approved">Get pre-approved</Link>
      <a className="rh-call" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752"><PhoneIcon/></a>
    </div></header>

    <section className="rh-hero"><div className="rh-hero-inner"><div className="rh-copy">
      <p className="rh-kicker">Tampa Bay · Drive today</p>
      <h1><span className="red">Bad credit?</span><br/><span className="blue">No credit?</span><br/>We don't care.</h1>
      <p className="rh-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
      <div className="rh-hero-actions"><Link className="rh-btn red" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link><Link className="rh-btn dark" href="/inventory">Browse inventory <span>→</span></Link></div>
      <a className="rh-phone" href="tel:+18135164752"><PhoneIcon/> <span>Call Sean <b>813-516-4752</b></span></a>
    </div></div></section>

    <section className="rh-benefit-wrap" data-rh-reveal><div className="rh-benefits">
      <article className="rh-benefit"><span className="rh-icon"><BenefitIcon kind="check"/></span><div><strong>Fast approvals</strong><small>Quick, straightforward decisions.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon"><BenefitIcon kind="money"/></span><div><strong>Low down payments</strong><small>Options designed around real buyers.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon"><BenefitIcon kind="car"/></span><div><strong>Drive today</strong><small>Move from interest to the road.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon"><BenefitIcon kind="shield"/></span><div><strong>Build your credit</strong><small>Ask what programs may apply.</small></div></article>
    </div></section>

    <section className="rh-inventory" data-rh-reveal><div className="rh-section-head"><div><small>Featured inventory</small><h2>Vehicles ready now.</h2><p>Cash price and down payment shown clearly.</p></div><Link className="rh-view-all" href="/inventory">View all inventory →</Link></div>
      {vehicles.length?<div className={inventoryCardStyles.featuredGrid}>{vehicles.map((vehicle,index)=><InventoryCard vehicle={vehicle} index={index} variant="featured" key={String(vehicle.id||vehicle.slug||index)}/>)}</div>:<div className="emptyInventory"><h3>Fresh inventory is on the way.</h3><p>Call Sean for vehicles being prepared now.</p><a href="tel:+18135164752">Call Sean · 813-516-4752</a></div>}
    </section>

    <section className="rh-finance" id="how-it-works" data-rh-reveal><div className="rh-finance-inner"><div className="rh-finance-head"><div><h2>In-house financing <span>made easy</span></h2><small>One simple process. No hoops. No hassle.</small></div><Link href="/get-approved?source=how-it-works"><span>Start pre-approval</span><span aria-hidden="true">→</span></Link></div><div className="rh-steps">
      <article className="rh-step"><b>1</b><span className="rh-step-icon"><ApprovalIcon/></span><strong>Apply online</strong><small>Send basic details securely.</small></article>
      <article className="rh-step"><b>2</b><span className="rh-step-icon"><TrustIcon kind="answers"/></span><strong>Talk to Sean</strong><small>Confirm down payment and vehicle fit.</small></article>
      <article className="rh-step"><b>3</b><span className="rh-step-icon"><BenefitIcon kind="car"/></span><strong>Choose your car</strong><small>Shop our inventory online or in person.</small></article>
      <article className="rh-step"><b>4</b><span className="rh-step-icon"><CalendarIcon/></span><strong>Drive today</strong><small>Schedule pickup or a test drive.</small></article>
    </div></div></section>

    <section className="rh-trust" id="reviews" data-rh-reveal><div className="rh-trust-grid"><article><span className="rh-trust-icon"><TrustIcon kind="local"/></span><div><b>Tampa Bay proud</b><span>Local dealer. Local community.</span></div></article><article><span className="rh-trust-icon"><TrustIcon kind="answers"/></span><div><b>Straight answers</b><span>Clear numbers. Direct help.</span></div></article><article><span className="rh-trust-icon"><TrustIcon kind="people"/></span><div><b>Real people</b><span>Talk to Sean. Not a call center.</span></div></article><article><span className="rh-trust-icon"><TrustIcon kind="finance"/></span><div><b>In-house financing</b><span>We make it happen when others can't.</span></div></article></div></section>
    <footer className="rh-footer" id="about-us"><div className="rh-footer-inner"><span>WDCC · We Don't Care Cars</span><span>Serving Tampa Bay · Confirm availability before visiting</span><span><a href="https://dealer.wedontcarecars.com/login">Dealer portal</a> · <a href="tel:+18135164752">813-516-4752</a></span></div></footer>
  </main>;
}
