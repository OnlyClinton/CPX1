"use client";

import Link from"next/link";
import{useEffect,useState}from"react";
import{Footer,Header}from"../../components";

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

  useEffect(()=>{
    let live=true;
    params.then(x=>{if(live)setId(String(x?.id||""))}).catch(()=>{if(live)setState("error")});
    return()=>{live=false};
  },[params]);

  useEffect(()=>{
    if(!id)return;
    const controller=new AbortController();
    let live=true;
    setState("loading");
    fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store",signal:controller.signal})
      .then(async r=>{
        const body=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(body?.error||`Vehicle ${r.status}`);
        const item=body?.item||body?.vehicle;
        if(!item||!customerVisible(item))throw new Error("VEHICLE_NOT_PUBLIC");
        return item;
      })
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
    <Header/>
    <main className="vehiclePage">
      <style>{vehicleCss}</style>
      <section className="inventoryTop vehicleTop"><div className="wrap"><div className="eyebrow">CURRENT VEHICLE DETAILS</div><h1>{title}</h1><p className="lede">Real published inventory only. Clear pricing, direct answers, and no demo vehicle substitutions.</p></div></section>
      <section className="section light vehicleSection"><div className="wrap">
        {state==="loading"&&<div className="vehicleStatus" role="status"><span className="vehicleStatusBadge">WDCC</span><div><h2>Loading current vehicle details…</h2><p>Checking the live published inventory record.</p></div></div>}

        {state==="error"&&<section className="vehicleUnavailable" role="status"><div className="eyebrow muted">LIVE INVENTORY STATUS</div><h2>Vehicle details are temporarily unavailable.</h2><p>We are not substituting a demo vehicle or made-up listing. Call Sean for current availability, or return to the published inventory page.</p><div className="vehicleActions"><Link className="cta red" href="/inventory">BROWSE INVENTORY</Link><Link className="cta" href="/get-approved?source=vehicle-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section>}

        {state==="ready"&&v&&<div className="vehicleLayout">
          <section className="vehicleMedia"><div className="photo vehiclePhoto">{src?<img src={src} alt={title}/>:<div className="vehiclePhotoMissing"><img src="/wdcc-official-logo.webp" alt=""/><span>PHOTOS COMING SOON</span></div>}</div><p>Photos shown are attached to this published vehicle record.</p></section>
          <section className="vehicleSummary"><div className="eyebrow muted">AVAILABLE VEHICLE</div><h2>{title}{v.trim?` ${v.trim}`:""}</h2><div className="price">${Number(v.price||v.cashPrice||0).toLocaleString()}</div>{down!=null&&<div className="down">${Number(down).toLocaleString()} estimated down</div>}<div className="vehicleFacts"><span><small>MILEAGE</small><b>{Number(v.mileage||0).toLocaleString()} mi</b></span>{v.stock||v.stock_id?<span><small>STOCK</small><b>{String(v.stock||v.stock_id)}</b></span>:null}{v.transmission?<span><small>TRANSMISSION</small><b>{String(v.transmission)}</b></span>:null}{v.drivetrain?<span><small>DRIVETRAIN</small><b>{String(v.drivetrain)}</b></span>:null}</div>{String(v.description||"").trim()&&<p className="vehicleDescription">{String(v.description)}</p>}<div className="vehicleActions"><Link className="cta red" href={`/schedule-test-drive${q}`}>SCHEDULE TEST DRIVE</Link><Link className="cta" href={`/get-approved${q}`}>GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section>
        </div>}
      </div></section>
    </main>
    <Footer/>
  </>;
}

const vehicleCss=`
.vehiclePage{background:#f3f0e9;color:#111820;overflow-x:hidden}
.vehiclePage .vehicleTop{min-height:260px!important;padding-top:52px!important;padding-bottom:42px!important}
.vehiclePage .vehicleTop h1{max-width:920px!important;font-size:clamp(46px,6vw,78px)!important}
.vehiclePage .vehicleSection{padding-top:34px!important;padding-bottom:100px!important}
.vehiclePage .vehicleSection>.wrap{width:min(1180px,100% - 32px)!important}
.vehicleLayout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.65fr);gap:24px;align-items:start}
.vehicleMedia,.vehicleSummary,.vehicleUnavailable,.vehicleStatus{background:#fff;border:1px solid #d9dee3;border-radius:18px;box-shadow:0 12px 32px rgba(20,31,42,.09)}
.vehicleMedia{overflow:hidden}.vehicleMedia>p{margin:0;padding:13px 17px 16px;color:#6a7680;font-size:11px;line-height:1.45}
.vehiclePhoto{width:100%!important;aspect-ratio:16/10!important;min-height:0!important;border-radius:0!important;background:#101820!important;overflow:hidden!important;display:grid!important;place-items:center!important}
.vehiclePhoto>img{width:100%;height:100%;object-fit:cover;display:block}
.vehiclePhotoMissing{display:grid;place-items:center;gap:12px;color:#aeb7bf;font-size:11px;letter-spacing:.08em}.vehiclePhotoMissing img{width:96px;height:96px;object-fit:contain;opacity:.38;border-radius:50%}
.vehicleSummary{padding:27px}.vehicleSummary h2,.vehicleUnavailable h2,.vehicleStatus h2{margin:8px 0 16px;font-size:clamp(28px,3vw,42px);line-height:1;letter-spacing:-.045em;color:#08111a}.vehicleSummary .price{font-size:42px;line-height:1;font-weight:950;letter-spacing:-.045em}.vehicleSummary .down{margin-top:7px;color:#c51f31;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.035em}
.vehicleFacts{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:22px 0}.vehicleFacts span{min-height:68px;padding:12px;border:1px solid #e0e4e7;border-radius:9px;background:#f7f8f9}.vehicleFacts small,.vehicleFacts b{display:block}.vehicleFacts small{margin-bottom:6px;color:#74808a;font-size:8px;font-weight:900;letter-spacing:.09em}.vehicleFacts b{font-size:13px;line-height:1.25;color:#15202a;overflow-wrap:anywhere}
.vehicleDescription{margin:18px 0;color:#53616d;font-size:14px;line-height:1.58;white-space:pre-wrap}
.vehicleActions{display:grid;gap:9px;margin-top:22px}.vehicleActions .cta{width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:8px;font-size:10px;font-weight:950;letter-spacing:.035em}
.vehicleUnavailable{max-width:760px;margin:0 auto;padding:34px}.vehicleUnavailable>p{max-width:620px;color:#5e6c77;font-size:15px;line-height:1.58}
.vehicleStatus{max-width:760px;margin:0 auto;padding:28px;display:grid;grid-template-columns:74px 1fr;gap:18px;align-items:center}.vehicleStatusBadge{width:68px;height:68px;display:grid;place-items:center;border-radius:50%;background:#071522;color:#fff;font-size:11px;font-weight:950;letter-spacing:.05em}.vehicleStatus h2{margin:0 0 7px}.vehicleStatus p{margin:0;color:#65717d}
@media(max-width:900px){.vehiclePage .vehicleTop{min-height:230px!important;padding:38px 0 32px!important}.vehiclePage .vehicleTop h1{font-size:clamp(38px,10vw,52px)!important}.vehiclePage .vehicleSection{padding-top:22px!important;padding-bottom:116px!important}.vehicleLayout{grid-template-columns:1fr;gap:14px}.vehicleSummary{padding:20px}.vehicleSummary h2,.vehicleUnavailable h2,.vehicleStatus h2{font-size:29px}.vehicleSummary .price{font-size:36px}.vehicleFacts{grid-template-columns:1fr 1fr}.vehicleUnavailable{padding:24px}.vehicleStatus{padding:22px;grid-template-columns:58px 1fr}.vehicleStatusBadge{width:54px;height:54px}.vehicleActions .cta{min-height:52px;font-size:11px}}
@media(max-width:430px){.vehicleFacts{grid-template-columns:1fr}.vehiclePage .vehicleTop h1{font-size:36px!important}.vehicleUnavailable>p,.vehicleDescription{font-size:14px}}
`;
