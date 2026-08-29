"use client";

import Link from"next/link";
import{useEffect,useMemo,useState}from"react";
import{WdccPublicFooter,WdccPublicHeader}from"../../WdccPublicChrome";
import{isWdccVisualReviewFixture,wdccVisualReviewVehicle}from"../../wdccVisualReviewInventory";
import{WDCC_RECOVERY_INVENTORY}from"../../../lib/recoveryInventory";

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
const mediaPath=(p:any)=>String(p||"").trim()?`/api/media?p=${encodeURIComponent(String(p).trim())}`:"";

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState("");
  const[vehicle,setVehicle]=useState<VehicleRecord|null>(null);
  const[state,setState]=useState<LoadState>("loading");
  const[fixtureMode,setFixtureMode]=useState(false);
  const[recoveryMode,setRecoveryMode]=useState(false);
  const[activePhoto,setActivePhoto]=useState(0);

  useEffect(()=>{let live=true;params.then(x=>{if(live)setId(String(x?.id||""))}).catch(()=>{if(live)setState("error")});return()=>{live=false}},[params]);
  useEffect(()=>{
    if(!id)return;
    setActivePhoto(0);
    if(isWdccVisualReviewFixture()){
      setFixtureMode(true);setRecoveryMode(false);
      const item=wdccVisualReviewVehicle(id);
      if(item){setVehicle(item);setState("ready")}else{setVehicle(null);setState("error")}
      return;
    }
    const recovery=WDCC_RECOVERY_INVENTORY.find(item=>String(item.id)===id||String(item.slug)===id);
    if(recovery){setFixtureMode(false);setRecoveryMode(true);setVehicle({...recovery});setState("ready");return;}
    const controller=new AbortController();
    let live=true;
    setFixtureMode(false);setRecoveryMode(false);setState("loading");
    fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store",signal:controller.signal})
      .then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok||body?.previewFallback||body?.inventorySource==="last-known-good-real-proof")throw new Error(body?.error||`Vehicle ${r.status}`);const item=body?.item||body?.vehicle;if(!item||!customerVisible(item))throw new Error("VEHICLE_NOT_PUBLIC");return item})
      .then(item=>{if(live){setVehicle(item);setState("ready")}})
      .catch(e=>{if(live&&e?.name!=="AbortError"){setVehicle(null);setState("error")}});
    return()=>{live=false;controller.abort()};
  },[id]);

  const v=vehicle;
  const q=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const title=v?`${v.year} ${v.make} ${v.model}`:"VEHICLE DETAILS";
  const down=v?.downPayment??v?.down_payment;
  const photos=useMemo(()=>{
    if(!v)return[] as string[];
    const paths=[v.primaryPhotoPathname,...(Array.isArray(v.photoPathnames)?v.photoPathnames:[])].filter(Boolean).map(mediaPath);
    const external=[v.primary_image_url,v.image].map(x=>String(x||"").trim()).filter(Boolean);
    return Array.from(new Set([...paths,...external]));
  },[v]);
  const features=useMemo(()=>{
    if(!v)return[] as string[];
    const raw=Array.isArray(v.features)?v.features:Array.isArray(v.options)?v.options:typeof v.features==="string"?v.features.split(/[,\n]/):[];
    return raw.map((x:any)=>String(x||"").trim()).filter(Boolean).slice(0,18);
  },[v]);
  const activeSrc=photos[activePhoto]||photos[0]||"";
  const facts=[
    ["MILEAGE",Number(v?.mileage||0)>0?`${Number(v?.mileage).toLocaleString()} mi`:"—"],
    ["TRANSMISSION",v?.transmission],
    ["DRIVETRAIN",v?.drivetrain],
    ["FUEL",v?.fuelType||v?.fuel_type||v?.fuel],
    ["BODY",v?.bodyStyle||v?.body_style],
    ["CONDITION",v?.condition],
    ["STOCK",v?.stock||v?.stock_id]
  ].filter(([,value])=>String(value||"").trim());
  const description=fixtureMode?"":String(v?.description||"").trim();

  return <>
    <WdccPublicHeader/>
    <main className="vehiclePage wdcc-public-page" data-wdcc-proof-mode={fixtureMode?"owner-review":undefined}>
      <section className="inventoryTop vehicleTop"><div className="wrap"><div className="eyebrow">{recoveryMode?"RECENT VERIFIED LISTING":"CURRENT VEHICLE DETAILS"}</div><h1>{title}</h1><p className="lede">{recoveryMode?"Listing updates may be delayed. Confirm current availability with Sean before visiting.":"Clear pricing, direct answers, and the details you need before scheduling a drive."}</p></div></section>
      <section className="section light vehicleSection"><div className="wrap">
        {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>INVENTORY SYNC UPDATE</strong><span>Some listing updates may be delayed. Confirm availability with Sean · 813-516-4752.</span></div>}
        {state==="loading"&&<div className="vehicleStatus" role="status"><span className="vehicleStatusBadge">WDCC</span><div><h2>Loading current vehicle details…</h2><p>Checking the published inventory record.</p></div></div>}
        {state==="error"&&<section className="vehicleUnavailable" role="status"><div className="eyebrow muted">INVENTORY STATUS</div><h2>Vehicle details are temporarily unavailable.</h2><p>Call Sean for current availability, or return to inventory.</p><div className="vehicleActions"><Link className="cta red" href="/inventory">BROWSE INVENTORY</Link><Link className="cta" href="/get-approved?source=vehicle-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section>}
        {state==="ready"&&v&&<div className="vehicleLayout">
          <section className="vehicleMedia"><div className="photo vehiclePhoto">{activeSrc?<img src={activeSrc} alt={`${title} photo ${activePhoto+1}`}/>:<div className="vehiclePhotoMissing" role="img" aria-label={`${title} photo coming soon`}><span>PHOTO COMING SOON</span></div>}</div>{photos.length>1&&<div className="vehicleGallery" aria-label="Vehicle photo gallery">{photos.map((src,i)=><button key={`${src}-${i}`} className={i===activePhoto?"active":""} type="button" onClick={()=>setActivePhoto(i)} aria-label={`Show vehicle photo ${i+1}`}><img src={src} alt=""/></button>)}</div>}<p>{recoveryMode?"Ask Sean to confirm current availability and send any additional photos you need.":photos.length?"Photos shown are attached to this vehicle record.":"Vehicle media has not been attached yet."}</p></section>
          <section className="vehicleSummary"><div className="eyebrow muted">{recoveryMode?"CONFIRM AVAILABILITY":fixtureMode?"FEATURED VEHICLE":"AVAILABLE VEHICLE"}</div><h2>{title}{v.trim?` ${v.trim}`:""}</h2><div className="price">${Number(v.price||v.cashPrice||0).toLocaleString()}</div>{down!=null&&<div className="down">${Number(down).toLocaleString()} estimated down</div>}<div className="vehicleFacts">{facts.map(([label,value])=><span key={String(label)}><small>{label}</small><b>{String(value)}</b></span>)}</div>{features.length>0&&<section className="vehicleFeatures"><h3>Features</h3><div>{features.map(feature=><span key={feature}>✓ {feature}</span>)}</div></section>}{description&&<section className="vehicleDescriptionBlock"><h3>Description</h3><p className="vehicleDescription">{description}</p></section>}<div className="vehicleActions vehicleActionsPrimary"><Link className="cta red" href={`/schedule-test-drive${q}`}>SCHEDULE TEST DRIVE</Link><a className="cta dark" href="tel:+18135164752">CALL SEAN</a></div></section>
        </div>}
      </div></section>
    </main>
    <WdccPublicFooter/>
  </>;
}
