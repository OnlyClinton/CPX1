"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

export default function Dealer(){
  const [session,setSession]=useState<any>();
  const [items,setItems]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const [busyId,setBusyId]=useState("");

  async function loadInventory(){
    const response=await fetch("/api/inventory",{cache:"no-store"});
    const json=await response.json();
    if(response.ok)setItems(json.items||[]);
    else setMessage(json.error||"Inventory could not be loaded");
  }

  useEffect(()=>{
    fetch("/api/auth/session",{cache:"no-store"})
      .then(response=>response.json())
      .then(value=>{
        setSession(value);
        if(!value.authenticated)location.href="/dealer/login";
        else return loadInventory();
      })
      .catch(()=>location.href="/dealer/login");
    const params=new URLSearchParams(location.search);
    const saved=params.get("saved");
    const visibility=params.get("visibility");
    if(saved)setMessage(saved==="published"?
      (visibility==="internal"?"Vehicle published for internal use only. It is blocked from the customer website.":"Vehicle published and visible to customers."):
      "Draft saved. You can finish it safely later.");
  },[]);

  async function setStatus(id:string,status:"published"|"archived"){
    if(status==="archived"&&!confirm("Archive this vehicle? It will disappear from the customer site but remain recoverable."))return;
    setBusyId(id);
    setMessage("");
    const response=await fetch(`/api/inventory/${id}`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})
    });
    const json=await response.json().catch(()=>({}));
    if(response.ok){
      const internal=String(json.item?.visibility||"public")==="internal"||json.item?.internalOnly===true;
      setMessage(status==="published"?
        (internal?"Vehicle published internally and remains hidden from customers.":"Vehicle published to the customer site."):
        "Vehicle archived and retained for recovery.");
      await loadInventory();
    }else setMessage(json.error||"Vehicle could not be updated");
    setBusyId("");
  }

  async function setVisibility(id:string,visibility:"public"|"internal"){
    if(visibility==="public"&&!confirm("Make this vehicle eligible for the public customer site when published?"))return;
    setBusyId(id);
    setMessage("");
    const response=await fetch(`/api/inventory/${id}`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({visibility})
    });
    const json=await response.json().catch(()=>({}));
    if(response.ok){
      setMessage(visibility==="internal"?"Vehicle is now Internal Only and blocked from the public site.":"Vehicle is now eligible for the public site when published.");
      await loadInventory();
    }else setMessage(json.error||"Vehicle visibility could not be updated");
    setBusyId("");
  }

  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    location.href="/dealer/login";
  }

  if(!session?.authenticated)return <main className="portal"><div className="wrap">Checking secure session…</div></main>;

  const active=items.filter(vehicle=>vehicle.status!=="archived");
  const published=active.filter(vehicle=>vehicle.status==="published").length;
  const drafts=active.filter(vehicle=>vehicle.status==="draft").length;
  const internal=active.filter(vehicle=>String(vehicle.visibility||"public")==="internal"||vehicle.internalOnly===true).length;

  return (
    <main className="dealerShell">
      <aside className="dealerSidebar">
        <div className="dealerLogo"><b>WDCC</b><span>DEALER COMMAND</span></div>
        <div className="dealerMenuLabel">INVENTORY</div>
        <nav className="dealerMenu">
          <Link className="active" href="/dealer">Dashboard</Link>
          <Link href="/dealer/inventory">All Vehicles</Link>
          <Link href="/dealer/inventory/new">+ Add Vehicle</Link>
          <Link href="/dealer/leads">Leads</Link>
          <Link href="/">View Website</Link>
          <button type="button" onClick={logout}>Log Out</button>
        </nav>
      </aside>

      <section className="dealerMain">
        <div className="dealerTop">
          <div><div className="eyebrow">WDCC DEALER PORTAL</div><h1>Inventory Command</h1></div>
        </div>

        <Link className="dealerPrimaryAction" href="/dealer/inventory/new">
          <span>＋</span><div><strong>CLICK HERE TO ADD A NEW VEHICLE</strong><small>Enter details, upload photos, choose public or Internal Only, review, and publish.</small></div>
        </Link>

        {message&&<div className="dealerMessage" role="status" aria-live="polite">{message}</div>}
        <div className="dealerStats">
          <div className="dealerStat"><small>Active Vehicles</small><strong>{active.length}</strong></div>
          <div className="dealerStat"><small>Published</small><strong>{published}</strong></div>
          <div className="dealerStat"><small>Drafts</small><strong>{drafts}</strong></div>
          <div className="dealerStat"><small>Internal Only</small><strong>{internal}</strong></div>
        </div>

        <div className="dealerPanel">
          {items.length?items.map(vehicle=>{
            const isInternal=String(vehicle.visibility||"public")==="internal"||vehicle.internalOnly===true;
            return (
              <div className="dealerRowR39" key={vehicle.id}>
                <div>
                  <strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong>
                  <div className="muted">${Number(vehicle.price||0).toLocaleString()} · {Number(vehicle.mileage||0).toLocaleString()} mi{vehicle.stock?` · Stock ${vehicle.stock}`:""}</div>
                  {isInternal&&<div className="muted"><strong>INTERNAL ONLY — never shown to customers</strong></div>}
                </div>
                <span className={`dealerStatus ${vehicle.status||"published"}`}>{vehicle.status||"published"}{isInternal?" · internal":" · public"}</span>
                <div className="dealerRowActions">
                  <Link href={`/vehicle/${vehicle.id}`}>View</Link>
                  {vehicle.status==="draft"&&<button disabled={busyId===vehicle.id} onClick={()=>setStatus(vehicle.id,"published")}>Publish</button>}
                  {isInternal?
                    <button disabled={busyId===vehicle.id} onClick={()=>setVisibility(vehicle.id,"public")}>Make Public</button>:
                    <button disabled={busyId===vehicle.id} onClick={()=>setVisibility(vehicle.id,"internal")}>Internal Only</button>}
                  {vehicle.status!=="archived"&&<button disabled={busyId===vehicle.id} onClick={()=>setStatus(vehicle.id,"archived")}>Archive</button>}
                </div>
              </div>
            );
          }):(
            <div><h3>No inventory yet.</h3><p className="muted">Use the large button above to add the first WDCC vehicle.</p></div>
          )}
        </div>
      </section>
    </main>
  );
}
