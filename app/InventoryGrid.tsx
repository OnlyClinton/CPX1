"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import WdccVehicleCard,{type WdccVehicle} from "./WdccVehicleCard";
import {isWdccVisualReviewFixture,WDCC_VISUAL_REVIEW_INVENTORY,WDCC_VISUAL_REVIEW_LABEL} from "./wdccVisualReviewInventory";

type InventoryState="loading"|"ready"|"empty"|"error";
type Vehicle=WdccVehicle&{status?:string;stock?:string;stock_id?:string;badges?:string[];visibility?:string;internalOnly?:boolean};

function customerVisible(v:Vehicle){
  const status=String(v?.status||"").toLowerCase();
  const stock=String(v?.stock||v?.stock_id||"").trim().toUpperCase();
  const visibility=String(v?.visibility||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map(x=>String(x||"").toUpperCase());
  const qa=/^(R36TEST|WDCC[-_]QA|QA|TEST)[-_]/.test(stock)||badges.some(b=>b==="R36-TEST"||b==="QA"||b==="TEST"||b.includes("CERTIFICATION"));
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!qa&&v?.internalOnly!==true&&visibility!=="internal"&&visibility!=="dealer_only";
}

export default function InventoryGrid(){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[state,setState]=useState<InventoryState>("loading");
  const[fixtureMode,setFixtureMode]=useState(false);
  const[recoveryMode,setRecoveryMode]=useState(false);

  useEffect(()=>{
    let live=true;
    if(isWdccVisualReviewFixture()){
      setFixtureMode(true);
      setRecoveryMode(false);
      setItems(WDCC_VISUAL_REVIEW_INVENTORY as Vehicle[]);
      setState("ready");
      return()=>{live=false};
    }
    fetch("/api/inventory",{cache:"no-store"})
      .then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.error||`Inventory ${r.status}`);return body})
      .then(body=>{
        if(!live)return;
        const visualFixture=body?.previewFallback===true||body?.inventorySource==="last-known-good-real-proof";
        const recovery=body?.recoveryFallback===true||body?.inventorySource==="verified-recovery-readonly"||body?.live===false;
        const source=Array.isArray(body?.items)?body.items:Array.isArray(body?.inventory)?body.inventory:[];
        const vehicles=source.filter(customerVisible);
        setFixtureMode(visualFixture);
        setRecoveryMode(!visualFixture&&recovery);
        setItems(vehicles);
        setState(vehicles.length?"ready":"empty");
      })
      .catch(()=>{if(live){setItems([]);setFixtureMode(false);setRecoveryMode(false);setState("error")}});
    return()=>{live=false};
  },[]);

  if(state==="loading")return <div className="inventoryGrid wdccVehicleGrid" aria-label="Loading current inventory">{[1,2,3].map(i=><div className="wdccVehicleSkeleton" key={i}><div/><span>Loading current vehicle…</span></div>)}</div>;
  if(state==="error")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is temporarily unavailable.</h3><p>Call Sean at <a href="tel:+18135164752">813-516-4752</a> for current availability.</p><div className="actions"><Link className="cta red" href="/get-approved?source=inventory-provider-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN</a></div></div></div>;
  if(state==="empty")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is being updated.</h3><p>There are no customer-visible published vehicles to show right now. Call or text Sean for vehicles being prepared.</p><a className="cta red" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></div>;

  return <>
    {fixtureMode&&<div className="wdccOwnerReviewBanner" role="status">{WDCC_VISUAL_REVIEW_LABEL}</div>}
    {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>VERIFIED RECOVERY INVENTORY</strong><span>Provider sync is temporarily unavailable. Confirm current availability with Sean · 813-516-4752.</span></div>}
    <div className="inventoryGrid wdccVehicleGrid">{items.map(v=><WdccVehicleCard key={String(v.id||v.slug)} vehicle={v}/>)}</div>
  </>;
}
