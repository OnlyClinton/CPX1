"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const norm=(v:any)=>String(v??"").trim();
const steps=["Info","Pricing","Photos","Verify","Publish"];

export default function NewVehicle(){
  const router=useRouter();
  const formRef=useRef<HTMLFormElement>(null);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [step,setStep]=useState(1);
  const [photos,setPhotos]=useState<File[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(s=>{
      if(!s.authenticated)location.href="/dealer"; else setReady(true);
    }).catch(()=>location.href="/dealer");
  },[]);

  const progress=useMemo(()=>Math.round((step/5)*100),[step]);

  function addPhotos(files:File[]){
    const accepted=files.filter(f=>allowedTypes.has(f.type)&&f.size<=15*1024*1024);
    const rejected=files.length-accepted.length;
    setPhotos(current=>[...current,...accepted].slice(0,30));
    setMessage(rejected?`${rejected} file${rejected===1?" was":"s were"} skipped. Use JPG, PNG, WEBP or AVIF under 15 MB.`:"");
  }

  function validate(names:string[]){
    const form=formRef.current;
    if(!form)return false;
    for(const name of names){
      const el=form.elements.namedItem(name) as HTMLInputElement|null;
      if(el && !el.checkValidity()){el.reportValidity();return false;}
    }
    return true;
  }

  function next(){
    if(step===1&&!validate(["year","make","model","mileage"]))return;
    if(step===2&&!validate(["price"]))return;
    if(step===3&&photos.length===0){setMessage("Add at least one vehicle photo to continue to verification.");return;}
    setMessage("");
    setStep(s=>Math.min(5,s+1));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const intent=submitter?.value==="draft"?"draft":"published";
    if(intent==="published"&&photos.length===0){setMessage("Add at least one vehicle photo before publishing.");setStep(3);return;}
    if(!event.currentTarget.checkValidity()){event.currentTarget.reportValidity();return;}

    setBusy(true);
    const requestId=crypto.randomUUID();
    setMessage(`Saving recoverable draft… Trace ${requestId}`);
    let draftId="";
    try{
      const form=new FormData(event.currentTarget);
      const body={year:Number(form.get("year")),make:norm(form.get("make")),model:norm(form.get("model")),trim:norm(form.get("trim")),price:Number(form.get("price")),downPayment:Number(form.get("downPayment")||0),mileage:Number(form.get("mileage")||0),stock:norm(form.get("stock")),description:norm(form.get("description"))};
      const headers={"Content-Type":"application/json","X-WDCC-Request-ID":requestId};
      const created=await fetch("/api/inventory",{method:"POST",headers,body:JSON.stringify(body)});
      const cj=await created.json().catch(()=>({}));
      if(!created.ok||!cj?.item?.id)throw new Error(cj.error||"Vehicle draft could not be created");
      draftId=String(cj.item.id);
      setStep(4);setMessage(`Draft saved. Verifying vehicle details… Trace ${requestId}`);

      const readback=await fetch(`/api/inventory/${encodeURIComponent(draftId)}?verify=${Date.now()}`,{cache:"no-store",headers:{"X-WDCC-Request-ID":requestId}});
      const rj=await readback.json().catch(()=>({})); const saved=rj?.item||{};
      if(!readback.ok||Number(saved.year)!==body.year||norm(saved.make)!==body.make||norm(saved.model)!==body.model||Number(saved.mileage||0)!==body.mileage||String(saved.status||"").toLowerCase()!=="draft")throw new Error("Draft readback did not match the vehicle you entered");

      const paths:string[]=[];
      for(let i=0;i<photos.length;i++){
        const file=photos[i]; setMessage(`Uploading photo ${i+1} of ${photos.length}… Trace ${requestId}`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||`photo-${i+1}.jpg`;
        const blob=await upload(`media/wdcc/${draftId}/${safeName}`,file,{access:"private",handleUploadUrl:"/api/upload",clientPayload:JSON.stringify({vehicleId:draftId,requestId}),contentType:file.type});
        if(!blob?.pathname)throw new Error(`Photo ${i+1} did not return a stored path`);
        paths.push(blob.pathname);
        const cp=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",headers,body:JSON.stringify({photoPathnames:paths,primaryPhotoPathname:paths[0]})});
        const cpj=await cp.json().catch(()=>({})); if(!cp.ok)throw new Error(cpj.error||`Photo ${i+1} checkpoint failed`);
      }

      if(intent==="published"){
        setStep(5);setMessage(`Publishing and verifying storefront… Trace ${requestId}`);
        const published=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",headers,body:JSON.stringify({status:"published"})});
        const pj=await published.json().catch(()=>({}));
        if(!published.ok)throw new Error(pj.error||"Publish failed");
        if(String(pj?.item?.status||"").toLowerCase()!=="published")throw new Error("Publish response did not confirm published status");
        if(pj?.storefront?.visible!==true){setMessage(`Published in dealer inventory, but storefront verification is ${pj?.storefront?.verification||"pending"}. Do not re-enter it. Trace ${requestId}.`);setBusy(false);return;}
        setMessage(`Published and verified on storefront. Trace ${requestId}`);
      }
      router.push(`/dealer/inventory?saved=${intent}&trace=${encodeURIComponent(requestId)}`);router.refresh();
    }catch(error){
      const reason=error instanceof Error?error.message:"Vehicle upload failed";
      setMessage(draftId?`Vehicle is safe as draft ${draftId}. ${reason}. Trace ${requestId}.`:`${reason}. Trace ${requestId}.`);
      setBusy(false);
    }
  }

  if(!ready)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;
  return <main className="dealerShell"><aside className="dealerSidebar"><div className="dealerLogo"><b>WDCC</b><span>DEALER COMMAND</span></div><div className="dealerMenuLabel">INVENTORY</div><nav className="dealerMenu"><Link href="/dealer">Dashboard</Link><Link href="/dealer/inventory">All Vehicles</Link><Link className="active" href="/dealer/inventory/new">+ Add Vehicle</Link><Link href="/dealer/inventory/logs">Vehicle Logs</Link><Link href="/dealer/leads">Leads</Link><Link href="/">View Website</Link></nav></aside><section className="dealerMain"><form ref={formRef} className="vehicleWizard" onSubmit={submit}><div className="wizardHeader"><div className="eyebrow">NEW INVENTORY</div><h1>Add a Vehicle</h1><p className="muted">Complete each step in order. The vehicle is saved as a recoverable draft before photos are checkpointed and publication is verified.</p><div className="wizardSteps" aria-label="Listing steps">{steps.map((label,i)=>{const n=i+1;return <button type="button" key={label} className={`wizardStep ${n<step?"done":""} ${n===step?"active":""}`} onClick={()=>n<step&&setStep(n)}><b>{n}</b>{label}</button>})}</div></div><div className="vehicleFormPanel">

{step===1&&<><h2>Vehicle Information</h2><p className="help">Enter the core identity fields first.</p><div className="vehicleFormGrid"><div className="vehicleField"><label>Year</label><input name="year" type="number" min="1901" max={new Date().getFullYear()+1} placeholder="2020" required/></div><div className="vehicleField"><label>Make</label><input name="make" maxLength={80} placeholder="Dodge" required/></div><div className="vehicleField"><label>Model</label><input name="model" maxLength={80} placeholder="Challenger" required/></div><div className="vehicleField"><label>Trim</label><input name="trim" maxLength={80} placeholder="SXT"/></div><div className="vehicleField"><label>Mileage</label><input name="mileage" type="number" min="0" max="2000000" placeholder="62500" required/></div><div className="vehicleField"><label>Stock #</label><input name="stock" maxLength={80} placeholder="WDCC-1024"/></div></div></>}

{step===2&&<><h2>Pricing & Details</h2><div className="vehicleFormGrid"><div className="vehicleField"><label>Cash Price</label><input name="price" type="number" min="1" max="10000000" placeholder="24995" required/></div><div className="vehicleField"><label>Estimated Down Payment</label><input name="downPayment" type="number" min="0" placeholder="2000"/></div><div className="vehicleField wide"><label>Description</label><textarea name="description" maxLength={3000} placeholder="Condition, equipment, key features and anything the customer should know."/></div></div></>}

{step===3&&<><h2>Vehicle Photos</h2><p className="help">Add at least one photo. First image becomes primary.</p><div className="photoTools"><label className="photoTool">TAKE PHOTO<input hidden type="file" accept="image/*" capture="environment" onChange={e=>addPhotos(Array.from(e.target.files||[]))}/></label><label className="photoTool">UPLOAD FILES<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e=>addPhotos(Array.from(e.target.files||[]))}/></label><div className="photoTool">{photos.length?`${photos.length} PHOTO${photos.length===1?"":"S"} READY`:"NO PHOTOS YET"}</div></div><label className="photoDrop"><div><b>Select vehicle photos</b><p>JPG, PNG, WEBP or AVIF · up to 15 MB each.</p><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e=>addPhotos(Array.from(e.target.files||[]))}/></div></label>{photos.length>0&&<div className="photoList">{photos.map((p,i)=><span key={`${p.name}-${i}`}>{i+1}. {p.name}</span>)}</div>}</>}

