"use client";

import {useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"handoff"|"exit"|"done";
const INTRO_KEY="wdcc-owner-cinematic-intro-v3";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const rootRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop")||navigator.webdriver===true;
    const forceReplay=params.has("intro")||params.has("owner-webgpu")||params.has("owner-cinematic");
    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof","wdcc-intro-active");
      return()=>document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active","wdcc-intro-handoff");
    }
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    if(!forceReplay){try{if(sessionStorage.getItem(INTRO_KEY)==="seen"){setPhase("done");return}}catch{}}
    try{sessionStorage.setItem(INTRO_KEY,"seen")}catch{}
    document.documentElement.classList.add("wdcc-intro-active");
    const handoff=window.setTimeout(()=>{document.documentElement.classList.add("wdcc-intro-handoff");setPhase("handoff")},1320);
    const exit=window.setTimeout(()=>setPhase("exit"),1440);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active","wdcc-intro-handoff");setPhase("done")},1910);
    return()=>{window.clearTimeout(handoff);window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active","wdcc-intro-handoff")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active","wdcc-intro-handoff");setPhase("done")};
  if(phase==="done")return null;

  return <div ref={rootRef} className={`li li-${phase} li-owner-cinematic`} aria-label="WDCC opening intro" data-wdcc-cinematic-intro="owner-v3">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-utility,
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-header,
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-inner,
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-shade{opacity:0!important;transition:opacity .34s cubic-bezier(.2,.8,.2,1)!important}
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-utility,
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-header,
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-inner,
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-shade{opacity:1!important}
      html.wdcc-intro-active body main.reference-home.locked-storefront .rh-hero-art{object-position:59% 48%!important;filter:saturate(1.18) contrast(1.04) brightness(1.14)!important;transition:filter .42s ease-out!important}
      html.wdcc-intro-handoff body main.reference-home.locked-storefront .rh-hero-art{filter:saturate(1.07) contrast(1.04) brightness(1.02)!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#020810;isolation:isolate;opacity:1;transition:opacity .46s cubic-bezier(.2,.78,.2,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:-1.5%;z-index:1;overflow:hidden;background:#020810;transform:scale(1.024);animation:liSceneResolve 1.58s cubic-bezier(.16,.82,.2,1) forwards}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:59% 48%;filter:saturate(1.18) contrast(1.04) brightness(1.14)}
      @keyframes liSceneResolve{0%{transform:scale(1.024);filter:blur(1.8px)}42%{filter:blur(.45px)}100%{transform:scale(1);filter:blur(0)}}
      .li-vignette{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 59% 50%,transparent 0 32%,rgba(1,7,12,.04) 54%,rgba(1,7,12,.52) 100%),linear-gradient(180deg,rgba(1,7,12,.10),transparent 52%,rgba(1,7,12,.32));animation:liVignette 1.48s ease-out forwards}
      @keyframes liVignette{0%{opacity:.96}100%{opacity:.58}}
      .li-smoke{position:absolute;inset:-12%;z-index:3;pointer-events:none;overflow:hidden;opacity:1;background:radial-gradient(ellipse at 18% 56%,rgba(245,249,252,.40),rgba(164,186,202,.18) 25%,transparent 58%),radial-gradient(ellipse at 75% 38%,rgba(236,244,249,.30),rgba(148,174,193,.14) 28%,transparent 59%);backdrop-filter:blur(13px) saturate(.88);-webkit-backdrop-filter:blur(13px) saturate(.88);animation:liSmokeClear 1.08s cubic-bezier(.14,.78,.2,1) .05s forwards}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-10%;border-radius:50%;pointer-events:none}
      .li-smoke:before{background:radial-gradient(ellipse at 34% 52%,rgba(255,255,255,.28),rgba(201,216,227,.10) 35%,transparent 62%);filter:blur(22px);animation:liFogDrift 1.32s ease-out forwards}
      .li-smoke:after{background:linear-gradient(108deg,transparent 22%,rgba(255,255,255,.13) 44%,rgba(157,206,246,.08) 52%,transparent 72%);filter:blur(10px);animation:liMistSweep 1.12s ease-out .08s forwards}
      @keyframes liSmokeClear{0%{opacity:1;backdrop-filter:blur(13px) saturate(.88);-webkit-backdrop-filter:blur(13px) saturate(.88)}50%{opacity:.62;backdrop-filter:blur(8px) saturate(.94);-webkit-backdrop-filter:blur(8px) saturate(.94)}100%{opacity:0;backdrop-filter:blur(0) saturate(1);-webkit-backdrop-filter:blur(0) saturate(1)}}
      @keyframes liFogDrift{0%{opacity:.92;transform:translate3d(-3%,2%,0) scale(1.03)}100%{opacity:0;transform:translate3d(3%,-2%,0) scale(.98)}}
      @keyframes liMistSweep{0%{opacity:.78;transform:translate3d(-6%,0,0)}100%{opacity:0;transform:translate3d(7%,-1%,0)}}
      .li-light{position:absolute;z-index:4;left:-25%;top:14%;width:58%;height:120%;pointer-events:none;opacity:0;background:linear-gradient(112deg,transparent 35%,rgba(255,255,255,.10) 47%,rgba(82,170,255,.12) 51%,transparent 64%);filter:blur(9px);transform:skewX(-12deg);animation:liLightPass .78s cubic-bezier(.2,.7,.2,1) .28s forwards}
      @keyframes liLightPass{0%{opacity:0;transform:translateX(-8%) skewX(-12deg)}25%{opacity:.78}100%{opacity:0;transform:translateX(170%) skewX(-12deg)}}
      .li-badge{position:absolute;z-index:6;left:50%;top:39%;width:clamp(232px,28vw,300px);aspect-ratio:1;transform:translate(-50%,-50%) scale(.88);display:grid;place-items:center;opacity:0;animation:liBadgeResolve .64s cubic-bezier(.12,.86,.22,1) .16s forwards,liBadgeSettle .40s ease-out 1.03s forwards}
      .li-badge:before,.li-badge:after{content:"";position:absolute;border-radius:50%;pointer-events:none}
      .li-badge:before{inset:-15px;border:1px solid rgba(255,255,255,.48);box-shadow:0 0 0 1px rgba(58,154,238,.20),0 0 42px rgba(58,154,238,.28);opacity:0;animation:liHalo .72s ease-out .24s forwards}
      .li-badge:after{inset:-34px;border:1px solid rgba(239,31,47,.22);opacity:0;animation:liImpactRing .68s cubic-bezier(.12,.78,.2,1) .44s forwards}
      @keyframes liBadgeResolve{0%{opacity:0;transform:translate(-50%,-50%) scale(.88)}68%{opacity:1;transform:translate(-50%,-50%) scale(1.025)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liBadgeSettle{from{opacity:1}to{opacity:.94}}
      @keyframes liHalo{0%{opacity:0;transform:scale(.82)}45%{opacity:.88}100%{opacity:.20;transform:scale(1.08)}}
      @keyframes liImpactRing{0%{opacity:0;transform:scale(.70)}34%{opacity:.75}100%{opacity:0;transform:scale(1.30)}}
      .li-badge img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 17px 34px rgba(0,0,0,.52));transform:none!important}
      .li-tag{position:absolute;z-index:7;left:50%;top:59%;transform:translateX(-50%);margin:0;padding:9px 15px;border:1px solid rgba(255,255,255,.44);border-radius:999px;background:rgba(2,9,15,.70);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;white-space:nowrap;font:950 clamp(12px,1.2vw,15px)/1 system-ui,sans-serif;letter-spacing:.075em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.9);opacity:0;animation:liTagIn .42s ease-out .48s forwards,liTagOut .30s ease-in 1.18s forwards}
      @keyframes liTagIn{from{opacity:0;transform:translate(-50%,5px)}to{opacity:1;transform:translate(-50%,0)}}
      @keyframes liTagOut{from{opacity:1}to{opacity:0}}
      .li-skip{position:absolute;z-index:9;right:max(16px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));min-height:42px;border:1px solid rgba(255,255,255,.40);border-radius:999px;background:rgba(3,9,14,.68);color:#fff;padding:0 16px;font:850 11px/1 system-ui,sans-serif;letter-spacing:.035em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .wdcc-visual-proof .li-scene,.wdcc-visual-proof .li-smoke,.wdcc-visual-proof .li-light,.wdcc-visual-proof .li-badge,.wdcc-visual-proof .li-tag{animation-play-state:paused!important;animation-delay:-.62s!important}.wdcc-visual-proof .li-badge,.wdcc-visual-proof .li-tag{opacity:1!important}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:62% 46%;filter:saturate(1.20) contrast(1.03) brightness(1.17)}.li-badge{top:38%;width:min(68vw,272px);min-width:226px}.li-tag{top:59%;font-size:12px;letter-spacing:.055em;padding:8px 12px}.li-smoke{inset:-14%}}
      @media(max-width:430px){.li-badge{width:min(66vw,260px);min-width:220px}.li-tag{font-size:11px}.li-skip{min-height:40px;padding:0 13px;font-size:10px}}
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-scene,.li-smoke,.li-smoke:before,.li-smoke:after,.li-light,.li-badge,.li-badge:before,.li-badge:after,.li-tag{animation:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-vignette" aria-hidden="true"/>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-light" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
