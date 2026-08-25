"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import styles from "./R31FeaturedInventory.module.css";

type Vehicle={
  id:string;year:number;make:string;model:string;trim?:string;price:number;downPayment?:number;down_payment?:number;mileage?:number;
  primaryPhotoPathname?:string|null;primary_image_url?:string|null;
};

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

export default function R31FeaturedInventory(){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/inventory",{cache:"no-store",headers:{accept:"application/json"}}).then(r=>r.json()).then(j=>setItems((Array.isArray(j.items)?j.items:Array.isArray(j.inventory)?j.inventory:[]).slice(0,5))).catch(()=>setItems([])).finally(()=>setLoading(false))},[]);
  if(loading)return <div className={styles.grid}>{[1,2,3,4,5].map(i=><div className={styles.card} key={i}><div className={styles.placeholder}>LOADING…</div></div>)}</div>;
  if(!items.length)return <div className={styles.empty}><b>INVENTORY IS BEING UPDATED.</b><span>Call Sean for vehicles being prepared now.</span></div>;
  return <div className={styles.grid}>{items.map(v=>{
    const photo=photoFor(v);const down=v.downPayment??v.down_payment;
    return <article className={styles.card} key={v.id}>
      <Link className={styles.photo} href={`/vehicle/${encodeURIComponent(v.id)}?source=r31-featured-card`}>
        {photo?<img src={photo} alt={`${v.year} ${v.make} ${v.model}`}/>:<div className={styles.placeholder}>PHOTO NEEDED</div>}
        <span>AVAILABLE</span>
      </Link>
      <div className={styles.body}>
        <small>{v.year} {v.make}</small><strong>{v.model}{v.trim?` ${v.trim}`:""}</strong>
        <b className={styles.price}>${Number(v.price||0).toLocaleString()}</b>
        {down!=null&&<div className={styles.down}>${Number(down).toLocaleString()} DOWN</div>}
        <div className={styles.miles}>{Number(v.mileage||0).toLocaleString()} MILES</div>
        <div className={styles.actions}><Link href={`/vehicle/${encodeURIComponent(v.id)}?source=r31-featured-details`}>VIEW DETAILS</Link><Link href={`/r31-preview/get-approved?source=r31-featured-approved&vehicle=${encodeURIComponent(v.id)}`}>GET PRE-APPROVED</Link></div>
      </div>
    </article>;
  })}</div>;
}
