"use client";

import {useState} from "react";

type Kind="schedule"|"contact"|"approval";

const submitLabel:Record<Kind,string>={schedule:"SCHEDULE TEST DRIVE",contact:"CONTACT SEAN",approval:"GET APPROVED"};
const successLabel:Record<Kind,string>={schedule:"Test-drive request received.",contact:"Request received.",approval:"Approval request received."};

export default function LeadForm({kind,source}:{kind:Kind;source?:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const[success,setSuccess]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formEl=event.currentTarget;
    const form=new FormData(formEl);
    const body:any=Object.fromEntries(form.entries());
    const phone=String(body.phone||"").trim(),email=String(body.email||"").trim();
    if(!phone&&!email){setSuccess(false);setMessage("Add a phone number or email so Sean can reach you.");return;}

    setBusy(true);setSuccess(false);setMessage("Sending…");
    try{
      const url=new URL(window.location.href);
      const qs=url.searchParams;
      const vehicle=qs.get("vehicle")||qs.get("vehicleId")||"";
      if(vehicle&&!body.vehicleInterest)body.vehicleInterest=vehicle;
      const leadSource=(qs.get("source")||qs.get("utm_source")||source||`cta-${kind}`).slice(0,80);
      const payload={
        ...body,
        kind,
        phone,
        email,
        consent:form.get("consent")==="on",
        source:leadSource,
        vehicleId:vehicle||undefined,
        pagePath:url.pathname,
        referrer:document.referrer||undefined,
        utmSource:qs.get("utm_source")||undefined,
        utmMedium:qs.get("utm_medium")||undefined,
        utmCampaign:qs.get("utm_campaign")||undefined,
        utmContent:qs.get("utm_content")||undefined,
        clickId:qs.get("gclid")||qs.get("fbclid")||undefined
      };
      const idempotencyKey=crypto.randomUUID();
      const response=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey},body:JSON.stringify({...payload,idempotencyKey})});
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(json.error||"submit_failed");
      formEl.reset();setSuccess(true);
      setMessage(json?.sync?.upstream==="pending"?`${successLabel[kind]} It is already saved in the dealer dashboard and queued for notification sync.`:`${successLabel[kind]} Sean's team can see it now.`);
    }catch(error){
      setSuccess(false);
      const reason=error instanceof Error?error.message:"submit_failed";
      setMessage(reason==="phone_or_email_required"?"Add a phone number or email so Sean can reach you.":reason==="consent_required"?"Please accept the contact consent to send this request.":"We couldn't send this request. Please call 813-516-4752.");
    }finally{setBusy(false);}
  }

  return <form className="leadForm" onSubmit={submit} noValidate>
    <div className="leadGrid">
      <label>Name<input name="name" autoComplete="name" maxLength={120} required/></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} placeholder="813-555-0123"/></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={160} placeholder="you@example.com"/></label>
      {kind!=="contact"&&<label>Vehicle of interest<input name="vehicleInterest" maxLength={240}/></label>}
      {kind==="schedule"&&<label>Preferred date or time<input name="preferredTime" maxLength={120}/></label>}
      <label className="wide">Message<textarea name="message" maxLength={2000}/></label>
      <label className="consent wide"><input name="consent" type="checkbox" required/> I agree WDCC may call, text, or email me about this request at the contact information I provided. Consent is not a condition of purchase. Message and data rates may apply.</label>
    </div>
    <button className="cta red" disabled={busy} type="submit">{busy?"SENDING…":submitLabel[kind]}</button>
    {message&&<div className={`leadMessage${success?" success":""}`} role="status" aria-live="polite">{message}</div>}
  </form>;
}
