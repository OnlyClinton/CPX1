"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type InventoryState="loading"|"ready"|"empty"|"error"|"fallback";

type Vehicle={
  id?:string;
  slug?:string;
  year?:number;
  make?:string;
  model?:string;
  trim?:string;
  price?:number;
  cashPrice?:number;
  downPayment?:number;
  down_payment?:number;
  mileage?:number;
  primaryPhotoPathname?:string;
  primary_image_url?:string;
  image?:string;
  status?:string;
  stock?:string;
  stock_id?:string;
  badges?:string[];
  visibility?:string;
  internalOnly?:boolean;
};

function customerVisible(v:Vehicle){
  const status=String(v?.status||"").toLowerCase();
  const stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase();
  const visibility=String(v?.visibility||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map(x=>String(x||"").toUpperCase());
  const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some(b=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only";
}

function vehicleHref(v:Vehicle){return `/vehicle/${encodeURIComponent(String(v.id||v.slug||""))}`}
function photo(v:Vehicle){return v.primaryPhotoPathname?`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`:String(v.primary_image_url||v.image||"").trim()}

export default function InventoryGrid(){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[state,setState]=useState<InventoryState>("loading");

  useEffect(()=>{
    let live=true;
    fetch("/api/inventory",{cache:"no-store"})
      .then(async r=>{
        const body=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(body?.error||`Inventory ${r.status}`);
        return body;
      })
      .then(body=>{
        if(!live)return;
        if(body?.previewFallback===true||body?.inventorySource==="last-known-good-real-proof"){
          setItems([]);
          setState("fallback");
          return;
        }
        const vehicles=(Array.isArray(body?.items)?body.items:Array.isArray(body?.inventory)?body.inventory:[]).filter(customerVisible);
        setItems(vehicles);
        setState(vehicles.length?"ready":"empty");
      })
      .catch(()=>{if(live){setItems([]);setState("error")}});
    return()=>{live=false};
  },[]);

  if(state==="loading")return <div className="grid inventoryGrid" aria-label="Loading current inventory">{[1,2,3].map(i=><div className="card" key={i}><div className="photo">LOADING VEHICLE…</div><div className="cardBody"><div className="carTitle">Inventory loading</div></div></div>)}</div>;

  if(state==="fallback")return <div className="grid inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Live inventory and uploaded photos are temporarily unavailable.</h3><p>This isolated preview can reach only the last verified inventory snapshot because the canonical media/state provider is currently blocked. We are not presenting stale records as live listings or substituting fake vehicle photos.</p><div className="actions"><Link className="cta red" href="/get-approved?source=inventory-provider-fallback">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></div></div>;

  if(state==="error")return <div className="grid inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Live inventory is temporarily unavailable.</h3><p>We are not substituting demo vehicles. Call Sean at <a href="tel:+18135164752">813-516-4752</a> for current availability.</p><div className="actions"><Link className="cta red" href="/get-approved?source=inventory-provider-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN</a></div></div></div>;

  if(state==="empty")return <div className="grid inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is being updated.</h3><p>There are no customer-visible published vehicles to show right now. Call or text Sean for vehicles being prepared.</p><a className="cta red" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></div>;

  return <div className="grid inventoryGrid">{items.map(v=>{
    const src=photo(v),href=vehicleHref(v),price=Number(v.price||v.cashPrice||0),down=v.downPayment??v.down_payment;
    return <article className="card" key={String(v.id||v.slug)}>
      <Link className="photo" href={href} aria-label={`View ${v.year} ${v.make} ${v.model}`}>{src?<img src={src} alt={`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</Link>
      <div className="cardBody">
        <div className="carTitle">{v.year} {v.make}<br/><b>{v.model}{v.trim?` ${v.trim}`:""}</b></div>
        <div className="facts"><span>{Number(v.mileage||0).toLocaleString()} MILES</span></div>
        <div className="price">${price.toLocaleString()}</div>
        {down!=null&&<div className="down">${Number(down).toLocaleString()} ESTIMATED DOWN</div>}
        <div className="cardButtons"><Link href={href}><span>VIEW VEHICLE</span></Link><Link href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(String(v.id||v.slug||""))}`}><span>GET PRE-APPROVED</span></Link></div>
      </div>
    </article>
  })}</div>;
}
