"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import LockedIntro from "./LockedIntro";
import WdccVehicleCard,{type WdccVehicle} from "./WdccVehicleCard";
import {WdccPublicFooter,WdccPublicHeader} from "./WdccPublicChrome";
import WdccIcon from "./WdccIcon";
import TrackedCallLink from "./TrackedCallLink";
import {loadPublicInventory} from "../lib/publicInventoryClient";
import {isWdccVisualReviewFixture,WDCC_VISUAL_REVIEW_INVENTORY,WDCC_VISUAL_REVIEW_LABEL,withWdccRecoveredReviewMedia} from "./wdccVisualReviewInventory";

type Vehicle=WdccVehicle&{status?:string;stock?:string;stock_id?:string;badges?:string[];visibility?:string;internalOnly?:boolean};
function customerVisible(v:any){const status=String(v?.status||"").toLowerCase(),stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase(),visibility=String(v?.visibility||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x||"").toUpperCase());const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some((b:string)=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only"}

export default function ReferenceCloneHome({allowVisualFixture=false}:{allowVisualFixture?:boolean}){
 const [items,setItems]=useState<Vehicle[]>([]);
 const [inventoryState,setInventoryState]=useState<"loading"|"ready"|"empty"|"error">("loading");
 const [fixtureMode,setFixtureMode]=useState(false);
 const [recoveryMode,setRecoveryMode]=useState(false);
 const [active,setActive]=useState(0);
 const [heroSource,setHeroSource]=useState("/wdcc-hero-canonical.webp");
 const gridRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{const media=window.matchMedia("(max-width: 767px)");const sync=()=>setHeroSource(media.matches?"/wdcc-hero-v2.webp":"/wdcc-hero-canonical.webp");sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync)},[]);
 useEffect(()=>{let live=true;if(isWdccVisualReviewFixture(allowVisualFixture)){setFixtureMode(true);setRecoveryMode(false);setItems(WDCC_VISUAL_REVIEW_INVENTORY as Vehicle[]);setInventoryState("ready");return()=>{live=false}}loadPublicInventory().then(j=>{if(!live)return;const visualFixture=j?.mockupPreview===true||j?.previewFallback===true||j?.inventorySource==="last-known-good-real-proof";const recovery=j?.recoveryFallback===true||j?.inventorySource==="verified-recovery-readonly"||(j?.live===false&&!visualFixture);const visible=(j.items||j.inventory||[]).filter(customerVisible).slice(0,8) as Vehicle[];const vehicles=visualFixture?withWdccRecoveredReviewMedia(visible):visible;setFixtureMode(visualFixture);setRecoveryMode(!visualFixture&&recovery);setItems(vehicles);setInventoryState(vehicles.length?"ready":"empty")}).catch(()=>{if(live){setItems([]);setFixtureMode(false);setRecoveryMode(false);setInventoryState("error")}});return()=>{live=false}},[allowVisualFixture]);
 const vehicles=items;
 const goTo=(i:number)=>{setActive(i);const node=gridRef.current?.children?.[i] as HTMLElement|undefined;node?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})};
 return <main className="reference-home locked-storefront owner-target-home">
   <LockedIntro/>
   <WdccPublicHeader/>
   <section className="rh-hero">
     <img key={heroSource} className="rh-hero-art" src={heroSource} alt="American flag Challenger with Tampa Bay skyline" width="1536" height="1024" fetchPriority="high"/>
     <div className="rh-hero-shade" aria-hidden="true"/>
     <div className="rh-hero-inner"><div className="rh-copy">
       <p className="rh-kicker">TAMPA BAY · DRIVE TODAY</p>
       <h1 aria-label="Bad credit? No credit? We don't care."><span className="red">BAD CREDIT?</span><span className="blue">NO CREDIT?</span><span className="white">WE DON&apos;T CARE.</span></h1>
       <p className="rh-proof-copy">In-house financing. Low down payments.<br/>Fast approvals. Straight answers.<br/>Get on the road without the runaround.</p>
       <div className="rh-hero-actions"><Link className="rh-btn red" href="/get-approved?source=home-hero-preapproval" aria-label="GET PRE-APPROVED"><span>GET PRE-APPROVED</span><WdccIcon name="arrow-right"/></Link><Link className="rh-btn dark" href="/inventory" aria-label="BROWSE INVENTORY"><span>BROWSE INVENTORY</span><WdccIcon name="arrow-right"/></Link></div>
       <TrackedCallLink className="rh-phone" source="home-hero-phone" label="Call Sean"><WdccIcon name="phone"/><span>CALL SEAN</span><b>813-516-4752</b></TrackedCallLink>
     </div></div>
   </section>
   <section className="rh-benefit-wrap"><div className="rh-benefits">
     <article className="rh-benefit"><span className="rh-icon"><WdccIcon className="rh-benefit-icon--desktop" name="check"/><WdccIcon className="rh-benefit-icon--mobile" name="check-mark"/></span><div><strong>FAST APPROVALS</strong><small>Quick, straightforward decisions.</small></div></article>
     <article className="rh-benefit"><span className="rh-icon"><WdccIcon className="rh-benefit-icon--desktop" name="dollar"/><WdccIcon className="rh-benefit-icon--mobile" name="dollar-mark"/></span><div><strong>LOW DOWN PAYMENTS</strong><small>Options designed around real buyers.</small></div></article>
     <Link className="rh-benefit" href="/schedule-test-drive?source=home-drive-today" aria-label="Schedule a test drive"><span className="rh-icon"><WdccIcon className="rh-benefit-icon--desktop" name="car"/><WdccIcon className="rh-benefit-icon--mobile" name="square"/></span><div><strong>DRIVE TODAY</strong><small>Move from interest to the road.</small></div></Link>
     <article className="rh-benefit"><span className="rh-icon"><WdccIcon className="rh-benefit-icon--desktop" name="shield"/><WdccIcon className="rh-benefit-icon--mobile" name="diamond"/></span><div><strong>BUILD YOUR CREDIT</strong><small>Ask what programs may apply.</small></div></article>
   </div></section>
   <section className="rh-inventory"><div className="rh-section-head"><div><small>FEATURED INVENTORY</small><h2>Vehicles ready now.</h2><p>{recoveryMode?"Last verified vehicles shown. Confirm current availability with Sean.":"Cash price and down payment shown clearly."}</p></div><Link className="rh-view-all" href="/inventory"><span>VIEW ALL INVENTORY</span><WdccIcon name="arrow-right"/></Link></div>
     {fixtureMode&&<div className="wdccOwnerReviewBanner" role="status">{WDCC_VISUAL_REVIEW_LABEL}</div>}
     {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>VERIFIED RECOVERY INVENTORY</strong><span>Provider sync is temporarily unavailable. Confirm availability with Sean · 813-516-4752.</span></div>}
     {inventoryState==="loading"&&<div className="rh-inventory-state">Loading current inventory…</div>}
     {inventoryState==="empty"&&<div className="rh-inventory-state"><strong>Inventory is updating.</strong><span>Call Sean for the vehicles available right now.</span></div>}
     {inventoryState==="error"&&<div className="rh-inventory-state"><strong>Live inventory is temporarily unavailable.</strong><span>Call Sean for current availability.</span></div>}
     {inventoryState==="ready"&&<><div className="rh-grid" ref={gridRef} onScroll={()=>{const g=gridRef.current;if(!g||!g.children.length)return;const center=g.scrollLeft+g.clientWidth/2;let best=0,dist=Infinity;Array.from(g.children).forEach((el,i)=>{const n=el as HTMLElement,d=Math.abs(n.offsetLeft+n.offsetWidth/2-center);if(d<dist){dist=d;best=i}});if(best!==active)setActive(best)}}>{vehicles.slice(0,5).map((v,i)=><WdccVehicleCard key={String(v.id||v.slug||i)} vehicle={v} featured/>)}</div><div className="rh-mobile-dots" aria-label="Featured inventory position">{vehicles.slice(0,5).map((v,i)=><button key={String(v.id||i)} className={i===active?"active":""} onClick={()=>goTo(i)} aria-label={`Vehicle ${i+1}`}/>)}</div></>}
   </section>
   <section className="rh-finance" id="how-it-works"><div className="rh-finance-inner"><div className="finance-heading"><div><h2>IN-HOUSE FINANCING <span>MADE EASY</span></h2><p>One simple process. No hoops. No hassle.</p></div><Link className="finance-start" href="/get-approved?source=home-finance-preapproval"><span>START PRE-APPROVAL</span><WdccIcon name="arrow-right"/></Link></div><div className="rh-steps">
     <article className="rh-step"><b>1</b><span className="rh-step-icon"><WdccIcon name="application"/></span><strong>APPLY ONLINE</strong><small>Send basic details securely.</small></article><article className="rh-step"><b>2</b><span className="rh-step-icon"><WdccIcon name="chat"/></span><strong>TALK TO SEAN</strong><small>Confirm down payment and vehicle fit.</small></article><article className="rh-step"><b>3</b><span className="rh-step-icon"><WdccIcon name="car"/></span><strong>CHOOSE YOUR CAR</strong><small>Shop our inventory online or in person.</small></article><article className="rh-step"><b>4</b><span className="rh-step-icon"><WdccIcon name="key"/></span><strong>DRIVE TODAY</strong><small>Schedule pickup or a test drive.</small></article>
   </div></div></section>
   <section className="rh-trust" id="about"><div className="rh-trust-grid rh-trust-grid-standard" id="reviews"><article><span className="trust-symbol"><WdccIcon name="community"/></span><div><b>TAMPA BAY PROUD</b><span>Local dealer. Local community.</span></div></article><article><span className="trust-symbol"><WdccIcon name="chat"/></span><div><b>STRAIGHT ANSWERS</b><span>No runaround. No hidden fees.</span></div></article><article><span className="trust-avatar"><img src="/wdcc-sean-portrait.webp" alt="Sean, sales manager"/></span><div><b>REAL PEOPLE</b><span>Talk to Sean. Not a call center.</span></div></article><article><span className="trust-symbol"><WdccIcon name="badge"/></span><div><b>IN-HOUSE FINANCING</b><span>We make it happen when others can&apos;t.</span></div></article></div><div className="rh-trust-grid rh-trust-grid-expanded"><strong className="trust-heading">WHY WDCC?</strong><article><span className="trust-symbol"><WdccIcon name="shield"/></span><div><b>WE WORK WITH YOU</b><span>Solutions for all credit situations.</span></div></article><article><span className="trust-symbol"><WdccIcon name="chat"/></span><div><b>STRAIGHT ANSWERS</b><span>No runaround. No hidden fees.</span></div></article><article><span className="trust-symbol"><WdccIcon name="handshake"/></span><div><b>LOCAL &amp; TRUSTED</b><span>Serving Tampa Bay and beyond.</span></div></article><article><span className="trust-symbol"><WdccIcon name="badge"/></span><div><b>BUILT FOR YOU</b><span>Your approval. Your future.</span></div></article><article><span className="trust-avatar"><img src="/wdcc-sean-portrait.webp" alt="Sean, sales manager"/></span><div><b>TALK TO SEAN</b><span>Real answers from a real person.</span></div></article></div></section>
   <WdccPublicFooter/>
 </main>
}
