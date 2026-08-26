"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string};
const fallback:Vehicle[]=[
{id:"2004-nissan-350z",slug:"2004-nissan-350z",year:2004,make:"Nissan",model:"350Z",price:4900,downPayment:2000,mileage:154000,image:"/assets/cars/2004-nissan-350z-1.webp",bodyStyle:"Car",drivetrain:"RWD"},
{id:"2016-ford-f150-limited",slug:"2016-ford-f150-limited",year:2016,make:"Ford",model:"F-150",trim:"Limited",price:15000,downPayment:6000,mileage:164000,image:"/assets/cars/2016-ford-f150-limited-1.webp",bodyStyle:"Truck",transmission:"Automatic"},
{id:"2019-honda-pilot",slug:"2019-honda-pilot",year:2019,make:"Honda",model:"Pilot",price:7900,downPayment:3000,mileage:380000,image:"/assets/cars/2019-honda-pilot-1.webp",bodyStyle:"SUV",transmission:"Automatic"},
{id:"2019-kia-sportage",slug:"2019-kia-sportage",year:2019,make:"Kia",model:"Sportage",price:6500,downPayment:2500,mileage:127000,image:"/assets/cars/2019-kia-sportage-1.webp",bodyStyle:"SUV",transmission:"Automatic"},
{id:"2019-toyota-rav4",slug:"2019-toyota-rav4",year:2019,make:"Toyota",model:"RAV4",price:10500,downPayment:4500,mileage:240000,image:"/assets/cars/2019-toyota-rav4-1.webp",bodyStyle:"SUV",transmission:"Automatic"}
];
const visible=(v:any)=>String(v?.status||"").toLowerCase()==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()&&String(v?.model||"").trim()&&Number(v?.price||v?.cashPrice)>0;
const photo=(v:Vehicle)=>v.primaryPhotoPathname?`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`:(v.primary_image_url||v.image||"/wdcc-hero-v2.webp");
const href=(v:Vehicle)=>v.slug?`/inventory/${v.slug}`:`/vehicle/${encodeURIComponent(String(v.id||""))}`;

export default function ReferenceCloneHome(){
  const[open,setOpen]=useState(false),[items,setItems]=useState<Vehicle[]>(fallback);
  useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{const live=(j.items||j.inventory||[]).filter(visible).slice(0,5);if(live.length)setItems(live)}).catch(()=>{})},[]);
  const vehicles=useMemo(()=>items.slice(0,5),[items]);
  return <main className="reference-home">
    <div className="rh-utility"><div className="rh-utility-inner"><span>⌖ Tampa Bay</span><span>›</span><span>In-house financing</span><span>›</span><span>Sean · <b>813-516-4752</b></span></div></div>
    <header className="rh-header"><div className="rh-header-inner">
      <button className="rh-menu" aria-label="Open navigation" onClick={()=>setOpen(v=>!v)}>☰</button>
      <Link className="rh-logo" href="/"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link>
      <nav className={`rh-nav${open?" open":""}`}><Link href="/inventory">Inventory</Link><Link href="/financing">Financing</Link><Link href="/#how-it-works">How it works</Link><Link href="/reviews">Reviews</Link><Link href="/about">About us</Link></nav>
      <Link className="rh-header-cta" href="/get-approved">Get pre-approved</Link>
      <a className="rh-call" href="tel:+18135164752" aria-label="Call Sean">☎</a>
    </div></header>
    <section className="rh-hero"><div className="rh-hero-inner"><div className="rh-copy">
      <p className="rh-kicker">Tampa Bay · Drive today</p>
      <h1><span className="red">Bad credit?</span><br/><span className="blue">No credit?</span><br/>We don't care.</h1>
      <p className="rh-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
      <div className="rh-hero-actions"><Link className="rh-btn red" href="/get-approved">Get pre-approved →</Link><Link className="rh-btn dark" href="/inventory">Browse inventory →</Link></div>
      <a className="rh-phone" href="tel:+18135164752">☎ Call Sean <b>813-516-4752</b></a>
    </div></div></section>
    <section className="rh-benefit-wrap"><div className="rh-benefits">
      <article className="rh-benefit"><span className="rh-icon">✓</span><div><strong>Fast approvals</strong><small>Quick, straightforward decisions.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon">$</span><div><strong>Low down payments</strong><small>Options designed around real buyers.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon">▣</span><div><strong>Drive today</strong><small>Move from interest to the road.</small></div></article>
      <article className="rh-benefit"><span className="rh-icon">◇</span><div><strong>Build your credit</strong><small>Ask what programs may apply.</small></div></article>
    </div></section>
    <section className="rh-inventory"><div className="rh-section-head"><div><small>Featured inventory</small><h2>Vehicles ready now.</h2><p>Cash price and down payment shown clearly.</p></div><Link className="rh-view-all" href="/inventory">View all inventory →</Link></div>
      <div className="rh-grid">{vehicles.map((v,i)=>{const down=Number(v.downPayment??v.down_payment??0);const tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain].filter(Boolean).slice(0,3);return <article className="rh-card" key={String(v.id||v.slug||i)}><Link className="rh-photo" href={href(v)}><img src={photo(v)} alt={`${v.year} ${v.make} ${v.model}`}/><span className="rh-badge">Available</span></Link><div className="rh-card-body"><p className="rh-eyebrow">{v.year} {v.make}</p><Link className="rh-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="rh-price">${Number(v.price||0).toLocaleString()}</strong><p className="rh-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"} · {Number(v.mileage||0).toLocaleString()} miles</p><div className="rh-pills">{tags.map((t,j)=><span key={j}>{String(t)}</span>)}</div></div></article>})}</div>
    </section>
    <section className="rh-finance" id="how-it-works"><div className="rh-finance-inner"><h2>In-house financing <span>made easy</span></h2><div className="rh-steps">
      <article className="rh-step"><b>1</b><strong>Apply online</strong><small>Send basic details securely.</small></article>
      <article className="rh-step"><b>2</b><strong>Talk to Sean</strong><small>Confirm down payment and vehicle fit.</small></article>
      <article className="rh-step"><b>3</b><strong>Choose your car</strong><small>Shop our inventory online or in person.</small></article>
      <article className="rh-step"><b>4</b><strong>Drive today</strong><small>Schedule pickup or a test drive.</small></article>
    </div></div></section>
    <section className="rh-trust"><div className="rh-trust-grid"><article><div><b>Tampa Bay proud</b><span>Local dealer. Local community.</span></div></article><article><div><b>Straight answers</b><span>No runaround. No hidden fees.</span></div></article><article><div><b>Real people</b><span>Talk to Sean. Not a call center.</span></div></article><article><div><b>In-house financing</b><span>We make it happen when others can't.</span></div></article></div></section>
    <footer className="rh-footer"><div className="rh-footer-inner"><span>WDCC · We Don't Care Cars</span><span>Serving Tampa Bay · Confirm availability before visiting</span><a href="tel:+18135164752">813-516-4752</a></div></footer>
  </main>
}
