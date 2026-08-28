"use client";

import {useEffect,useMemo,useRef,useState} from "react";

type ApprovalState={
  name:string;
  phone:string;
  email:string;
  monthlyIncome:string;
  downPayment:string;
  desiredVehicle:string;
  referralSource:string;
};

const initial:ApprovalState={name:"",phone:"",email:"",monthlyIncome:"",downPayment:"",desiredVehicle:"",referralSource:""};
const stages=["Your Info","Your Vehicle","Review"];
const money=(value:string)=>{const n=Number(value||0);return Number.isFinite(n)&&n>0?n.toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}):"Not entered"};

export default function ApprovalLeadForm(){
  const[step,setStep]=useState(0);
  const[form,setForm]=useState<ApprovalState>(initial);
  const[consent,setConsent]=useState(false);
  const[busy,setBusy]=useState(false);
  const[success,setSuccess]=useState(false);
  const[message,setMessage]=useState("");
  const vehicleId=useRef("");
  const idempotencyKey=useRef("");

  useEffect(()=>{
    const qs=new URL(window.location.href).searchParams;
    vehicleId.current=(qs.get("vehicle")||qs.get("vehicleId")||"").trim().slice(0,160);
    const selected=(qs.get("vehicleLabel")||vehicleId.current).trim().slice(0,240);
    if(selected)setForm(current=>current.desiredVehicle?current:{...current,desiredVehicle:selected});
  },[]);

  const canContinue=useMemo(()=>{
    if(step===0)return Boolean(form.name.trim()&&(form.phone.trim()||form.email.trim())&&Number(form.monthlyIncome)>0);
    if(step===1)return Boolean(Number(form.downPayment)>=0&&form.desiredVehicle.trim()&&form.referralSource.trim());
    return consent;
  },[step,form,consent]);

  const set=(name:keyof ApprovalState,value:string)=>{idempotencyKey.current="";setSuccess(false);setForm(v=>({...v,[name]:value}));};
  function submissionKey(){
    if(!idempotencyKey.current)idempotencyKey.current=globalThis.crypto?.randomUUID?.()||`approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return idempotencyKey.current;
  }
  function next(){
    if(step===0&&!canContinue){setMessage("Add your name, a phone or email, and monthly income to continue.");return;}
    if(step===0&&form.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())){setMessage("Enter a valid email address or leave the email field blank.");return;}
    if(step===1&&!canContinue){setMessage("Add a desired vehicle and tell us how you heard about WDCC.");return;}
    setMessage("");setStep(v=>Math.min(2,v+1));
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(step<2){next();return;}
    if(!consent){setMessage("Please accept the contact consent to send this request.");return;}
    const phone=form.phone.trim(),email=form.email.trim();
    if(!phone&&!email){setMessage("Add a phone number or email so Sean can reach you.");setStep(0);return;}

    setBusy(true);setSuccess(false);setMessage("Sending your request…");
    try{
      const url=new URL(window.location.href),qs=url.searchParams;
      const key=submissionKey();
      const source=(qs.get("source")||qs.get("utm_source")||"get-approved").slice(0,80);
      const payload={
        kind:"approval",
        name:form.name.trim(),
        phone,
        email,
        monthlyIncome:Number(form.monthlyIncome),
        downPayment:Number(form.downPayment||0),
        vehicleInterest:form.desiredVehicle.trim(),
        desiredVehicle:form.desiredVehicle.trim(),
        vehicleId:vehicleId.current||undefined,
        referralSource:form.referralSource.trim(),
        consent:true,
        source,
        pagePath:url.pathname,
        referrer:document.referrer||undefined,
        utmSource:qs.get("utm_source")||undefined,
        utmMedium:qs.get("utm_medium")||undefined,
        utmCampaign:qs.get("utm_campaign")||undefined,
        utmContent:qs.get("utm_content")||undefined,
        clickId:qs.get("gclid")||qs.get("fbclid")||undefined,
        idempotencyKey:key
      };
      const response=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(payload)});
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(json.error||"submit_failed");
      setSuccess(true);
      setMessage(json?.sync?.upstream==="pending"?"Request saved. Sean's team can see it now; notification sync is queued.":"Request received. Sean's team can see it now.");
    }catch(error){
      const reason=error instanceof Error?error.message:"submit_failed";
      setMessage(reason==="consent_required"?"Please accept the contact consent to send this request.":"We couldn't send this request. Please call 813-516-4752.");
    }finally{setBusy(false);}
  }

  return <form className="approvalWizard" onSubmit={submit} noValidate>
    <div className="approvalStages" aria-label="Pre-approval progress">
      {stages.map((label,i)=><button key={label} type="button" className={i===step?"active":i<step?"done":""} onClick={()=>i<=step&&setStep(i)} aria-current={i===step?"step":undefined}><b>{i+1}</b><span>{label}</span></button>)}
    </div>

    {step===0&&<section className="approvalStagePanel" data-stage="info">
      <div className="approvalStageHeading"><small>STEP 1 OF 3</small><h2>Tell us about you.</h2><p>No hard-credit inquiry happens on this screen.</p></div>
      <div className="approvalFieldGrid">
        <label><span>FULL NAME</span><input value={form.name} onChange={e=>set("name",e.target.value)} autoComplete="name" maxLength={120} placeholder="Your name" required/></label>
        <label><span>PHONE</span><input value={form.phone} onChange={e=>set("phone",e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={40} placeholder="813-555-0123"/></label>
        <label><span>EMAIL</span><input value={form.email} onChange={e=>set("email",e.target.value)} type="email" autoComplete="email" maxLength={160} placeholder="you@example.com"/></label>
        <label><span>MONTHLY INCOME</span><input value={form.monthlyIncome} onChange={e=>set("monthlyIncome",e.target.value)} type="number" inputMode="decimal" min="0" step="100" placeholder="$4,000" required/></label>
      </div>
    </section>}

    {step===1&&<section className="approvalStagePanel" data-stage="vehicle">
      <div className="approvalStageHeading"><small>STEP 2 OF 3</small><h2>What are you looking for?</h2><p>Give Sean the starting numbers so the conversation is useful from the first call.</p></div>
      <div className="approvalFieldGrid">
        <label><span>DOWN PAYMENT</span><input value={form.downPayment} onChange={e=>set("downPayment",e.target.value)} type="number" inputMode="decimal" min="0" step="100" placeholder="$1,500"/></label>
        <label className="wide"><span>DESIRED VEHICLE</span><input value={form.desiredVehicle} onChange={e=>set("desiredVehicle",e.target.value)} maxLength={240} placeholder="Example: Challenger, SUV, truck, or open to options" required/></label>
        <label className="wide"><span>HOW DID YOU HEAR ABOUT US?</span><select value={form.referralSource} onChange={e=>set("referralSource",e.target.value)} required><option value="">Choose one</option><option>Google</option><option>Facebook / Instagram</option><option>Friend / Referral</option><option>Drive-by / Local</option><option>Returning customer</option><option>Other</option></select></label>
      </div>
    </section>}

    {step===2&&<section className="approvalStagePanel" data-stage="review">
      <div className="approvalStageHeading"><small>STEP 3 OF 3</small><h2>Review your request.</h2><p>Confirm the basics. This sends a contact request to WDCC; it is not a hard-credit application.</p></div>
      <div className="approvalReview">
        <article><span>CONTACT</span><b>{form.name||"—"}</b><small>{form.phone||form.email||"—"}</small></article>
        <article><span>MONTHLY INCOME</span><b>{money(form.monthlyIncome)}</b><small>Self-reported</small></article>
        <article><span>DOWN PAYMENT</span><b>{money(form.downPayment)}</b><small>Starting amount</small></article>
        <article><span>VEHICLE</span><b>{form.desiredVehicle||"—"}</b><small>{form.referralSource||"Source not selected"}</small></article>
      </div>
      <label className="approvalConsent"><input type="checkbox" checked={consent} onChange={e=>{idempotencyKey.current="";setSuccess(false);setConsent(e.target.checked)}} required/><span>I agree WDCC may call, text, or email me about this request at the contact information I provided. Consent is not a condition of purchase. Message and data rates may apply.</span></label>
    </section>}

    {message&&<div className={`approvalMessage${success?" success":""}`} role={success?"status":"alert"} aria-live="polite">{message}</div>}
    <div className="approvalActions">
      {step>0&&<button type="button" className="back" onClick={()=>{setMessage("");setStep(v=>v-1)}} disabled={busy}>Back</button>}
      {step<2?<button type="button" className="next" onClick={next}>Continue</button>:<button type="submit" className="submit" disabled={busy||!consent||success}>{busy?"SENDING…":success?"REQUEST RECEIVED":"SEND PRE-APPROVAL REQUEST"}</button>}
    </div>
  </form>;
}
