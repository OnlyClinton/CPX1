"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {vehiclePhotoSources} from "../../../lib/vehiclePhotos";
import {Footer,Header} from "../../components";
import styles from "./page.module.css";

type VehicleRecord=Record<string,any>;

const money=(value:unknown)=>Number(value||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const text=(value:unknown,fallback="—")=>String(value??"").trim()||fallback;
const isInternal=(vehicle:VehicleRecord)=>vehicle.internalOnly===true||["internal","dealer_only"].includes(String(vehicle.visibility||vehicle.listingVisibility||"").toLowerCase());

export default function Vehicle({params}:{params:Promise<{id:string}>}){
  const[id,setId]=useState("");
  const[vehicle,setVehicle]=useState<VehicleRecord|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[activePhoto,setActivePhoto]=useState(0);
  const[failedPhotos,setFailedPhotos]=useState<string[]>([]);

  useEffect(()=>{params.then(value=>setId(value.id))},[params]);
  useEffect(()=>{
    if(!id)return;
    const controller=new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/inventory/${encodeURIComponent(id)}`,{cache:"no-store",credentials:"include",signal:controller.signal})
      .then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok||!body?.item)throw Error(response.status===404?"This vehicle is no longer available.":body?.error||"Vehicle details could not be loaded.");return body.item})
      .then(item=>{setVehicle(item);setActivePhoto(0);setFailedPhotos([])})
      .catch(reason=>{if(reason?.name!=="AbortError")setError(reason instanceof Error?reason.message:"Vehicle details could not be loaded.")})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[id]);

  const photos=useMemo(()=>vehiclePhotoSources(vehicle).filter(source=>!failedPhotos.includes(source)),[vehicle,failedPhotos]);
  const selectedPhoto=photos[Math.min(activePhoto,Math.max(photos.length-1,0))]||"";
  const title=vehicle?`${text(vehicle.year,"")} ${text(vehicle.make,"")} ${text(vehicle.model,"")} ${text(vehicle.trim,"")}`.replace(/\s+/g," ").trim():"Vehicle";
  const internal=Boolean(vehicle&&isInternal(vehicle));
  const dealerPreview=Boolean(vehicle&&(internal||String(vehicle.status||"").toLowerCase()!=="published"));
  const query=id?`?vehicle=${encodeURIComponent(id)}&source=vdp`:"";
  const facts=vehicle?[
    ["Mileage",`${Number(vehicle.mileage||0).toLocaleString()} mi`],
    ["Stock #",text(vehicle.stock)],
    ["VIN",text(vehicle.vin)],
    ["Condition",text(vehicle.condition)],
    ["Transmission",text(vehicle.transmission)],
    ["Drivetrain",text(vehicle.drivetrain)],
    ["Fuel",text(vehicle.fuelType)],
    ["Exterior",text(vehicle.exteriorColor)],
  ]:[];

  function markPhotoFailed(source:string){
    setFailedPhotos(current=>current.includes(source)?current:[...current,source]);
    setActivePhoto(0);
  }

  return <>
    <Header/>
    <main className={styles.page}>
      <div className={styles.wrap}>
        {loading&&<section className={styles.state}><span className={styles.spinner}/><h1>Loading vehicle…</h1></section>}
        {!loading&&error&&<section className={styles.state}><span className={styles.stateMark}>!</span><h1>{error}</h1><Link href="/inventory">Back to inventory</Link></section>}
        {!loading&&!error&&vehicle&&<>
          <Link className={styles.back} href={dealerPreview?"/dealer/inventory":"/inventory"}>← Back to inventory</Link>
          {dealerPreview&&<div className={`${styles.previewBanner} ${internal?styles.internal:""}`}><strong>{internal?"INTERNAL USE ONLY":"DEALER PREVIEW"}</strong><span>{internal?"This vehicle is hidden from every customer-facing inventory view.":"This vehicle is not published to customers."}</span></div>}
          <div className={styles.heading}><div><span>VEHICLE DETAILS</span><h1>{title}</h1></div><div><strong>{money(vehicle.price)}</strong>{Number(vehicle.downPayment||vehicle.down_payment||0)>0&&<small>{money(vehicle.downPayment||vehicle.down_payment)} estimated down</small>}</div></div>
          <div className={styles.layout}>
            <section className={styles.gallery} aria-label={`${title} photos`}>
              <div className={styles.heroPhoto}>{selectedPhoto?<img src={selectedPhoto} alt={title} onError={()=>markPhotoFailed(selectedPhoto)}/>:<div className={styles.photoNeeded}><span>PHOTO NEEDED</span><p>No working photo is attached to this vehicle. Re-upload one in the dealer portal.</p>{dealerPreview&&<Link href={`/dealer/inventory/new?edit=${encodeURIComponent(id)}`}>Add vehicle photos</Link>}</div>}{photos.length>1&&<span className={styles.count}>{Math.min(activePhoto+1,photos.length)} / {photos.length}</span>}</div>
              {photos.length>1&&<div className={styles.thumbnails}>{photos.map((source,index)=><button className={index===activePhoto?styles.active:""} type="button" onClick={()=>setActivePhoto(index)} key={source} aria-label={`Show photo ${index+1}`}><img src={source} alt="" onError={()=>markPhotoFailed(source)}/></button>)}</div>}
            </section>
            <aside className={styles.summary}>
              <span className={styles.availability}>{dealerPreview?(internal?"INTERNAL ONLY":"DRAFT PREVIEW"):"AVAILABLE NOW"}</span>
              <h2>{title}</h2>
              <div className={styles.price}>{money(vehicle.price)}</div>
              {Number(vehicle.downPayment||vehicle.down_payment||0)>0&&<div className={styles.down}>{money(vehicle.downPayment||vehicle.down_payment)} estimated down</div>}
              <div className={styles.facts}>{facts.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              {vehicle.description&&<div className={styles.description}><span>DESCRIPTION</span><p>{vehicle.description}</p></div>}
              {dealerPreview?<div className={styles.actions}><Link className={styles.primary} href={`/dealer/inventory/new?edit=${encodeURIComponent(id)}`}>EDIT VEHICLE</Link><Link href="/dealer/inventory">DEALER INVENTORY</Link></div>:<div className={styles.actions}><Link className={styles.primary} href={`/schedule-test-drive${query}`}>SCHEDULE TEST DRIVE</Link><Link href={`/get-approved${query}`}>GET APPROVED</Link><a href="tel:+18135164752">CALL SEAN</a></div>}
            </aside>
          </div>
        </>}
      </div>
    </main>
    <Footer/>
  </>;
}
