"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
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

const bodyOf=(v:Vehicle)=>String(v.bodyStyle||v.body_style||"").trim();
const milesOf=(v:Vehicle)=>Number(v.mileage||0);

export default function InventoryGrid(){
  const[items,setItems]=useState<Vehicle[]>([]);
  const[state,setState]=useState<InventoryState>("loading");
  const[fixtureMode,setFixtureMode]=useState(false);
  const[recoveryMode,setRecoveryMode]=useState(false);
  const[query,setQuery]=useState("");
  const[make,setMake]=useState("all");
  const[model,setModel]=useState("all");
  const[year,setYear]=useState("all");
  const[bodyStyle,setBodyStyle]=useState("all");
  const[drivetrain,setDrivetrain]=useState("all");
  const[maxPrice,setMaxPrice]=useState("all");
  const[maxMileage,setMaxMileage]=useState("all");
  const[sort,setSort]=useState("featured");
  const[view,setView]=useState<"grid"|"list">("grid");
  const[showFilters,setShowFilters]=useState(false);

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

  const makes=useMemo(()=>Array.from(new Set(items.map(v=>String(v.make||"").trim()).filter(Boolean))).sort(),[items]);
  const models=useMemo(()=>Array.from(new Set(items.filter(v=>make==="all"||String(v.make||"")===make).map(v=>String(v.model||"").trim()).filter(Boolean))).sort(),[items,make]);
  const years=useMemo(()=>Array.from(new Set(items.map(v=>Number(v.year||0)).filter(Boolean))).sort((a,b)=>b-a),[items]);
  const bodyStyles=useMemo(()=>Array.from(new Set(items.map(bodyOf).filter(Boolean))).sort(),[items]);
  const drivetrains=useMemo(()=>Array.from(new Set(items.map(v=>String(v.drivetrain||"").trim()).filter(Boolean))).sort(),[items]);

  useEffect(()=>{if(model!=="all"&&!models.includes(model))setModel("all")},[make,model,models]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const priceCeiling=maxPrice==="all"?Infinity:Number(maxPrice);
    const mileageCeiling=maxMileage==="all"?Infinity:Number(maxMileage);
    const list=items.filter(v=>{
      const hay=`${v.year||""} ${v.make||""} ${v.model||""} ${v.trim||""}`.toLowerCase();
      return(!q||hay.includes(q))
        &&(make==="all"||String(v.make||"")===make)
        &&(model==="all"||String(v.model||"")===model)
        &&(year==="all"||String(v.year||"")===year)
        &&(bodyStyle==="all"||bodyOf(v)===bodyStyle)
        &&(drivetrain==="all"||String(v.drivetrain||"")===drivetrain)
        &&Number(v.price||v.cashPrice||0)<=priceCeiling
        &&milesOf(v)<=mileageCeiling;
    });
    const next=[...list];
    if(sort==="price-asc")next.sort((a,b)=>Number(a.price||a.cashPrice||0)-Number(b.price||b.cashPrice||0));
    if(sort==="price-desc")next.sort((a,b)=>Number(b.price||b.cashPrice||0)-Number(a.price||a.cashPrice||0));
    if(sort==="year-desc")next.sort((a,b)=>Number(b.year||0)-Number(a.year||0));
    if(sort==="mileage-asc")next.sort((a,b)=>milesOf(a)-milesOf(b));
    return next;
  },[items,query,make,model,year,bodyStyle,drivetrain,maxPrice,maxMileage,sort]);

  const activeFilters=[query,make!=="all",model!=="all",year!=="all",bodyStyle!=="all",drivetrain!=="all",maxPrice!=="all",maxMileage!=="all"].filter(Boolean).length;
  const priceRange=maxPrice==="all"?50000:Number(maxPrice);
  const mileageRange=maxMileage==="all"?100000:Number(maxMileage);
  const clearFilters=()=>{setQuery("");setMake("all");setModel("all");setYear("all");setBodyStyle("all");setDrivetrain("all");setMaxPrice("all");setMaxMileage("all")};
  const showResults=()=>document.querySelector('.publicInventoryMeta')?.scrollIntoView({behavior:"smooth",block:"start"});

  if(state==="loading")return <div className="inventoryGrid wdccVehicleGrid" aria-label="Loading current inventory">{[1,2,3].map(i=><div className="wdccVehicleSkeleton" key={i}><div/><span>Loading current vehicle…</span></div>)}</div>;
  if(state==="error")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is temporarily unavailable.</h3><p>Call Sean at <a href="tel:+18135164752">813-516-4752</a> for current availability.</p><div className="actions"><Link className="cta red" href="/get-approved?source=inventory-provider-unavailable">GET PRE-APPROVED</Link><a className="cta ghost" href="tel:+18135164752">CALL SEAN</a></div></div></div>;
  if(state==="empty")return <div className="inventoryGrid"><div className="emptyInventory inventoryProviderState" role="status"><h3>Inventory is being updated.</h3><p>There are no customer-visible published vehicles to show right now. Call or text Sean for vehicles being prepared.</p><a className="cta red" href="tel:+18135164752">CALL SEAN · 813-516-4752</a></div></div>;

  return <>
    {fixtureMode&&<div className="wdccOwnerReviewBanner" role="status">{WDCC_VISUAL_REVIEW_LABEL}</div>}
    {recoveryMode&&<div className="wdccRecoveryInventoryBanner" role="status"><strong>VERIFIED RECOVERY INVENTORY</strong><span>Provider sync is temporarily unavailable. Confirm current availability with Sean · 813-516-4752.</span></div>}

    <div className="publicInventoryFilterShell">
      <div className="publicInventoryMobileToolbar">
        <button type="button" className="inventoryMobileFilterButton" aria-expanded={showFilters} onClick={()=>setShowFilters(v=>!v)}><span aria-hidden="true">☷</span> FILTER &amp; SORT {activeFilters>0&&<b>{activeFilters}</b>}</button>
        <label className="inventoryMobileSort"><span>SORT BY</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort inventory mobile"><option value="featured">Featured</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="year-desc">Newest Year</option><option value="mileage-asc">Lowest Mileage</option></select></label>
      </div>

      <div className={`publicInventoryControls${showFilters?" mobileOpen":""}`} aria-label="Filter inventory">
        <div className="inventoryFilterColumn">
          <strong className="inventoryFilterTitle">FILTER INVENTORY</strong>
          <input className="inventorySearch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search make, model, year, or stock #" aria-label="Search inventory"/>
          <div className="inventorySelectGrid">
            <select value={make} onChange={e=>setMake(e.target.value)} aria-label="Filter by make"><option value="all">All Makes</option>{makes.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select value={model} onChange={e=>setModel(e.target.value)} aria-label="Filter by model"><option value="all">All Models</option>{models.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} aria-label="Maximum price"><option value="all">Max Price</option><option value="10000">$10,000</option><option value="15000">$15,000</option><option value="20000">$20,000</option><option value="25000">$25,000</option><option value="30000">$30,000</option><option value="40000">$40,000</option><option value="50000">$50,000</option></select>
            <select value={year} onChange={e=>setYear(e.target.value)} aria-label="Filter by year"><option value="all">All Years</option>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select>
            <select value={bodyStyle} onChange={e=>setBodyStyle(e.target.value)} aria-label="Filter by body style"><option value="all">All Body Styles</option>{bodyStyles.map(b=><option key={b} value={b}>{b}</option>)}</select>
            <select value={drivetrain} onChange={e=>setDrivetrain(e.target.value)} aria-label="Filter by drivetrain"><option value="all">All Drivetrains</option>{drivetrains.map(d=><option key={d} value={d}>{d}</option>)}</select>
          </div>
          <button type="button" className="inventoryMoreFilters" onClick={()=>setShowFilters(true)}>MORE FILTERS <span aria-hidden="true">⌄</span></button>
        </div>

        <div className="inventoryRangeColumn">
          <div className="inventoryRangeGroup"><strong>PRICE RANGE</strong><input type="range" min="5000" max="50000" step="1000" value={priceRange} onChange={e=>setMaxPrice(Number(e.target.value)>=50000?"all":e.target.value)} aria-label="Price range"/><div><span>$0</span><span>{priceRange>=50000?"$50,000+":`$${priceRange.toLocaleString()}`}</span></div></div>
          <div className="inventoryRangeGroup"><strong>MILEAGE</strong><input type="range" min="10000" max="100000" step="5000" value={mileageRange} onChange={e=>setMaxMileage(Number(e.target.value)>=100000?"all":e.target.value)} aria-label="Mileage range"/><div><span>0 mi</span><span>{mileageRange>=100000?"100,000+ mi":`${mileageRange.toLocaleString()} mi`}</span></div></div>
        </div>

        <div className="inventorySortColumn">
          <strong>SORT BY</strong>
          <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort inventory"><option value="featured">Featured</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="year-desc">Newest Year</option><option value="mileage-asc">Lowest Mileage</option></select>
          <button type="button" className="inventoryViewResults" onClick={showResults}>VIEW INVENTORY ({filtered.length})</button>
          <button type="button" className="inventoryClearFilters" onClick={clearFilters}>CLEAR ALL FILTERS</button>
        </div>
      </div>
    </div>

    <div className="publicInventoryMeta"><strong>{filtered.length} VEHICLE{filtered.length===1?"":"S"} FOUND</strong><div className="publicInventoryViewControls"><span>VIEW AS:</span><button type="button" aria-label="Grid view" aria-pressed={view==="grid"} onClick={()=>setView("grid")}>▦</button><button type="button" aria-label="List view" aria-pressed={view==="list"} onClick={()=>setView("list")}>☷</button></div></div>
    <div className={`inventoryGrid wdccVehicleGrid${view==="list"?" wdccListView":""}`}>{filtered.map(v=><WdccVehicleCard key={String(v.id||v.slug)} vehicle={v}/>)}</div>
  </>;
}
