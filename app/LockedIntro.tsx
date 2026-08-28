"use client";

import {useLayoutEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"dock"|"done";

const INTRO_SESSION_KEY="wdcc-opening-seen-v1";
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
    },1780);
    const done=window.setTimeout(()=>{
      rememberIntro();
      document.documentElement.classList.remove("wdcc-intro-active");
      setPhase("done");
    },2600);
    return()=>{window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{rememberIntro();document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} data-wdcc-intro-phase={phase} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:rgba(5,13,20,1);isolation:isolate;opacity:1;transition:background-color .42s ease .12s,opacity .18s ease .60s}
      .li-dock{background:rgba(5,13,20,0);opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14;opacity:1;transition:opacity .46s cubic-bezier(.22,.72,.18,1)}
      .li-dock .li-scene{opacity:0}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(1.24) contrast(1.03) brightness(1.27);transform:scale(1.025)!important;animation:liSceneSettle 1.72s cubic-bezier(.18,.76,.22,1) .06s forwards!important;transition:none!important}
      .li-scene:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 52% 43%,rgba(120,184,236,.10),transparent 42%),linear-gradient(180deg,rgba(255,255,255,.025),transparent 48%);opacity:.9;animation:liBloomResolve 1.72s ease-out .08s forwards}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 56%,rgba(2,7,12,.08) 80%,rgba(2,7,12,.26) 100%)}
      @keyframes liBloomResolve{0%{opacity:.9}62%{opacity:.42}100%{opacity:0}}
      @keyframes liSceneSettle{from{transform:scale(1.025)}to{transform:scale(1)}}
      .li-smoke{position:absolute;inset:-8%;z-index:3;overflow:hidden;pointer-events:none;opacity:1;background:radial-gradient(ellipse at 18% 40%,rgba(236,242,247,.26) 0%,rgba(181,196,207,.12) 25%,transparent 54%),radial-gradient(ellipse at 80% 55%,rgba(225,234,241,.20) 0%,rgba(148,168,182,.10) 31%,transparent 59%),linear-gradient(180deg,rgba(15,31,43,.09),rgba(5,13,20,.22));backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96);will-change:opacity,backdrop-filter;animation:liSmokeClear 1.08s cubic-bezier(.16,.80,.24,1) .10s forwards}
      .li-dock .li-smoke{opacity:0!important;animation:none!important;transition:opacity .08s linear!important}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-10%;pointer-events:none;border-radius:50%;opacity:1;will-change:opacity,transform,filter}
      .li-smoke:before{background:radial-gradient(ellipse at 32% 52%,rgba(245,248,250,.24) 0%,rgba(184,199,210,.12) 31%,transparent 61%),radial-gradient(ellipse at 68% 36%,rgba(226,235,241,.20) 0%,rgba(170,188,201,.10) 29%,transparent 58%);filter:blur(19px);animation:liFogDrift 1.72s cubic-bezier(.18,.72,.20,1) .06s forwards}
      .li-smoke:after{background:linear-gradient(112deg,transparent 16%,rgba(255,255,255,.10) 42%,rgba(221,233,241,.06) 52%,transparent 74%);filter:blur(12px);animation:liMistDrift 1.58s ease-out .14s forwards}
      @keyframes liSmokeClear{0%{opacity:1;backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96)}42%{opacity:.82;backdrop-filter:blur(10px) saturate(.92) contrast(.98);-webkit-backdrop-filter:blur(10px) saturate(.92) contrast(.98)}76%{opacity:.28;backdrop-filter:blur(3px) saturate(.99) contrast(1);-webkit-backdrop-filter:blur(3px) saturate(.99) contrast(1)}100%{opacity:0;backdrop-filter:blur(0) saturate(1) contrast(1);-webkit-backdrop-filter:blur(0) saturate(1) contrast(1)}}
      @keyframes liFogDrift{0%{opacity:.96;filter:blur(19px);transform:translate3d(-2%,1%,0)}46%{opacity:.60;filter:blur(15px);transform:translate3d(.3%,-.2%,0)}80%{opacity:.18;filter:blur(10px);transform:translate3d(1.5%,-.8%,0)}100%{opacity:0;filter:blur(8px);transform:translate3d(2%,-1%,0)}}
      @keyframes liMistDrift{0%{opacity:.74;transform:translate3d(1.5%,0,0)}50%{opacity:.34;transform:translate3d(0,-.4%,0)}82%{opacity:.10;transform:translate3d(-1%,-.7%,0)}100%{opacity:0;transform:translate3d(-1.5%,-1%,0)}}
      .li-badge{position:absolute;z-index:4;left:50%;top:39%;width:clamp(236px,29vw,292px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:0 18px 52px rgba(0,0,0,.46);transform:translate(-50%,-50%) scale(.92);opacity:0;animation:liBadgeResolve .72s cubic-bezier(.16,.86,.24,1) .18s forwards!important;transition:transform .52s cubic-bezier(.2,.78,.2,1),opacity .14s linear .42s!important;overflow:visible;will-change:transform,opacity}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--li-dock-x,0px)),calc(-50% + var(--li-dock-y,-34vh))) scale(var(--li-dock-scale,.30));opacity:0!important;animation:none!important}
      @keyframes liBadgeResolve{0%{opacity:0;transform:translate(-50%,-50%) scale(.92)}58%{opacity:1;transform:translate(-50%,-50%) scale(1.025)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      .li-badge:before{content:"";position:absolute;inset:-12px;border-radius:50%;border:1px solid rgba(255,255,255,.52);box-shadow:0 0 0 1px rgba(74,154,230,.18),0 0 34px rgba(74,154,230,.26);opacity:0;animation:liBadgeHalo 1.36s ease-out .22s both;pointer-events:none}
      @keyframes liBadgeHalo{0%{opacity:0;box-shadow:0 0 0 1px rgba(74,154,230,.08),0 0 10px rgba(74,154,230,.08)}42%{opacity:.82;box-shadow:0 0 0 1px rgba(255,255,255,.34),0 0 34px rgba(74,154,230,.28)}100%{opacity:.18;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 18px rgba(74,154,230,.10)}}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important;transform:none!important;animation:none!important;transition:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:59%;transform:translateX(-50%);margin:0;padding:9px 14px;border:1px solid rgba(255,255,255,.52);border-radius:999px;background:rgba(2,9,15,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff!important;white-space:nowrap;font:950 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.085em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.98),0 0 12px rgba(255,255,255,.18);opacity:0;animation:liTagResolve .74s cubic-bezier(.2,.8,.2,1) .30s forwards;transition:opacity .10s linear!important}
      @keyframes liTagResolve{from{opacity:0}to{opacity:1}}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:opacity .10s linear!important}
      .li-dock .li-tag,.li-dock .li-skip{opacity:0!important;animation:none!important;pointer-events:none!important;transition:opacity .12s linear!important}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:64% 45%;filter:saturate(1.25) contrast(1.02) brightness(1.30)}html body .li .li-badge{top:38.5%!important;width:min(70vw,276px)!important;min-width:238px!important}html body .li .li-tag{top:59%!important;font-size:13px!important;letter-spacing:.06em!important;padding:9px 13px!important}.li-smoke{inset:-10%;backdrop-filter:blur(16px) saturate(.84);-webkit-backdrop-filter:blur(16px) saturate(.84)}}
      @media(max-width:430px){html body .li .li-badge{width:min(69vw,270px)!important;min-width:236px!important}html body .li .li-tag{font-size:12px!important;letter-spacing:.05em!important}}
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-smoke,.li-smoke:before,.li-smoke:after,.li-tag,.li-badge:before,.li-scene:before{animation:none!important;opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge" ref={badgeRef}><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128"/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
