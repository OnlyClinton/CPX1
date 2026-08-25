"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";
import {vehicleImageFor} from "../../../inventoryMedia";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const norm=(v:any)=>String(v??"").trim();
const money=(v:any)=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});

type Preview={year:string;make:string;model:string;trim:string;price:string;downPayment:string;mileage:string;stock:string;description:string;image:string};
const blankPreview:Preview={year:"",make:"",model:"",trim:"",price:"",downPayment:"",mileage:"",stock:"",description:"",image:"/vehicle-placeholder.svg"};

export default function NewVehicle(){
  const router=useRouter();
  const[ready,setReady]=useState(false);
  const[busy,setBusy]=useState(false);
  const[photos,setPhotos]=useState<File[]>([]);
  const[message,setMessage]=useState("");
  const[editId,setEditId]=useState("");
  const[initialVehicle,setInitialVehicle]=useState<any>(null);
  const[existingPhotoCount,setExistingPhotoCount]=useState(0);
  const[preview,setPreview]=useState<Preview>(blankPreview);

  useEffect(()=>{
    let cancelled=false;
    async function boot(){
      try{
        const auth=await fetch("/api/auth/session",{cache:"no-store"});
        const session=await auth.json();
        if(!session.authenticated){location.href="/dealer/login";return}
        const qs=new URLSearchParams(window.location.search);
        const id=qs.get("edit")||qs.get("clone")||"";
        if(id){
          setEditId(id);
          const response=await fetch(`/api/inventory/${encodeURIComponent(id)}?edit=${Date.now()}`,{cache:"no-store"});
          const json=await response.json().catch(()=>({}));
          if(!response.ok||!json?.item)throw new Error(json.error||"Vehicle could not be loaded for editing");
          const item=json.item;
          if(cancelled)return;
          setInitialVehicle(item);
          const count=Array.isArray(item.photoPathnames)?item.photoPathnames.length:0;
          setExistingPhotoCount(count);
          setPreview({year:String(item.year||""),make:norm(item.make),model:norm(item.model),trim:norm(item.trim),price:String(item.price||""),downPayment:String(item.downPayment??item.down_payment??""),mileage:String(item.mileage||""),stock:norm(item.stock||item.stock_id),description:norm(item.description),image:vehicleImageFor(item)});
        }
        if(!cancelled)setReady(true);
      }catch(error){
        if(cancelled)return;
        setMessage(error instanceof Error?error.message:"Vehicle editor could not be loaded");
        setReady(true);
      }
    }
    boot();
    return()=>{cancelled=true};
  },[]);

  function updatePreview(form:HTMLFormElement){
    const data=new FormData(form);
    setPreview(current=>({...current,year:norm(data.get("year")),make:norm(data.get("make")),model:norm(data.get("model")),trim:norm(data.get("trim")),price:norm(data.get("price")),downPayment:norm(data.get("downPayment")),mileage:norm(data.get("mileage")),stock:norm(data.get("stock")),description:norm(data.get("description"))}));
  }

  function addPhotos(files:File[]){
    const accepted=files.filter(file=>allowedTypes.has(file.type)&&file.size<=15*1024*1024);
    const rejected=files.length-accepted.length;
    setPhotos(current=>[...current,...accepted].slice(0,30));
    if(accepted[0])setPreview(current=>({...current,image:URL.createObjectURL(accepted[0])}));
    setMessage(rejected?`${rejected} file${rejected===1?" was":"s were"} skipped. Use JPG, PNG, WEBP or AVIF under 15 MB.`:"");
  }

  async function storefrontVisible(id:string){
    for(let attempt=0;attempt<4;attempt++){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
      const response=await fetch(`/api/inventory?verify=${Date.now()}-${attempt}`,{cache:"no-store"}).catch(()=>null);
      if(!response?.ok)continue;
      const json=await response.json().catch(()=>({}));
      const items=Array.isArray(json?.items)?json.items:Array.isArray(json?.inventory)?json.inventory:[];
      if(items.some((item:any)=>String(item?.id)===String(id)))return true;
    }
    return false;
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const intent=submitter?.value==="draft"?"draft":"published";
    const currentStatus=String(initialVehicle?.status||"draft").toLowerCase();
    const totalPhotos=existingPhotoCount+photos.length;
    if(intent==="published"&&currentStatus!=="published"&&totalPhotos===0){
      setMessage("Add at least one vehicle photo before publishing. You can save a draft without photos.");
      return;
    }

    setBusy(true);
    const requestId=crypto.randomUUID();
    let vehicleId=editId;
    try{
      const form=new FormData(event.currentTarget);
      const body={year:Number(form.get("year")),make:norm(form.get("make")),model:norm(form.get("model")),trim:norm(form.get("trim")),price:Number(form.get("price")),downPayment:Number(form.get("downPayment")||0),mileage:Number(form.get("mileage")||0),stock:norm(form.get("stock")),description:norm(form.get("description"))};
      const headers={"Content-Type":"application/json","X-WDCC-Request-ID":requestId};

      if(editId){
        setMessage(`Saving vehicle changes… Trace ${requestId}`);
        const updated=await fetch(`/api/inventory/${encodeURIComponent(editId)}`,{method:"PATCH",headers,body:JSON.stringify(body)});
        const updatedJson=await updated.json().catch(()=>({}));
        if(!updated.ok)throw new Error(updatedJson.error||"Vehicle changes could not be saved");
      }else{
        setMessage(`Saving a recoverable draft… Trace ${requestId}`);
        const created=await fetch("/api/inventory",{method:"POST",headers,body:JSON.stringify(body)});
        const createdJson=await created.json().catch(()=>({}));
        if(!created.ok||!createdJson?.item?.id)throw new Error(createdJson.error||"Vehicle draft could not be created");
        vehicleId=String(createdJson.item.id);
      }

      setMessage(`Vehicle saved. Verifying details… Trace ${requestId}`);
      const readback=await fetch(`/api/inventory/${encodeURIComponent(vehicleId)}?verify=${Date.now()}`,{cache:"no-store",headers:{"X-WDCC-Request-ID":requestId}});
      const readbackJson=await readback.json().catch(()=>({}));
      const saved=readbackJson?.item||{};
      if(!readback.ok||Number(saved.year)!==body.year||norm(saved.make)!==body.make||norm(saved.model)!==body.model||Number(saved.mileage||0)!==body.mileage||norm(saved.stock)!==body.stock)throw new Error("Readback did not match the vehicle you entered");

      const newPaths:string[]=[];
      for(let index=0;index<photos.length;index++){
        const file=photos[index];
        setMessage(`Vehicle verified. Uploading photo ${index+1} of ${photos.length}… Trace ${requestId}`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||`photo-${index+1}.jpg`;
        const blob=await upload(`media/wdcc/${vehicleId}/${safeName}`,file,{access:"private",handleUploadUrl:"/api/upload",clientPayload:JSON.stringify({vehicleId,requestId}),contentType:file.type});
        if(!blob?.pathname)throw new Error(`Photo ${index+1} did not return a stored path`);
        newPaths.push(blob.pathname);
        const checkpoint=await fetch(`/api/inventory/${encodeURIComponent(vehicleId)}`,{method:"PATCH",headers,body:JSON.stringify({photoPathnames:newPaths,primaryPhotoPathname:saved.primaryPhotoPathname||newPaths[0]})});
        const checkpointJson=await checkpoint.json().catch(()=>({}));
        if(!checkpoint.ok)throw new Error(checkpointJson.error||`Photo ${index+1} checkpoint failed`);
        const checkpointPaths=Array.isArray(checkpointJson?.item?.photoPathnames)?checkpointJson.item.photoPathnames:[];
        if(!checkpointPaths.includes(blob.pathname))throw new Error(`Photo ${index+1} was uploaded but not checkpointed to the vehicle`);
      }

      if(intent==="published"){
        if(currentStatus!=="published"){
          setMessage(`Photos verified. Publishing and checking the storefront… Trace ${requestId}`);
          const published=await fetch(`/api/inventory/${encodeURIComponent(vehicleId)}`,{method:"PATCH",headers,body:JSON.stringify({status:"published"})});
          const publishedJson=await published.json().catch(()=>({}));
          if(!published.ok)throw new Error(publishedJson.error||"Publish failed");
          if(String(publishedJson?.item?.status||"").toLowerCase()!=="published")throw new Error("Publish response did not confirm published status");
          if(publishedJson?.storefront&&publishedJson.storefront.visible!==true){
            const verification=publishedJson?.storefront?.verification||"not verified";
            setMessage(`Vehicle is safely PUBLISHED in dealer inventory, but storefront verification is ${verification}. Do not re-enter it. Trace ${requestId}. Check Vehicle Logs.`);
            setBusy(false);return;
          }
        }else{
          setMessage(`Live vehicle updated. Verifying storefront… Trace ${requestId}`);
          const visible=await storefrontVisible(vehicleId);
          if(!visible){setMessage(`Vehicle changes are saved, but storefront visibility could not be verified yet. Trace ${requestId}. Check Vehicle Logs before retrying.`);setBusy(false);return;}
        }
      }

      router.push(`/dealer/inventory?saved=${editId?"updated":intent}&trace=${encodeURIComponent(requestId)}`);
      router.refresh();
    }catch(error){
      const reason=error instanceof Error?error.message:"Vehicle save failed";
      setMessage(vehicleId?`Vehicle ${vehicleId} is preserved. ${reason}. Trace ${requestId}. Open Vehicle Logs before retrying.`:`${reason}. Trace ${requestId}.`);
      setBusy(false);
    }
  }

  if(!ready)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;
  const currentStatus=String(initialVehicle?.status||"draft").toLowerCase();
  const totalPhotos=existingPhotoCount+photos.length;
  const readiness=Math.round(([Number(preview.year)>1900,preview.make,preview.model,Number(preview.price)>0,Number(preview.mileage)>=0,preview.stock,Number(preview.downPayment)>=0,totalPhotos>0].filter(Boolean).length/8)*100);

  return <main className="dealerShell"><aside className="dealerSidebar"><div className="dealerLogo"><b>WDCC</b><span>DEALER COMMAND</span></div><div className="dealerMenuLabel">INVENTORY</div><nav className="dealerMenu"><Link href="/dealer">Dashboard</Link><Link href="/dealer/inventory">All Vehicles</Link><Link className="active" href="/dealer/inventory/new">+ Add Vehicle</Link><Link href="/dealer/inventory/logs">Vehicle Logs</Link><Link href="/dealer/leads">Leads</Link><Link href="/">View Website</Link></nav></aside>
    <section className="dealerMain"><form className="vehicleWizard" onSubmit={submit} onInput={event=>updatePreview(event.currentTarget)}>
      <div className="wizardHeader"><div className="eyebrow">{editId?"EDIT INVENTORY":"NEW INVENTORY"}</div><h1>{editId?"Edit Vehicle":"Add Vehicle"}</h1><p className="muted">{editId?"Changes are saved to this vehicle record. Existing media and status are preserved unless you explicitly change them.":"A draft is saved and read back first. Every photo is checkpointed before publish."}</p><div className="wizardSteps" aria-label="Listing steps"><div className="wizardStep done"><b>1</b>Info</div><div className="wizardStep done"><b>2</b>Pricing</div><div className="wizardStep active"><b>3</b>Photos</div><div className="wizardStep"><b>4</b>Verify</div><div className="wizardStep"><b>5</b>Publish</div></div></div>
      <div className="vehicleFormPanel"><h2>Vehicle Information</h2><p className="help">Year, make, model and mileage are the primary identity fields. Stock number is the internal cross-check.</p><div className="vehicleFormGrid">
        <div className="vehicleField"><label>Year</label><input name="year" type="number" min="1901" max={new Date().getFullYear()+1} defaultValue={initialVehicle?.year||""} placeholder="2020" required/></div>
        <div className="vehicleField"><label>Make</label><input name="make" maxLength={80} defaultValue={initialVehicle?.make||""} placeholder="Dodge" required/></div>
        <div className="vehicleField"><label>Model</label><input name="model" maxLength={80} defaultValue={initialVehicle?.model||""} placeholder="Challenger" required/></div>
        <div className="vehicleField"><label>Trim</label><input name="trim" maxLength={80} defaultValue={initialVehicle?.trim||""} placeholder="SXT"/></div>
        <div className="vehicleField"><label>Cash Price</label><input name="price" type="number" min="1" max="10000000" defaultValue={initialVehicle?.price||""} placeholder="24995" required/></div>
        <div className="vehicleField"><label>Estimated Down Payment</label><input name="downPayment" type="number" min="0" defaultValue={initialVehicle?.downPayment??initialVehicle?.down_payment??""} placeholder="2000"/></div>
        <div className="vehicleField"><label>Mileage</label><input name="mileage" type="number" min="0" max="2000000" defaultValue={initialVehicle?.mileage||""} placeholder="62500" required/></div>
        <div className="vehicleField"><label>Stock #</label><input name="stock" maxLength={80} defaultValue={initialVehicle?.stock||initialVehicle?.stock_id||""} placeholder="WDCC-1024"/></div>
        <div className="vehicleField wide"><label>Description</label><textarea name="description" maxLength={3000} defaultValue={initialVehicle?.description||""} placeholder="Condition, equipment, key features and anything the customer should know."/></div>
        <div className="vehicleField wide"><label>Vehicle Photos</label><div className="photoTools"><label className="photoTool">TAKE PHOTO<input hidden type="file" accept="image/*" capture="environment" onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></label><label className="photoTool">UPLOAD FILES<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></label><div className="photoTool">{totalPhotos?`${totalPhotos} PHOTO${totalPhotos===1?"":"S"} READY`:"NO PHOTOS YET"}</div></div><label className="photoDrop"><div><b>Select vehicle photos</b><p>JPG, PNG, WEBP or AVIF · up to 15 MB each · existing photos are preserved.</p><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></div></label>{photos.length>0&&<div className="photoList">{photos.map((photo,index)=><span key={`${photo.name}-${index}`}>{index+1}. {photo.name}</span>)}</div>}</div>
      </div>
      <div className="readiness"><div className="readinessTop"><span>LISTING READINESS</span><span>{readiness}%</span></div><div className="readinessTrack"><span style={{width:`${readiness}%`}}/></div><div className="muted">Vehicle info {preview.year&&preview.make&&preview.model?"✓":"—"} · Pricing {Number(preview.price)>0?"✓":"—"} · {totalPhotos?"Photos ready ✓":"Photos required to publish"} · Server readback required ✓</div></div>
      {message&&<div className="dealerMessage" role="status" aria-live="polite">{message}</div>}
      <div className="wizardActions"><button type="button" disabled={busy} onClick={()=>router.push("/dealer/inventory")}>CANCEL</button><Link href="/dealer/inventory/logs">VEHICLE LOGS</Link><button type="submit" name="intent" value="draft" disabled={busy}>{editId?"SAVE CHANGES":"SAVE DRAFT"}</button><button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"VERIFYING…":currentStatus==="published"?"UPDATE LIVE VEHICLE":"PUBLISH VEHICLE"}</button></div></div>
      <aside className="vehiclePreviewPane" aria-label="Vehicle listing preview"><div className="previewLabel">LIVE LISTING PREVIEW</div><img src={preview.image||"/vehicle-placeholder.svg"} onError={event=>{event.currentTarget.src="/vehicle-placeholder.svg"}} alt="Vehicle preview"/><div className="previewBody"><small>{preview.stock||"STOCK #"}</small><h2>{preview.year||"YEAR"} {preview.make||"MAKE"}<br/><b>{preview.model||"MODEL"}{preview.trim?` ${preview.trim}`:""}</b></h2><div className="previewPrice">{Number(preview.price)>0?money(preview.price):"PRICE"}</div><div className="previewDown">{Number(preview.downPayment)>=0&&preview.downPayment!==""?`${money(preview.downPayment)} DOWN`:"DOWN PAYMENT"}</div><div className="previewFacts">{preview.mileage?`${Number(preview.mileage).toLocaleString()} MILES`:"MILEAGE"}</div><p>{preview.description||"Vehicle description will appear here as you type."}</p><div className="previewCtas"><span>SCHEDULE TEST DRIVE</span><span>CALL SEAN</span></div></div></aside>
    </form></section></main>;
}
