"use client";

import Link from"next/link";
import{useEffect,useState}from"react";
import{Footer,Header}from"../../components";
import{fallbackVehicle}from"../../../lib/publicInventoryFallback";

function vehiclePhoto(vehicle:any){
  const pathname=String(vehicle?.primaryPhotoPathname||vehicle?.photoPathnames?.[0]||"");
  return pathname?`/api/media?p=${encodeURIComponent(pathname)}`:String(vehicle?.primary_image_url||vehicle?.image||"");
}

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState("");
  const[v,setV]=useState<any>();
  const[loading,setLoading]=useState(true);

  useEffect(()=>{params.then(value=>setId(value.id))},[params]);
  useEffect(()=>{
    if(!id)return;
    const fallback=fallbackVehicle(id);
    if(fallback)setV(fallback);
    fetch(`/api/inventory/${encodeURIComponent(id)}?scope=public`,{cache:"no-store"})
      .then(async response=>({ok:response.ok,json:await response.json().catch(()=>({}))}))
      .then(({ok,json})=>{if(ok&&json.item)setV(json.item);else setV(undefined)})
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[id]);

  const query=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const photo=v?vehiclePhoto(v):"";
  const recovered=v?fallbackVehicle(String(v.id||v.slug||id)):undefined;
  const recoveredPhoto=recovered?vehiclePhoto(recovered):"";

  const specs=v?[v.bodyStyle||v.body_style,v.transmission,v.drivetrain,v.fuelType||v.fuel_type].filter(Boolean):[];
  return <><Header/><main className="section light vehicle-detail"><div className="wrap">{v?<><div className="eyebrow muted">AVAILABLE VEHICLE · {v.stock?`STOCK ${v.stock}`:"TAMPA BAY"}</div><h2>{v.year} {v.make} {v.model}{v.trim?` ${v.trim}`:""}</h2><div className="grid vehicle-detail-grid"><div className={`photo${v.photoPending?" photo-pending":""}`}>{photo?<img src={photo} alt={v.photoPending?"Vehicle photos updating":`${v.year} ${v.make} ${v.model}`} width="1400" height="782" loading="eager" decoding="async" fetchPriority="high" onError={event=>{if(recoveredPhoto&&!event.currentTarget.src.endsWith(recoveredPhoto)){event.currentTarget.src=recoveredPhoto;return}event.currentTarget.style.display="none"}}/>:"PHOTOS COMING"}</div><section className="vehicle-summary"><div className="price">${Number(v.price||0).toLocaleString()}</div>{(v.downPayment??v.down_payment)!=null?<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} estimated down</div>:null}<div className="vehicle-specs"><span>{Number(v.mileage||0).toLocaleString()} miles</span>{specs.map((spec,index)=><span key={`${spec}-${index}`}>{String(spec)}</span>)}</div><p className="vehicle-description">{v.description||"Call Sean to confirm current vehicle details and availability."}</p><div className="actions"><Link className="cta red" href={`/schedule-test-drive${query}`}>SCHEDULE TEST DRIVE</Link><Link className="cta" href={`/get-approved${query}`}>GET PRE-APPROVED</Link><a className="cta ghost vdp-call" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></section></div></>:loading?<h2>Loading vehicle…</h2>:<><h2>Vehicle not found.</h2><p>Call Sean at 813-516-4752 for current availability.</p></>}</div></main><Footer/></>;
}
