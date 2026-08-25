"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import styles from "./inventory.module.css";

type Vehicle={
  id:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;
  primaryPhotoPathname?:string|null;primary_image_url?:string|null;bodyStyle?:string;status?:string;
};

const money=(n:number)=>`$${Number(n||0).toLocaleString()}`;
function donorFallback(v:Vehicle){
  const key=`${v.year} ${String(v.make||"").toLowerCase()} ${String(v.model||"").toLowerCase().replace(/[^a-z0-9]/g,"")}`;
  if(key.includes("2004 nissan 350z"))return "/assets/cars/2004-nissan-350z-1.webp";
  if(key.includes("2016 ford f150"))return "/assets/cars/2016-ford-f150-limited-1.webp";
  if(key.includes("2019 honda pilot"))return "/assets/cars/2019-honda-pilot-1.webp";
  if(key.includes("2019 kia sportage"))return "/assets/cars/2019-kia-sportage-1.webp";
  if(key.includes("2019 toyota rav4"))return "/assets/cars/2019-toyota-rav4-1.webp";
  return "";
}
function photoFor(v:Vehicle){
  if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;
  return v.primary_image_url||donorFallback(v);
}

export default function R31InventoryBrowser(){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[q,setQ]=useState("");
  const[make,setMake]=useState("ALL");
  const[maxPrice,setMaxPrice]=useState("ALL");
  const[sort,setSort]=useState("featured");

  useEffect(()=>{
    fetch("/api/inventory",{cache:"no-store",headers:{accept:"application/json"}})
      .then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`inventory_${r.status}`);return j;})
      .then(j=>setItems(Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[]))
      .catch(e=>setError(e instanceof Error?e.message:"inventory_unavailable"))
      .finally(()=>setLoading(false));
  },[]);

  const makes=useMemo(()=>["ALL",...Array.from(new Set(items.map(v=>String(v.make||"").trim()).filter(Boolean))).sort()], [items]);
  const shown=useMemo(()=>{
    const needle=q.trim().toLowerCase();
    const cap=maxPrice==="ALL"?Infinity:Number(maxPrice);
    const next=items.filter(v=>{
      const hay=`${v.year} ${v.make} ${v.model} ${v.trim||""}`.toLowerCase();
      return (!needle||hay.includes(needle))&&(make==="ALL"||v.make===make)&&Number(v.price||0)<=cap;
    });
    if(sort==="price-asc")next.sort((a,b)=>Number(a.price)-Number(b.price));
    if(sort==="price-desc")next.sort((a,b)=>Number(b.price)-Number(a.price));
    if(sort==="year-desc")next.sort((a,b)=>Number(b.year)-Number(a.year));
    if(sort==="mileage-asc")next.sort((a,b)=>Number(a.mileage||0)-Number(b.mileage||0));
    return next;
  },[items,q,make,maxPrice,sort]);

  if(loading)return <div className={styles.state}>Loading current dealer-published inventory…</div>;
  if(error)return <div className={styles.state}><strong>Inventory is temporarily unavailable.</strong><span>{error}</span></div>;

  return <>
    <section className={styles.controls} aria-label="Inventory filters">
      <label className={styles.search}><span>SEARCH</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Year, make, model…"/></label>
      <label><span>MAKE</span><select value={make} onChange={e=>setMake(e.target.value)}>{makes.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>MAX PRICE</span><select value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}><option value="ALL">Any price</option><option value="5000">$5,000</option><option value="7500">$7,500</option><option value="10000">$10,000</option><option value="15000">$15,000</option><option value="25000">$25,000</option></select></label>
      <label><span>SORT</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="year-desc">Newest year</option><option value="mileage-asc">Lowest mileage</option></select></label>
    </section>

    <div className={styles.resultBar}><strong>{shown.length}</strong> vehicle{shown.length===1?"":"s"} match <button type="button" onClick={()=>{setQ("");setMake("ALL");setMaxPrice("ALL");setSort("featured")}}>CLEAR FILTERS</button></div>

    <section className={styles.grid} aria-live="polite">
      {shown.length?shown.map(v=>{
        const down=v.downPayment??v.down_payment;
        const photo=photoFor(v);
        return <article className={styles.card} key={v.id}>
          <Link className={styles.photo} href={`/vehicle/${encodeURIComponent(v.id)}`} aria-label={`View ${v.year} ${v.make} ${v.model}`}>
            {photo?<img src={photo} alt={`${v.year} ${v.make} ${v.model}`}/>:<div className={styles.noPhoto}><b>PHOTO NEEDED</b><span>Vehicle details are still available.</span></div>}
            <span className={styles.available}>AVAILABLE</span>
          </Link>
          <div className={styles.body}>
            <div className={styles.title}><small>{v.year} {v.make}</small><strong>{v.model}{v.trim?` ${v.trim}`:""}</strong></div>
            <div className={styles.price}>{money(v.price)}</div>
            {down!=null&&<div className={styles.down}>{money(Number(down))} DOWN</div>}
            <div className={styles.meta}><span>{Number(v.mileage||0).toLocaleString()} MILES</span></div>
            <div className={styles.actions}><Link href={`/vehicle/${encodeURIComponent(v.id)}`}>VIEW DETAILS</Link><Link href={`/r31-preview/get-approved?vehicle=${encodeURIComponent(v.id)}`}>GET PRE-APPROVED</Link></div>
          </div>
        </article>;
      }):<div className={styles.empty}><h2>No vehicles match those filters.</h2><p>Clear a filter or call Sean for vehicles being prepared now.</p></div>}
    </section>
  </>;
}