{step===4&&<><h2>Verify Listing</h2><p className="help">Everything is ready for server readback and photo checkpointing. Save as draft or continue to publish.</p><div className="readiness"><div className="readinessTop"><span>LISTING READINESS</span><span>100%</span></div><div className="readinessTrack"><span style={{width:"100%"}}/></div><div className="muted">Vehicle info ✓ · Pricing ✓ · Photos ✓ · Ready for verification ✓</div></div></>}

{step===5&&<><h2>Publish</h2><p className="help">Publish will only report success after the backend confirms the vehicle and storefront verification succeeds.</p></>}

<div className="readiness"><div className="readinessTop"><span>STEP {step} OF 5</span><span>{progress}%</span></div><div className="readinessTrack"><span style={{width:`${progress}%`}}/></div></div>{message&&<div className="dealerMessage" role="status" aria-live="polite">{message}</div>}<div className="wizardActions"><button type="button" disabled={busy} onClick={()=>step>1?setStep(step-1):router.push("/dealer/inventory")}>{step>1?"BACK":"CANCEL"}</button><Link href="/dealer/inventory/logs">VEHICLE LOGS</Link>{step<4&&<button type="button" className="publish" disabled={busy} onClick={next}>NEXT</button>}{step===4&&<><button type="submit" name="intent" value="draft" disabled={busy}>SAVE DRAFT</button><button type="button" className="publish" disabled={busy} onClick={()=>setStep(5)}>CONTINUE TO PUBLISH</button></>}{step===5&&<button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"VERIFYING…":"PUBLISH VEHICLE"}</button>}</div></div></form></section></main>;
}
