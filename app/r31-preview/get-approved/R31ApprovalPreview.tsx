"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import styles from "./approval.module.css";

type Draft={name:string;phone:string;email:string;vehicle:string;income:string;down:string;housing:string;referral:string;consent:boolean};
type Attribution={source:string;utmSource:string;utmCampaign:string;clickId:string;referrer:string};
const empty:Draft={name:"",phone:"",email:"",vehicle:"",income:"",down:"",housing:"",referral:"",consent:false};
const emptyAttribution:Attribution={source:"direct",utmSource:"",utmCampaign:"",clickId:"",referrer:""};

export default function R31ApprovalPreview(){
  const[step,setStep]=useState(1);
  const[draft,setDraft]=useState<Draft>(empty);
  const[attribution,setAttribution]=useState<Attribution>(emptyAttribution);
  const[error,setError]=useState("");
  const[complete,setComplete]=useState(false);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const vehicle=params.get("vehicle")||"";
    if(vehicle)setDraft(v=>({...v,vehicle}));
    setAttribution({
      source:params.get("source")||"direct",
      utmSource:params.get("utm_source")||"",
      utmCampaign:params.get("utm_campaign")||"",
      clickId:params.get("gclid")||params.get("fbclid")||"",
      referrer:document.referrer||""
    });
  },[]);

  const progress=useMemo(()=>`${Math.round(step/3*100)}%`,[step]);
  const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(v=>({...v,[key]:value}));
  const next=()=>{
    setError("");
    if(step===1&&(!draft.name.trim()||!draft.phone.trim())){setError("Name and mobile phone are required for this preview flow.");return;}
    if(step===2&&(!draft.income.trim()||!draft.down.trim())){setError("Add monthly income and planned down payment to continue.");return;}
    setStep(s=>Math.min(3,s+1));
  };
  const submit=(e:FormEvent)=>{e.preventDefault();setError("");if(!draft.consent){setError("Consent is required before a real application could be sent.");return;}setComplete(true)};

  if(complete)return <section className={styles.complete}><div className={styles.check}>✓</div><h2>PREVIEW FLOW COMPLETE.</h2><p>No customer lead was created. This R31 QA route deliberately stops before the production lead API.</p><div className={styles.attributionProof}><b>ATTRIBUTION PRESERVED</b><span>Source: {attribution.source}</span>{attribution.utmSource&&<span>UTM source: {attribution.utmSource}</span>}{attribution.utmCampaign&&<span>Campaign: {attribution.utmCampaign}</span>}</div><button type="button" onClick={()=>{setComplete(false);setStep(1)}}>TEST AGAIN</button></section>;

  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.progress}><span style={{width:progress}}/></div>
    <div className={styles.stepMeta}><b>STEP {step} OF 3</b><span>{step===1?"CONTACT":step===2?"VEHICLE + BUDGET":"REVIEW"}</span></div>

    {step===1&&<section className={styles.panel}>
      <h2>START WITH THE BASICS.</h2><p>Fast, direct information so Sean knows how to reach you.</p>
      <div className={styles.fields}>
        <label className={styles.full}><span>FULL NAME *</span><input autoComplete="name" value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="Your name"/></label>
        <label><span>MOBILE PHONE *</span><input inputMode="tel" autoComplete="tel" value={draft.phone} onChange={e=>set("phone",e.target.value)} placeholder="(813) 555-0123"/></label>
        <label><span>EMAIL</span><input inputMode="email" autoComplete="email" value={draft.email} onChange={e=>set("email",e.target.value)} placeholder="you@example.com"/></label>
      </div>
    </section>}

    {step===2&&<section className={styles.panel}>
      <h2>WHAT WORKS FOR YOUR BUDGET?</h2><p>Preview-only fields. Nothing is transmitted from this route.</p>
      <div className={styles.fields}>
        <label className={styles.full}><span>VEHICLE INTEREST</span><input value={draft.vehicle} onChange={e=>set("vehicle",e.target.value)} placeholder="Vehicle or stock number"/></label>
        <label><span>MONTHLY INCOME *</span><input inputMode="numeric" value={draft.income} onChange={e=>set("income",e.target.value)} placeholder="$4,000"/></label>
        <label><span>PLANNED DOWN PAYMENT *</span><input inputMode="numeric" value={draft.down} onChange={e=>set("down",e.target.value)} placeholder="$2,000"/></label>
        <label><span>HOUSING</span><select value={draft.housing} onChange={e=>set("housing",e.target.value)}><option value="">Select</option><option>Rent</option><option>Own</option><option>Family / Other</option></select></label>
        <label><span>HOW DID YOU HEAR ABOUT US?</span><select value={draft.referral} onChange={e=>set("referral",e.target.value)}><option value="">Select</option><option>Google</option><option>Facebook / Instagram</option><option>Referral</option><option>Drive-by</option><option>Other</option></select></label>
      </div>
    </section>}

    {step===3&&<section className={styles.panel}>
      <h2>REVIEW BEFORE SENDING.</h2><p>This safe preview shows exactly what would be reviewed before the production submission.</p>
      <dl className={styles.review}><div><dt>NAME</dt><dd>{draft.name}</dd></div><div><dt>PHONE</dt><dd>{draft.phone}</dd></div><div><dt>EMAIL</dt><dd>{draft.email||"Not provided"}</dd></div><div><dt>VEHICLE</dt><dd>{draft.vehicle||"Open to options"}</dd></div><div><dt>MONTHLY INCOME</dt><dd>{draft.income}</dd></div><div><dt>DOWN PAYMENT</dt><dd>{draft.down}</dd></div><div><dt>ATTRIBUTION SOURCE</dt><dd>{attribution.source}</dd></div><div><dt>CAMPAIGN</dt><dd>{attribution.utmCampaign||"None"}</dd></div></dl>
      <label className={styles.consent}><input type="checkbox" checked={draft.consent} onChange={e=>set("consent",e.target.checked)}/><span>I consent to being contacted about my vehicle inquiry. In this QA preview, checking this box still sends nothing.</span></label>
    </section>}

    {error&&<div className={styles.error}>{error}</div>}
    <div className={styles.actions}>{step>1&&<button type="button" className={styles.back} onClick={()=>{setError("");setStep(s=>s-1)}}>← BACK</button>}{step<3?<button type="button" className={styles.next} onClick={next}>CONTINUE →</button>:<button type="submit" className={styles.next}>COMPLETE SAFE PREVIEW →</button>}</div>
    <div className={styles.safe}>QA SAFE MODE · NO POST TO /api/leads · SOURCE {attribution.source.toUpperCase()}</div>
  </form>;
}
