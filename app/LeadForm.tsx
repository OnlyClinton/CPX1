"use client";

import {useState} from "react";

export default function LeadForm({kind,source}:{kind:"schedule"|"contact"|"approval";source?:string}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setMessage("Sending…");
    const form=new FormData(event.currentTarget);
    const body=Object.fromEntries(form.entries());
    const querySource=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("source"):null;
    const vehicle=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("vehicle"):null;
    const leadSource=(querySource||source||`cta-${kind}`).slice(0,80);
    if(vehicle&&!body.vehicleInterest)body.vehicleInterest=vehicle;
    const response=await fetch("/api/leads",{
      method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},
      body:JSON.stringify({...body,kind,consent:form.get("consent")==="on",source:leadSource})
    });
    const json=await response.json().catch(()=>({}));
    if(response.ok){event.currentTarget.reset();setMessage("Received. Sean's team will follow up shortly.");}
    else setMessage(json.error||"We couldn't send this request. Please call 813-516-4752.");
    setBusy(false);
  }
  return <form className="leadForm" onSubmit={submit}>
    <div className="leadGrid">
      <label>Name<input name="name" maxLength={120} required/></label>
      <label>Phone<input name="phone" type="tel" maxLength={40}/></label>
      <label>Email<input name="email" type="email" maxLength={160}/></label>
      {kind!=="contact"&&<label>Vehicle of interest<input name="vehicleInterest" maxLength={240}/></label>}
      {kind==="schedule"&&<label>Preferred date or time<input name="preferredTime" maxLength={120}/></label>}
      <label className="wide">Message<textarea name="message" maxLength={2000}/></label>
      <label className="consent wide"><input name="consent" type="checkbox" required/> I agree that WDCC may contact me by phone, text, or email about this request.</label>
    </div>
    <button className="cta red" disabled={busy} type="submit">{busy?"SENDING…":"SEND REQUEST"}</button>
    {message&&<div className="leadMessage" role="status" aria-live="polite">{message}</div>}
  </form>;
}
