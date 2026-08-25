"use client";

import {useMemo,useState} from "react";
import styles from "./dealer-editor.module.css";

type Draft={year:string;make:string;model:string;trim:string;mileage:string;stock:string;price:string;down:string;description:string};
const initial:Draft={year:"",make:"",model:"",trim:"",mileage:"",stock:"",price:"",down:"",description:""};

export default function DealerEditorPreview(){
  const[step,setStep]=useState(1);
  const[draft,setDraft]=useState(initial);
  const[photos,setPhotos]=useState<File[]>([]);
  const[primary,setPrimary]=useState(0);
  const[message,setMessage]=useState("");
  const[complete,setComplete]=useState(false);
  const set=(key:keyof Draft,value:string)=>setDraft(v=>({...v,[key]:value}));
  const readiness=useMemo(()=>{
    let score=0;
    if(draft.year&&draft.make&&draft.model&&draft.mileage)score+=30;
    if(draft.price&&draft.down)score+=25;
    if(photos.length)score+=25;
    if(draft.description.trim().length>=20)score+=20;
    return score;
  },[draft,photos]);
  const go=(next:number)=>{setMessage("");if(step===1&&(!draft.year||!draft.make||!draft.model||!draft.mileage)){setMessage("Year, make, model and mileage are required.");return;}if(step===2&&(!draft.price||!draft.down)){setMessage("Cash price and down payment are required for this preview.");return;}if(step===3&&!photos.length){setMessage("Add at least one photo to test the publish-ready path.");return;}if(step===4&&draft.description.trim().length<20){setMessage("Add at least 20 characters of customer-facing description.");return;}setStep(next)};
  const addPhotos=(files:File[])=>setPhotos(current=>[...current,...files.filter(f=>f.type.startsWith("image/"))].slice(0,30));
  const removePhoto=(index:number)=>{setPhotos(p=>p.filter((_,i)=>i!==index));setPrimary(0)};

  if(complete)return <section className={styles.safeComplete}><div>✓</div><h2>PUBLISH PREVIEW PASSED.</h2><p>No vehicle was created or changed. The editor flow reached a publish-ready state entirely in QA safe mode.</p><button onClick={()=>{setComplete(false);setStep(1)}}>TEST AGAIN</button></section>;

  return <div className={styles.editor}>
    <header className={styles.editorHeader}><div><span>INVENTORY EDITOR · SAFE QA</span><h1>Add / Edit Vehicle</h1></div><div className={styles.readiness}><b>{readiness}%</b><span><i style={{width:`${readiness}%`}}/></span></div></header>
    <nav className={styles.steps} aria-label="Vehicle editor steps">{["INFO","PRICING","PHOTOS","DETAILS","REVIEW"].map((label,i)=><button key={label} type="button" className={step===i+1?styles.active:step>i+1?styles.done:""} onClick={()=>{if(i+1<step)setStep(i+1)}}><b>{i+1}</b><span>{label}</span></button>)}</nav>

    {step===1&&<section className={styles.panel}><div className={styles.panelHead}><div><span>STEP 1</span><h2>Vehicle Information</h2></div><small>Start clean — no demo defaults.</small></div><div className={styles.fields}><label><span>YEAR *</span><input value={draft.year} onChange={e=>set("year",e.target.value)} inputMode="numeric" placeholder="2020"/></label><label><span>MAKE *</span><input value={draft.make} onChange={e=>set("make",e.target.value)} placeholder="Dodge"/></label><label><span>MODEL *</span><input value={draft.model} onChange={e=>set("model",e.target.value)} placeholder="Challenger"/></label><label><span>TRIM</span><input value={draft.trim} onChange={e=>set("trim",e.target.value)} placeholder="SXT"/></label><label><span>MILEAGE *</span><input value={draft.mileage} onChange={e=>set("mileage",e.target.value)} inputMode="numeric" placeholder="62,500"/></label><label><span>STOCK #</span><input value={draft.stock} onChange={e=>set("stock",e.target.value)} placeholder="WDCC-1024"/></label></div></section>}

    {step===2&&<section className={styles.panel}><div className={styles.panelHead}><div><span>STEP 2</span><h2>Pricing</h2></div><small>Clear customer starting numbers.</small></div><div className={styles.fields}><label><span>CASH PRICE *</span><input value={draft.price} onChange={e=>set("price",e.target.value)} inputMode="numeric" placeholder="$24,995"/></label><label><span>DOWN PAYMENT *</span><input value={draft.down} onChange={e=>set("down",e.target.value)} inputMode="numeric" placeholder="$2,000"/></label></div></section>}

    {step===3&&<section className={styles.panel}><div className={styles.panelHead}><div><span>STEP 3</span><h2>Photos</h2></div><small>Camera, upload, primary image and removal.</small></div><div className={styles.photoActions}><label>TAKE PHOTO<input hidden type="file" accept="image/*" capture="environment" onChange={e=>addPhotos(Array.from(e.target.files||[]))}/></label><label>UPLOAD FILES<input hidden type="file" accept="image/*" multiple onChange={e=>addPhotos(Array.from(e.target.files||[]))}/></label></div><label className={styles.drop}>DROP / SELECT VEHICLE PHOTOS<input type="file" hidden accept="image/*" multiple onChange={e=>addPhotos(Array.from(e.target.files||[]))}/><span>JPG · PNG · WEBP · AVIF · up to 30 photos</span></label>{photos.length>0&&<div className={styles.photoGrid}>{photos.map((p,i)=><article key={`${p.name}-${i}`} className={primary===i?styles.primaryPhoto:""}><div><b>{i+1}</b><span>{p.name}</span></div><button type="button" onClick={()=>setPrimary(i)}>SET PRIMARY</button><button type="button" onClick={()=>removePhoto(i)}>REMOVE</button></article>)}</div>}</section>}

    {step===4&&<section className={styles.panel}><div className={styles.panelHead}><div><span>STEP 4</span><h2>Details</h2></div><small>Customer-facing condition and equipment notes.</small></div><label className={styles.description}><span>DESCRIPTION *</span><textarea value={draft.description} onChange={e=>set("description",e.target.value)} placeholder="Condition, equipment, features, recent service, and anything the buyer should know."/><small>{draft.description.trim().length}/3000 · minimum 20 for preview readiness</small></label></section>}

    {step===5&&<section className={styles.panel}><div className={styles.panelHead}><div><span>STEP 5</span><h2>Review & Publish</h2></div><small>Server verification would happen here in production.</small></div><div className={styles.review}><div><span>VEHICLE</span><b>{draft.year} {draft.make} {draft.model} {draft.trim}</b></div><div><span>PRICE</span><b>{draft.price} · {draft.down} down</b></div><div><span>MILEAGE</span><b>{draft.mileage}</b></div><div><span>PHOTOS</span><b>{photos.length} · primary #{primary+1}</b></div><div className={styles.reviewWide}><span>DESCRIPTION</span><b>{draft.description}</b></div></div><div className={styles.publishNote}>QA SAFE MODE: the production version will save/read back the draft, checkpoint every photo, enforce server readiness, publish, verify storefront visibility, and preserve the trace ID. This preview intentionally performs none of those writes.</div></section>}

    {message&&<div className={styles.message}>{message}</div>}
    <footer className={styles.actions}><button type="button" onClick={()=>step>1&&setStep(s=>s-1)} disabled={step===1}>← BACK</button><button type="button" className={styles.draft}>SAVE DRAFT PREVIEW</button>{step<5?<button type="button" className={styles.next} onClick={()=>go(step+1)}>CONTINUE →</button>:<button type="button" className={styles.publish} disabled={readiness<100} onClick={()=>setComplete(true)}>PUBLISH PREVIEW</button>}</footer>
  </div>;
}
