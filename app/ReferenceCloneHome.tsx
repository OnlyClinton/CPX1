"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import LockedIntro from "./LockedIntro";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string;visibility?:string;internalOnly?:boolean};
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase(),stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase(),visibility=String(v?.visibility||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x||"").toUpperCase());const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some((b:string)=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only"}
const photo=(v:Vehicle)=>v.primaryPhotoPathname?`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`:String(v.primary_image_url||v.image||"").trim();
const href=(v:Vehicle)=>`/vehicle/${encodeURIComponent(String(v.id||v.slug||""))}`;

export default function ReferenceCloneHome(){
 const[open,setOpen]=useState(false),[items,setItems]=useState<Vehicle[]>([]),[active,setActive]=useState(0),[inventoryState,setInventoryState]=useState<"loading"|"ready"|"empty"|"error">("loading");
 const gridRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{let live=true;fetch("/api/inventory",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`inventory ${r.status}`);return r.json()}).then(j=>{if(!live)return;const vehicles=(j.items||j.inventory||[]).filter(customerVisible).slice(0,8);setItems(vehicles);setInventoryState(vehicles.length?"ready":"empty")}).catch(()=>{if(live)setInventoryState("error")});return()=>{live=false}},[]);
 const vehicles=useMemo(()=>items,[items]);
 const goTo=(i:number)=>{setActive(i);const node=gridRef.current?.children?.[i] as HTMLElement|undefined;node?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})};
 return <main className="reference-home locked-storefront">
   <LockedIntro/>
   <div className="rh-utility"><div className="rh-utility-inner"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Low down payments</span><span>Drive today</span></div></div>
   <header className="rh-header"><div className="rh-header-inner">
     <button className="rh-menu" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
     <Link className="rh-logo logoBrand" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></Link>
     <nav className={`rh-nav${open?" open":""}`} aria-label="Main navigation"><Link href="/inventory" onClick={()=>setOpen(false)}>Inventory</Link><Link href="/get-approved?source=nav-financing" onClick={()=>setOpen(false)}>Financing</Link><Link href="/#how-it-works" onClick={()=>setOpen(false)}>How it works</Link><Link href="/contact?source=nav-contact" onClick={()=>setOpen(false)}>Contact</Link></nav>
     <div className="rh-header-actions"><a className="rh-header-phone" href="tel:+18135164752">Call Sean · (813) 516-4752</a></div>
     <a className="rh-call" href="tel:+18135164752" aria-label="Call Sean"><span>Call Sean</span></a>
   </div></header>
   <section className="rh-hero">
     <img className="rh-hero-art" src="/wdcc-hero-v2.webp" alt="American flag Challenger with Tampa Bay skyline" width="1672" height="941" fetchPriority="high"/>
     <div className="rh-hero-shade" aria-hidden="true"/>
     <div className="rh-hero-inner"><div className="rh-copy">
       <p className="rh-kicker">Tampa Bay · Drive today</p>
       <h1 aria-label="Bad credit? No credit? We don't care."><span className="red">Bad credit?</span><span className="blue">No credit?</span><span className="white">We don't care.</span></h1>
       <p className="rh-lead">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
       <div className="rh-hero-actions"><Link className="rh-btn red" href="/inventory">Browse cars →</Link><Link className="rh-btn dark" href="/get-approved?source=hero-get-approved">Get approved →</Link></div>
       <a className="rh-phone" href="tel:+18135164752">Call Sean <b>813-516-4752</b></a>
     </div></div>
   </section>
   <section className="rh-benefit-wrap"><div className="rh-benefits">
     <article className="rh-benefit"><span className="rh-icon">✓</span><div><strong>Fast approvals</strong><small>Quick, straightforward decisions.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">$</span><div><strong>Low down payments</strong><small>Options designed around real buyers.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">▣</span><div><strong>Drive today</strong><small>Move from interest to the road.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">◇</span><div><strong>Build your credit</strong><small>Ask what programs may apply.</small></div></article>
   </div></section>
   <section className="rh-inventory"><div className="rh-section-head"><div><small>Featured inventory</small><h2>Vehicles ready now.</h2><p>Live dealer inventory. Real vehicle data and real uploaded media only.</p></div><Link className="rh-view-all" href="/inventory">View all inventory →</Link></div>
     {inventoryState==="loading"&&<div className="rh-inventory-state">Loading current inventory…</div>}
     {inventoryState==="empty"&&<div className="rh-inventory-state"><strong>Inventory is updating.</strong><span>Call Sean for the vehicles available right now.</span></div>}
     {inventoryState==="error"&&<div className="rh-inventory-state"><strong>Live inventory is temporarily unavailable.</strong><span>We are not substituting demo vehicles. Call Sean for current availability.</span></div>}
     {inventoryState==="ready"&&<><div className="rh-grid" ref={gridRef} onScroll={()=>{const g=gridRef.current;if(!g||!g.children.length)return;const center=g.scrollLeft+g.clientWidth/2;let best=0,dist=Infinity;Array.from(g.children).forEach((el,i)=>{const n=el as HTMLElement,d=Math.abs(n.offsetLeft+n.offsetWidth/2-center);if(d<dist){dist=d;best=i}});if(best!==active)setActive(best)}}>{vehicles.map((v,i)=>{const down=Number(v.downPayment??v.down_payment??0),src=photo(v);const tags=[v.bodyStyle||v.body_style,v.transmission,v.drivetrain,Number(v.mileage||0)>0?`${Number(v.mileage).toLocaleString()} mi`:null].filter(Boolean).slice(0,3);return <article className={`rh-card${i===active?" active":""}`} key={String(v.id||v.slug||i)} onMouseEnter={()=>setActive(i)}><Link className="rh-photo" href={href(v)}>{src?<img src={src} alt={`${v.year} ${v.make} ${v.model}`}/>:<span className="rh-photo-placeholder" role="img" aria-label={`${v.year} ${v.make} ${v.model} photo coming soon`}><small>Photo coming soon</small><strong>{v.make} {v.model}</strong></span>}<span className="rh-badge">Available</span></Link><div className="rh-card-body"><p className="rh-eyebrow">{v.year} {v.make}</p><Link className="rh-title" href={href(v)}>{v.model}{v.trim?` ${v.trim}`:""}</Link><strong className="rh-price">${Number(v.price||0).toLocaleString()}</strong><p className="rh-payment">{down?`$${down.toLocaleString()} down`:"Call for down payment"}</p><div className="rh-pills">{tags.map((t,j)=><span key={j}>{String(t)}</span>)}</div></div></article>})}</div><div className="rh-mobile-dots" aria-label="Featured inventory position">{vehicles.map((v,i)=><button key={String(v.id||i)} className={i===active?"active":""} onClick={()=>goTo(i)} aria-label={`Vehicle ${i+1}`}/>)}</div></>}
   </section>
   <section className="rh-finance" id="how-it-works"><div className="rh-finance-inner"><div className="finance-heading"><h2>In-house financing <span>made easy</span></h2><p>One simple process. No hoops. No hassle.</p></div><div className="rh-steps">
     <article className="rh-step"><b>1</b><strong>Apply online</strong><small>Send basic details securely.</small></article><article className="rh-step"><b>2</b><strong>Talk to Sean</strong><small>Confirm down payment and vehicle fit.</small></article><article className="rh-step"><b>3</b><strong>Choose your car</strong><small>Shop real inventory online or in person.</small></article><article className="rh-step"><b>4</b><strong>Drive today</strong><small>Schedule pickup or a test drive.</small></article>
   </div></div></section>
   <section className="rh-trust" id="reviews"><div className="rh-trust-grid"><article><span className="trust-symbol">☆</span><div><b>Tampa Bay proud</b><span>Local dealer. Local community.</span></div></article><article><span className="trust-symbol">•••</span><div><b>Straight answers</b><span>No runaround. Ask the real questions.</span></div></article><article><span className="trust-avatar">SE</span><div><b>Real people</b><span>Talk to Sean. Not a call center.</span></div></article><article><span className="trust-symbol">✓</span><div><b>Confidence driven</b><span>We work to get you driving.</span></div></article></div></section>
   <footer className="rh-footer" id="about"><div className="rh-footer-inner"><span>WDCC · We Don't Care Cars</span><span>Serving Tampa Bay · Confirm availability before visiting</span><a href="tel:+18135164752">813-516-4752</a></div></footer>
 </main>
}
