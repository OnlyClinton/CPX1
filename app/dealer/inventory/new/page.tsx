"use client";

import Link from "next/link";
import {DragEvent,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});

type FormState={year:string;make:string;model:string;trim:string;price:string;downPayment:string;mileage:string;stock:string;description:string};
const initial:FormState={year:"2020",make:"Dodge",model:"Challenger",trim:"SXT",price:"24995",downPayment:"2000",mileage:"41000",stock:"WDCC-2020-001",description:"Clean title. Runs and drives great. Well maintained inside and out. Ready to drive today."};

export default function NewVehicle(){
  const router=useRouter();
  const cameraRef=useRef<HTMLInputElement|null>(null);
  const uploadRef=useRef<HTMLInputElement|null>(null);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [photos,setPhotos]=useState<File[]>([]);
  const [primary,setPrimary]=useState(0);
  const [message,setMessage]=useState("");
  const [formState,setFormState]=useState<FormState>(initial);

  useEffect(()=>{
    fetch("/api/auth/session",{cache:"no-store",credentials:"include"})
      .then(response=>response.json())
      .then(session=>{if(!session.authenticated)location.href="/dealer";else setReady(true)})
      .catch(()=>location.href="/dealer");
  },[]);

  const previews=useMemo(()=>photos.map(file=>URL.createObjectURL(file)),[photos]);
  useEffect(()=>()=>{previews.forEach(URL.revokeObjectURL)},[previews]);
  const hero=previews[primary]||previews[0]||"/wdcc-hero-v2.webp";
  const readiness=useMemo(()=>{
    let n=0;if(formState.year&&formState.make&&formState.model)n+=25;if(Number(formState.price)>0)n+=25;if(photos.length)n+=25;if(formState.description.trim())n+=25;return n;
  },[formState,photos]);

  function setField(name:keyof FormState,value:string){setFormState(current=>({...current,[name]:value}));}
  function addPhotos(files:File[]){
    const accepted=files.filter(file=>allowedTypes.has(file.type)&&file.size<=15*1024*1024);
    const rejected=files.length-accepted.length;
    setPhotos(current=>[...current,...accepted].slice(0,10));
    setMessage(rejected?`${rejected} photo${rejected===1?" was":"s were"} skipped. Use JPG, PNG, WEBP or AVIF under 15 MB.`:"");
  }
  function removePhoto(index:number){setPhotos(current=>current.filter((_,i)=>i!==index));setPrimary(current=>current===index?0:current>index?current-1:current);}
  function makePrimary(index:number){setPrimary(index);}
  function onDrop(event:DragEvent<HTMLDivElement>){event.preventDefault();addPhotos(Array.from(event.dataTransfer.files||[]));}

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const intent=submitter?.value==="draft"?"draft":"published";
    if(intent==="published"&&photos.length===0){setMessage("Add at least one vehicle photo before publishing. You can save a draft without photos.");return;}
    setBusy(true);const requestId=crypto.randomUUID();setMessage(`Saving draft… Trace ${requestId}`);let draftId="";
    try{
      const form=new FormData(event.currentTarget);
      const body={year:Number(form.get("year")),make:norm(form.get("make")),model:norm(form.get("model")),trim:norm(form.get("trim")),price:Number(form.get("price")),downPayment:Number(form.get("downPayment")||0),mileage:Number(form.get("mileage")||0),stock:norm(form.get("stock")),description:norm(form.get("description"))};
      const headers={"Content-Type":"application/json","X-WDCC-Request-ID":requestId};
      const created=await fetch("/api/inventory",{method:"POST",credentials:"include",headers,body:JSON.stringify(body)});
      const createdJson=await created.json().catch(()=>({}));
      if(!created.ok||!createdJson?.item?.id)throw new Error(createdJson.error||"Vehicle draft could not be created");
      draftId=String(createdJson.item.id);
      const readback=await fetch(`/api/inventory/${encodeURIComponent(draftId)}?verify=${Date.now()}`,{cache:"no-store",credentials:"include",headers:{"X-WDCC-Request-ID":requestId}});
      const readbackJson=await readback.json().catch(()=>({}));const saved=readbackJson?.item||{};
      if(!readback.ok||Number(saved.year)!==body.year||norm(saved.make)!==body.make||norm(saved.model)!==body.model)throw new Error("Draft verification failed");
      const order=photos.length?[photos[primary],...photos.filter((_,i)=>i!==primary)]:[];const paths:string[]=[];
      for(let index=0;index<order.length;index++){
        const file=order[index];setMessage(`Uploading photo ${index+1} of ${order.length}…`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||`photo-${index+1}.jpg`;
        const blob=await upload(`media/wdcc/${draftId}/${safeName}`,file,{access:"private",handleUploadUrl:"/api/upload",clientPayload:JSON.stringify({vehicleId:draftId,requestId}),contentType:file.type});
        if(!blob?.pathname)throw new Error(`Photo ${index+1} upload failed`);paths.push(blob.pathname);
        const checkpoint=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",credentials:"include",headers,body:JSON.stringify({photoPathnames:paths,primaryPhotoPathname:paths[0]})});
        if(!checkpoint.ok)throw new Error(`Photo ${index+1} checkpoint failed`);
      }
      if(intent==="published"){
        setMessage("Publishing vehicle…");
        const published=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",credentials:"include",headers,body:JSON.stringify({status:"published"})});
        const publishedJson=await published.json().catch(()=>({}));if(!published.ok)throw new Error(publishedJson.error||"Publish failed");
      }
      router.push(`/dealer/inventory?saved=${intent}&trace=${encodeURIComponent(requestId)}`);router.refresh();
    }catch(error){const reason=error instanceof Error?error.message:"Vehicle upload failed";setMessage(draftId?`Draft ${draftId} is preserved. ${reason}`:reason);setBusy(false);}
  }

  if(!ready)return <main className="wdccLoading">Checking secure dealer session…</main>;
  return <main className="vehicleScreen">
    <aside className="vehicleRail">
      <Link href="/dealer" className="railBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></Link>
      <nav><Link href="/dealer">⌂ Dashboard</Link><strong>INVENTORY</strong><Link href="/dealer/inventory">All Vehicles</Link><Link className="active" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
      <div className="helpBox"><small>CALL SEAN</small><a href="tel:18135164752">813-516-4752</a></div>
    </aside>
    <section className="vehicleWorkspace">
      <header className="vehicleTop"><div className="topBrand"><img src="/wdcc-logo-transparent.webp" alt=""/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span>Sean · Sales Manager</span><button onClick={()=>fetch("/api/auth/logout",{method:"POST",credentials:"include"}).finally(()=>location.href="/dealer")}>Sign Out</button></header>
      <form className="editorGrid" onSubmit={submit}>
        <section className="editorMain">
          <div className="editorHead"><h1>Add / Edit Vehicle</h1><span>Step 3 of 5</span><div className="stepper">{["Info","Pricing","Photos","Details","Review"].map((label,i)=><div className={`step ${i<2?"done":i===2?"active":""}`} key={label}><b>{i+1}</b><span>{label}</span></div>)}</div></div>
          <div className="formCard">
            <h2>Photos</h2><p>Add up to 10 photos. First photo will be the primary image.</p>
            <div className="photoButtons"><button type="button" onClick={()=>cameraRef.current?.click()}>▧ <b>Take Photo</b><span>Use camera</span></button><button type="button" onClick={()=>uploadRef.current?.click()}>▣ <b>Upload Files</b><span>Choose from device</span></button><button type="button" onClick={()=>uploadRef.current?.click()}>⇧ <b>Drag & Drop</b><span>Drop images here</span></button></div>
            <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={event=>addPhotos(Array.from(event.target.files||[]))}/><input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/>
            <div className="dropZone" onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
              <div className="thumbGrid">{previews.map((url,index)=><div className={`thumb ${index===primary?"primary":""}`} key={url} onClick={()=>makePrimary(index)}>{index===primary&&<em>PRIMARY</em>}<img src={url} alt={`Vehicle photo ${index+1}`}/><button type="button" aria-label="Remove photo" onClick={e=>{e.stopPropagation();removePhoto(index)}}>×</button></div>)}{photos.length<10&&<button className="addPhoto" type="button" onClick={()=>uploadRef.current?.click()}>＋<span>Add Photo</span></button>}</div>
            </div>
            <div className="hiddenFields" aria-hidden="true"><input name="year" value={formState.year} onChange={e=>setField("year",e.target.value)}/><input name="make" value={formState.make} onChange={e=>setField("make",e.target.value)}/><input name="model" value={formState.model} onChange={e=>setField("model",e.target.value)}/><input name="trim" value={formState.trim} onChange={e=>setField("trim",e.target.value)}/><input name="price" value={formState.price} onChange={e=>setField("price",e.target.value)}/><input name="downPayment" value={formState.downPayment} onChange={e=>setField("downPayment",e.target.value)}/><input name="mileage" value={formState.mileage} onChange={e=>setField("mileage",e.target.value)}/><input name="stock" value={formState.stock} onChange={e=>setField("stock",e.target.value)}/><textarea name="description" value={formState.description} onChange={e=>setField("description",e.target.value)}/></div>
            <section className="readinessCard"><h3>Listing Readiness</h3><strong>Ready {readiness}%</strong><div className="progress"><i style={{width:`${readiness}%`}}/></div><ul><li>Vehicle information <b>✓</b></li><li>Pricing <b>✓</b></li><li>Primary photo <b>{photos.length?"✓":"—"}</b></li><li>Description <b>{formState.description?"✓":"—"}</b></li></ul></section>
            {message&&<div className="statusMessage">{message}</div>}
            <div className="bottomActions"><button type="submit" name="intent" value="draft" disabled={busy}>Save Draft</button><button type="button" onClick={()=>document.querySelector(".previewCard")?.scrollIntoView({behavior:"smooth"})}>Preview</button><button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"Working…":"Publish / Submit"}</button></div>
          </div>
        </section>
        <aside className="previewCard">
          <div className="previewTitle"><b>Vehicle Details Preview</b><span>×</span></div><div className="previewHero"><img src={hero} alt="Vehicle preview"/><span>‹</span><span>›</span><small>{photos.length?`1 / ${photos.length}`:"Preview"}</small></div>
          <h2>{formState.year} {formState.make} {formState.model} {formState.trim}</h2><div className="priceRow"><strong>{money(formState.price)}</strong><b>{money(formState.downPayment)} DOWN</b></div><div className="specs"><span>◉ {Number(formState.mileage||0).toLocaleString()} MILES</span><span>⚙ V6</span><span>⌁ AUTOMATIC</span><span>⛽ GASOLINE</span><span>◎ RWD</span></div><h4>Description</h4><p>{formState.description}</p><div className="previewActions"><button type="button">SCHEDULE TEST DRIVE</button><a href="tel:18135164752">CALL SEAN</a></div><Link href="/dealer/inventory">VIEW FULL DETAILS →</Link>
        </aside>
      </form>
    </section>
    <style jsx global>{`
      .wdccLoading{min-height:100svh;background:#06111c;color:#fff;display:grid;place-items:center;font:700 14px Inter,system-ui}.vehicleScreen{min-height:100svh;background:#eef1f4;color:#111820;display:grid;grid-template-columns:188px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.vehicleRail{background:#071522;color:#d1d9e0;border-right:1px solid #183047;padding:14px 10px;min-height:100svh}.railBrand{display:flex;gap:8px;align-items:center;padding:4px 4px 18px;border-bottom:1px solid #183047}.railBrand img{width:54px;height:44px;object-fit:contain}.railBrand b,.railBrand span{display:block}.railBrand b{font-size:9px;color:#fff}.railBrand span{font-size:7px;color:#8496a7;margin-top:3px}.vehicleRail nav{display:grid;padding-top:12px}.vehicleRail nav strong{font-size:8px;letter-spacing:.08em;color:#fff;padding:15px 8px 7px}.vehicleRail nav a{font-size:9px;padding:10px 8px;border-radius:4px}.vehicleRail nav a.active{background:#ed1c2e;color:#fff}.helpBox{position:sticky;top:calc(100svh - 92px);background:#0b1b2a;border:1px solid #27405a;border-radius:6px;padding:10px}.helpBox small,.helpBox a{display:block}.helpBox a{color:#ed1c2e;font-weight:900;margin-top:4px}.vehicleWorkspace{min-width:0}.vehicleTop{height:68px;background:#06111c;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:20px;padding:0 22px}.topBrand{display:flex;align-items:center;gap:8px}.topBrand img{width:48px;height:40px;object-fit:contain}.topBrand b,.topBrand span{display:block}.topBrand b{font-size:10px}.topBrand span{font-size:8px;color:#8ea0b0;margin-top:2px}.vehicleTop>a{border:1px solid #364b5e;border-radius:5px;padding:9px 13px;font-size:10px}.vehicleTop>span{font-size:9px}.vehicleTop>button{background:transparent;color:#fff;border:1px solid #364b5e;border-radius:5px;padding:9px 13px}.editorGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;max-width:1160px;margin:18px auto;gap:0;background:#fff;border:1px solid #d5dce3;border-radius:9px;overflow:hidden;box-shadow:0 10px 30px #0b1a2c17}.editorMain{min-width:0;padding:20px}.editorHead h1{font-size:20px;margin:0 0 3px}.editorHead>span{font-size:10px;color:#677381}.stepper{display:grid;grid-template-columns:repeat(5,1fr);margin:20px 0 5px;position:relative}.stepper:before{content:"";position:absolute;top:13px;left:10%;right:10%;height:1px;background:#d5dbe0}.step{z-index:1;text-align:center;font-size:8px;color:#485562}.step b{width:27px;height:27px;border:1px solid #c7ced5;border-radius:50%;display:grid;place-items:center;margin:auto;background:#fff;font-size:9px}.step span{display:block;margin-top:5px}.step.active{color:#ed1c2e;font-weight:900}.step.active b{background:#ed1c2e;color:#fff;border-color:#ed1c2e}.step.done b{border-color:#bfc8d0}.formCard h2{font-size:17px;margin:16px 0 3px}.formCard>p{font-size:9px;color:#697582;margin:0 0 13px}.photoButtons{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.photoButtons button{background:#fff;border:1px solid #d3d9df;border-radius:6px;min-height:58px;color:#19232d;font-size:15px;display:grid;grid-template-columns:auto auto;justify-content:center;align-content:center;column-gap:5px}.photoButtons button b{font-size:9px}.photoButtons button span{grid-column:1/-1;font-size:7px;color:#7c8791}.dropZone{margin-top:11px}.thumbGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.thumb{height:86px;border:2px solid transparent;border-radius:6px;overflow:hidden;position:relative;background:#0b1520;cursor:pointer}.thumb.primary{border-color:#e0a900}.thumb img{width:100%;height:100%;object-fit:cover}.thumb em{position:absolute;top:3px;left:3px;background:#e0a900;color:#1a1a1a;font-size:6px;font-style:normal;font-weight:950;padding:3px 5px;border-radius:3px;z-index:2}.thumb button{position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#e11c2d;color:#fff;border:0;z-index:2;font-size:13px;line-height:16px}.addPhoto{height:86px;background:#fff;border:1px solid #d6dce2;border-radius:6px;display:grid;place-items:center;align-content:center;font-size:25px;color:#1d2730}.addPhoto span{font-size:7px;font-weight:800}.hiddenFields{height:0;overflow:hidden;position:absolute;pointer-events:none}.readinessCard{margin-top:18px}.readinessCard h3{font-size:10px;margin:0 0 5px}.readinessCard>strong{font-size:18px}.progress{height:4px;background:#e4e7ea;margin:9px 0 12px}.progress i{height:100%;background:#ed1c2e;display:block}.readinessCard ul{list-style:none;padding:0;margin:0;display:grid;gap:8px;font-size:9px}.readinessCard li{display:flex;justify-content:space-between}.statusMessage{background:#fff5dc;border:1px solid #e3c987;color:#6d4d10;border-radius:5px;padding:9px;margin-top:12px;font-size:9px}.bottomActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.bottomActions button{min-height:39px;background:#fff;border:1px solid #d1d7dd;border-radius:5px;font-size:9px;font-weight:800}.bottomActions .publish{grid-column:1/-1;background:#ed1c2e;border-color:#ed1c2e;color:#fff}.previewCard{border-left:1px solid #d9dfe4;padding:18px;min-width:0}.previewTitle{display:flex;justify-content:space-between;font-size:9px;margin-bottom:11px}.previewHero{height:190px;background:#06111c;border-radius:6px;overflow:hidden;position:relative}.previewHero img{width:100%;height:100%;object-fit:cover}.previewHero>span{position:absolute;top:45%;color:#fff;font-size:24px}.previewHero>span:first-of-type{left:7px}.previewHero>span:nth-of-type(2){right:7px}.previewHero small{position:absolute;right:8px;bottom:7px;color:#fff;background:#0008;padding:3px 5px}.previewCard h2{font-size:18px;margin:13px 0 5px}.priceRow{display:flex;align-items:center;gap:10px}.priceRow strong{font-size:24px}.priceRow b{background:#101820;color:#fff;border-radius:3px;padding:5px 8px;font-size:7px}.specs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;color:#66727c;font-size:7px}.previewCard h4{font-size:9px;margin:13px 0 5px}.previewCard p{font-size:9px;line-height:1.5;color:#3f4a53;min-height:44px}.previewActions{display:grid;grid-template-columns:1.25fr 1fr;gap:8px;margin:15px 0}.previewActions button,.previewActions a{min-height:36px;border-radius:4px;display:grid;place-items:center;font-size:8px;font-weight:900}.previewActions button{background:#ed1c2e;color:#fff;border:0}.previewActions a{background:#06111c;color:#fff}.previewCard>a{font-size:8px;font-weight:900;text-align:center;display:block;margin-top:14px}@media(max-width:780px){.vehicleScreen{display:block;background:#071522}.vehicleRail{display:none}.vehicleTop{height:67px;grid-template-columns:1fr auto auto;padding:0 14px;position:sticky;top:0;z-index:30}.vehicleTop>span{display:none}.vehicleTop>button{font-size:0;width:40px}.vehicleTop>button:after{content:"⋮";font-size:18px}.topBrand b,.topBrand span{display:none}.topBrand img{width:72px}.editorGrid{display:block;margin:0;border-radius:0;border:0;background:#081726;box-shadow:none}.editorMain{padding:14px}.editorHead{color:#fff}.editorHead h1{font-size:17px}.editorHead>span{color:#b9c5cf}.stepper:before{background:#395064}.step{color:#c4ced7}.step b{background:#081726;color:#fff;border-color:#526678}.formCard{background:#081726;color:#fff}.formCard>p{color:#b8c3cc}.photoButtons{gap:6px}.photoButtons button{background:#0d1d2c;color:#fff;border-color:#405468;min-height:43px;font-size:12px}.photoButtons button span{display:none}.thumbGrid{grid-template-columns:repeat(4,1fr);gap:5px}.thumb,.addPhoto{height:65px}.readinessCard{background:#fff;color:#111820;border-radius:9px;padding:13px}.readinessCard ul{font-size:9px}.bottomActions{background:#fff;border-radius:8px;padding:9px}.bottomActions button{min-height:37px}.previewCard{background:#fff;border:0;border-radius:8px;margin:5px 9px 18px;padding:12px}.previewHero{height:130px}.previewCard h2{font-size:17px}.priceRow strong{font-size:22px}.previewActions{margin-bottom:8px}}
    `}</style>
  </main>;
}
