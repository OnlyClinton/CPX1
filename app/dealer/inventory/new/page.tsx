"use client";

import Link from "next/link";
import {DragEvent,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});

type FormState={year:string;make:string;model:string;trim:string;price:string;downPayment:string;mileage:string;stock:string;description:string};
const initial:FormState={year:"",make:"",model:"",trim:"",price:"",downPayment:"",mileage:"",stock:"",description:""};

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
    let n=0;
    if(formState.year&&formState.make&&formState.model)n+=25;
    if(Number(formState.price)>0)n+=25;
    if(photos.length)n+=25;
    if(formState.description.trim())n+=25;
    return n;
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
    if(!formState.year||!formState.make.trim()||!formState.model.trim()||Number(formState.price)<=0){setMessage("Year, make, model and a valid price are required.");return;}
    if(intent==="published"&&photos.length===0){setMessage("Add at least one vehicle photo before publishing. You can save a draft without photos.");return;}
    setBusy(true);const requestId=crypto.randomUUID();setMessage("Saving vehicle…");let draftId="";
    try{
      const body={year:Number(formState.year),make:norm(formState.make),model:norm(formState.model),trim:norm(formState.trim),price:Number(formState.price),downPayment:Number(formState.downPayment||0),mileage:Number(formState.mileage||0),stock:norm(formState.stock),description:norm(formState.description)};
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
        const verify=await fetch(`/api/inventory/${encodeURIComponent(draftId)}?published=${Date.now()}`,{cache:"no-store",credentials:"include",headers:{"X-WDCC-Request-ID":requestId}});
        const verifyJson=await verify.json().catch(()=>({}));
        if(!verify.ok||String(verifyJson?.item?.status||"").toLowerCase()!=="published")throw new Error("Publish verification failed; draft was preserved.");
      }
      router.push(`/dealer/inventory?saved=${intent}&trace=${encodeURIComponent(requestId)}`);router.refresh();
    }catch(error){const reason=error instanceof Error?error.message:"Vehicle upload failed";setMessage(draftId?`Draft ${draftId} is preserved. ${reason}`:reason);setBusy(false);}
  }

  if(!ready)return <main className="wdccLoading">Checking secure dealer session…</main>;
  return <main className="vehicleScreen">
    <aside className="vehicleRail">
      <Link href="/dealer" className="railBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></Link>
      <nav><Link href="/dealer">⌂ Dashboard</Link><strong>INVENTORY</strong><Link href="/dealer/inventory">All Vehicles</Link><Link className="active" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link><Link href="/dealer/inventory">Categories</Link><Link href="/dealer/inventory">Import Vehicles</Link><strong>OPERATIONS</strong><Link href="/dealer/leads">Leads</Link><Link href="/dealer/leads">Appointments</Link><Link href="/dealer/leads">Test Drives</Link><Link href="/dealer/leads">Customers</Link><Link href="/dealer/leads">Applications</Link><Link href="/dealer/leads">Messages</Link><Link href="/dealer/inventory/logs">Reports</Link><Link href="/dealer">Settings</Link></nav>
      <div className="helpBox"><small>NEED HELP?</small><span>Call Sean anytime.</span><a href="tel:18135164752">813-516-4752</a></div>
    </aside>
    <section className="vehicleWorkspace">
      <header className="vehicleTop"><div className="topBrand"><img src="/wdcc-logo-transparent.webp" alt=""/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div><a href="tel:18135164752">☎ (813) 516-4752</a><span className="manager">Sean · Sales Manager</span><button onClick={()=>fetch("/api/auth/logout",{method:"POST",credentials:"include"}).finally(()=>location.href="/dealer")}>Sign Out</button></header>
      <form className="editorGrid" onSubmit={submit}>
        <section className="editorMain">
          <div className="editorHead"><div><h1>Add / Edit Vehicle</h1><span>Build the listing, add photos, review readiness, then publish.</span></div><div className="stepper">{["Info","Pricing","Photos","Details","Review"].map((label,i)=><div className={`step ${i<2?"done":i===2?"active":""}`} key={label}><b>{i+1}</b><span>{label}</span></div>)}</div></div>
          <div className="formCard">
            <section className="vehicleInfo"><div className="sectionHead"><h2>Vehicle Information</h2><p>Enter the dealer listing details.</p></div><div className="fieldGrid">
              <label>YEAR<input name="year" inputMode="numeric" value={formState.year} onChange={e=>setField("year",e.target.value)} placeholder="2020" required/></label>
              <label>MAKE<input name="make" value={formState.make} onChange={e=>setField("make",e.target.value)} placeholder="Dodge" required/></label>
              <label>MODEL<input name="model" value={formState.model} onChange={e=>setField("model",e.target.value)} placeholder="Challenger" required/></label>
              <label>TRIM<input name="trim" value={formState.trim} onChange={e=>setField("trim",e.target.value)} placeholder="SXT"/></label>
              <label>PRICE<input name="price" inputMode="decimal" value={formState.price} onChange={e=>setField("price",e.target.value)} placeholder="24995" required/></label>
              <label>DOWN PAYMENT<input name="downPayment" inputMode="decimal" value={formState.downPayment} onChange={e=>setField("downPayment",e.target.value)} placeholder="2000"/></label>
              <label>MILEAGE<input name="mileage" inputMode="numeric" value={formState.mileage} onChange={e=>setField("mileage",e.target.value)} placeholder="41000"/></label>
              <label>STOCK #<input name="stock" value={formState.stock} onChange={e=>setField("stock",e.target.value)} placeholder="WDCC-2020-001"/></label>
              <label className="descriptionField">DESCRIPTION<textarea name="description" rows={3} value={formState.description} onChange={e=>setField("description",e.target.value)} placeholder="Clean title. Runs and drives great…"/></label>
            </div></section>
            <section className="photosSection"><div className="sectionHead"><h2>Photos</h2><p>Add up to 10. Tap a thumbnail to make it primary.</p></div>
              <div className="photoButtons"><button type="button" onClick={()=>cameraRef.current?.click()}>▧ <b>Take Photo</b><span>Use camera</span></button><button type="button" onClick={()=>uploadRef.current?.click()}>▣ <b>Upload Files</b><span>Choose from device</span></button><button type="button" onClick={()=>uploadRef.current?.click()}>⇧ <b>Drag & Drop</b><span>Drop images here</span></button></div>
              <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={event=>addPhotos(Array.from(event.target.files||[]))}/><input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/>
              <div className="dropZone" onDragOver={e=>e.preventDefault()} onDrop={onDrop}><div className="thumbGrid">{previews.map((url,index)=><div className={`thumb ${index===primary?"primary":""}`} key={url} onClick={()=>makePrimary(index)}>{index===primary&&<em>PRIMARY</em>}<img src={url} alt={`Vehicle photo ${index+1}`}/><button type="button" aria-label="Remove photo" onClick={e=>{e.stopPropagation();removePhoto(index)}}>×</button></div>)}{photos.length<10&&<button className="addPhoto" type="button" onClick={()=>uploadRef.current?.click()}>＋<span>Add Photo</span></button>}</div></div>
            </section>
            <section className="readinessCard"><div><h3>Listing Readiness</h3><strong>Ready {readiness}%</strong></div><div className="progress"><i style={{width:`${readiness}%`}}/></div><ul><li>Vehicle information <b>{formState.year&&formState.make&&formState.model?"✓":"—"}</b></li><li>Pricing <b>{Number(formState.price)>0?"✓":"—"}</b></li><li>Primary photo <b>{photos.length?"✓":"—"}</b></li><li>Description <b>{formState.description?"✓":"—"}</b></li></ul></section>
            {message&&<div className="statusMessage" role="status">{message}</div>}
            <div className="bottomActions"><div><button type="submit" name="intent" value="draft" disabled={busy}>Save Draft</button><button type="button" onClick={()=>document.querySelector(".previewCard")?.scrollIntoView({behavior:"smooth"})}>Preview</button></div><button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"Working…":"Publish Vehicle"}</button></div>
          </div>
        </section>
        <aside className="previewCard">
          <div className="previewTitle"><div><b>Listing Preview</b><span>Customer-facing actions are shown on the storefront, not in this editor.</span></div></div><div className="previewHero"><img src={hero} alt="Vehicle preview"/><small>{photos.length?`1 / ${photos.length}`:"Preview"}</small></div>
          <div className="previewBody"><h2>{[formState.year,formState.make,formState.model,formState.trim].filter(Boolean).join(" ")||"Vehicle preview"}</h2><div className="priceRow"><strong>{formState.price?money(formState.price):"Price"}</strong>{Number(formState.downPayment)>0&&<b>{money(formState.downPayment)} DOWN</b>}</div><div className="specs"><span>{formState.mileage?`${Number(formState.mileage).toLocaleString()} MILES`:"Mileage"}</span><span>{formState.stock||"Stock #"}</span></div><h4>Description</h4><p>{formState.description||"Add a description to preview the public listing."}</p></div>
        </aside>
      </form>
    </section>
    <style jsx global>{editorCss}</style>
  </main>;
}

