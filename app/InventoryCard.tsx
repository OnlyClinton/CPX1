"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {recoveryVehicleImage,vehicleImageSource} from "../lib/recoveryVehicleImage";
import styles from "./inventory-cards.module.css";

export type InventoryVehicle={
  id?:string;slug?:string;year?:number;make?:string;model?:string;trim?:string;
  price?:number;cashPrice?:number;downPayment?:number;down_payment?:number;mileage?:number;
  primaryPhotoPathname?:string;photoPathnames?:string[];primary_image_url?:string;image?:string;
  photoPending?:boolean;bodyStyle?:string;body_style?:string;transmission?:string;drivetrain?:string;
};

function vehicleKey(vehicle:InventoryVehicle){return String(vehicle.slug||vehicle.id||"");}
export function vehicleHref(vehicle:InventoryVehicle){return `/vehicle/${encodeURIComponent(vehicleKey(vehicle))}`;}
export function InventoryCard({vehicle,index=0,variant="catalog"}:{vehicle:InventoryVehicle;index?:number;variant?:"catalog"|"featured"}){
  const href=vehicleHref(vehicle);
  const year=Number(vehicle.year||0),make=String(vehicle.make||"").trim(),model=String(vehicle.model||"").trim(),trim=String(vehicle.trim||"").trim();
  const price=Number(vehicle.price??vehicle.cashPrice??0),down=Number(vehicle.downPayment??vehicle.down_payment??0),mileage=Number(vehicle.mileage||0);
  const primary=vehicleImageSource(vehicle),fallback=recoveryVehicleImage(vehicle),body=String(vehicle.bodyStyle||vehicle.body_style||"").trim();
  const[photoUnavailable,setPhotoUnavailable]=useState(!primary);
  useEffect(()=>{setPhotoUnavailable(!primary)},[primary]);

  return <Link className={`${styles.card} ${styles[variant]}`} href={href} data-inventory-card data-vehicle-id={vehicleKey(vehicle)}>
    <span className={styles.media}>
      <span className={styles.photoSkeleton} aria-hidden="true"/>
      {!primary||photoUnavailable?<span className={styles.photoFallback} aria-hidden="true">Photo unavailable · call Sean</span>:null}
      {primary?<img src={primary} alt="" width="1400" height="782" loading={variant==="catalog"&&index===0?"eager":"lazy"} decoding="async" fetchPriority={variant==="catalog"&&index===0?"high":"auto"} onError={event=>{
        const image=event.currentTarget;
        if(fallback&&!image.dataset.fallbackAttempted&&!image.src.endsWith(fallback)){image.dataset.fallbackAttempted="true";image.src=fallback;return;}
        image.hidden=true;setPhotoUnavailable(true);
      }} onLoad={event=>{event.currentTarget.hidden=false;setPhotoUnavailable(false)}}/>:null}
    </span>
    <span className={styles.body}>
      <span className={styles.makeLine}>{year} {make}</span>
      <span className={styles.title}>{model}{trim?<small>{trim}</small>:null}</span>
      <span className={styles.price}>${price.toLocaleString()}</span>
      <span className={styles.facts}><span>{mileage.toLocaleString()} miles</span>{body?<span>{body}</span>:null}</span>
      <span className={styles.down}>{down?`From $${down.toLocaleString()} down`:"Ask about financing"}</span>
      <span className={styles.details} aria-hidden={variant==="featured"?"true":undefined}>View details <b aria-hidden="true">→</b></span>
    </span>
  </Link>;
}

export {styles as inventoryCardStyles};
