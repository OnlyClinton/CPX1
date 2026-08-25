"use client";

import {useState} from "react";
import {getAttributionContext,trackEvent} from "./attribution";

type Kind="schedule"|"contact"|"approval";
const labels:Record<Kind,{title:string;button:string;success:string}>={
  schedule:{title:"Schedule a test drive",button:"REQUEST TEST DRIVE",success:"Your test-drive request is saved. Sean's team can see it now."},
  approval:{title:"Get pre-approved",button:"GET PRE-APPROVED",success:"Your pre-approval request is saved. Sean's team can see it now."},
  contact:{title:"Talk to Sean",button:"SEND MESSAGE",success:"Your message is saved. Sean's team can see it now."}
};

export default function LeadForm({kind,source}:{kind:Kind;source?:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const[submitted,setSubmitted]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formEl=event.currentTarget;
    if(busy)return;
    setBusy(true);
    setMessage("Saving your request…");
    const idempotencyKey=crypto.randomUUID();
    try{
      const form=new FormData(formEl);
      const body:any=Object.fromEntries(form.entries());
      const url=new URL(window.location.href);
      const qs=url.searchParams;
      const vehicle=qs.get("vehicleId")||qs.get("vehicle")||body.vehicleInterest||"";
      if(vehicle&&!body.vehicleInterest)body.vehicleInterest=vehicle;
      const detailParts=[
        body.incomeRange?`Income range: ${body.incomeRange}`:"",
        body.availableDownPayment?`Available down payment: ${body.availableDownPayment}`:"",
        body.preferredDate?`Preferred date: ${body.preferredDate}`:"",
        body.preferredTime?`Preferred time: ${body.preferredTime}`:""
      ].filter(Boolean);
      if(detailParts.length)body.message=[body.message,...detailParts].filter(Boolean).join(" | ");

      const attribution=getAttributionContext();
      const leadSource=(qs.get("source")||source||attribution.source||`cta-${kind}`).slice(0,80);
      const payload={
        ...body,
        kind,
        consent:form.get("consent")==="on",
        source:leadSource,
        cta:source||`cta-${kind}`,
        sessionId:attribution.sessionId,
        anonymousUserId:attribution.anonymousUserId,
        referralCode:attribution.referralCode||undefined,
        landingPath:attribution.landingPath||undefined,
        vehicleId:vehicle||undefined,
        pagePath:url.pathname,
        referrer:attribution.referrer||document.referrer||undefined,
        utmSource:attribution.source||undefined,
        utmMedium:attribution.medium||undefined,
        utmCampaign:attribution.campaign||undefined,
        utmContent:attribution.content||undefined,
        utmTerm:attribution.term||undefined,
        clickId:attribution.clickId||undefined,
        firstSource:attribution.firstSource||undefined,
        firstMedium:attribution.firstMedium||undefined,
        firstCampaign:attribution.firstCampaign||undefined,
        firstContent:attribution.firstContent||undefined,
        firstTerm:attribution.firstTerm||undefined,
        firstClickId:attribution.firstClickId||undefined,
        firstReferralCode:attribution.firstReferralCode||undefined,
        idempotencyKey
      };

      trackEvent(`lead.${kind}.submit`,{cta:payload.cta,vehicleId:vehicle||undefined,metadata:{idempotencyKey}});
      const response=await fetch("/api/leads",{
        method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":idempotencyKey},
        body:JSON.stringify(payload)
      });
      const json=await response.json().catch(()=>({}));
      if(!response.ok||json?.persisted===false)throw Error(json.error||"submit_failed");
      const leadId=String(json?.item?.id||json?.leadId||"");
      trackEvent(`lead.${kind}.accepted`,{cta:payload.cta,leadId:leadId||undefined,vehicleId:vehicle||undefined,metadata:{idempotencyKey,persisted:true,sync:json?.sync||null}});
      formEl.reset();
      setSubmitted(true);
      setMessage(json?.sync?.upstream==="pending"?`${labels[kind].success} Notification sync is queued.`:labels[kind].success);
    }catch(error){
      trackEvent(`lead.${kind}.failed`,{cta:source||`cta-${kind}`,metadata:{idempotencyKey,error:error instanceof Error?error.message:"submit_failed"}});
      setMessage(error instanceof Error&&error.message!=="submit_failed"?error.message:"We couldn't save this request. Please call 813-516-4752.");
    }finally{
      setBusy(false);
    }
  }

  if(submitted)return <div className="leadSuccess" role="status"><div className="leadSuccessIcon">✓</div><h2>YOU'RE ALL SET.</h2><p>{message}</p><div className="leadSuccessActions"><a href="/inventory">VIEW INVENTORY</a><a href="tel:+18135164752">CALL SEAN</a></div></div>;

  return <form className={`leadForm leadForm-${kind}`} onSubmit={submit}>
    <div className="leadFormHeading"><strong>{labels[kind].title}</strong><span>{kind==="approval"?"No SSN required to get started.":kind==="schedule"?"Pick the vehicle and time that work for you.":"Real answers from a real person."}</span></div>
    <div className="leadGrid">
      <label>Full name<input name="name" autoComplete="name" maxLength={120} placeholder="Your full name" required/></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} placeholder="(813) 555-1234" required/></label>
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={160} placeholder="you@email.com"/></label>
      {kind!=="contact"&&<label>Vehicle of interest<input name="vehicleInterest" maxLength={240} placeholder="Vehicle or stock number"/></label>}
      {kind==="approval"&&<>
        <label>Monthly income range<select name="incomeRange" required defaultValue=""><option value="" disabled>Select range</option><option value="under-2000">Under $2,000</option><option value="2000-3499">$2,000–$3,499</option><option value="3500-4999">$3,500–$4,999</option><option value="5000-plus">$5,000+</option></select></label>
        <label>Available down payment<select name="availableDownPayment" required defaultValue=""><option value="" disabled>Select amount</option><option value="under-1000">Under $1,000</option><option value="1000-1999">$1,000–$1,999</option><option value="2000-3999">$2,000–$3,999</option><option value="4000-plus">$4,000+</option></select></label>
      </>}
      {kind==="schedule"&&<>
        <label>Preferred date<input name="preferredDate" type="date"/></label>
        <label>Preferred time<select name="preferredTime" defaultValue=""><option value="">Any time</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select></label>
      </>}
      <label className="wide">{kind==="contact"?"How can we help?":"Anything Sean should know?"}<textarea name="message" maxLength={2000} placeholder={kind==="schedule"?"Best time, vehicle questions, trade-in, etc.":"Optional"}/></label>
      <label className="consent wide"><input name="consent" type="checkbox" required/> I agree WDCC may call, text, or email me about this request at the contact information I provided. Consent is not a condition of purchase. Message and data rates may apply.</label>
    </div>
    <button className="cta red leadSubmit" disabled={busy} type="submit">{busy?"SAVING…":`${labels[kind].button} →`}</button>
    <p className="leadPrivacy">Secure request. No SSN, bank password, or payment information is collected here.</p>
    {message&&<div className="leadMessage" role="status" aria-live="polite">{message}</div>}
  </form>;
}