const editorCss=`
*{box-sizing:border-box}html,body{margin:0;background:#f2f4f6;color:#101820}.wdccLoading{min-height:100svh;background:#06111c;color:#fff;display:grid;place-items:center;font:700 14px Inter,system-ui}.vehicleScreen{min-height:100svh;background:#f2f4f6;color:#101820;display:grid;grid-template-columns:202px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.vehicleRail{background:#071522;color:#cbd5df;border-right:1px solid #1d3348;padding:14px 12px;min-height:100svh;display:flex;flex-direction:column}.railBrand{display:flex;gap:9px;align-items:center;padding:4px 4px 17px;border-bottom:1px solid #183047;text-decoration:none}.railBrand img{width:58px;height:46px;object-fit:contain}.railBrand b,.railBrand span{display:block}.railBrand b{font-size:10px;color:#fff}.railBrand span{font-size:8px;color:#8ca0b2;margin-top:3px}.vehicleRail nav{display:grid;padding-top:10px}.vehicleRail nav strong{font-size:9px;letter-spacing:.08em;color:#8fa1b1;padding:15px 9px 6px}.vehicleRail nav a{font-size:11px;padding:9px;border-radius:6px;color:#dce5ec;text-decoration:none}.vehicleRail nav a:hover{background:#102437}.vehicleRail nav a.active{background:#ed1c2e;color:#fff;font-weight:900}.helpBox{margin-top:auto;background:#0b1b2a;border:1px solid #29435a;border-radius:8px;padding:12px}.helpBox small,.helpBox span,.helpBox a{display:block}.helpBox small{font-size:9px;color:#8da1b3}.helpBox span{font-size:10px;margin-top:4px}.helpBox a{color:#ff3848;font-weight:900;margin-top:5px}.vehicleWorkspace{min-width:0}.vehicleTop{height:72px;background:#06111c;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:18px;padding:0 24px;border-bottom:1px solid #1d3348}.topBrand{display:flex;align-items:center;gap:9px}.topBrand img{width:62px;height:46px;object-fit:contain}.topBrand b,.topBrand span{display:block}.topBrand b{font-size:11px}.topBrand span{font-size:8px;color:#91a3b2}.vehicleTop>a,.vehicleTop>button{border:1px solid #36506a;border-radius:7px;padding:10px 13px;color:#fff;background:transparent;font:800 11px Inter,system-ui;text-decoration:none}.vehicleTop .manager{font-size:11px;color:#d6dee5}.editorGrid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;padding:18px;max-width:1450px;margin:0 auto}.editorMain{min-width:0}.editorHead,.formCard,.previewCard{background:#fff;border:1px solid #dce3e8;border-radius:10px;box-shadow:0 3px 16px #0f22330a}.editorHead{padding:18px 20px;margin-bottom:12px}.editorHead>div:first-child{display:flex;align-items:baseline;gap:12px}.editorHead h1{font-size:22px;margin:0;letter-spacing:-.03em}.editorHead>div:first-child>span{font-size:11px;color:#74818d}.stepper{display:grid!important;grid-template-columns:repeat(5,1fr);gap:0!important;margin-top:18px;position:relative}.stepper:before{content:"";position:absolute;left:8%;right:8%;top:13px;height:1px;background:#d9e0e5}.step{position:relative;z-index:1;text-align:center;display:grid!important;justify-items:center!important;gap:4px!important}.step b{width:27px;height:27px;border-radius:50%;border:1px solid #cbd4db;background:#fff;display:grid;place-items:center;font-size:11px}.step span{font-size:9px;color:#687682}.step.done b{border-color:#aebac4}.step.active b{background:#ed1c2e;border-color:#ed1c2e;color:#fff}.step.active span{color:#d8192b;font-weight:900}.formCard{padding:20px}.sectionHead h2{font-size:15px;margin:0}.sectionHead p{font-size:10px;color:#74818d;margin:4px 0 0}.fieldGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-top:14px}.fieldGrid label{display:grid;gap:6px;font-size:9px;font-weight:900;color:#51606c;letter-spacing:.03em}.fieldGrid input,.fieldGrid textarea{width:100%;border:1px solid #d2dbe2;border-radius:6px;background:#fff;color:#101820;padding:10px 11px;font:500 12px Inter,system-ui;outline:none}.fieldGrid input:focus,.fieldGrid textarea:focus{border-color:#8ca2b5;box-shadow:0 0 0 3px #1830470d}.descriptionField{grid-column:1/-1}.photosSection{margin-top:22px;padding-top:20px;border-top:1px solid #e5e9ec}.photoButtons{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.photoButtons button{height:62px;border:1px solid #d5dde3;border-radius:7px;background:#fff;color:#111820;display:grid;grid-template-columns:auto auto;justify-content:center;align-content:center;column-gap:8px;font-size:17px}.photoButtons b,.photoButtons span{display:block;text-align:left}.photoButtons b{font-size:11px}.photoButtons span{font-size:8px;color:#74818d}.dropZone{margin-top:12px}.thumbGrid{display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:9px}.thumb,.addPhoto{aspect-ratio:1.45;border-radius:7px;overflow:hidden;position:relative;border:1px solid #d5dde3;background:#eef2f5}.thumb{cursor:pointer}.thumb img{width:100%;height:100%;object-fit:cover}.thumb.primary{outline:2px solid #efb51e;outline-offset:-2px}.thumb em{position:absolute;left:4px;top:4px;background:#f5c128;color:#111;padding:3px 6px;border-radius:4px;font-size:8px;font-weight:900;font-style:normal;z-index:2}.thumb>button{position:absolute;right:4px;top:4px;border:0;width:20px;height:20px;border-radius:50%;background:#ed1c2e;color:#fff;font-weight:900}.addPhoto{display:grid;place-items:center;align-content:center;border-style:dashed;color:#384b5a;background:#fafbfc;font-size:24px}.addPhoto span{display:block;font-size:9px;margin-top:3px}.readinessCard{margin-top:22px;padding-top:20px;border-top:1px solid #e5e9ec}.readinessCard>div:first-child{display:flex;justify-content:space-between;align-items:end}.readinessCard h3{font-size:12px;margin:0}.readinessCard strong{font-size:20px}.progress{height:5px;background:#e6ebef;border-radius:99px;overflow:hidden;margin:12px 0}.progress i{display:block;height:100%;background:#ed1c2e}.readinessCard ul{list-style:none;padding:0;margin:0;display:grid;gap:6px}.readinessCard li{display:flex;justify-content:space-between;font-size:10px;color:#4e5d69}.readinessCard li b{color:#27895d}.statusMessage{margin-top:14px;background:#fff7df;border:1px solid #ebd89b;color:#735817;border-radius:7px;padding:10px 12px;font-size:10px;line-height:1.4}.bottomActions{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:18px}.bottomActions>div{display:flex;gap:8px}.bottomActions button{height:40px;border:1px solid #d1dae1;border-radius:6px;background:#fff;color:#111820;padding:0 18px;font:800 10px Inter,system-ui}.bottomActions .publish{min-width:190px;background:#ed1c2e;border-color:#ed1c2e;color:#fff;font-size:11px}.bottomActions button:disabled{opacity:.55}.previewCard{align-self:start;position:sticky;top:90px;overflow:hidden}.previewTitle{padding:15px 16px;border-bottom:1px solid #e1e6ea}.previewTitle b,.previewTitle span{display:block}.previewTitle b{font-size:12px}.previewTitle span{font-size:9px;color:#778590;margin-top:3px;line-height:1.35}.previewHero{position:relative;aspect-ratio:1.6;background:#071522}.previewHero img{width:100%;height:100%;object-fit:cover}.previewHero small{position:absolute;right:9px;bottom:8px;background:#06111ccc;color:#fff;border-radius:99px;padding:4px 7px;font-size:8px}.previewBody{padding:16px}.previewBody h2{font-size:18px;line-height:1.15;margin:0 0 8px}.priceRow{display:flex;align-items:center;gap:9px}.priceRow strong{font-size:22px}.priceRow b{background:#101820;color:#fff;border-radius:5px;padding:5px 7px;font-size:8px}.specs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;color:#667580;font-size:9px}.previewBody h4{font-size:10px;margin:15px 0 5px}.previewBody p{font-size:10px;line-height:1.55;color:#42505b;margin:0}
@media(max-width:1100px){.vehicleScreen{grid-template-columns:174px minmax(0,1fr)}.editorGrid{grid-template-columns:minmax(0,1fr) 300px}.fieldGrid{grid-template-columns:repeat(2,1fr)}.thumbGrid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:820px){.vehicleScreen{display:block}.vehicleRail{display:none}.vehicleTop{height:64px;grid-template-columns:1fr auto;padding:0 14px}.vehicleTop .manager,.vehicleTop>button{display:none}.vehicleTop>a{font-size:0;padding:9px}.vehicleTop>a:before{content:"☎";font-size:18px}.topBrand img{width:50px}.editorGrid{display:block;padding:12px}.editorHead{padding:16px}.editorHead>div:first-child{display:block}.editorHead>div:first-child>span{display:block;margin-top:4px}.formCard{padding:15px}.previewCard{position:static;margin-top:12px}.photoButtons{grid-template-columns:1fr}.photoButtons button{height:50px}.thumbGrid{grid-template-columns:repeat(3,1fr)}.bottomActions{display:grid}.bottomActions>div{display:grid;grid-template-columns:1fr 1fr}.bottomActions button,.bottomActions .publish{width:100%;min-width:0}.bottomActions .publish{height:46px}.fieldGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.editorGrid{padding:8px}.editorHead,.formCard,.previewCard{border-radius:8px}.editorHead{padding:14px 12px}.editorHead h1{font-size:20px}.stepper{margin-top:15px}.formCard{padding:13px}.fieldGrid{gap:8px}.fieldGrid label{font-size:8px}.fieldGrid input,.fieldGrid textarea{padding:9px;font-size:11px}.thumbGrid{grid-template-columns:repeat(3,1fr);gap:6px}.readinessCard strong{font-size:18px}.previewBody h2{font-size:17px}}
`;
