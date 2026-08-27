"use client";

import Link from"next/link";
import{useEffect,useMemo,useState}from"react";
import{Footer,Header}from"../../components";

function mediaUrl(pathname:string){return `/api/media?p=${encodeURIComponent(pathname)}`}
function vehicleImages(v:any){
  const staticImages=Array.isArray(v?.images)?v.images.filter(Boolean):[];
  const durable=Array.isArray(v?.photoPathnames)?v.photoPathnames.filter(Boolean).map((p:string)=>mediaUrl(p)):[];
  const primary=v?.primaryPhotoPathname?mediaUrl(v.primaryPhotoPathname):v?.primary_image_url||v?.image||"";
  return Array.from(new Set([primary,...durable,...staticImages].filter(Boolean)));
}

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState(""),[v,setV]=useState<any>(),[active,setActive]=useState(0),[error,setError]=useState("");
  useEffect(()=>{params.then(x=>setId(x.id))},[params]);
  useEffect(()=>{if(!id)return;setError("");fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Vehicle unavailable");setV(j.item);setActive(0)}).catch(e=>setError(e.message||"Vehicle unavailable"))},[id]);
  const images=useMemo(()=>vehicleImages(v),[v]);
  const q=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const downPayment=Number((v?.downPayment??v?.down_payment)||0);
  return <><Header/><main className="wdccVdp"><div className="wdccVdpWrap">
    {error?<section className="wdccVdpEmpty"><h1>Vehicle unavailable</h1><p>{error}</p><Link href="/inventory">Back to inventory</Link></section>:v?<>
      <div className="wdccVdpKicker">AVAILABLE · TAMPA BAY</div>
      <div className="wdccVdpHeading"><div><h1>{v.year} {v.make} {v.model}{v.trim?` ${v.trim}`:""}</h1><p>Stock #{v.stock||String(v.id||"").slice(-8)}</p></div><div><strong>${Number(v.price||0).toLocaleString()}</strong>{downPayment>0&&<span>${downPayment.toLocaleString()} estimated down</span>}</div></div>
      <div className="wdccVdpGrid">
        <section className="wdccVdpGallery">
          <div className="wdccVdpMainPhoto">{images.length?<img src={images[Math.min(active,images.length-1)]} alt={`${v.year} ${v.make} ${v.model}`}/>:<div>PHOTOS COMING</div>}</div>
          {images.length>1&&<div className="wdccVdpThumbs">{images.map((src,i)=><button type="button" key={`${src}-${i}`} className={i===active?"active":""} onClick={()=>setActive(i)} aria-label={`View photo ${i+1}`}><img src={src} alt="" loading="lazy"/></button>)}</div>}
        </section>
        <aside className="wdccVdpDetails">
          <div className="wdccVdpFacts"><div><small>MILEAGE</small><b>{Number(v.mileage||0).toLocaleString()} mi</b></div><div><small>BODY</small><b>{v.bodyStyle||v.body_style||"Used Vehicle"}</b></div><div><small>TRANSMISSION</small><b>{v.transmission||"Call for details"}</b></div><div><small>DRIVETRAIN</small><b>{v.drivetrain||"Call for details"}</b></div></div>
          <p className="wdccVdpDescription">{v.description||"Call Sean for current condition, equipment and availability details."}</p>
          <div className="wdccVdpActions"><Link className="primary" href={`/schedule-test-drive${q}`}>SCHEDULE TEST DRIVE</Link><Link href={`/get-approved${q}`}>GET APPROVED</Link><a href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div>
          <p className="wdccVdpFine">Confirm price, mileage, down payment, equipment and availability before purchase.</p>
        </aside>
      </div>
    </>:<section className="wdccVdpEmpty"><h1>Loading vehicle…</h1></section>}
  </div></main><Footer/><style jsx global>{`
  .wdccVdp{background:#f4f6f8;color:#081522;min-height:70svh;padding:42px 18px 64px}.wdccVdpWrap{max-width:1180px;margin:auto}.wdccVdpKicker{font-size:11px;font-weight:900;letter-spacing:.15em;color:#d8192c;margin-bottom:10px}.wdccVdpHeading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:24px}.wdccVdpHeading h1{font-size:clamp(30px,4vw,52px);line-height:.98;margin:0;letter-spacing:-.04em}.wdccVdpHeading p{color:#667483;margin:8px 0 0}.wdccVdpHeading>div:last-child{text-align:right}.wdccVdpHeading strong{display:block;font-size:34px}.wdccVdpHeading span{font-size:13px;color:#d8192c;font-weight:800}.wdccVdpGrid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.7fr);gap:22px;align-items:start}.wdccVdpGallery,.wdccVdpDetails{background:white;border:1px solid #dce3e8;border-radius:18px;box-shadow:0 15px 35px rgba(8,21,34,.08)}.wdccVdpGallery{padding:12px}.wdccVdpMainPhoto{aspect-ratio:16/10;background:#e9edf0;border-radius:13px;overflow:hidden;display:grid;place-items:center;color:#73808a;font-weight:900}.wdccVdpMainPhoto img{width:100%;height:100%;object-fit:cover}.wdccVdpThumbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:8px;margin-top:9px}.wdccVdpThumbs button{border:2px solid transparent;border-radius:9px;padding:0;overflow:hidden;aspect-ratio:4/3;background:#e9edf0;cursor:pointer}.wdccVdpThumbs button.active{border-color:#e51c30}.wdccVdpThumbs img{width:100%;height:100%;object-fit:cover}.wdccVdpDetails{padding:22px}.wdccVdpFacts{display:grid;grid-template-columns:1fr 1fr;gap:9px}.wdccVdpFacts div{border:1px solid #e2e7eb;background:#f8fafb;border-radius:10px;padding:12px}.wdccVdpFacts small{display:block;color:#7b8791;font-size:9px;letter-spacing:.08em}.wdccVdpFacts b{display:block;margin-top:4px;font-size:13px}.wdccVdpDescription{font-size:14px;line-height:1.65;color:#465664;margin:18px 0}.wdccVdpActions{display:grid;gap:9px}.wdccVdpActions a{min-height:48px;border:1px solid #13293a;border-radius:8px;display:grid;place-items:center;font-size:12px;font-weight:950;color:#10202d}.wdccVdpActions .primary{background:#e51c30;border-color:#e51c30;color:white}.wdccVdpFine{font-size:10px;color:#78848d;line-height:1.5;margin:15px 0 0}.wdccVdpEmpty{max-width:700px;margin:60px auto;text-align:center}.wdccVdpEmpty a{color:#d8192c;font-weight:900}@media(max-width:780px){.wdccVdp{padding:24px 12px 42px}.wdccVdpHeading{display:block}.wdccVdpHeading>div:last-child{text-align:left;margin-top:14px}.wdccVdpGrid{grid-template-columns:1fr}.wdccVdpFacts{grid-template-columns:1fr 1fr}.wdccVdpThumbs{display:flex;overflow:auto}.wdccVdpThumbs button{min-width:82px}.wdccVdpHeading h1{font-size:34px}}
  `}</style></>;
}
