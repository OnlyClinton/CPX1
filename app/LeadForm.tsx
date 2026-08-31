"use client";

import {useEffect,useState} from "react";

type Kind="schedule"|"contact"|"approval";
const publicVehicle=(vehicle:any)=>{
  const status=String(vehicle?.status||"").toLowerCase();
  const visibility=String(vehicle?.visibility||vehicle?.listingVisibility||"").toLowerCase();
  const stock=String(vehicle?.stock||vehicle?.stock_id||"").toUpperCase();
  const badges=(Array.isArray(vehicle?.badges)?vehicle.badges:[]).map((value:any)=>String(value).toUpperCase());
  return status==="published"&&vehicle?.internalOnly!==true&&vehicle?.qa!==true&&!['internal','dealer_only'].includes(visibility)&&!/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)&&!badges.some((badge:string)=>badge==="R36-TEST"||badge==="QA"||badge==="TEST"||badge.includes("CERTIFICATION"));
};
const vehicleLabel=(vehicle:any)=>`${vehicle?.year||""} ${vehicle?.make||""} ${vehicle?.model||""}${vehicle?.trim?` ${vehicle.trim}`:""}`.replace(/\s+/g," ").trim();

const submitLabel:Record<Kind,string>={schedule:"SCHEDULE TEST DRIVE",contact:"CONTACT SEAN",approval:"GET APPROVED"};
const successLabel:Record<Kind,string>={schedule:"Test-drive request received.",contact:"Request received.",approval:"Approval request received."};

export default function LeadForm({kind,source}:{kind:Kind;source?:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const[success,setSuccess]=useState(false);
  const[vehicles,setVehicles]=useState<any[]>([]);
  const[selectedVehicle,setSelectedVehicle]=useState("");

  useEffect(()=>{
    if(kind==="contact")return;
    const queryVehicle=new URLSearchParams(window.location.search).get("vehicle")||"";
    if(queryVehicle)setSelectedVehicle(queryVehicle);
    fetch("/api/inventory?scope=public",{cache:"no-store"}).then(response=>response.json()).then(json=>{
      const items=(json.items||json.inventory||json.vehicles||[]).filter(publicVehicle).slice(0,40);
      setVehicles(items);
    }).catch(()=>{});
  },[kind]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formEl=event.currentTarget;
    const form=new FormData(formEl);
    const body:any=Object.fromEntries(form.entries());
    const name=String(body.name||"").trim();
    const phone=String(body.phone||"").trim(),email=String(body.email||"").trim();
    if(!name){setSuccess(false);setMessage("Add your name so Sean knows who to ask for.");return;}
    if(!phone&&!email){setSuccess(false);setMessage("Add a phone number or email so Sean can reach you.");return;}

    body.message=String(body.message||"").trim();
    const selected=vehicles.find(vehicle=>String(vehicle.id||vehicle.slug)===selectedVehicle);
    if(selected){body.vehicleId=String(selected.id||selected.slug);body.vehicleInterest=vehicleLabel(selected)}
    delete body.vehicleSelection;

    setBusy(true);setSuccess(false);setMessage("Sending…");
    try{
      const url=new URL(window.location.href);
      const qs=url.searchParams;
      const vehicle=qs.get("vehicle")||qs.get("vehicleId")||"";
      if(vehicle&&!body.vehicleId)body.vehicleId=vehicle;
      const leadSource=(qs.get("source")||qs.get("utm_source")||source||`cta-${kind}`).slice(0,80);
      const payload={
        ...body,
        kind,
        phone,
        email,
        consent:form.get("consent")==="on",
        source:leadSource,
        vehicleId:body.vehicleId||vehicle||undefined,
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
      if(!response.ok||json?.ok!==true)throw Error(json.error||"submit_failed");
      formEl.reset();setSelectedVehicle("");setSuccess(true);
      setMessage(json?.sync?.upstream==="pending"?`${successLabel[kind]} It is already saved in the dealer dashboard and queued for notification sync.`:`${successLabel[kind]} Sean's team can see it now.`);
    }catch(error){
      setSuccess(false);
      const reason=error instanceof Error?error.message:"submit_failed";
      setMessage(reason==="phone_or_email_required"?"Add a phone number or email so Sean can reach you.":reason==="consent_required"?"Please accept the contact consent to send this request.":"We couldn't send this request. Please call 813-516-4752.");
    }finally{setBusy(false);}
  }

  return <form className="leadForm" onSubmit={submit}>
    <div className="leadGrid">
      <label>Name<input name="name" autoComplete="name" maxLength={120} required/></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} placeholder="813-555-0123"/></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={160} placeholder="you@example.com"/></label>
      {kind==="approval"&&<label>Monthly income<input name="monthlyIncome" inputMode="decimal" maxLength={40} placeholder="$ e.g. 5,000"/></label>}
      {kind==="approval"&&<label>Down payment<input name="downPaymentInterest" inputMode="decimal" maxLength={40} placeholder="$ e.g. 2,000"/></label>}
      {kind!=="contact"?<label className={kind==="schedule"?"wide":""}>Vehicle of interest{vehicles.length?<select name="vehicleSelection" value={selectedVehicle} onChange={event=>setSelectedVehicle(event.target.value)}><option value="">Select a vehicle</option>{vehicles.map(vehicle=><option key={String(vehicle.id||vehicle.slug)} value={String(vehicle.id||vehicle.slug)}>{vehicleLabel(vehicle)} — ${Number(vehicle.price||0).toLocaleString()}</option>)}</select>:<input name="vehicleInterest" maxLength={240} placeholder="Year, make, and model"/>}</label>:null}
      {kind==="approval"&&<label>How did you hear about us?<select name="referralSource" defaultValue=""><option value="">Select an option</option><option>Google</option><option>Facebook or Instagram</option><option>Friend or family</option><option>Drive-by or local ad</option><option>Other</option></select></label>}
      {kind==="schedule"&&<label className="wide">Preferred date and time<input name="preferredTime" type="datetime-local" maxLength={120}/></label>}
      <label className="wide">Anything Sean should know?<textarea name="message" maxLength={1600} placeholder="Optional details"/></label>
      <label className="consent wide"><input name="consent" type="checkbox" required/> I agree WDCC may call, text, or email me about this request at the contact information I provided. Consent is not a condition of purchase. Message and data rates may apply.</label>
    </div>
    <button className="cta red" disabled={busy} type="submit">{busy?"SENDING…":submitLabel[kind]}</button>
    <p className="formPrivacy">Sent directly to the WDCC team. Do not enter an SSN or bank-account number on this form.</p>
    {message&&<div className={`leadMessage${success?" success":""}`} role="status" aria-live="polite">{message}</div>}
  </form>;
}
