"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import LockedIntro from "./LockedIntro";
import WdccVehicleCard,{type WdccVehicle} from "./WdccVehicleCard";
import {WdccPublicFooter,WdccPublicHeader} from "./WdccPublicChrome";
import TrackedCallLink from "./TrackedCallLink";
import {isWdccVisualReviewFixture,WDCC_VISUAL_REVIEW_INVENTORY} from "./wdccVisualReviewInventory";

type Vehicle=WdccVehicle&{status?:string;stock?:string;stock_id?:string;badges?:string[];visibility?:string;internalOnly?:boolean};
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase(),stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase(),visibility=String(v?.visibility||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x||"").toUpperCase());const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some((b:string)=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only"}

export default function ReferenceCloneHome(){
 const [items,setItems]=useState<Vehicle[]>([]);
 const [inventoryState,setInventoryState]=useState<"loading"|"ready"|"empty"|"error">("loading");
 const [fixtureMode,setFixtureMode]=useState(false);
 const [recoveryMode,setRecoveryMode]=useState(false);
 const [active,setActive]=useState(0);
 const gridRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{let live=true;if(isWdccVisualReviewFixture()){setFixtureMode(true);setRecoveryMode(false);setItems(WDCC_VISUAL_REVIEW_INVENTORY as Vehicle[]);setInventoryState("ready");return()=>{live=false}}fetch("/api/inventory",{cache:"no-store"}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`inventory ${r.status}`);return j}).then(j=>{if(!live)return;const visualFixture=j?.previewFallback===true||j?.inventorySource==="last-known-good-real-proof";const recovery=j?.recoveryFallback===true||j?.inventorySource==="verified-recovery-readonly"||j?.live===false;const vehicles=(j.items||j.inventory||[]).filter(customerVisible).slice(0,8);setFixtureMode(visualFixture);setRecoveryMode(!visualFixture&&recovery);setItems(vehicles);setInventoryState(vehicles.length?"ready":"empty")}).catch(()=>{if(live){setItems([]);setFixtureMode(false);setRecoveryMode(false);setInventoryState("error")}});return()=>{live=false}},[]);
 const vehicles=useMemo(()=>items,[items]);
 const goTo=(i:number)=>{setActive(i);const node=gridRef.current?.children?.[i] as HTMLElement|undefined;node?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})};
 return <main className="reference-home locked-storefront owner-target-home" data-wdcc-proof-mode={fixtureMode?"owner-review":undefined}>
   <LockedIntro/>
   <WdccPublicHeader/>
   <section className="rh-hero">
     <img className="rh-hero-art" src="/wdcc-hero-v2.webp" alt="American flag Challenger with Tampa Bay skyline" width="1672" height="941" fetchPriority="high"/>
     <div className="rh-hero-shade" aria-hidden="true"/>
     <div className="rh-hero-inner"><div className="rh-copy">
       <p className="rh-kicker">TAMPA BAY · DRIVE TODAY</p>
       <h1 aria-label="Bad credit? No credit? We don't care."><span className="red">BAD CREDIT?</span><span className="blue">NO CREDIT?</span><span className="white">WE DON&apos;T CARE.</span></h1>
       <p className="rh-v32-copy">In-house financing. Low down payments. Fast approvals. Straight answers. Get on the road without the runaround.</p>
       <div className="rh-hero-actions"><Link className="rh-btn red" href="/get-approved">GET PRE-APPROVED <span>→</span></Link><Link className="rh-btn dark" href="/inventory">BROWSE INVENTORY <span>→</span></Link></div>
       <TrackedCallLink className="rh-phone" source="home-hero-phone" label="Call Sean"><span>CALL SEAN</span><b>813-516-4752</b></TrackedCallLink>
     </div></div>
   </section>
   <section className="rh-benefit-wrap"><div className="rh-benefits">
     <article className="rh-benefit"><span className="rh-icon">✓</span><div><strong>FAST APPROVALS</strong><small>Quick, straightforward decisions.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">$</span><div><strong>LOW DOWN PAYMENTS</strong><small>Options designed around real buyers.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">▣</span><div><strong>DRIVE TODAY</strong><small>Move from interest to the road.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon">◇</span><div><strong>BUILD YOUR CREDIT</strong><small>Ask what programs may apply.</small></div></article>
   </div></section>
   <section className="rh-inventory"><div className="rh-section-head"><div><small>FEATURED INVENTORY</small><h2>Vehicles ready now.</h2><p>{recoveryMode?"Recent verified listings shown. Confirm current availability with Sean.":"Cash price and down payment shown clearly."}</p></div><Link className="rh-view-all" href="/inventory">VIEW ALL INVENTORY →</Link></div>
     {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>INVENTORY SYNC UPDATE</strong><span>Some listing updates may be delayed. Confirm availability with Sean · 813-516-4752.</span></div>}
     {inventoryState==="loading"&&<div className="rh-inventory-state">Loading current inventory…</div>}
     {inventoryState==="empty"&&<div className="rh-inventory-state"><strong>Inventory is updating.</strong><span>Call Sean for the vehicles available right now.</span></div>}
     {inventoryState==="error"&&<div className="rh-inventory-state"><strong>Live inventory is temporarily unavailable.</strong><span>Call Sean for current availability.</span></div>}
     {inventoryState==="ready"&&<><div className="rh-grid" ref={gridRef} onScroll={()=>{const g=gridRef.current;if(!g||!g.children.length)return;const center=g.scrollLeft+g.clientWidth/2;let best=0,dist=Infinity;Array.from(g.children).forEach((el,i)=>{const n=el as HTMLElement,d=Math.abs(n.offsetLeft+n.offsetWidth/2-center);if(d<dist){dist=d;best=i}});if(best!==active)setActive(best)}}>{vehicles.slice(0,5).map((v,i)=><WdccVehicleCard key={String(v.id||v.slug||i)} vehicle={v} featured/>)}</div><div className="rh-mobile-dots" aria-label="Featured inventory position">{vehicles.slice(0,5).map((v,i)=><button key={String(v.id||i)} className={i===active?"active":""} onClick={()=>goTo(i)} aria-label={`Vehicle ${i+1}`}/>)}</div></>}
   </section>
   <section className="rh-finance" id="how-it-works"><div className="rh-finance-inner"><div className="finance-heading"><h2>IN-HOUSE FINANCING <span>MADE EASY</span></h2><p>One simple process. No hoops. No hassle.</p></div><div className="rh-steps">
     <article className="rh-step"><b>1</b><div><strong>APPLY ONLINE</strong><small>Send basic details securely.</small></div></article><article className="rh-step"><b>2</b><div><strong>TALK TO SEAN</strong><small>Confirm down payment and vehicle fit.</small></div></article><article className="rh-step"><b>3</b><div><strong>CHOOSE YOUR CAR</strong><small>Shop our inventory online or in person.</small></div></article><article className="rh-step"><b>4</b><div><strong>DRIVE TODAY</strong><small>Schedule pickup or a test drive.</small></div></article>
   </div></div></section>
   <section className="rh-trust" id="reviews"><div className="rh-trust-grid"><article><div className="trust-symbol">★</div><div><b>TAMPA BAY PROUD</b><span>Local dealer. Local community.</span></div></article><article><div className="trust-symbol">•••</div><div><b>STRAIGHT ANSWERS</b><span>No runaround. No hidden fees.</span></div></article><article><div className="trust-avatar">SE</div><div><b>REAL PEOPLE</b><span>Talk to Sean. Not a call center.</span></div></article><article><div className="trust-symbol">✓</div><div><b>IN-HOUSE FINANCING</b><span>We work to find options that fit.</span></div></article></div></section>
   <WdccPublicFooter/>
 </main>
}
