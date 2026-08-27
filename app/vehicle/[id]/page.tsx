"use client";

import Link from"next/link";
import{useEffect,useState}from"react";
import{WdccPublicFooter,WdccPublicHeader}from"../../WdccPublicChrome";
import{isWdccVisualReviewFixture,wdccVisualReviewVehicle,WDCC_VISUAL_REVIEW_LABEL}from"../../wdccVisualReviewInventory";

type LoadState="loading"|"ready"|"error";
type VehicleRecord=Record<string,any>;

function customerVisible(v:VehicleRecord){
  const status=String(v?.status||"").toLowerCase();
  const stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase();
  const visibility=String(v?.visibility||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x||"").toUpperCase());
  const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some((b:string)=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));
  return status==="published"&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only"&&!qa;
}

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState("");
  const[vehicle,setVehicle]=useState<VehicleRecord|null>(null);
  const[state,setState]=useState<LoadState>("loading");
  const[fixtureMode,setFixtureMode]=useState(false);

  useEffect(()=>{let live=true;params.then(x=>{if(live)setId(String(x?.id||""))}).catch(()=>{if(live)setState("error")});return()=>{live=false}},[params]);
  useEffect(()=>{
    if(!id)return;
    if(isWdccVisualReviewFixture()){
      setFixtureMode(true);
      const item=wdccVisualReviewVehicle(id);
      if(item){setVehicle(item);setState("ready")}else{setVehicle(null);setState("error")}
      return;
    }
    const controller=new AbortController();
    let live=true;
    setState("loading");
    fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store",signal:controller.signal})
      .then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok||body?.previewFallback||body?.inventorySource==="last-known-good-real-proof")throw new Error(body?.error||`Vehicle ${r.status}`);const item=body?.item||body?.vehicle;if(!item||!customerVisible(item))throw new Error("VEHICLE_NOT_PUBLIC");return item})
      .then(item=>{if(live){setVehicle(item);setState("ready")}})
      .catch(e=>{if(live&&e?.name!=="AbortError"){setVehicle(null);setState("error")}});
    return()=>{live=false;controller.abort()};
  },[id]);

  const v=vehicle;
  const q=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const title=v?`${v.year} ${v.make} ${v.model}`:"VEHICLE DETAILS";
  const src=v?.primaryPhotoPathname?`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`:String(v?.primary_image_url||v?.image||"").trim();
  const down=v?.downPayment??v?.down_payment;

  return <>
    <WdccPublicHeader/>
    <main className="vehiclePage wdcc-public-page">
      <section className="inventoryTop vehicleTop"><div className="wrap"><div className="eyebrow">CURRENT VEHICLE DETAILS</div><h1>{title}</h1><p className="lede">Real published inventory only. Clear pricing, direct answers, and no demo vehicle substitutions.</p></div></section>
      <section className="section light vehicleSection"><div className="wrap">
        {fixtureMode&&<div className="wdccOwnerReviewBanner" role="status">{WDCC_VISUAL_REVIEW_LABEL}</div>}
        {state==="loading"&&<div className="vehicleStatus" role="status"><span className="vehicleStatusBadge">WDCC</span><div><h2>Loading current vehicle details…</h2><p>Checking the live published inventory record.</p></div></div>}
        {state==="error"&&<section className="vehicleUnavailable" role="status"><div className="eyebrow muted">LIVE INVENTORY STATUS</div><h2>Vehicle details are temporarily unavailable.</h2><p>We are not substituting a demo vehicle or made-up listing. Call Sean for current availability, or return to the published inventory page.</p><div className="vehicleActions"><Link className="cta red" href="/inventory">BROWSE INVENTORY</Link><Link className="cta" href="/get-approved?source=vehicle-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section>}
        {state==="ready"&&v&&<div className="vehicleLayout">
          <section className="vehicleMedia"><div className="photo vehiclePhoto">{src?<img src={src} alt={title}/>:<div className="vehiclePhotoMissing"><img src="/wdcc-official-logo.webp" alt=""/><span>PHOTOS COMING SOON</span></div>}</div><p>{fixtureMode?"Historical record photo is not being substituted while media storage is blocked.":"Photos shown are attached to this published vehicle record."}</p></section>
          <section className="vehicleSummary"><div className="eyebrow muted">{fixtureMode?"HISTORICAL REVIEW RECORD":"AVAILABLE VEHICLE"}</div><h2>{title}{v.trim?` ${v.trim}`:""}</h2><div className="price">${Number(v.price||v.cashPrice||0).toLocaleString()}</div>{down!=null&&<div className="down">${Number(down).toLocaleString()} estimated down</div>}<div className="vehicleFacts"><span><small>MILEAGE</small><b>{Number(v.mileage||0).toLocaleString()} mi</b></span>{v.stock||v.stock_id?<span><small>STOCK</small><b>{String(v.stock||v.stock_id)}</b></span>:null}{v.transmission?<span><small>TRANSMISSION</small><b>{String(v.transmission)}</b></span>:null}{v.drivetrain?<span><small>DRIVETRAIN</small><b>{String(v.drivetrain)}</b></span>:null}</div>{String(v.description||"").trim()&&<p className="vehicleDescription">{String(v.description)}</p>}<div className="vehicleActions"><Link className="cta red" href={`/schedule-test-drive${q}`}>SCHEDULE TEST DRIVE</Link><Link className="cta" href={`/get-approved${q}`}>GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section>
        </div>}
      </div></section>
    </main>
    <WdccPublicFooter/>
  </>;
}
