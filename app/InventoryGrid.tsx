"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {loadPublicInventory} from "../lib/publicInventoryClient";
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

export default function InventoryGrid({allowVisualFixture=false}:{allowVisualFixture?:boolean}){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[state,setState]=useState<InventoryState>("loading");
  const[fixtureMode,setFixtureMode]=useState(false);
  const[designMode,setDesignMode]=useState(false);
  const[recoveryMode,setRecoveryMode]=useState(false);
  const[query,setQuery]=useState("");
  const[make,setMake]=useState("all");
  const[maxPrice,setMaxPrice]=useState("all");
  const[sort,setSort]=useState("featured");

  useEffect(()=>{
    let live=true;
    if(isWdccVisualReviewFixture(allowVisualFixture)){
      setFixtureMode(true);
      setDesignMode(false);
      setRecoveryMode(false);
      setItems(WDCC_VISUAL_REVIEW_INVENTORY as Vehicle[]);
      setState("ready");
      return()=>{live=false};
    }
    loadPublicInventory()
      .then(body=>{
        if(!live)return;
        const designPreview=body?.mockupPreview===true||body?.inventorySource==="r31-r25-design-reference";
        const visualFixture=body?.previewFallback===true||body?.inventorySource==="last-known-good-real-proof";
        const recovery=body?.recoveryFallback===true||body?.inventorySource==="verified-recovery-readonly"||(body?.live===false&&!designPreview);
        const source=Array.isArray(body?.items)?body.items:Array.isArray(body?.inventory)?body.inventory:[];
        const vehicles=source.filter(customerVisible);
        setFixtureMode(visualFixture);
        setDesignMode(designPreview);
        setRecoveryMode(!visualFixture&&!designPreview&&recovery);
        setItems(vehicles);
        setState(vehicles.length?"ready":"empty");
      })
      .catch(()=>{if(live){setItems([]);setFixtureMode(false);setDesignMode(false);setRecoveryMode(false);setState("error")}});
    return()=>{live=false};
  },[allowVisualFixture]);

  const makes=useMemo(()=>Array.from(new Set(items.map(v=>String(v.make||"").trim()).filter(Boolean))).sort(),[items]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const ceiling=maxPrice==="all"?Infinity:Number(maxPrice);
    const list=items.filter(v=>{
      const hay=`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""}`.toLowerCase();
      return(!q||hay.includes(q))&&(make==="all"||String(v.make||"")===make)&&Number(v.price||v.cashPrice||0)<=ceiling;
    });
    const next=[...list];
    if(sort==="price-asc")next.sort((a,b)=>Number(a.price||a.cashPrice||0)-Number(b.price||b.cashPrice||0));
    if(sort==="price-desc")next.sort((a,b)=>Number(b.price||b.cashPrice||0)-Number(a.price||a.cashPrice||0));
    if(sort==="year-desc")next.sort((a,b)=>Number(b.year||0)-Number(a.year||0));
    return next;
  },[items,query,make,maxPrice,sort]);

  if(state==="loading")return <div className="inventoryGrid wdccVehicleGrid" aria-label="Loading current inventory">{[1,2,3].map(i=><div className="wdccVehicleSkeleton" key={i}><div/><span>Loading current vehicle…</span></div>)}</div>;
  if(state==="error")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is temporarily unavailable.</h3><p>Call Sean at <a href="tel:+18135164752">813-516-4752</a> for current availability.</p><div className="actions"><Link className="cta red" href="/get-approved?source=inventory-provider-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN</a></div></div></div>;
  if(state==="empty")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is being updated.</h3><p>There are no customer-visible published vehicles to show right now. Call or text Sean for vehicles being prepared.</p><a className="cta red" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></div>;

  return <>
    {fixtureMode&&<div className="wdccOwnerReviewBanner" role="status">{WDCC_VISUAL_REVIEW_LABEL}</div>}
    {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>VERIFIED RECOVERY INVENTORY</strong><span>Provider sync is temporarily unavailable. Confirm current availability with Sean · 813-516-4752.</span></div>}
    <div className="publicInventoryControls" aria-label="Filter inventory">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search make, model or year" aria-label="Search inventory"/>
      <select value={make} onChange={e=>setMake(e.target.value)} aria-label="Filter by make"><option value="all">All Makes</option>{makes.map(m=><option key={m} value={m}>{m}</option>)}</select>
      <select value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} aria-label="Maximum price"><option value="all">Max Price</option><option value="10000">$10,000</option><option value="15000">$15,000</option><option value="20000">$20,000</option><option value="25000">$25,000</option><option value="30000">$30,000</option></select>
      <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort inventory"><option value="featured">Featured</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="year-desc">Newest Year</option></select>
    </div>
    <div className="publicInventoryMeta"><strong>{filtered.length} VEHICLE{filtered.length===1?"":"S"} FOUND</strong><span>{designMode?"DESIGN PREVIEW · NOT LIVE":"REAL VEHICLE DATA"}</span></div>
    <div className="inventoryGrid wdccVehicleGrid">{filtered.map(v=><WdccVehicleCard key={String(v.id||v.slug)} vehicle={v}/>)}</div>
  </>;
}
