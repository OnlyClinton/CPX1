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
    const saved=new URLSearchParams(location.search).get("saved");
    if(saved)setMessage(saved==="published"?"Vehicle published and visible to customers.":"Draft saved. You can finish it safely later.");
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
      setMessage(status==="published"?"Vehicle published.":"Vehicle archived and retained for recovery.");
      await loadInventory();
    }else setMessage(json.error||"Vehicle could not be updated");
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
          <span>＋</span><div><strong>CLICK HERE TO ADD A NEW VEHICLE</strong><small>Enter the details, upload photos, review, and publish.</small></div>
        </Link>

        {message&&<div className="dealerMessage" role="status" aria-live="polite">{message}</div>}
        <div className="dealerStats">
          <div className="dealerStat"><small>Active Vehicles</small><strong>{active.length}</strong></div>
          <div className="dealerStat"><small>Published</small><strong>{published}</strong></div>
          <div className="dealerStat"><small>Drafts</small><strong>{drafts}</strong></div>
          <div className="dealerStat"><small>Photos Ready</small><strong>{active.filter(vehicle=>vehicle.primaryPhotoPathname).length}</strong></div>
        </div>

        <div className="dealerPanel">
          {items.length?items.map(vehicle=>(
            <div className="dealerRowR39" key={vehicle.id}>
              <div>
                <strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong>
                <div className="muted">${Number(vehicle.price||0).toLocaleString()} · {Number(vehicle.mileage||0).toLocaleString()} mi{vehicle.stock?` · Stock ${vehicle.stock}`:""}</div>
              </div>
              <span className={`dealerStatus ${vehicle.status||"published"}`}>{vehicle.status||"published"}</span>
              <div className="dealerRowActions">
                <Link href={`/vehicle/${vehicle.id}`}>View</Link>
                {vehicle.status==="draft"&&<button disabled={busyId===vehicle.id} onClick={()=>setStatus(vehicle.id,"published")}>Publish</button>}
                {vehicle.status!=="archived"&&<button disabled={busyId===vehicle.id} onClick={()=>setStatus(vehicle.id,"archived")}>Archive</button>}
              </div>
            </div>
          )):(
            <div><h3>No inventory yet.</h3><p className="muted">Use the large button above to add the first WDCC vehicle.</p></div>
          )}
        </div>
      </section>
    </main>
  );
}
