"use client";
import Link from"next/link";
import type{CSSProperties}from"react";
import{useEffect,useState}from"react";

export function Intro(){
  const[phase,setPhase]=useState<"reveal"|"dock"|"done">("reveal");
  const[landing,setLanding]=useState({x:0,y:0,scale:.42});
  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const measure=()=>{
      const target=document.querySelector(".homeComposite .logoBrand img") as HTMLElement|null;
      const badge=document.querySelector(".intro-badge") as HTMLElement|null;
      if(!target||!badge)return;
      const tr=target.getBoundingClientRect();
      const bw=badge.offsetWidth||300;
      const originY=window.innerHeight*(window.innerWidth<=900?.47:.49);
      setLanding({x:tr.left+tr.width/2-window.innerWidth/2,y:tr.top+tr.height/2-originY,scale:Math.max(.2,Math.min(.7,tr.width/bw))});
    };
    const raf=requestAnimationFrame(measure);
    window.addEventListener("resize",measure);
    const dockTimer=window.setTimeout(()=>setPhase("dock"),1550);
    const doneTimer=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2850);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dockTimer);window.clearTimeout(doneTimer);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);
  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const style={"--intro-dock-x":`${landing.x}px`,"--intro-dock-y":`${landing.y}px`,"--intro-dock-scale":landing.scale} as CSSProperties;
  return <div className={`intro-sequence intro-${phase}`} aria-label="WDCC opening animation">
    <div className="intro-scene" aria-hidden="true"/>
    <div className="intro-smoke smoke-one" aria-hidden="true"/>
    <div className="intro-smoke smoke-two" aria-hidden="true"/>
    <div className="intro-badge" style={style}><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="intro-tagline">Tampa Bay · Drive today</p>
    <button className="intro-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}

export function Header(){const[open,setOpen]=useState(false);return <><div className="commandStrip"><div className="wrap"><span>Tampa Bay · In-house financing</span><span>Fast answers · Real inventory</span><span>Sean · <b>813-516-4752</b></span></div></div><header className="premiumHeader"><div className="wrap nav"><Link className="brand logoBrand" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link><button className="mobileMenuButton" type="button" aria-expanded={open} aria-controls="mobileHeaderMenu" onClick={()=>setOpen(v=>!v)}>{open?"CLOSE":"MENU"}</button><a className="mobileCallButton" href="tel:+18135164752" aria-label="Call Sean">☎</a><div className="navlinks"><Link href="/inventory">INVENTORY</Link><Link href="/schedule-test-drive?source=schedule-test-drive">TEST DRIVE</Link><Link href="/get-approved?source=get-approved">FINANCING</Link><Link href="/contact?source=call-sean">CONTACT</Link><a className="premiumPhone" href="tel:+18135164752">SEAN · <b>813-516-4752</b></a><Link className="premiumApply" href="/get-approved?source=header-get-approved">GET APPROVED</Link></div></div>{open&&<nav id="mobileHeaderMenu" className="mobileHeaderMenu"><Link href="/inventory" onClick={()=>setOpen(false)}>INVENTORY</Link><Link href="/schedule-test-drive?source=schedule-test-drive" onClick={()=>setOpen(false)}>TEST DRIVE</Link><Link href="/get-approved?source=get-approved" onClick={()=>setOpen(false)}>FINANCING</Link><Link href="/contact?source=call-sean" onClick={()=>setOpen(false)}>CONTACT</Link></nav>}</header><div className="mobilebar compositeMobileDock"><a href="tel:+18135164752">CALL SEAN</a><Link href="/get-approved?source=mobile-bottom-apply">GET PRE-APPROVED</Link></div></>}

export function Footer(){return <footer className="premiumFooter"><div className="wrap premiumFooterRow"><div style={{display:"flex",alignItems:"center",gap:14}}><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>WE DON'T CARE CARS</strong><br/><small>Tampa Bay · Real inventory · Direct help</small></div></div><div><a href="tel:+18135164752">813-516-4752</a> · <Link href="/contact?source=footer-contact">Contact</Link></div></div></footer>}

function customerVisible(v:any){const status=String(v?.status||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());const stock=String(v?.stock||v?.stock_id||"").toUpperCase();return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST")}
export function VehicleGrid({limit}:{limit?:number}){const[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true);useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>setItems((j.items||j.inventory||[]).filter(customerVisible))).catch(()=>{}).finally(()=>setLoading(false))},[]);const shown=limit?items.slice(0,limit):items;if(loading)return <div className="grid">{[1,2,3].map(i=><div className="card" key={i}><div className="photo">LOADING VEHICLE…</div><div className="cardBody"><div className="carTitle">Inventory loading</div></div></div>)}</div>;return <div className="grid">{shown.length?shown.map(v=><article className="card" key={v.id}><Link className="photo" href={`/vehicle/${v.id}`} aria-label={`View ${v.year} ${v.make} ${v.model}`}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt={`${v.year} ${v.make} ${v.model}`}/>:v.primary_image_url?<img src={v.primary_image_url} alt={`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</Link><div className="cardBody"><div className="carTitle">{v.year} {v.make} {v.model}</div><div className="facts"><span>{Number(v.mileage||0).toLocaleString()} MI</span>{(v.stock||v.stock_id)&&<span>STOCK {v.stock||v.stock_id}</span>}</div><div className="price">${Number(v.price||0).toLocaleString()}</div>{(v.downPayment??v.down_payment)!=null&&<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} estimated down</div>}<div className="cardButtons"><Link href={`/vehicle/${v.id}`}><span>VIEW VEHICLE</span></Link><Link href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(v.id)}`}><span>GET APPROVED</span></Link></div></div></article>):<div><h3>Inventory is being updated.</h3><p className="muted">Call or text Sean for vehicles being prepared now.</p></div>}</div>}
