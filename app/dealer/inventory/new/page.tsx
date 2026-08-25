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
  function removePhoto(index:number){
    setPhotos(current=>current.filter((_,i)=>i!==index));
    setPrimary(current=>current===index?0:current>index?current-1:current);
  }
  function makePrimary(index:number){setPrimary(index);}
  function onDrop(event:DragEvent<HTMLDivElement>){event.preventDefault();addPhotos(Array.from(event.dataTransfer.files||[]));}

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const intent=submitter?.value==="draft"?"draft":"published";
    if(intent==="published"&&photos.length===0){setMessage("Add at least one vehicle photo before publishing. You can save a draft without photos.");return;}
    setBusy(true);
    const requestId=crypto.randomUUID();
    setMessage(`Saving draft… Trace ${requestId}`);
    let draftId="";
    try{
      const form=new FormData(event.currentTarget);
      const body={year:Number(form.get("year")),make:norm(form.get("make")),model:norm(form.get("model")),trim:norm(form.get("trim")),price:Number(form.get("price")),downPayment:Number(form.get("downPayment")||0),mileage:Number(form.get("mileage")||0),stock:norm(form.get("stock")),description:norm(form.get("description"))};
      const headers={"Content-Type":"application/json","X-WDCC-Request-ID":requestId};
      const created=await fetch("/api/inventory",{method:"POST",credentials:"include",headers,body:JSON.stringify(body)});
      const createdJson=await created.json().catch(()=>({}));
      if(!created.ok||!createdJson?.item?.id)throw new Error(createdJson.error||"Vehicle draft could not be created");
      draftId=String(createdJson.item.id);
      const readback=await fetch(`/api/inventory/${encodeURIComponent(draftId)}?verify=${Date.now()}`,{cache:"no-store",credentials:"include",headers:{"X-WDCC-Request-ID":requestId}});
      const readbackJson=await readback.json().catch(()=>({}));
      const saved=readbackJson?.item||{};
      if(!readback.ok||Number(saved.year)!==body.year||norm(saved.make)!==body.make||norm(saved.model)!==body.model)throw new Error("Draft verification failed");
      const order=photos.length?[photos[primary],...photos.filter((_,i)=>i!==primary)]:[];
      const paths:string[]=[];
      for(let index=0;index<order.length;index++){
        const file=order[index];
        setMessage(`Uploading photo ${index+1} of ${order.length}…`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||`photo-${index+1}.jpg`;
        const blob=await upload(`media/wdcc/${draftId}/${safeName}`,file,{access:"private",handleUploadUrl:"/api/upload",clientPayload:JSON.stringify({vehicleId:draftId,requestId}),contentType:file.type});
        if(!blob?.pathname)throw new Error(`Photo ${index+1} upload failed`);
        paths.push(blob.pathname);
        const checkpoint=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",credentials:"include",headers,body:JSON.stringify({photoPathnames:paths,primaryPhotoPathname:paths[0]})});
        if(!checkpoint.ok)throw new Error(`Photo ${index+1} checkpoint failed`);
      }
      if(intent==="published"){
        setMessage("Publishing vehicle…");
        const published=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{method:"PATCH",credentials:"include",headers,body:JSON.stringify({status:"published"})});
        const publishedJson=await published.json().catch(()=>({}));
        if(!published.ok)throw new Error(publishedJson.error||"Publish failed");
      }
      router.push(`/dealer/inventory?saved=${intent}&trace=${encodeURIComponent(requestId)}`);
      router.refresh();
    }catch(error){
      const reason=error instanceof Error?error.message:"Vehicle upload failed";
      setMessage(draftId?`Draft ${draftId} is preserved. ${reason}`:reason);
      setBusy(false);
    }
  }

  if(!ready)return <main className="wdccLoading">Checking secure dealer session…</main>;

  return <main className="vehicleScreen">
    <aside className="vehicleRail">
      <Link href="/dealer" className="railBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></Link>
      <nav>
        <Link href="/dealer">⌂ Dashboard</Link>
        <strong>INVENTORY</strong>
        <Link href="/dealer/inventory">All Vehicles</Link>
        <Link className="active" href="/dealer/inventory/new">＋ Add / Edit Vehicle</Link>
        <Link href="/dealer/inventory">Categories</Link>
        <Link href="/dealer/inventory">Import Vehicles</Link>
        <strong>OPERATIONS</strong>
        <Link href="/dealer/leads">Leads</Link>
        <Link href="/dealer/leads">Appointments</Link>
        <Link href="/dealer/leads">Test Drives</Link>
        <Link href="/dealer/leads">Customers</Link>
        <Link href="/dealer/leads">Applications</Link>
        <Link href="/dealer/leads">Messages</Link>
        <Link href="/dealer/inventory/logs">Reports</Link>
        <Link href="/dealer">Settings</Link>
      </nav>
    </aside>

    <section className="vehicleWorkspace">
      <header className="vehicleTop">
        <div className="topBrand"><img src="/wdcc-logo-transparent.webp" alt=""/><div><b>WDCC · DEALER PORTAL</b><span>Inventory Operations</span></div></div>
        <a className="phoneChip" href="tel:18135164752">☎ (813) 516-4752</a>
        <span className="manager">Sean · Sales Manager</span>
        <button className="signOut" onClick={()=>fetch("/api/auth/logout",{method:"POST",credentials:"include"}).finally(()=>location.href="/dealer")}>Sign Out</button>
      </header>

      <form className="editorGrid" onSubmit={submit}>
        <section className="editorMain">
          <div className="editorHead">
            <div><h1>Add / Edit Vehicle</h1><span>Step 3 of 5 · Photos</span></div>
            <div className="stepper">{["Info","Pricing","Photos","Details","Review"].map((label,i)=><div className={`step ${i<2?"done":i===2?"active":""}`} key={label}><b>{i+1}</b><span>{label}</span></div>)}</div>
          </div>

          <div className="listingSummary" aria-label="Current vehicle summary">
            <div><small>VEHICLE</small><b>{formState.year} {formState.make} {formState.model} {formState.trim}</b></div>
            <div><small>PRICE</small><b>{money(formState.price)}</b></div>
            <div><small>MILEAGE</small><b>{Number(formState.mileage||0).toLocaleString()} mi</b></div>
            <div><small>STOCK</small><b>{formState.stock}</b></div>
          </div>

          <section className="photoSection">
            <div className="sectionIntro"><div><h2>Vehicle Photos</h2><p>Add up to 10 photos. Select a thumbnail to make it primary.</p></div><span>{photos.length}/10</span></div>
            <div className="photoButtons">
              <button type="button" onClick={()=>cameraRef.current?.click()}><span className="toolIcon">▧</span><b>Take Photo</b><small>Use camera</small></button>
              <button type="button" onClick={()=>uploadRef.current?.click()}><span className="toolIcon">▣</span><b>Upload Files</b><small>Choose from device</small></button>
              <button type="button" onClick={()=>uploadRef.current?.click()}><span className="toolIcon">⇧</span><b>Drag & Drop</b><small>Drop images here</small></button>
            </div>
            <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={event=>addPhotos(Array.from(event.target.files||[]))}/>
            <input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/>
            <div className="dropZone" onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
              <div className="thumbGrid">
                {previews.map((url,index)=><div className={`thumb ${index===primary?"primary":""}`} key={url} onClick={()=>makePrimary(index)}>{index===primary&&<em>PRIMARY</em>}<img src={url} alt={`Vehicle photo ${index+1}`}/><button type="button" aria-label="Remove photo" onClick={e=>{e.stopPropagation();removePhoto(index)}}>×</button></div>)}
                {photos.length<10&&<button className="addPhoto" type="button" onClick={()=>uploadRef.current?.click()}>＋<span>Add Photo</span></button>}
              </div>
            </div>
          </section>

          <div className="hiddenFields" aria-hidden="true">
            <input name="year" value={formState.year} onChange={e=>setField("year",e.target.value)}/><input name="make" value={formState.make} onChange={e=>setField("make",e.target.value)}/><input name="model" value={formState.model} onChange={e=>setField("model",e.target.value)}/><input name="trim" value={formState.trim} onChange={e=>setField("trim",e.target.value)}/><input name="price" value={formState.price} onChange={e=>setField("price",e.target.value)}/><input name="downPayment" value={formState.downPayment} onChange={e=>setField("downPayment",e.target.value)}/><input name="mileage" value={formState.mileage} onChange={e=>setField("mileage",e.target.value)}/><input name="stock" value={formState.stock} onChange={e=>setField("stock",e.target.value)}/><textarea name="description" value={formState.description} onChange={e=>setField("description",e.target.value)}/>
          </div>

          <section className="readinessCard">
            <div className="readinessTop"><div><small>LISTING READINESS</small><strong>{readiness}% ready</strong></div><span className={readiness===100?"readyState":"workState"}>{readiness===100?"Ready to publish":"Needs attention"}</span></div>
            <div className="progress"><i style={{width:`${readiness}%`}}/></div>
            <ul><li><span>Vehicle information</span><b>✓</b></li><li><span>Pricing</span><b>✓</b></li><li><span>Primary photo</span><b>{photos.length?"✓":"—"}</b></li><li><span>Description</span><b>{formState.description?"✓":"—"}</b></li></ul>
          </section>

          {message&&<div className="statusMessage" role="status">{message}</div>}

          <div className="bottomActions">
            <button className="saveDraft" type="submit" name="intent" value="draft" disabled={busy}>Save Draft</button>
            <button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"Working…":"Publish Listing"}</button>
          </div>
        </section>

        <aside className="previewCard">
          <div className="previewTitle"><div><small>CUSTOMER VIEW</small><b>Listing Preview</b></div><span className={readiness===100?"previewReady":"previewDraft"}>{readiness===100?"READY":"DRAFT"}</span></div>
          <div className="previewHero"><img src={hero} alt="Vehicle preview"/><small>{photos.length?`1 / ${photos.length}`:"Add photos to preview"}</small></div>
          <div className="previewBody">
            <h2>{formState.year} {formState.make} {formState.model} {formState.trim}</h2>
            <div className="priceRow"><strong>{money(formState.price)}</strong><b>{money(formState.downPayment)} DOWN</b></div>
            <div className="specs"><span>{Number(formState.mileage||0).toLocaleString()} MILES</span><span>V6</span><span>AUTOMATIC</span><span>GASOLINE</span><span>RWD</span></div>
            <h4>Description</h4><p>{formState.description}</p>
            <div className="previewNote">This panel is a preview only. Customer CTAs are intentionally hidden while editing.</div>
          </div>
        </aside>
      </form>
    </section>

    <style jsx global>{`
      *{box-sizing:border-box}.wdccLoading{min-height:100svh;background:#07111c;color:#fff;display:grid;place-items:center;font:700 14px Inter,system-ui}.vehicleScreen{min-height:100svh;background:#eef1f4;color:#17202a;display:grid;grid-template-columns:210px minmax(0,1fr);font-family:Inter,system-ui,sans-serif}.vehicleRail{background:#071522;color:#c7d0d8;border-right:1px solid #183047;padding:16px 12px;min-height:100svh}.railBrand{display:flex;gap:10px;align-items:center;padding:2px 4px 18px;border-bottom:1px solid #183047}.railBrand img{width:58px;height:48px;object-fit:contain}.railBrand b,.railBrand span{display:block}.railBrand b{font-size:10px;color:#fff}.railBrand span{font-size:8px;color:#8191a0;margin-top:3px}.vehicleRail nav{display:grid;padding-top:12px}.vehicleRail nav strong{font-size:9px;letter-spacing:.1em;color:#7f92a4;padding:18px 10px 6px}.vehicleRail nav a{font-size:10px;padding:10px;border-radius:5px;color:#d4dce3;text-decoration:none}.vehicleRail nav a:hover{background:#0d2132;color:#fff}.vehicleRail nav a.active{background:#ef1f2f;color:#fff;font-weight:800}.vehicleWorkspace{min-width:0}.vehicleTop{height:72px;background:#06111c;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:18px;padding:0 24px;border-bottom:1px solid #203243}.topBrand{display:flex;align-items:center;gap:9px}.topBrand img{width:50px;height:42px;object-fit:contain}.topBrand b,.topBrand span{display:block}.topBrand b{font-size:11px}.topBrand span{font-size:8px;color:#8ea0af;margin-top:3px}.phoneChip{border:1px solid #9b7219;color:#f2cf72;border-radius:7px;padding:9px 14px;text-decoration:none;font-size:11px;font-weight:800}.manager{font-size:10px;color:#c6d0d8}.signOut{background:transparent;color:#fff;border:1px solid #53616c;border-radius:7px;padding:9px 13px;font-weight:700}.editorGrid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;padding:20px;align-items:start}.editorMain{background:#fff;border:1px solid #d8dee4;border-radius:12px;box-shadow:0 8px 24px rgba(9,22,34,.06);overflow:hidden}.editorHead{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 22px 16px;border-bottom:1px solid #e2e6ea}.editorHead h1{font-size:22px;margin:0}.editorHead>div:first-child>span{display:block;color:#6e7882;font-size:10px;margin-top:4px}.stepper{display:grid;grid-template-columns:repeat(5,62px);gap:8px;align-items:start}.step{position:relative;text-align:center;color:#7d8790}.step:before{content:"";position:absolute;top:11px;left:-18px;width:28px;border-top:1px solid #cdd3d8}.step:first-child:before{display:none}.step b{display:grid;place-items:center;margin:auto;width:23px;height:23px;border-radius:50%;border:1px solid #c5ccd2;background:#fff;font-size:9px}.step span{display:block;font-size:8px;margin-top:5px}.step.done b{background:#132433;border-color:#132433;color:#fff}.step.active{color:#e11d2e;font-weight:800}.step.active b{background:#e11d2e;border-color:#e11d2e;color:#fff}.listingSummary{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:1px;background:#e2e6ea;border-bottom:1px solid #e2e6ea}.listingSummary>div{background:#f8fafb;padding:12px 16px;min-width:0}.listingSummary small{display:block;color:#78828c;font-size:8px;letter-spacing:.08em}.listingSummary b{display:block;margin-top:4px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.photoSection{padding:22px}.sectionIntro{display:flex;align-items:end;justify-content:space-between;margin-bottom:14px}.sectionIntro h2{font-size:17px;margin:0}.sectionIntro p{font-size:10px;color:#6f7881;margin:4px 0 0}.sectionIntro>span{font-size:10px;color:#6d7780;background:#f1f4f6;border:1px solid #dce2e7;border-radius:999px;padding:4px 8px}.photoButtons{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.photoButtons button{min-height:62px;background:#fff;border:1px solid #ccd4da;border-radius:8px;color:#18212a;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:9px;align-items:center;text-align:left;padding:11px 13px;cursor:pointer}.photoButtons button:hover{border-color:#81909b;background:#f7f9fa}.toolIcon{grid-row:1/3;font-size:20px;color:#43515c}.photoButtons b{font-size:11px}.photoButtons small{font-size:8px;color:#7d8790}.dropZone{margin-top:14px;border:1px dashed #c7d0d6;background:#fafbfc;border-radius:9px;padding:12px}.thumbGrid{display:grid;grid-template-columns:repeat(5,minmax(76px,1fr));gap:9px}.thumb{position:relative;aspect-ratio:4/3;border:2px solid transparent;border-radius:7px;overflow:hidden;background:#dfe5e9;cursor:pointer}.thumb.primary{border-color:#d2a31b;box-shadow:0 0 0 2px rgba(210,163,27,.12)}.thumb img{width:100%;height:100%;object-fit:cover}.thumb em{position:absolute;z-index:2;left:5px;top:5px;background:#f1c92b;color:#191919;font-size:7px;font-weight:900;font-style:normal;padding:3px 5px;border-radius:3px}.thumb>button{position:absolute;right:4px;top:4px;width:20px;height:20px;border:0;border-radius:50%;background:#b91c1c;color:#fff;font-size:14px;line-height:18px}.addPhoto{aspect-ratio:4/3;border:1px dashed #b8c2ca;border-radius:7px;background:#fff;color:#55616b;display:grid;place-items:center;align-content:center;font-size:24px;cursor:pointer}.addPhoto span{font-size:9px;margin-top:3px}.hiddenFields{display:none}.readinessCard{border-top:1px solid #e1e6ea;padding:18px 22px;background:#fbfcfd}.readinessTop{display:flex;justify-content:space-between;align-items:center}.readinessTop small{display:block;font-size:8px;letter-spacing:.08em;color:#7a848d}.readinessTop strong{display:block;font-size:18px;margin-top:2px}.readyState,.workState{font-size:9px;font-weight:800;border-radius:999px;padding:5px 8px}.readyState{background:#e7f5ec;color:#19723e}.workState{background:#fff3dc;color:#9b6500}.progress{height:7px;background:#e3e8eb;border-radius:999px;overflow:hidden;margin:12px 0}.progress i{display:block;height:100%;background:#198754;border-radius:999px}.readinessCard ul{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0;margin:0;list-style:none}.readinessCard li{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;background:#fff;border:1px solid #e1e6ea;border-radius:6px;font-size:9px}.readinessCard li b{color:#198754}.statusMessage{margin:0 22px 16px;padding:10px 12px;background:#eef5fb;border:1px solid #c8ddec;color:#23475e;border-radius:7px;font-size:9px}.bottomActions{display:flex;justify-content:flex-end;gap:10px;padding:0 22px 22px}.bottomActions button{min-width:150px;border-radius:7px;padding:12px 18px;font-weight:900;font-size:11px}.saveDraft{background:#fff;border:1px solid #bcc6ce;color:#2a343d}.publish{background:#ed1c2e;border:1px solid #ed1c2e;color:#fff;box-shadow:0 6px 16px rgba(237,28,46,.18)}.bottomActions button:disabled{opacity:.55}.previewCard{background:#f7f9fa;border:1px solid #d8dee4;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(9,22,34,.06);position:sticky;top:90px}.previewTitle{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid #dce2e7;background:#fff}.previewTitle small,.previewTitle b{display:block}.previewTitle small{font-size:7px;letter-spacing:.1em;color:#7c8790}.previewTitle b{font-size:12px;margin-top:2px}.previewDraft,.previewReady{font-size:8px;font-weight:900;padding:5px 7px;border-radius:999px}.previewDraft{background:#eef1f3;color:#58636c}.previewReady{background:#e7f5ec;color:#19723e}.previewHero{position:relative;aspect-ratio:16/10;background:#06111c}.previewHero img{width:100%;height:100%;object-fit:cover}.previewHero small{position:absolute;right:9px;bottom:8px;background:rgba(0,0,0,.72);color:#fff;padding:4px 6px;border-radius:4px;font-size:8px}.previewBody{padding:16px}.previewBody h2{font-size:18px;line-height:1.15;margin:0 0 8px}.priceRow{display:flex;align-items:center;gap:9px}.priceRow strong{font-size:23px}.priceRow b{font-size:8px;background:#15222c;color:#fff;padding:5px 7px;border-radius:4px}.specs{display:flex;flex-wrap:wrap;gap:5px;margin:12px 0}.specs span{font-size:7px;background:#edf1f3;color:#55616a;padding:4px 6px;border-radius:4px}.previewBody h4{font-size:10px;margin:14px 0 5px}.previewBody p{font-size:9px;line-height:1.5;color:#4d5963}.previewNote{margin-top:14px;border-top:1px solid #dde3e7;padding-top:12px;color:#74808a;font-size:8px;line-height:1.4}.phoneChip,.vehicleRail a{transition:.15s ease}.signOut,.bottomActions button,.photoButtons button,.addPhoto,.thumb>button{cursor:pointer}
      @media(max-width:980px){.vehicleScreen{grid-template-columns:1fr}.vehicleRail{display:none}.vehicleTop{height:64px;grid-template-columns:minmax(0,1fr) auto}.topBrand img{width:44px}.manager,.signOut{display:none}.phoneChip{font-size:9px;padding:8px 10px}.editorGrid{grid-template-columns:1fr;padding:10px;gap:10px}.previewCard{position:static;top:auto}.editorHead{display:block;padding:16px}.editorHead>div:first-child{margin-bottom:14px}.stepper{grid-template-columns:repeat(5,1fr);gap:4px}.listingSummary{grid-template-columns:1fr 1fr}.photoSection{padding:16px}.photoButtons{grid-template-columns:1fr 1fr}.photoButtons button:last-child{grid-column:1/-1}.thumbGrid{grid-template-columns:repeat(3,1fr)}.readinessCard{padding:16px}.readinessCard ul{grid-template-columns:1fr 1fr}.bottomActions{position:sticky;bottom:0;z-index:5;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);padding:10px 16px;border-top:1px solid #dde3e7}.bottomActions button{min-width:0;flex:1}.previewBody h2{font-size:17px}}
      @media(max-width:560px){.topBrand span{display:none}.topBrand b{font-size:9px}.phoneChip{border-color:#5c6a75;color:#fff}.editorGrid{padding:0}.editorMain,.previewCard{border-radius:0;border-left:0;border-right:0;box-shadow:none}.editorHead h1{font-size:18px}.listingSummary{grid-template-columns:1fr 1fr}.listingSummary>div{padding:10px 12px}.photoButtons{grid-template-columns:1fr}.photoButtons button:last-child{grid-column:auto}.thumbGrid{grid-template-columns:repeat(2,1fr)}.readinessCard ul{grid-template-columns:1fr}.previewCard{margin-top:8px}.bottomActions{padding-bottom:max(10px,env(safe-area-inset-bottom))}}
    `}</style>
  </main>;
}
