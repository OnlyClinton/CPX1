"use client";

import {useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="impact"|"reveal"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("impact");
  const[sceneReady,setSceneReady]=useState(false);
  const[logoReady,setLogoReady]=useState(false);
  const[reduced,setReduced]=useState(false);
  const started=useRef(false);
  const ready=sceneReady&&logoReady;

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const forceFull=params.get("intro-motion")==="full"||params.get("owner-animation")==="1";
    setReduced(!forceFull&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const failSafe=window.setTimeout(()=>{setSceneReady(true);setLogoReady(true)},5500);
    return()=>window.clearTimeout(failSafe);
  },[]);

  useEffect(()=>{
    if(!ready||started.current)return;
    started.current=true;
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop");
    document.documentElement.classList.add("wdcc-intro-active");

    if(reduced){
      document.documentElement.classList.remove("wdcc-intro-active");
      setPhase("done");
      return;
    }

    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof");
      return()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")};
    }

    const reveal=window.setTimeout(()=>setPhase("reveal"),1150);
    const done=window.setTimeout(()=>{
      document.documentElement.classList.remove("wdcc-intro-active");
      setPhase("done");
    },2850);
    return()=>{
      window.clearTimeout(reveal);
      window.clearTimeout(done);
      document.documentElement.classList.remove("wdcc-intro-active");
    };
  },[ready,reduced]);

  const finish=()=>{
    document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");
    setPhase("done");
  };

  if(phase==="done")return null;
  const legacyPhase=phase==="impact"?"move":"handoff";

  return <div className={`li li-${phase}${ready?" li-ready":""}`} data-wdcc-intro-ready={ready?"true":"false"} data-wdcc-intro-motion={reduced?"reduced":"full"} data-wdcc-intro-phase={legacyPhase} data-wdcc-intro-v32-phase={phase} data-wdcc-intro-benchmark="wdcc-v32-storefront" aria-label="WDCC opening intro" onWheel={finish} onTouchMove={finish} onClick={finish}>
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#020305;isolation:isolate;opacity:1;visibility:visible;transition:opacity .42s cubic-bezier(.22,1,.36,1),visibility .42s linear}
      .li-scene{position:absolute;inset:-3%;z-index:1;overflow:hidden;pointer-events:none}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:68% 50%;filter:saturate(1.08) contrast(1.08) brightness(.83);transform:scale(1.09);transform-origin:68% 50%;will-change:transform,filter;animation:liV32Scene 2.65s cubic-bezier(.16,1,.3,1) forwards!important}
      .li:after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(90deg,rgba(2,5,9,.91) 0%,rgba(2,5,9,.71) 31%,rgba(2,5,9,.27) 62%,rgba(2,5,9,.06) 78%),radial-gradient(circle at 68% 55%,transparent 0%,rgba(2,5,9,.19) 56%,rgba(2,5,9,.79) 100%)}
      .li-smoke{position:absolute;z-index:3;filter:blur(36px);opacity:0;pointer-events:none;border-radius:50%}
      .li-smoke-one{left:8%;bottom:2%;width:58%;height:38%;background:radial-gradient(circle,rgba(255,255,255,.17),transparent 66%);animation:liV32SmokeOne 2.45s ease-out .14s both}
      .li-smoke-two{right:0;bottom:4%;width:48%;height:36%;background:radial-gradient(circle,rgba(22,138,244,.22),transparent 66%);animation:liV32SmokeTwo 2.6s ease-out .28s both}
      .li-badge{position:absolute;z-index:5;left:50%;top:49%;width:min(28vw,300px);aspect-ratio:1;opacity:0;transform:translate(-50%,-50%) scale(.78);will-change:transform,opacity;animation:liV32Badge .72s cubic-bezier(.16,1,.3,1) .12s forwards}
      .li-badge img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 14px 32px rgba(0,0,0,.66)) drop-shadow(0 0 30px rgba(22,138,244,.24))!important}
      .li-tag{position:absolute;z-index:6;left:50%;top:69%;transform:translate(-50%,8px);margin:0;color:#e8edf2!important;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap;font:900 11px/1 system-ui,sans-serif;opacity:0;animation:liV32Tag .72s ease .38s forwards}
      .li-skip{position:absolute;z-index:8;right:max(18px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));min-height:38px;border:1px solid rgba(255,255,255,.26);border-radius:999px;background:rgba(2,5,9,.60);color:#d8e0e7;padding:0 14px;text-transform:uppercase;font:900 10px/1 system-ui,sans-serif;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .li-reveal .li-tag{opacity:.78}
      @keyframes liV32Scene{0%{filter:saturate(1.05) contrast(1.06) brightness(.78);transform:scale(1.09)}55%{filter:saturate(1.09) contrast(1.09) brightness(.88);transform:scale(1.035)}100%{filter:saturate(1.10) contrast(1.10) brightness(.92);transform:scale(1.005)}}
      @keyframes liV32Badge{0%{opacity:0;transform:translate(-50%,-50%) scale(.78)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liV32Tag{0%{opacity:0;transform:translate(-50%,8px)}100%{opacity:1;transform:translate(-50%,0)}}
      @keyframes liV32SmokeOne{0%{opacity:0;transform:scale(.72) translateY(12%)}35%{opacity:.78}100%{opacity:0;transform:scale(1.5) translate(8%,-5%)}}
      @keyframes liV32SmokeTwo{0%{opacity:0;transform:scale(.68) translate(7%,10%)}38%{opacity:.72}100%{opacity:0;transform:scale(1.56) translate(-5%,-7%)}}
      @media(max-width:900px){.li-scene img{object-position:71% 50%;transform-origin:71% 50%}.li-badge{width:min(58vw,230px)}.li-tag{top:74%;font-size:9px}}
      @media(max-width:560px){.li-scene{inset:-1%}.li-scene img{object-position:73% 50%;transform-origin:73% 50%}.li-badge{width:min(64vw,230px)}}
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high" onLoad={()=>setSceneReady(true)} onError={()=>setSceneReady(true)}/></div>
    <div className="li-smoke li-smoke-one" aria-hidden="true"/>
    <div className="li-smoke li-smoke-two" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128" onLoad={()=>setLogoReady(true)} onError={()=>setLogoReady(true)}/></div>
    <p className="li-tag">Tampa Bay · Drive today</p>
    <button className="li-skip" type="button" onClick={e=>{e.stopPropagation();finish()}}>Skip intro</button>
  </div>;
}
