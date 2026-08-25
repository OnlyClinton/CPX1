"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {uploadPresigned} from "@vercel/blob/client";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
const norm=(v:any)=>String(v??"").trim();

export default function NewVehicle(){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [photos,setPhotos]=useState<File[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    fetch("/api/auth/session",{cache:"no-store"})
      .then(response=>response.json())
      .then(session=>{
        if(!session.authenticated)location.href="/dealer/login";
        else setReady(true);
      })
      .catch(()=>location.href="/dealer/login");
  },[]);

  function addPhotos(files:File[]){
    const accepted=files.filter(file=>allowedTypes.has(file.type)&&file.size<=15*1024*1024);
    const rejected=files.length-accepted.length;
    setPhotos(current=>[...current,...accepted].slice(0,30));
    setMessage(rejected?`${rejected} file${rejected===1?" was":"s were"} skipped. Use JPG, PNG, WEBP or AVIF under 15 MB.`:"");
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const intent=submitter?.value==="draft"?"draft":"published";
    if(intent==="published"&&photos.length===0){
      setMessage("Add at least one vehicle photo before publishing. You can save a draft without photos.");
      return;
    }

    setBusy(true);
    const requestId=crypto.randomUUID();
    setMessage(`Saving a recoverable draft… Trace ${requestId}`);
    let draftId="";

    try{
      const form=new FormData(event.currentTarget);
      const body={
        year:Number(form.get("year")),
        make:norm(form.get("make")),
        model:norm(form.get("model")),
        trim:norm(form.get("trim")),
        price:Number(form.get("price")),
        downPayment:Number(form.get("downPayment")||0),
        mileage:Number(form.get("mileage")||0),
        stock:norm(form.get("stock")),
        description:norm(form.get("description"))
      };
      const headers={"Content-Type":"application/json","X-WDCC-Request-ID":requestId};

      const created=await fetch("/api/inventory",{method:"POST",headers,body:JSON.stringify(body)});
      const createdJson=await created.json().catch(()=>({}));
      if(!created.ok||!createdJson?.item?.id)throw new Error(createdJson.error||"Vehicle draft could not be created");
      draftId=String(createdJson.item.id);

      setMessage(`Draft saved. Verifying vehicle details… Trace ${requestId}`);
      const readback=await fetch(`/api/inventory/${encodeURIComponent(draftId)}?verify=${Date.now()}`,{cache:"no-store",headers:{"X-WDCC-Request-ID":requestId}});
      const readbackJson=await readback.json().catch(()=>({}));
      const saved=readbackJson?.item||{};
      if(!readback.ok||Number(saved.year)!==body.year||norm(saved.make)!==body.make||norm(saved.model)!==body.model||Number(saved.mileage||0)!==body.mileage||norm(saved.stock)!==body.stock||String(saved.status||"").toLowerCase()!=="draft"){
        throw new Error("Draft readback did not match the vehicle you entered");
      }

      const paths:string[]=[];
      for(let index=0;index<photos.length;index++){
        const file=photos[index];
        setMessage(`Draft verified. Uploading photo ${index+1} of ${photos.length}… Trace ${requestId}`);
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||`photo-${index+1}.jpg`;
        const blob=await uploadPresigned(`media/wdcc/${draftId}/${safeName}`,file,{
          access:"private",
          handleUploadUrl:"/api/upload"
        });
        if(!blob?.pathname)throw new Error(`Photo ${index+1} did not return a stored path`);
        paths.push(blob.pathname);

        const checkpoint=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{
          method:"PATCH",headers,body:JSON.stringify({photoPathnames:paths,primaryPhotoPathname:paths[0]})
        });
        const checkpointJson=await checkpoint.json().catch(()=>({}));
        if(!checkpoint.ok)throw new Error(checkpointJson.error||`Photo ${index+1} checkpoint failed`);
        const checkpointPaths=Array.isArray(checkpointJson?.item?.photoPathnames)?checkpointJson.item.photoPathnames:[];
        if(!checkpointPaths.includes(blob.pathname))throw new Error(`Photo ${index+1} was uploaded but not checkpointed to the vehicle`);
      }

      if(intent==="published"){
        setMessage(`Photos verified. Publishing and checking the storefront… Trace ${requestId}`);
        const published=await fetch(`/api/inventory/${encodeURIComponent(draftId)}`,{
          method:"PATCH",headers,body:JSON.stringify({status:"published"})
        });
        const publishedJson=await published.json().catch(()=>({}));
        if(!published.ok)throw new Error(publishedJson.error||"Publish failed");
        if(String(publishedJson?.item?.status||"").toLowerCase()!=="published")throw new Error("Publish response did not confirm published status");
        if(publishedJson?.storefront?.visible!==true){
          const verification=publishedJson?.storefront?.verification||"not verified";
          setMessage(`Vehicle is safely PUBLISHED in dealer inventory, but storefront verification is ${verification}. Do not re-enter it. Trace ${requestId}. Check Vehicle Logs.`);
          setBusy(false);
          return;
        }
        setMessage(`Published and verified on the storefront. Trace ${requestId}`);
      }else{
        setMessage(`Draft saved and verified. Trace ${requestId}`);
      }

      router.push(`/dealer/inventory?saved=${intent}&trace=${encodeURIComponent(requestId)}`);
      router.refresh();
    }catch(error){
      const reason=error instanceof Error?error.message:"Vehicle upload failed";
      setMessage(draftId?`The vehicle is safe as draft ${draftId}. ${reason}. Trace ${requestId}. Open Vehicle Logs before retrying.`:`${reason}. Trace ${requestId}.`);
      setBusy(false);
    }
  }

  if(!ready)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;

  return (
    <main className="dealerShell">
      <aside className="dealerSidebar">
        <div className="dealerLogo"><b>WDCC</b><span>DEALER COMMAND</span></div>
        <div className="dealerMenuLabel">INVENTORY</div>
        <nav className="dealerMenu">
          <Link href="/dealer">Dashboard</Link>
          <Link href="/dealer/inventory">All Vehicles</Link>
          <Link className="active" href="/dealer/inventory/new">+ Add Vehicle</Link>
          <Link href="/dealer/inventory/logs">Vehicle Logs</Link>
          <Link href="/dealer/leads">Leads</Link>
          <Link href="/">View Website</Link>
        </nav>
      </aside>

      <section className="dealerMain">
        <form className="vehicleWizard" onSubmit={submit}>
          <div className="wizardHeader">
            <div className="eyebrow">NEW INVENTORY</div>
            <h1>Add a Vehicle</h1>
            <p className="muted">A draft is saved and read back first. Every photo is checkpointed. Publish is not reported as complete until storefront verification succeeds.</p>
            <div className="wizardSteps" aria-label="Listing steps">
              <div className="wizardStep done"><b>1</b>Info</div><div className="wizardStep done"><b>2</b>Pricing</div><div className="wizardStep active"><b>3</b>Photos</div><div className="wizardStep"><b>4</b>Verify</div><div className="wizardStep"><b>5</b>Publish</div>
            </div>
          </div>

          <div className="vehicleFormPanel">
            <h2>Vehicle Information</h2>
            <p className="help">Year, make, model and mileage are the primary identity fields. Stock number is the internal cross-check.</p>
            <div className="vehicleFormGrid">
              <div className="vehicleField"><label>Year</label><input name="year" type="number" min="1901" max={new Date().getFullYear()+1} placeholder="2020" required/></div>
              <div className="vehicleField"><label>Make</label><input name="make" maxLength={80} placeholder="Dodge" required/></div>
              <div className="vehicleField"><label>Model</label><input name="model" maxLength={80} placeholder="Challenger" required/></div>
              <div className="vehicleField"><label>Trim</label><input name="trim" maxLength={80} placeholder="SXT"/></div>
              <div className="vehicleField"><label>Cash Price</label><input name="price" type="number" min="1" max="10000000" placeholder="24995" required/></div>
              <div className="vehicleField"><label>Estimated Down Payment</label><input name="downPayment" type="number" min="0" placeholder="2000"/></div>
              <div className="vehicleField"><label>Mileage</label><input name="mileage" type="number" min="0" max="2000000" placeholder="62500" required/></div>
              <div className="vehicleField"><label>Stock #</label><input name="stock" maxLength={80} placeholder="WDCC-1024"/></div>
              <div className="vehicleField wide"><label>Description</label><textarea name="description" maxLength={3000} placeholder="Condition, equipment, key features and anything the customer should know."/></div>
              <div className="vehicleField wide"><label>Vehicle Photos</label><div className="photoTools"><label className="photoTool">TAKE PHOTO<input hidden type="file" accept="image/*" capture="environment" onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></label><label className="photoTool">UPLOAD FILES<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></label><div className="photoTool">{photos.length?`${photos.length} PHOTO${photos.length===1?"":"S"} READY`:"NO PHOTOS YET"}</div></div><label className="photoDrop"><div><b>Select vehicle photos</b><p>JPG, PNG, WEBP or AVIF · up to 15 MB each · first image is primary.</p><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={event=>addPhotos(Array.from(event.target.files||[]))}/></div></label>{photos.length>0&&<div className="photoList">{photos.map((photo,index)=><span key={`${photo.name}-${index}`}>{index+1}. {photo.name}</span>)}</div>}</div>
            </div>

            <div className="readiness"><div className="readinessTop"><span>LISTING READINESS</span><span>{photos.length?"100%":"70%"}</span></div><div className="readinessTrack"><span style={{width:photos.length?"100%":"70%"}}/></div><div className="muted">Vehicle info ✓ · Pricing ✓ · {photos.length?"Photos ready ✓":"Photos required to publish"} · Server readback required ✓</div></div>
            {message&&<div className="dealerMessage" role="status" aria-live="polite">{message}</div>}
            <div className="wizardActions"><button type="button" disabled={busy} onClick={()=>router.push("/dealer/inventory")}>CANCEL</button><Link href="/dealer/inventory/logs">VEHICLE LOGS</Link><button type="submit" name="intent" value="draft" disabled={busy}>SAVE DRAFT</button><button className="publish" type="submit" name="intent" value="published" disabled={busy}>{busy?"VERIFYING…":"PUBLISH VEHICLE"}</button></div>
          </div>
        </form>
      </section>
    </main>
  );
}
