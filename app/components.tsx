"use client";
import Link from"next/link";
import{useEffect,useRef,useState}from"react";
import TrackedCallLink from"./TrackedCallLink";

type IntroPhase="enter"|"move"|"flight"|"exit"|"done";

export function Intro(){
  const[phase,setPhase]=useState<IntroPhase>("enter");
  const logoRef=useRef<HTMLImageElement>(null);

  useEffect(()=>{
    const forceReplay=new URLSearchParams(window.location.search).get("intro")==="1";
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if((!forceReplay&&sessionStorage.getItem("wdcc_intro_seen"))||reducedMotion){setPhase("done");return;}

    sessionStorage.setItem("wdcc_intro_seen","1");
    let cancelled=false;
    const timers:number[]=[];
    const later=(fn:()=>void,ms:number)=>{const id=window.setTimeout(fn,ms);timers.push(id);};

    const complete=()=>{
      if(cancelled)return;
      setPhase("exit");
      later(()=>{if(!cancelled)setPhase("done")},520);
    };

    const flyLogo=()=>{
      if(cancelled)return;
      setPhase("flight");
      const source=logoRef.current;
      const target=document.querySelector<HTMLImageElement>("[data-wdcc-header-logo]");
      if(!source||!target){complete();return;}

      source.getAnimations().forEach(animation=>animation.cancel());
      const start=source.getBoundingClientRect();
      const end=target.getBoundingClientRect();
      if(!start.width||!start.height||!end.width||!end.height){complete();return;}

      target.style.opacity="0";
      source.style.left=`${start.left}px`;
      source.style.top=`${start.top}px`;
      source.style.width=`${start.width}px`;
      source.style.height=`${start.height}px`;
      source.style.transform="none";
      source.style.transformOrigin="top left";
      source.style.opacity="1";

      const dx=end.left-start.left;
      const dy=end.top-start.top;
      const scale=Math.min(end.width/start.width,end.height/start.height);

      const flight=source.animate([
        {transform:"translate3d(0,0,0) scale(1)",opacity:1,offset:0},
        {transform:`translate3d(${dx*.84}px,${dy*.84}px,0) scale(${Math.max(scale*1.18,.12)})`,opacity:1,offset:.72},
        {transform:`translate3d(${dx}px,${dy}px,0) scale(${scale})`,opacity:.12,offset:1}
      ],{duration:900,easing:"cubic-bezier(.16,1,.3,1)",fill:"forwards"});

      const reveal=target.animate([
        {opacity:0,offset:0},
        {opacity:0,offset:.74},
        {opacity:1,offset:1}
      ],{duration:900,easing:"ease-out",fill:"forwards"});

      Promise.allSettled([flight.finished,reveal.finished]).then(()=>{
        if(cancelled)return;
        target.style.opacity="1";
        complete();
      });
    };

    later(()=>setPhase("move"),520);
    later(()=>window.requestAnimationFrame(flyLogo),1500);
    later(complete,3300);

    return()=>{
      cancelled=true;
      timers.forEach(id=>window.clearTimeout(id));
      const target=document.querySelector<HTMLImageElement>("[data-wdcc-header-logo]");
      if(target)target.style.opacity="";
    };
  },[]);

  if(phase==="done")return null;
  return <div className={`cinematic cinematic-${phase}`} aria-label="WDCC opening animation">
    <div className="cinScene" aria-hidden="true"/>
    <div className="cinVignette" aria-hidden="true"/>
    <div className="cinSmoke one" aria-hidden="true"/>
    <div className="cinSmoke two" aria-hidden="true"/>
    <img ref={logoRef} className="cinLogo" src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/>
    <p className="cinTagline">Tampa Bay · Drive today</p>
    <button className="skipIntro" onClick={()=>setPhase("done")}>Skip intro</button>
  </div>;
}

