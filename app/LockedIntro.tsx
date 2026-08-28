"use client";

import {useLayoutEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"dock"|"done";

const INTRO_SESSION_KEY="wdcc-opening-seen-v2";
const introSeen=()=>{try{return window.sessionStorage.getItem(INTRO_SESSION_KEY)==="1"}catch{return false}};
const rememberIntro=()=>{try{window.sessionStorage.setItem(INTRO_SESSION_KEY,"1")}catch{/* Storage can be unavailable in privacy-restricted browsers. */}};

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const badgeRef=useRef<HTMLDivElement|null>(null);

  useLayoutEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    // Hold only inside automated screenshot browsers. A real phone opening a
    // visual-mobile/visual-desktop review URL must still receive the normal
    // short intro and handoff instead of being trapped behind proof mode.
    const proofHold=navigator.webdriver===true&&(params.has("visual-mobile")||params.has("visual-desktop")||params.has("intro-proof"));
    const forceReplay=params.get("intro")==="1"||params.has("intro-preview")||params.has("intro-proof");
    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof","wdcc-intro-active");
      return()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")};
    }
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seenThisSession=introSeen();
    if(reducedMotion||(seenThisSession&&!forceReplay)){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const dock=window.setTimeout(()=>{
      const badge=badgeRef.current;
      const target=document.querySelector<HTMLElement>('[data-wdcc-logo-art="owner-wordmark"]');
      if(badge&&target){
        const from=badge.getBoundingClientRect();
        const to=target.getBoundingClientRect();
        badge.style.setProperty("--li-dock-x",`${to.left+to.width/2-(from.left+from.width/2)}px`);
        badge.style.setProperty("--li-dock-y",`${to.top+to.height/2-(from.top+from.height/2)}px`);
        badge.style.setProperty("--li-dock-scale",String(Math.max(.18,Math.min(.42,(to.height/from.height)*.9))));
      }
      setPhase("dock");
    },1550);
    const done=window.setTimeout(()=>{
      rememberIntro();
      document.documentElement.classList.remove("wdcc-intro-active");
      setPhase("done");
    },2350);
    return()=>{window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{rememberIntro();document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} data-wdcc-intro-phase={phase} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:rgba(2,7,12,1);isolation:isolate;opacity:1;transition:background-color .36s ease .10s,opacity .16s ease .54s}
      .li-dock{background:rgba(5,13,20,0);opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#02070c;opacity:1;transition:opacity .40s cubic-bezier(.22,.72,.18,1)}
      .li-dock .li-scene{opacity:0}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(.82) contrast(1.08) brightness(.42);transform:scale(1.018)!important;animation:liSceneReveal 1.18s cubic-bezier(.18,.76,.22,1) .04s forwards!important;transition:none!important}
      .li-scene:before{content:"";position:absolute;inset:-20% -35%;z-index:2;pointer-events:none;background:linear-gradient(112deg,transparent 35%,rgba(121,190,255,.03) 42%,rgba(255,255,255,.22) 49%,rgba(244,31,49,.10) 54%,transparent 62%);transform:translateX(-42%);opacity:0;animation:liLightSweep .72s cubic-bezier(.2,.72,.18,1) .22s both}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:radial-gradient(circle at 65% 48%,transparent 24%,rgba(2,7,12,.12) 58%,rgba(2,7,12,.54) 100%),linear-gradient(90deg,rgba(2,7,12,.56) 0%,rgba(2,7,12,.12) 42%,rgba(2,7,12,.02) 76%)}
      @keyframes liSceneReveal{0%{filter:saturate(.82) contrast(1.08) brightness(.42);transform:scale(1.018)}58%{filter:saturate(1.08) contrast(1.06) brightness(.86)}100%{filter:saturate(1.18) contrast(1.04) brightness(1.03);transform:scale(1)}}
      @keyframes liLightSweep{0%{opacity:0;transform:translateX(-42%)}34%{opacity:.78}100%{opacity:0;transform:translateX(42%)}}
      .li-smoke{position:absolute;inset:42% -12% -18%;z-index:3;overflow:hidden;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 72% 72%,rgba(218,230,239,.24) 0%,rgba(130,154,171,.10) 30%,transparent 66%),radial-gradient(ellipse at 28% 88%,rgba(210,224,233,.16) 0%,transparent 58%);filter:blur(17px);will-change:opacity,transform;animation:liSmokeDrift 1.16s cubic-bezier(.16,.80,.24,1) .18s forwards}
      .li-dock .li-smoke{opacity:0!important;animation:none!important;transition:opacity .08s linear!important}
      @keyframes liSmokeDrift{0%{opacity:0;transform:translate3d(3%,8%,0) scale(1.08)}32%{opacity:.48}100%{opacity:.08;transform:translate3d(-2%,-3%,0) scale(1)}}
      .li-badge{position:absolute;z-index:4;left:23%;top:46%;width:clamp(154px,16vw,194px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:none;transform:translate(-50%,-50%) scale(.84);opacity:0;animation:liBadgeResolve .54s cubic-bezier(.16,.86,.24,1) .48s forwards!important;transition:transform .50s cubic-bezier(.2,.78,.2,1),opacity .12s linear .38s!important;overflow:visible;will-change:transform,opacity}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--li-dock-x,0px)),calc(-50% + var(--li-dock-y,-34vh))) scale(var(--li-dock-scale,.30));opacity:0!important;animation:none!important}
      @keyframes liBadgeResolve{0%{opacity:0;transform:translate(-50%,-50%) scale(.84)}72%{opacity:1;transform:translate(-50%,-50%) scale(1.025)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      .li-badge:before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1px solid rgba(255,255,255,.32);box-shadow:0 0 24px rgba(43,139,235,.18);opacity:0;animation:liBadgeHalo .72s ease-out .52s both;pointer-events:none}
      @keyframes liBadgeHalo{0%{opacity:0;transform:scale(.92)}48%{opacity:.66}100%{opacity:.14;transform:scale(1.08)}}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important;transform:none!important;animation:none!important;transition:none!important}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));min-height:40px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,9,14,.48);color:#fff;padding:0 16px;font:800 11px/1 system-ui,sans-serif;letter-spacing:.02em;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);transition:opacity .10s linear!important}
      .li-dock .li-skip{opacity:0!important;animation:none!important;pointer-events:none!important;transition:opacity .10s linear!important}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:64% 45%}html body .li .li-badge{left:50%!important;top:30%!important;width:min(41vw,160px)!important;min-width:138px!important;max-width:160px!important}.li-smoke{inset:48% -22% -20%}}
      @media(max-width:430px){html body .li .li-badge{width:min(40vw,154px)!important;min-width:132px!important}}
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-smoke,.li-badge:before,.li-scene:before{animation:none!important;opacity:0!important;filter:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge" ref={badgeRef}><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128"/></div>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
