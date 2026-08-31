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
    fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store"})
      .then(response=>response.json())
      .then(json=>{if(json.item)setV(json.item)})
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[id]);

  const query=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const photo=v?vehiclePhoto(v):"";

  return <><Header/><main className="section light vehicle-detail"><div className="wrap">{v?<><div className="eyebrow muted">VEHICLE DETAILS</div><h2>{v.year} {v.make} {v.model}</h2><div className="grid vehicle-detail-grid"><div className={`photo${v.photoPending?" photo-pending":""}`} style={{borderRadius:22}}>{photo?<img src={photo} alt={v.photoPending?"Vehicle photos updating":`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</div><div><div className="price">${Number(v.price||0).toLocaleString()}</div>{(v.downPayment??v.down_payment)!=null&&<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} estimated down</div>}<p>{Number(v.mileage||0).toLocaleString()} miles</p><p>{v.description}</p><div className="actions"><Link className="cta red" href={`/schedule-test-drive${query}`}>SCHEDULE TEST DRIVE</Link><Link className="cta" href={`/get-approved${query}`}>GET APPROVED</Link><a className="cta ghost vdp-call" href="tel:+18135164752">CALL SEAN</a></div></div></div></>:loading?<h2>Loading vehicle…</h2>:<><h2>Vehicle not found.</h2><p>Call Sean at 813-516-4752 for current availability.</p></>}</div></main><Footer/></>;
}
