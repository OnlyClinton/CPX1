"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import styles from "./WdccVehicleCard.module.css";

export type WdccVehicle={
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
  transmission?:string;
  drivetrain?:string;
  bodyStyle?:string;
  body_style?:string;
  primaryPhotoPathname?:string;
  primary_image_url?:string;
  image?:string;
};

const VERIFIED_RECOVERY_MEDIA:Record<string,string>={
  "2004-nissan-350z":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2004-nissan-350z.jpg",
  "2016-ford-f150-limited":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2016-ford-f150-limited.jpg",
  "2019-honda-pilot":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-honda-pilot.jpg",
  "2019-kia-sportage":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-kia-sportage.jpg",
  "2019-toyota-rav4":"https://xgbsyv0ovelnac0u.public.blob.vercel-storage.com/wdcc/vehicles/2019-toyota-rav4.jpg"
};

function recoveryMediaKey(v:WdccVehicle){
  return String(v.slug||v.id||"").trim().toLowerCase().replace(/^recovered-/,"").replace(/^recovery-/,"");
}

export function vehicleHref(v:WdccVehicle){return `/vehicle/${encodeURIComponent(String(v.id||v.slug||""))}`}
export function vehiclePhoto(v:WdccVehicle){
  if(v.primaryPhotoPathname)return `/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`;
  const direct=String(v.primary_image_url||v.image||"").trim();
  if(direct)return direct;
  return VERIFIED_RECOVERY_MEDIA[recoveryMediaKey(v)]||"";
}

export default function WdccVehicleCard({vehicle,featured=false}:{vehicle:WdccVehicle;featured?:boolean}){
  const v=vehicle;
  const href=vehicleHref(v);
  const src=vehiclePhoto(v);
  const[photoFailed,setPhotoFailed]=useState(false);
  useEffect(()=>setPhotoFailed(false),[src]);
  const price=Number(v.price||v.cashPrice||0);
  const down=v.downPayment??v.down_payment;
  const tags=[Number(v.mileage||0)>0?`${Number(v.mileage).toLocaleString()} MILES`:null,v.transmission,v.drivetrain||v.bodyStyle||v.body_style].filter(Boolean).slice(0,3);
  const title=`${v.year||""} ${v.make||""} ${v.model||""}`.trim();
  const showPhoto=Boolean(src)&&!photoFailed;

  return <article className={`${styles.card}${featured?` ${styles.featured}`:""}`}>
    <Link className={styles.photo} href={href} aria-label={`View ${title}`}>
      {showPhoto?<img src={src} alt={title} loading={featured?"eager":"lazy"} onError={()=>setPhotoFailed(true)}/>:<span className={styles.placeholder} role="img" aria-label={`${title} photo unavailable`}><small>PHOTO TEMPORARILY UNAVAILABLE</small><strong>{v.make||"WDCC"} {v.model||"VEHICLE"}</strong></span>}
      {featured&&<span className={styles.badge}>AVAILABLE</span>}
    </Link>
    <div className={styles.body}>
      <p className={styles.eyebrow}>{v.year||"—"} {v.make||"Vehicle"}</p>
      <Link className={styles.title} href={href}>{v.model||"Vehicle"}{v.trim?` ${v.trim}`:""}</Link>
      <strong className={styles.price}>${price.toLocaleString()}</strong>
      <p className={styles.down}>{down!=null&&Number(down)>0?`$${Number(down).toLocaleString()} DOWN`:"CALL FOR DOWN PAYMENT"}</p>
      <div className={styles.pills}>{tags.map((tag,i)=><span key={`${String(tag)}-${i}`}>{String(tag)}</span>)}</div>
      {!featured&&<div className={styles.actions}><Link href={href}>VIEW VEHICLE</Link><Link className={styles.primary} href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(String(v.id||v.slug||""))}`}>GET PRE-APPROVED</Link></div>}
    </div>
  </article>;
}
