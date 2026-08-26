"use client";

import Link from"next/link";
import{useEffect,useState}from"react";
import{Footer,Header}from"../../components";

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState("");
  const[v,setV]=useState<any>();
  useEffect(()=>{params.then(x=>setId(x.id))},[params]);
  useEffect(()=>{
    if(!id)return;
    let live=true;
    const load=async()=>{
      try{
        const direct=await fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store"});
        if(direct.ok){const j=await direct.json();if(live&&j?.item){setV(j.item);return}}
      }catch{}
      try{
        const list=await fetch(`/api/inventory?vdp=${Date.now()}`,{cache:"no-store"});
        if(!list.ok)return;
        const j=await list.json();const items=Array.isArray(j?.items)?j.items:Array.isArray(j?.inventory)?j.inventory:[];
        const item=items.find((x:any)=>String(x?.id||x?.slug||"")===id);
        if(live&&item)setV(item);
      }catch{}
    };
    load();
    return()=>{live=false};
  },[id]);
  const q=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  return <>
    <Header/>
    <main className="vdp-page">
      <div className="vdp-wrap">
        {v?<>
          <div className="vdp-kicker">VEHICLE DETAILS</div>
          <h1 className="vdp-title">{v.year} {v.make} {v.model}</h1>
          <div className="vdp-grid">
            <div className="vdp-photo">
              {v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt={`${v.year} ${v.make} ${v.model}`}/>:v.primary_image_url?<img src={v.primary_image_url} alt={`${v.year} ${v.make} ${v.model}`}/>:<span>PHOTOS COMING</span>}
            </div>
            <aside className="vdp-summary">
              <div className="vdp-price">${Number(v.price||0).toLocaleString()}</div>
              {(v.downPayment??v.down_payment)!=null&&<div className="vdp-down">${Number(v.downPayment??v.down_payment).toLocaleString()} DOWN</div>}
              <div className="vdp-mileage">{Number(v.mileage||0).toLocaleString()} miles</div>
              {v.description&&<p className="vdp-description">{v.description}</p>}
              <div className="vdp-actions">
                <Link className="vdp-btn primary" href={`/schedule-test-drive${q}`}>TEST DRIVE</Link>
                <Link className="vdp-btn" href={`/get-approved${q}`}>GET APPROVED</Link>
                <a className="vdp-btn ghost" href="tel:+18135164752">CALL SEAN</a>
              </div>
            </aside>
          </div>
        </>:<div className="vdp-loading">Loading vehicle…</div>}
      </div>
    </main>
    <Footer/>
  </>
}