export function Header(){const[open,setOpen]=useState(false);return <><div className="commandStrip"><div className="wrap"><span>Tampa Bay · In-house financing</span><span>Fast answers · Real inventory</span><span>Sean · <b>813-516-4752</b></span></div></div><header className="premiumHeader"><div className="wrap nav"><Link className="brand logoBrand" href="/" aria-label="We Don't Care Cars home"><img data-wdcc-header-logo src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link><button className="mobileMenuButton" type="button" aria-expanded={open} aria-controls="mobileHeaderMenu" onClick={()=>setOpen(v=>!v)}>{open?"CLOSE":"MENU"}</button><TrackedCallLink className="mobileCallButton" source="header-mobile-phone" label="Call Sean">☎</TrackedCallLink><div className="navlinks"><Link href="/inventory">INVENTORY</Link><Link href="/schedule-test-drive?source=schedule-test-drive">TEST DRIVE</Link><Link href="/get-approved?source=get-approved">FINANCING</Link><Link href="/contact?source=call-sean">CONTACT</Link><TrackedCallLink className="premiumPhone" source="header-phone">SEAN · <b>813-516-4752</b></TrackedCallLink><Link className="premiumApply" href="/get-approved?source=get-approved">GET APPROVED</Link></div></div>{open&&<nav id="mobileHeaderMenu" className="mobileHeaderMenu"><Link href="/inventory" onClick={()=>setOpen(false)}>INVENTORY</Link><Link href="/schedule-test-drive?source=schedule-test-drive" onClick={()=>setOpen(false)}>TEST DRIVE</Link><Link href="/get-approved?source=get-approved" onClick={()=>setOpen(false)}>FINANCING</Link><Link href="/contact?source=call-sean" onClick={()=>setOpen(false)}>CONTACT</Link></nav>}</header><div className="stickyCtaBar" aria-label="Quick actions"><Link className="stickyPrimary" href="/schedule-test-drive?source=schedule-test-drive">TEST DRIVE</Link><Link className="stickySecondary" href="/get-approved?source=get-approved">GET APPROVED</Link><Link className="stickyContact" href="/contact?source=call-sean">CALL SEAN</Link></div></>}

export function Footer(){return <footer className="premiumFooter"><div className="wrap premiumFooterRow"><div style={{display:"flex",alignItems:"center",gap:14}}><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>WE DON'T CARE CARS</strong><br/><small>Tampa Bay · Real inventory · Direct help</small></div></div><div><TrackedCallLink source="footer-phone">813-516-4752</TrackedCallLink> · <Link href="/contact?source=call-sean">Contact</Link></div></div></footer>}

function customerVisible(v:any){const status=String(v?.status||"").toLowerCase();const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());const stock=String(v?.stock||v?.stock_id||"").toUpperCase();return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST")}
export function VehicleGrid({limit}:{limit?:number}){const[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true);useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>setItems((j.items||j.inventory||[]).filter(customerVisible))).catch(()=>{}).finally(()=>setLoading(false))},[]);const shown=limit?items.slice(0,limit):items;if(loading)return <div className="grid">{[1,2,3].map(i=><div className="card" key={i}><div className="photo">LOADING VEHICLE…</div><div className="cardBody"><div className="carTitle">Inventory loading</div></div></div>)}</div>;return <div className="grid">{shown.length?shown.map(v=><article className="card" key={v.id}><Link className="photo" href={`/vehicle/${v.id}`} aria-label={`View ${v.year} ${v.make} ${v.model}`}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt={`${v.year} ${v.make} ${v.model}`}/>:v.primary_image_url?<img src={v.primary_image_url} alt={`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</Link><div className="cardBody"><div className="carTitle">{v.year} {v.make} {v.model}</div><div className="facts"><span>{Number(v.mileage||0).toLocaleString()} MI</span>{(v.stock||v.stock_id)&&<span>STOCK {v.stock||v.stock_id}</span>}</div><div className="price">${Number(v.price||0).toLocaleString()}</div>{(v.downPayment??v.down_payment)!=null&&<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} estimated down</div>}<div className="cardButtons"><Link href={`/vehicle/${v.id}`}><span>VIEW VEHICLE</span></Link><Link href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(v.id)}`}><span>GET APPROVED</span></Link></div></div></article>):<div><h3>Inventory is being updated.</h3><p className="muted">Call or text Sean for vehicles being prepared now.</p></div>}</div>}
