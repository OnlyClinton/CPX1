"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import LockedIntro from "./LockedIntro";

type Vehicle={id?:string;slug?:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;primaryPhotoPathname?:string;primary_image_url?:string;image?:string;status?:string;stock?:string;stock_id?:string;badges?:string[];bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string;visibility?:string;internalOnly?:boolean};
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase(),stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase(),visibility=String(v?.visibility||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x||"").toUpperCase());const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some((b:string)=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only"}
const photo=(v:Vehicle)=>v.primaryPhotoPathname?`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`:String(v.primary_image_url||v.image||"").trim();
const href=(v:Vehicle)=>`/vehicle/${encodeURIComponent(String(v.id||v.slug||""))}`;

const FINAL_VISUAL_CSS=`
main.reference-home.locked-storefront .rh-utility{position:sticky!important;top:0!important;z-index:2201!important;background:#07121c!important}
main.reference-home.locked-storefront .rh-header{position:sticky!important;top:28px!important;z-index:2200!important;background:rgba(2,7,12,.98)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;box-shadow:0 8px 24px rgba(0,0,0,.28)!important}
main.reference-home.locked-storefront .rh-logo{display:grid!important;place-items:center!important;background:transparent!important;overflow:visible!important}
main.reference-home.locked-storefront .rh-logo:before,main.reference-home.locked-storefront .rh-logo:after{display:none!important;content:none!important}
main.reference-home.locked-storefront .rh-logo img{content:url('/wdcc-official-logo.webp')!important;display:block!important;max-width:none!important;object-fit:contain!important;object-position:center!important;border-radius:50%!important;clip-path:circle(48% at 50% 50%)!important}
@media(min-width:1101px){
 main.reference-home.locked-storefront .rh-utility{height:28px!important;min-height:28px!important}
 main.reference-home.locked-storefront .rh-header{height:90px!important;min-height:90px!important;top:28px!important}
 main.reference-home.locked-storefront .rh-header-inner{height:90px!important;grid-template-columns:150px minmax(0,1fr) auto!important;gap:26px!important}
 main.reference-home.locked-storefront .rh-logo{width:138px!important;height:88px!important}
 main.reference-home.locked-storefront .rh-logo img{width:90px!important;height:90px!important;filter:drop-shadow(0 7px 16px rgba(0,0,0,.5))!important}
 main.reference-home.locked-storefront .rh-menu,main.reference-home.locked-storefront .rh-call{display:none!important}
 main.reference-home.locked-storefront .rh-nav{display:flex!important;gap:32px!important;font-size:13px!important}
 main.reference-home.locked-storefront .rh-header-actions{display:flex!important}
 main.reference-home.locked-storefront .rh-hero,main.reference-home.locked-storefront .rh-hero-inner{min-height:570px!important}
 main.reference-home.locked-storefront .rh-copy{width:min(560px,45vw)!important;padding:52px 0 46px!important}
 main.reference-home.locked-storefront h1{font-size:clamp(60px,5vw,76px)!important;line-height:.91!important;letter-spacing:-.052em!important;max-width:560px!important;margin:0 0 20px!important}
 main.reference-home.locked-storefront .rh-lead{font-size:17px!important;line-height:1.48!important;max-width:500px!important}
 main.reference-home.locked-storefront .rh-btn{min-height:52px!important;font-size:12px!important}
 main.reference-home.locked-storefront .rh-benefit{min-height:106px!important;padding:18px 20px!important}
 main.reference-home.locked-storefront .rh-benefit strong{font-size:14px!important} main.reference-home.locked-storefront .rh-benefit small{font-size:12px!important}
 main.reference-home.locked-storefront .rh-inventory{padding:50px 24px 60px!important}
 main.reference-home.locked-storefront .rh-section-head h2{font-size:42px!important}
 main.reference-home.locked-storefront .rh-section-head p{font-size:13px!important}
 main.reference-home.locked-storefront .rh-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important;overflow:visible!important;padding:0!important}
 main.reference-home.locked-storefront .rh-card{min-width:0!important;max-width:none!important}
 main.reference-home.locked-storefront .rh-mobile-dots{display:none!important}
 main.reference-home.locked-storefront .rh-finance{padding:56px 24px 62px!important}
 main.reference-home.locked-storefront .finance-heading h2{font-size:38px!important}
 main.reference-home.locked-storefront .rh-step{min-height:126px!important;padding:20px!important}
}
@media(max-width:1100px),(hover:none) and (pointer:coarse){
 main.reference-home.locked-storefront .rh-utility{height:28px!important;min-height:28px!important;top:0!important;overflow:hidden!important}
 main.reference-home.locked-storefront .rh-utility-inner{height:28px!important;width:100%!important;max-width:none!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:17px!important;padding:0 12px!important;overflow-x:auto!important;white-space:nowrap!important;font-size:10px!important;scrollbar-width:none!important}
 main.reference-home.locked-storefront .rh-header{height:82px!important;min-height:82px!important;top:28px!important}
 main.reference-home.locked-storefront .rh-header-inner{height:82px!important;width:100%!important;display:grid!important;grid-template-columns:58px 1fr 94px!important;padding:0 10px!important;gap:4px!important}
 main.reference-home.locked-storefront .rh-menu{display:flex!important;width:46px!important;height:46px!important;align-items:center!important;justify-content:center!important;font-size:28px!important;justify-self:start!important}
 main.reference-home.locked-storefront .rh-logo{width:106px!important;height:82px!important;justify-self:center!important}
 main.reference-home.locked-storefront .rh-logo img{width:90px!important;height:90px!important;transform:scale(1.06)!important;transform-origin:center!important;filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))!important}
 main.reference-home.locked-storefront .rh-header-actions{display:none!important}
 main.reference-home.locked-storefront .rh-call{display:flex!important;align-items:center!important;justify-content:center!important;min-width:90px!important;height:44px!important;padding:0 12px!important;border-radius:999px!important;font-size:11.5px!important;font-weight:950!important;justify-self:end!important}
 main.reference-home.locked-storefront .rh-nav{display:none!important;position:fixed!important;top:110px!important;left:12px!important;right:12px!important;z-index:2300!important;flex-direction:column!important;gap:0!important;padding:8px!important;background:#07121c!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:12px!important;box-shadow:0 18px 44px rgba(0,0,0,.45)!important}
 main.reference-home.locked-storefront .rh-nav.open{display:flex!important}
 main.reference-home.locked-storefront .rh-nav a{display:flex!important;min-height:48px!important;align-items:center!important;padding:0 14px!important;font-size:14px!important;border-bottom:1px solid rgba(255,255,255,.08)!important}
 main.reference-home.locked-storefront .rh-hero{position:relative!important;min-height:0!important;height:auto!important;padding-top:278px!important;background:#02070c!important;overflow:hidden!important}
 main.reference-home.locked-storefront .rh-hero-art,main.reference-home.locked-storefront .rh-hero-shade,main.reference-home.locked-storefront .rh-hero:after{height:342px!important}
 main.reference-home.locked-storefront .rh-hero-art{position:absolute!important;inset:0 0 auto 0!important;width:100%!important;object-fit:cover!important;object-position:72% 34%!important;filter:saturate(1.24) contrast(1.08) brightness(1.20)!important}
 main.reference-home.locked-storefront .rh-hero-shade{position:absolute!important;inset:0 0 auto 0!important;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,.01) 45%,rgba(2,7,12,.14) 66%,rgba(2,7,12,.60) 84%,#02070c 100%)!important}
 main.reference-home.locked-storefront .rh-hero:after{bottom:auto!important;background:linear-gradient(180deg,transparent 0%,transparent 64%,rgba(2,7,12,.20) 79%,#02070c 100%)!important}
 main.reference-home.locked-storefront .rh-hero-inner{width:100%!important;min-height:0!important;display:block!important}
 main.reference-home.locked-storefront .rh-copy{width:100%!important;max-width:none!important;padding:22px 17px 29px!important;background:#02070c!important}
 main.reference-home.locked-storefront .rh-kicker{font-size:11.5px!important;line-height:1.2!important;margin:0 0 10px!important}
 main.reference-home.locked-storefront h1{font-size:clamp(38px,10.2vw,44px)!important;line-height:.94!important;letter-spacing:-.044em!important;max-width:372px!important;margin:0 0 17px!important}
 main.reference-home.locked-storefront .rh-lead{font-size:15.5px!important;line-height:1.48!important;max-width:365px!important}
 main.reference-home.locked-storefront .rh-hero-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important;margin-top:18px!important}
 main.reference-home.locked-storefront .rh-btn{min-height:50px!important;padding:0 10px!important;font-size:12px!important}
 main.reference-home.locked-storefront .rh-phone{font-size:12px!important;margin-top:13px!important}
 main.reference-home.locked-storefront .rh-benefits{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important;border-radius:0!important}
 main.reference-home.locked-storefront .rh-benefit{min-height:96px!important;padding:14px 13px!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important}
 main.reference-home.locked-storefront .rh-icon{width:34px!important;height:34px!important;font-size:14px!important}
 main.reference-home.locked-storefront .rh-benefit strong{font-size:14px!important;line-height:1.18!important}
 main.reference-home.locked-storefront .rh-benefit small{font-size:12px!important;line-height:1.34!important;margin-top:3px!important}
 main.reference-home.locked-storefront .rh-inventory{padding:38px 0 44px!important}
 main.reference-home.locked-storefront .rh-section-head{display:block!important;padding:0 17px!important;margin-bottom:18px!important}
 main.reference-home.locked-storefront .rh-section-head small{font-size:11px!important}
 main.reference-home.locked-storefront .rh-section-head h2{font-size:32px!important;line-height:1.02!important;margin:6px 0 8px!important}
 main.reference-home.locked-storefront .rh-section-head p{font-size:13px!important;line-height:1.44!important;max-width:360px!important}
 main.reference-home.locked-storefront .rh-view-all{display:inline-flex!important;font-size:11.5px!important;margin-top:10px!important}
 main.reference-home.locked-storefront .rh-grid{display:flex!important;width:100%!important;gap:13px!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory!important;scroll-padding-inline:8vw!important;padding:0 8vw 9px!important;margin:0!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}
 main.reference-home.locked-storefront .rh-card{flex:0 0 84vw!important;min-width:84vw!important;max-width:84vw!important;scroll-snap-align:center!important;scroll-snap-stop:always!important;border-radius:12px!important}
 main.reference-home.locked-storefront .rh-photo{aspect-ratio:1.62!important;min-height:0!important}
 main.reference-home.locked-storefront .rh-card-body{padding:16px 17px 18px!important}
 main.reference-home.locked-storefront .rh-eyebrow{font-size:10px!important}
 main.reference-home.locked-storefront .rh-title{font-size:18.5px!important;line-height:1.1!important;margin-bottom:11px!important}
 main.reference-home.locked-storefront .rh-price{font-size:30px!important}
 main.reference-home.locked-storefront .rh-payment{font-size:12.5px!important;margin:5px 0 9px!important}
 main.reference-home.locked-storefront .rh-pills span{font-size:9.5px!important;padding:5px 7px!important}
 main.reference-home.locked-storefront .rh-mobile-dots{display:flex!important;justify-content:center!important;align-items:center!important;gap:8px!important;margin-top:12px!important}
 main.reference-home.locked-storefront .rh-mobile-dots button{width:8px!important;height:8px!important;border-radius:999px!important}
 main.reference-home.locked-storefront .rh-mobile-dots button.active{width:22px!important;background:#f2263d!important}
 main.reference-home.locked-storefront .rh-finance{padding:40px 15px 44px!important}
 main.reference-home.locked-storefront .finance-heading h2{font-size:30px!important;line-height:1.04!important}
 main.reference-home.locked-storefront .finance-heading p{font-size:12.5px!important;line-height:1.4!important}
 main.reference-home.locked-storefront .rh-steps{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
 main.reference-home.locked-storefront .rh-step{min-height:98px!important;padding:16px 17px!important;grid-template-columns:46px 1fr!important;column-gap:14px!important}
 main.reference-home.locked-storefront .rh-step b{width:44px!important;height:44px!important;font-size:18px!important}
 main.reference-home.locked-storefront .rh-step strong{font-size:14.5px!important}
 main.reference-home.locked-storefront .rh-step small{font-size:12px!important;line-height:1.38!important}
 main.reference-home.locked-storefront .rh-trust-grid{grid-template-columns:1fr!important}
 main.reference-home.locked-storefront .rh-trust-grid article{min-height:78px!important;padding:14px 17px!important}
 main.reference-home.locked-storefront .rh-trust-grid b{font-size:14px!important}
 main.reference-home.locked-storefront .rh-trust-grid span{font-size:12px!important;line-height:1.36!important}
 main.reference-home.locked-storefront .rh-footer{padding:24px 17px 28px!important}
 main.reference-home.locked-storefront .rh-footer-inner{font-size:11.5px!important;line-height:1.45!important}
}
@media(max-width:430px){
 main.reference-home.locked-storefront .rh-header-inner{grid-template-columns:56px 1fr 90px!important;padding:0 9px!important}
 main.reference-home.locked-storefront .rh-logo img{width:88px!important;height:88px!important}
 main.reference-home.locked-storefront .rh-hero{padding-top:268px!important}
 main.reference-home.locked-storefront .rh-hero-art,main.reference-home.locked-storefront .rh-hero-shade,main.reference-home.locked-storefront .rh-hero:after{height:332px!important}
 main.reference-home.locked-storefront h1{font-size:clamp(37px,10.4vw,42px)!important;max-width:360px!important}
 main.reference-home.locked-storefront .rh-lead{font-size:15px!important}
}
`;

export default function ReferenceCloneHome(){
 const[open,setOpen]=useState(false),[items,setItems]=useState<Vehicle[]>([]),[active,setActive]=useState(0),[inventoryState,setInventoryState]=useState<"loading"|"ready"|"empty"|"error">("loading");
 const gridRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{let live=true;fetch("/api/inventory",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`inventory ${r.status}`);return r.json()}).then(j=>{if(!live)return;const vehicles=(j.items||j.inventory||[]).filter(customerVisible).slice(0,8);setItems(vehicles);setInventoryState(vehicles.length?"ready":"empty")}).catch(()=>{if(live)setInventoryState("error")});return()=>{live=false}},[]);
 const vehicles=useMemo(()=>items,[items]);
 const goTo=(i:number)=>{setActive(i);const node=gridRef.current?.children?.[i] as HTMLElement|undefined;node?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})};
 return <main className="reference-home locked-storefront">
   <style>{FINAL_VISUAL_CSS}</style>
   <LockedIntro/>
   <div className="rh-utility"><div className="rh-utility-inner"><span>⌖ Tampa Bay</span><span>In-house financing</span><span>Low down payments</span><span>Drive today</span></div></div>
   <header className="rh-header"><div className="rh-header-inner">
     <button className="rh-menu" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
     <Link className="rh-logo logoBrand" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-official-logo.webp" data-fallback="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></Link>
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
       <div className="rh-hero-actions"><Link className="rh-btn red" href="/get-approved" aria-label="GET PRE-APPROVED">GET PRE-APPROVED</Link><Link className="rh-btn dark" href="/inventory" aria-label="BROWSE INVENTORY">BROWSE INVENTORY</Link></div>
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
