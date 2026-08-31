"use client";

import {useLayoutEffect,useRef,useState} from "react";

type Phase="show"|"dock"|"done";
const KEY="wdcc-opening-seen-v2";

export default function LockedIntro({onComplete}:{onComplete?:()=>void}){
  const[phase,setPhase]=useState<Phase>("show");
  const badgeRef=useRef<HTMLDivElement|null>(null);
  useLayoutEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    const force=q.get("intro")==="1"||q.has("intro-preview");
    const seen=(()=>{try{return sessionStorage.getItem(KEY)==="1"}catch{return false}})();
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||(seen&&!force)){setPhase("done");onComplete?.();return}
    document.documentElement.classList.add("wdcc-intro-active");
    const dock=window.setTimeout(()=>setPhase("dock"),1550);
    const done=window.setTimeout(()=>{try{sessionStorage.setItem(KEY,"1")}catch{}document.documentElement.classList.remove("wdcc-intro-active");setPhase("done");onComplete?.()},2350);
    return()=>{clearTimeout(dock);clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[onComplete]);
  const finish=()=>{try{sessionStorage.setItem(KEY,"1")}catch{}document.documentElement.classList.remove("wdcc-intro-active");setPhase("done");onComplete?.()};
  if(phase==="done")return null;
  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}.li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate;opacity:1;transition:background-color .36s ease .1s,opacity .18s ease .5s}.li-dock{background:rgba(2,7,12,0);opacity:0;pointer-events:none}.li-scene{position:absolute;inset:0}.li-scene img{width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(.82) contrast(1.08) brightness(.42);transform:scale(1.018);animation:scene 1.18s cubic-bezier(.18,.76,.22,1) .04s forwards}.li-scene:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 65% 48%,transparent 22%,rgba(2,7,12,.14) 58%,rgba(2,7,12,.58)),linear-gradient(90deg,rgba(2,7,12,.58),rgba(2,7,12,.10) 48%,transparent 78%)}@keyframes scene{to{filter:saturate(1.18) contrast(1.04) brightness(1.03);transform:scale(1)}}.li-smoke{position:absolute;inset:45% -12% -18%;background:radial-gradient(ellipse at 72% 72%,rgba(218,230,239,.24),rgba(130,154,171,.10) 30%,transparent 66%),radial-gradient(ellipse at 28% 88%,rgba(210,224,233,.16),transparent 58%);filter:blur(17px);opacity:0;animation:smoke 1.16s ease .18s forwards}@keyframes smoke{32%{opacity:.48}to{opacity:.08;transform:translate(-2%,-3%)}}.li-badge{position:absolute;left:23%;top:46%;width:clamp(154px,16vw,194px);aspect-ratio:1;transform:translate(-50%,-50%) scale(.84);opacity:0;animation:badge .54s cubic-bezier(.16,.86,.24,1) .48s forwards}.li-badge img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 28px rgba(0,0,0,.5))}@keyframes badge{72%{opacity:1;transform:translate(-50%,-50%) scale(1.025)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}.li-dock .li-badge{opacity:0;transform:translate(-80%,-150%) scale(.3);transition:transform .5s cubic-bezier(.2,.78,.2,1),opacity .12s linear .38s}.li-skip{position:absolute;right:18px;bottom:18px;min-height:40px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,9,14,.48);color:#fff;padding:0 16px;font:800 11px system-ui}.li-dock .li-skip{opacity:0}@media(max-width:600px){.li-scene img{object-position:64% 45%}.li-badge{left:50%;top:30%;width:min(41vw,160px)}}@media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke"/><div className="li-badge" ref={badgeRef}><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/></div>
    <button className="li-skip" onClick={finish}>Skip intro</button>
  </div>
}
