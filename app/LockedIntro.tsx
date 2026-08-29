"use client";

import {useLayoutEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"dock"|"done";
const KEY="wdcc-opening-seen-v2";
const seen=()=>{try{return sessionStorage.getItem(KEY)==="1"}catch{return false}};
const remember=()=>{try{sessionStorage.setItem(KEY,"1")}catch{}}

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const badgeRef=useRef<HTMLDivElement|null>(null);

  useLayoutEffect(()=>{
    const p=new URLSearchParams(location.search);
    const proof=navigator.webdriver===true&&(p.has("visual-mobile")||p.has("visual-desktop")||p.has("intro-proof"));
    const replay=p.get("intro")==="1"||p.has("intro-preview")||p.has("intro-proof");
    if(proof){document.documentElement.classList.add("wdcc-visual-proof","wdcc-intro-active");return()=>document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")}
    if(matchMedia("(prefers-reduced-motion: reduce)").matches||(seen()&&!replay)){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const dock=window.setTimeout(()=>{
      const badge=badgeRef.current;
      const target=document.querySelector<HTMLElement>('[data-wdcc-logo-art="owner-wordmark"],.logo-button');
      if(badge&&target){const a=badge.getBoundingClientRect(),b=target.getBoundingClientRect();badge.style.setProperty("--dx",`${b.left+b.width/2-(a.left+a.width/2)}px`);badge.style.setProperty("--dy",`${b.top+b.height/2-(a.top+a.height/2)}px`);badge.style.setProperty("--ds",String(Math.max(.18,Math.min(.42,(b.height/a.height)*.9))))}
      setPhase("dock");
    },1550);
    const done=window.setTimeout(()=>{remember();document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2350);
    return()=>{clearTimeout(dock);clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{remember();document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  return <div className={`li li-${phase}`} data-wdcc-intro-phase={phase} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate;opacity:1;transition:background-color .36s ease .1s,opacity .16s ease .54s}
      .li-dock{background:rgba(5,13,20,0);opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;background:#02070c;opacity:1;transition:opacity .4s cubic-bezier(.22,.72,.18,1)}
      .li-dock .li-scene{opacity:0}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(.82) contrast(1.08) brightness(.42);transform:scale(1.018);animation:liReveal 1.18s cubic-bezier(.18,.76,.22,1) .04s forwards}
      .li-scene:before{content:"";position:absolute;inset:-20% -35%;z-index:2;background:linear-gradient(112deg,transparent 35%,rgba(121,190,255,.03) 42%,rgba(255,255,255,.22) 49%,rgba(244,31,49,.10) 54%,transparent 62%);transform:translateX(-42%);opacity:0;animation:liSweep .72s cubic-bezier(.2,.72,.18,1) .22s both}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:radial-gradient(circle at 65% 48%,transparent 24%,rgba(2,7,12,.12) 58%,rgba(2,7,12,.54) 100%),linear-gradient(90deg,rgba(2,7,12,.56),rgba(2,7,12,.12) 42%,rgba(2,7,12,.02) 76%)}
      @keyframes liReveal{0%{filter:saturate(.82) contrast(1.08) brightness(.42);transform:scale(1.018)}58%{filter:saturate(1.08) contrast(1.06) brightness(.86)}100%{filter:saturate(1.18) contrast(1.04) brightness(1.03);transform:scale(1)}}
      @keyframes liSweep{0%{opacity:0;transform:translateX(-42%)}34%{opacity:.78}100%{opacity:0;transform:translateX(42%)}}
      .li-smoke{position:absolute;inset:42% -12% -18%;z-index:3;opacity:0;background:radial-gradient(ellipse at 72% 72%,rgba(218,230,239,.24),rgba(130,154,171,.10) 30%,transparent 66%),radial-gradient(ellipse at 28% 88%,rgba(210,224,233,.16),transparent 58%);filter:blur(17px);animation:liSmoke 1.16s cubic-bezier(.16,.8,.24,1) .18s forwards}
      .li-dock .li-smoke{opacity:0!important;animation:none!important}
      @keyframes liSmoke{0%{opacity:0;transform:translate3d(3%,8%,0) scale(1.08)}32%{opacity:.48}100%{opacity:.08;transform:translate3d(-2%,-3%,0) scale(1)}}
      .li-badge{position:absolute;z-index:4;left:23%;top:46%;width:clamp(154px,16vw,194px);aspect-ratio:1;display:grid;place-items:center;transform:translate(-50%,-50%) scale(.84);opacity:0;animation:liBadge .54s cubic-bezier(.16,.86,.24,1) .48s forwards;transition:transform .5s cubic-bezier(.2,.78,.2,1),opacity .12s linear .38s;will-change:transform,opacity}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--dx,0px)),calc(-50% + var(--dy,-34vh))) scale(var(--ds,.30));opacity:0!important;animation:none!important}
      @keyframes liBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.84)}72%{opacity:1;transform:translate(-50%,-50%) scale(1.025)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      .li-badge:before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1px solid rgba(255,255,255,.32);box-shadow:0 0 24px rgba(43,139,235,.18)}
      .li-badge img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));min-height:40px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,9,14,.48);color:#fff;padding:0 16px;font:800 11px/1 system-ui,sans-serif;backdrop-filter:blur(7px)}
      .li-dock .li-skip{opacity:0;pointer-events:none}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:64% 45%}.li .li-badge{left:50%!important;top:30%!important;width:min(41vw,160px)!important;min-width:138px!important}.li-smoke{inset:48% -22% -20%}}
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge" ref={badgeRef}><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128"/></div>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
