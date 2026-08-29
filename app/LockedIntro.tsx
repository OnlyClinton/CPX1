"use client";

import {useEffect,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const[sceneReady,setSceneReady]=useState(false);
  const[logoReady,setLogoReady]=useState(false);
  const[reduced,setReduced]=useState(false);
  const ready=sceneReady&&logoReady;

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const forceFull=params.get("intro-motion")==="full"||params.get("owner-animation")==="1";
    setReduced(!forceFull&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const failSafe=window.setTimeout(()=>{setSceneReady(true);setLogoReady(true)},6000);
    return()=>window.clearTimeout(failSafe);
  },[]);

  useEffect(()=>{
    if(!ready||phase!=="show")return;
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop");
    document.documentElement.classList.add("wdcc-intro-active");
    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof");
      return()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")};
    }
    const exitDelay=reduced?1050:2680;
    const doneDelay=reduced?1220:3160;
    const exit=window.setTimeout(()=>setPhase("exit"),exitDelay);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},doneDelay);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[ready,reduced,phase]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}${ready?" li-ready":""}${reduced?" li-reduced":""}`} data-wdcc-intro-ready={ready?"true":"false"} data-wdcc-intro-motion={reduced?"reduced":"full"} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .48s cubic-bezier(.22,.72,.18,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(1.24) contrast(1.03) brightness(1.22);transform:none!important;animation:none!important;transition:none!important;opacity:.72}
      .li-ready .li-scene img{opacity:1;transition:opacity .28s ease-out!important}
      .li-scene:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 52% 43%,rgba(120,184,236,.16),transparent 42%),linear-gradient(180deg,rgba(255,255,255,.04),transparent 48%);opacity:.94}
      .li-ready .li-scene:before{animation:liBloomResolve 1.9s ease-out .04s forwards}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 56%,rgba(2,7,12,.08) 80%,rgba(2,7,12,.26) 100%)}
      @keyframes liBloomResolve{0%{opacity:.94}58%{opacity:.46}100%{opacity:0}}
      .li-smoke{position:absolute;inset:-8%;z-index:3;overflow:hidden;pointer-events:none;opacity:1;background:radial-gradient(ellipse at 18% 40%,rgba(236,242,247,.32) 0%,rgba(181,196,207,.15) 25%,transparent 54%),radial-gradient(ellipse at 80% 55%,rgba(225,234,241,.26) 0%,rgba(148,168,182,.12) 31%,transparent 59%),linear-gradient(180deg,rgba(15,31,43,.12),rgba(5,13,20,.26));backdrop-filter:blur(16px) saturate(.84) contrast(.96);-webkit-backdrop-filter:blur(16px) saturate(.84) contrast(.96);will-change:opacity,backdrop-filter}
      .li-ready .li-smoke{animation:liSmokeClear 1.42s cubic-bezier(.16,.80,.24,1) .08s forwards}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-10%;pointer-events:none;border-radius:50%;opacity:1;will-change:opacity,transform,filter}
      .li-smoke:before{background:radial-gradient(ellipse at 32% 52%,rgba(245,248,250,.29) 0%,rgba(184,199,210,.14) 31%,transparent 61%),radial-gradient(ellipse at 68% 36%,rgba(226,235,241,.24) 0%,rgba(170,188,201,.12) 29%,transparent 58%);filter:blur(20px)}
      .li-ready .li-smoke:before{animation:liFogDrift 1.92s cubic-bezier(.18,.72,.20,1) .04s forwards}
      .li-smoke:after{background:linear-gradient(112deg,transparent 16%,rgba(255,255,255,.13) 42%,rgba(221,233,241,.08) 52%,transparent 74%);filter:blur(13px)}
      .li-ready .li-smoke:after{animation:liMistDrift 1.72s ease-out .12s forwards}
      @keyframes liSmokeClear{0%{opacity:1;backdrop-filter:blur(16px) saturate(.84) contrast(.96);-webkit-backdrop-filter:blur(16px) saturate(.84) contrast(.96)}42%{opacity:.84;backdrop-filter:blur(11px) saturate(.91) contrast(.98);-webkit-backdrop-filter:blur(11px) saturate(.91) contrast(.98)}76%{opacity:.30;backdrop-filter:blur(3px) saturate(.99) contrast(1);-webkit-backdrop-filter:blur(3px) saturate(.99) contrast(1)}100%{opacity:0;backdrop-filter:blur(0) saturate(1) contrast(1);-webkit-backdrop-filter:blur(0) saturate(1) contrast(1)}}
      @keyframes liFogDrift{0%{opacity:.98;filter:blur(20px);transform:translate3d(-2%,1%,0)}46%{opacity:.62;filter:blur(15px);transform:translate3d(.3%,-.2%,0)}80%{opacity:.18;filter:blur(10px);transform:translate3d(1.5%,-.8%,0)}100%{opacity:0;filter:blur(8px);transform:translate3d(2%,-1%,0)}}
      @keyframes liMistDrift{0%{opacity:.82;transform:translate3d(1.5%,0,0)}50%{opacity:.36;transform:translate3d(0,-.4%,0)}82%{opacity:.10;transform:translate3d(-1%,-.7%,0)}100%{opacity:0;transform:translate3d(-1.5%,-1%,0)}}
      .li-badge{position:absolute;z-index:4;left:50%;top:39%;width:clamp(236px,29vw,292px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:0 18px 52px rgba(0,0,0,.46);transform:translate(-50%,-50%)!important;overflow:visible;opacity:0;filter:blur(7px) brightness(1.35)}
      .li-ready .li-badge{animation:liBadgeResolve 1.18s cubic-bezier(.16,.82,.22,1) .18s both!important}
      @keyframes liBadgeResolve{0%{opacity:0;filter:blur(7px) brightness(1.38)}38%{opacity:.84;filter:blur(2px) brightness(1.22)}70%{opacity:1;filter:blur(0) brightness(1.10)}100%{opacity:1;filter:blur(0) brightness(1)}}
      .li-badge:before{content:"";position:absolute;inset:-12px;border-radius:50%;border:1px solid rgba(255,255,255,.58);box-shadow:0 0 0 1px rgba(74,154,230,.20),0 0 40px rgba(74,154,230,.30);opacity:0;pointer-events:none}
      .li-ready .li-badge:before{animation:liBadgeHalo 1.64s ease-out .24s both}
      .li-badge:after{content:"";position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,rgba(111,190,255,.18),rgba(111,190,255,.04) 48%,transparent 70%);opacity:0;pointer-events:none}
      .li-ready .li-badge:after{animation:liBadgeGlow 1.82s ease-out .20s both}
      @keyframes liBadgeHalo{0%{opacity:0;box-shadow:0 0 0 1px rgba(74,154,230,.06),0 0 10px rgba(74,154,230,.08)}42%{opacity:.88;box-shadow:0 0 0 1px rgba(255,255,255,.38),0 0 42px rgba(74,154,230,.32)}100%{opacity:.20;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 18px rgba(74,154,230,.10)}}
      @keyframes liBadgeGlow{0%{opacity:0}38%{opacity:.85}100%{opacity:.10}}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important;transform:none!important;animation:none!important;transition:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:59%;transform:translateX(-50%);margin:0;padding:9px 14px;border:1px solid rgba(255,255,255,.52);border-radius:999px;background:rgba(2,9,15,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff!important;white-space:nowrap;font:950 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.085em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.98),0 0 12px rgba(255,255,255,.18);opacity:0}
      .li-ready .li-tag{animation:liTagResolve .86s cubic-bezier(.2,.8,.2,1) .62s forwards}
      @keyframes liTagResolve{from{opacity:0}to{opacity:1}}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .li:not(.li-ready) .li-skip{opacity:.45}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:61% 45%;filter:saturate(1.25) contrast(1.02) brightness(1.25)}html body .li .li-badge{top:38.5%!important;width:min(70vw,276px)!important;min-width:238px!important}html body .li .li-tag{top:59%!important;font-size:13px!important;letter-spacing:.06em!important;padding:9px 13px!important}.li-smoke{inset:-10%;backdrop-filter:blur(16px) saturate(.84);-webkit-backdrop-filter:blur(16px) saturate(.84)}}
      @media(max-width:430px){html body .li .li-badge{width:min(69vw,270px)!important;min-width:236px!important}html body .li .li-tag{font-size:12px!important;letter-spacing:.05em!important}}
      .li-reduced .li-smoke,.li-reduced .li-smoke:before,.li-reduced .li-smoke:after,.li-reduced .li-scene:before{animation:none!important;opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      .li-reduced .li-badge{animation:none!important;opacity:1!important;filter:none!important}
      .li-reduced .li-badge:before,.li-reduced .li-badge:after{animation:none!important;opacity:.12!important}
      .li-reduced .li-tag{animation:none!important;opacity:1!important}
      @media(prefers-reduced-motion:reduce){.li{transition-duration:.14s!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high" onLoad={()=>setSceneReady(true)} onError={()=>setSceneReady(true)}/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128" onLoad={()=>setLogoReady(true)} onError={()=>setLogoReady(true)}/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
