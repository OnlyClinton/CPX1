"use client";
import Link from"next/link";
import type{CSSProperties}from"react";
import{useEffect,useState}from"react";
import {PUBLIC_INVENTORY_FALLBACK} from "../lib/publicInventoryFallback";
import TrackedCallLink from"./TrackedCallLink";

export function Intro(){
  const[phase,setPhase]=useState<"reveal"|"dock"|"done">("reveal");
  const[landing,setLanding]=useState({x:0,y:0,scale:.42});
  useEffect(()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduced){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const measure=()=>{
      const target=document.querySelector(".logoBrand img") as HTMLElement|null;
      const badge=document.querySelector(".intro-badge") as HTMLElement|null;
      if(!target||!badge)return;
      const tr=target.getBoundingClientRect();
      const br=badge.getBoundingClientRect();
      const bw=br.width||Math.min(window.innerWidth*.56,360);
      const originX=window.innerWidth/2;
      const originY=window.innerHeight*.43;
      setLanding({x:tr.left+tr.width/2-originX,y:tr.top+tr.height/2-originY,scale:Math.max(.18,Math.min(.58,tr.width/bw))});
    };
    const raf=requestAnimationFrame(()=>requestAnimationFrame(measure));
    window.addEventListener("resize",measure);
    const dockTimer=window.setTimeout(()=>setPhase("dock"),1650);
    const doneTimer=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2950);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dockTimer);window.clearTimeout(doneTimer);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);
  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const style={"--intro-dock-x":`${landing.x}px`,"--intro-dock-y":`${landing.y}px`,"--intro-dock-scale":landing.scale} as CSSProperties;
  return <div className={`intro-sequence intro-${phase}`} aria-label="WDCC opening animation">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .intro-sequence{position:fixed!important;inset:0!important;z-index:2147483000!important;overflow:hidden!important;background:#02070c!important;isolation:isolate!important;display:block!important}
      .intro-scene{position:absolute!important;inset:-3%!important;z-index:0!important;background-image:linear-gradient(180deg,rgba(1,5,9,.12) 0%,rgba(1,5,9,.04) 50%,rgba(1,5,9,.58) 100%),url('/wdcc-hero-v2.webp')!important;background-size:cover!important;background-position:center 48%!important;background-repeat:no-repeat!important;transform:scale(1.035)!important;filter:saturate(1.08) contrast(1.04)!important;animation:wdccScenePush 2.95s cubic-bezier(.2,.8,.2,1) both!important}
      .intro-sequence:after{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;pointer-events:none!important;background:radial-gradient(circle at 50% 47%,transparent 24%,rgba(0,0,0,.08) 55%,rgba(0,0,0,.5) 100%)!important}
      .intro-smoke{position:absolute!important;z-index:3!important;left:50%!important;top:53%!important;width:min(100vw,900px)!important;height:min(48vw,430px)!important;transform:translate(-50%,-50%)!important;border-radius:50%!important;filter:blur(34px)!important;pointer-events:none!important;opacity:.5!important;background:radial-gradient(ellipse,rgba(208,222,230,.35) 0%,rgba(111,139,156,.22) 38%,transparent 72%)!important;mix-blend-mode:screen!important}
      .smoke-one{animation:wdccSmokeA 2.8s ease-in-out both!important}
      .smoke-two{top:60%!important;opacity:.32!important;transform:translate(-50%,-50%) scale(.78)!important;animation:wdccSmokeB 2.8s ease-in-out both!important}
      .intro-badge{position:absolute!important;z-index:5!important;left:50%!important;top:43%!important;width:min(58vw,360px)!important;aspect-ratio:1!important;display:grid!important;place-items:center!important;opacity:1!important;visibility:visible!important;pointer-events:none!important;will-change:transform,opacity!important;transform-origin:center!important}
      .intro-badge img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 18px 42px rgba(0,0,0,.9)) drop-shadow(0 0 22px rgba(255,255,255,.2))!important}
      .intro-reveal .intro-badge{animation:wdccBadgeReveal 1.65s cubic-bezier(.16,.84,.18,1) both!important}
      .intro-dock .intro-badge{transform:translate(calc(-50% + var(--intro-dock-x)),calc(-50% + var(--intro-dock-y))) scale(var(--intro-dock-scale))!important;transition:transform 1.05s cubic-bezier(.2,.85,.22,1),opacity .18s linear .86s!important}
      .intro-dock .intro-scene{filter:saturate(1.02) contrast(1.01) brightness(.92)!important;transition:filter .8s ease!important}
      .intro-tagline{position:absolute!important;z-index:6!important;left:50%!important;top:68%!important;transform:translateX(-50%)!important;margin:0!important;white-space:nowrap!important;color:#fff!important;font-size:clamp(12px,3vw,16px)!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important;text-shadow:0 2px 14px #000!important;opacity:.96!important;animation:wdccTag 2.25s ease both!important}
      .intro-dock .intro-tagline{opacity:0!important;transition:opacity .22s ease!important}
      .intro-skip{position:absolute!important;right:max(22px,env(safe-area-inset-right))!important;bottom:max(26px,calc(env(safe-area-inset-bottom) + 18px))!important;z-index:8!important;color:#fff!important;background:rgba(3,9,14,.72)!important;border:1px solid rgba(255,255,255,.28)!important;border-radius:999px!important;padding:14px 22px!important;font:800 12px/1 system-ui,sans-serif!important;letter-spacing:.02em!important}
      @keyframes wdccScenePush{0%{opacity:.78;transform:scale(1.1) translate3d(1.5%,0,0)}18%{opacity:1}100%{opacity:1;transform:scale(1.035) translate3d(0,0,0)}}
      @keyframes wdccBadgeReveal{0%{opacity:0;transform:translate(-50%,-50%) scale(.62) rotate(-5deg);filter:blur(7px)}18%{opacity:1}62%{transform:translate(-50%,-50%) scale(1.08) rotate(1.5deg);filter:blur(0)}100%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0);filter:blur(0)}}
      @keyframes wdccSmokeA{0%{opacity:0;transform:translate(-62%,-42%) scale(.5)}35%{opacity:.56}100%{opacity:.17;transform:translate(-38%,-55%) scale(1.32)}}
      @keyframes wdccSmokeB{0%{opacity:0;transform:translate(-38%,-52%) scale(.5)}45%{opacity:.38}100%{opacity:.12;transform:translate(-60%,-47%) scale(1.14)}}
      @keyframes wdccTag{0%,24%{opacity:0;transform:translate(-50%,12px)}45%,82%{opacity:.96;transform:translate(-50%,0)}100%{opacity:.78}}
      @media(max-width:600px){.intro-scene{inset:0!important;background-size:auto 100%!important;background-position:66% center!important;transform:scale(1.01)!important;animation:wdccScenePushMobile 2.95s cubic-bezier(.2,.8,.2,1) both!important}.intro-badge{top:40%!important;width:min(62vw,290px)!important}.intro-tagline{top:67%!important;font-size:12px!important;letter-spacing:.13em!important}.intro-smoke{left:60%!important;top:53%!important;width:112vw!important;height:70vw!important}@keyframes wdccScenePushMobile{0%{opacity:.82;transform:scale(1.08) translate3d(3%,0,0)}100%{opacity:1;transform:scale(1.01) translate3d(0,0,0)}}}
    `}</style>
    <div className="intro-scene" aria-hidden="true"/>
    <div className="intro-smoke smoke-one" aria-hidden="true"/>
    <div className="intro-smoke smoke-two" aria-hidden="true"/>
    <div className="intro-badge" style={style}><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="intro-tagline">Tampa Bay · Drive today</p>
    <button className="intro-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}

export function Header(){
  const[open,setOpen]=useState(false);
  return <>
    <div className="commandStrip"><div className="wrap"><span>● TAMPA BAY</span><span>IN-HOUSE FINANCING</span><span>SEAN · <b>813-516-4752</b></span></div></div>
    <header className="premiumHeader"><div className="wrap nav">
      <Link className="brand logoBrand" href="/" aria-label="We Don't Care Cars home"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></Link>
      <button className="mobileMenuButton" type="button" aria-expanded={open} aria-controls="mobileHeaderMenu" onClick={()=>setOpen(v=>!v)}>{open?"CLOSE":"☰"}</button>
      <TrackedCallLink className="mobileCallButton" source="header-mobile-phone" label="Call Sean">☎</TrackedCallLink>
      <div className="navlinks">
        <Link href="/inventory">INVENTORY</Link><Link href="/schedule-test-drive?source=header-test-drive">TEST DRIVE</Link><Link href="/get-approved?source=header-financing">FINANCING</Link><Link href="/#how-it-works">HOW IT WORKS</Link><Link href="/dealer/login">DEALER PORTAL</Link><Link href="/contact?source=header-contact">CONTACT</Link><TrackedCallLink className="premiumPhone" source="header-phone">☎ <b>813-516-4752</b></TrackedCallLink><Link className="premiumApply" href="/get-approved?source=header-get-approved">GET PRE-APPROVED</Link>
      </div>
    </div>
    {open&&<nav id="mobileHeaderMenu" className="mobileHeaderMenu"><Link href="/inventory" onClick={()=>setOpen(false)}>INVENTORY</Link><Link href="/schedule-test-drive?source=mobile-test-drive" onClick={()=>setOpen(false)}>TEST DRIVE</Link><Link href="/get-approved?source=mobile-financing" onClick={()=>setOpen(false)}>FINANCING</Link><Link href="/#how-it-works" onClick={()=>setOpen(false)}>HOW IT WORKS</Link><Link href="/dealer/login" onClick={()=>setOpen(false)}>DEALER PORTAL</Link><Link href="/contact?source=mobile-contact" onClick={()=>setOpen(false)}>CONTACT</Link></nav>}
    </header>
    <nav className="stickyCtaBar" aria-label="Quick actions"><Link className="stickyPrimary" href="/schedule-test-drive?source=sticky-test-drive"><span>TEST DRIVE</span></Link><Link className="stickySecondary" href="/get-approved?source=sticky-get-approved"><span>GET APPROVED</span></Link><TrackedCallLink className="stickyContact" source="sticky-call-sean" label="Call Sean"><span>CALL SEAN</span></TrackedCallLink></nav>
  </>
}

export function Footer(){
  return <footer className="premiumFooter"><div className="wrap premiumFooterRow"><div className="footerBrand"><img src="/wdcc-logo-transparent.webp" alt="WDCC"/><div><strong>WE DON'T CARE CARS</strong><br/><small>Tampa Bay · Real inventory · Direct help</small></div></div><div><TrackedCallLink source="footer-phone">813-516-4752</TrackedCallLink> · <Link href="/contact?source=footer-contact">Contact</Link></div></div></footer>
}

function customerVisible(v:any){
  const status=String(v?.status||"").toLowerCase();
  const badges=(Array.isArray(v?.badges)?v.badges:[]).map((x:any)=>String(x).toUpperCase());
  const stock=String(v?.stock||v?.stock_id||"").toUpperCase();
  return status==="published"&&Number(v?.year)>1900&&String(v?.make||"").trim()!==""&&String(v?.model||"").trim()!==""&&Number(v?.price||v?.cashPrice)>0&&!stock.startsWith("R36TEST-")&&!badges.includes("R36-TEST");
}

export function VehicleGrid({limit}:{limit?:number}){
  const[items,setItems]=useState<any[]>(PUBLIC_INVENTORY_FALLBACK),[loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(j=>{const live=(j.items||j.inventory||[]).filter(customerVisible);setItems(live.length?live:PUBLIC_INVENTORY_FALLBACK)}).catch(()=>setItems(PUBLIC_INVENTORY_FALLBACK)).finally(()=>setLoading(false))},[]);
  const shown=limit?items.slice(0,limit):items;
  if(loading)return <div className="grid">{[1,2,3,4,5].map(i=><div className="card" key={i}><div className="photo">LOADING VEHICLE…</div><div className="cardBody"><div className="carTitle">Inventory loading</div></div></div>)}</div>;
  return <div className="grid">{shown.length?shown.map(v=><article className="card" key={v.id}><Link className="photo" href={`/vehicle/${v.id}`} aria-label={`View ${v.year} ${v.make} ${v.model}`}>{v.primaryPhotoPathname?<img src={`/api/media?p=${encodeURIComponent(v.primaryPhotoPathname)}`} alt={`${v.year} ${v.make} ${v.model}`}/>:v.primary_image_url?<img src={v.primary_image_url} alt={`${v.year} ${v.make} ${v.model}`}/>:"PHOTOS COMING"}</Link><div className="cardBody"><div className="carTitle">{v.year} {v.make}<br/><b>{v.model}</b></div><div className="facts"><span>{Number(v.mileage||0).toLocaleString()} MILES</span></div><div className="price">${Number(v.price||0).toLocaleString()}</div>{(v.downPayment??v.down_payment)!=null&&<div className="down">${Number(v.downPayment??v.down_payment).toLocaleString()} DOWN</div>}<div className="cardButtons"><Link href={`/vehicle/${v.id}`}><span>VIEW VEHICLE</span></Link><Link href={`/get-approved?source=inventory-get-approved&vehicle=${encodeURIComponent(v.id)}`}><span>GET APPROVED</span></Link></div></div></article>):<div className="emptyInventory"><h3>Inventory is being updated.</h3><p>Call or text Sean for vehicles being prepared now.</p></div>}</div>
}
