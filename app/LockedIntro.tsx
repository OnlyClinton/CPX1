"use client";

import {useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"move"|"handoff"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
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
    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof");
      return()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")};
    }

    const timers:number[]=[];
    if(reduced){
      timers.push(window.setTimeout(()=>setPhase("handoff"),260));
      timers.push(window.setTimeout(()=>setPhase("exit"),760));
      timers.push(window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},960));
    }else{
      timers.push(window.setTimeout(()=>setPhase("move"),120));
      timers.push(window.setTimeout(()=>setPhase("handoff"),1780));
      timers.push(window.setTimeout(()=>setPhase("exit"),2720));
      timers.push(window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},3220));
    }
    return()=>{timers.forEach(window.clearTimeout);document.documentElement.classList.remove("wdcc-intro-active")};
  },[ready,reduced]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}${ready?" li-ready":""}${reduced?" li-reduced":""}`} data-wdcc-intro-ready={ready?"true":"false"} data-wdcc-intro-motion={reduced?"reduced":"full"} data-wdcc-intro-phase={phase} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .50s cubic-bezier(.22,.72,.18,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:-2%;z-index:1;overflow:hidden;pointer-events:none;background:#050d14;opacity:1;transition:opacity .82s cubic-bezier(.22,.72,.18,1)}
      .li-scene img{display:block;width:104%;height:104%;margin:-2%;object-fit:cover;object-position:64% 45%;filter:blur(7px) saturate(.90) contrast(.98) brightness(.88);opacity:.84;transform:scale(1.13) translate3d(1.8%,.6%,0);transform-origin:64% 45%;transition:transform 2.35s cubic-bezier(.16,.82,.18,1),filter 1.30s cubic-bezier(.16,.82,.18,1),opacity .9s ease;will-change:transform,filter,opacity}
      .li-ready.li-show .li-scene img{filter:blur(5px) saturate(.96) contrast(1) brightness(.94);opacity:.90}
      .li-ready.li-move .li-scene img{filter:blur(0) saturate(1.24) contrast(1.04) brightness(1.18);opacity:1;transform:scale(1.045) translate3d(.25%,0,0)}
      .li-ready.li-handoff .li-scene img{filter:blur(0) saturate(1.20) contrast(1.04) brightness(1.12);opacity:1;transform:scale(1.005) translate3d(0,0,0)}
      .li-handoff .li-scene{opacity:.18}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:radial-gradient(circle at 52% 39%,rgba(120,184,236,.12),transparent 38%),linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 54%,rgba(2,7,12,.10) 77%,rgba(2,7,12,.31) 100%);transition:opacity .7s ease}
      .li-handoff .li-scene:after{opacity:.15}
      .li-light-sweep{position:absolute;z-index:2;top:12%;bottom:9%;left:-44%;width:34%;pointer-events:none;background:linear-gradient(102deg,transparent 0%,rgba(150,210,255,.04) 18%,rgba(235,248,255,.34) 50%,rgba(95,177,255,.08) 78%,transparent 100%);filter:blur(8px);opacity:0;transform:skewX(-13deg);will-change:left,opacity}
      .li-move .li-light-sweep{animation:liSweep 1.28s cubic-bezier(.18,.78,.20,1) .05s forwards}
      @keyframes liSweep{0%{left:-44%;opacity:0}15%{opacity:.72}78%{opacity:.24}100%{left:118%;opacity:0}}
      .li-smoke{position:absolute;inset:-11%;z-index:3;overflow:hidden;pointer-events:none;opacity:1;background:radial-gradient(ellipse at 17% 42%,rgba(238,244,248,.34) 0%,rgba(182,198,210,.16) 25%,transparent 54%),radial-gradient(ellipse at 81% 54%,rgba(226,236,242,.27) 0%,rgba(149,169,184,.13) 31%,transparent 60%),linear-gradient(180deg,rgba(15,31,43,.12),rgba(5,13,20,.27));backdrop-filter:blur(17px) saturate(.84);-webkit-backdrop-filter:blur(17px) saturate(.84);transition:opacity .68s ease}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-12%;pointer-events:none;border-radius:50%;opacity:1;will-change:opacity,transform,filter}
      .li-smoke:before{background:radial-gradient(ellipse at 31% 52%,rgba(245,248,250,.32) 0%,rgba(184,199,210,.15) 31%,transparent 61%),radial-gradient(ellipse at 68% 35%,rgba(226,235,241,.27) 0%,rgba(170,188,201,.13) 29%,transparent 58%);filter:blur(21px)}
      .li-smoke:after{background:linear-gradient(112deg,transparent 14%,rgba(255,255,255,.15) 40%,rgba(221,233,241,.09) 52%,transparent 76%);filter:blur(13px)}
      .li-move .li-smoke{animation:liSmokeClear 1.58s cubic-bezier(.16,.80,.24,1) forwards}
      .li-move .li-smoke:before{animation:liFogDrift 1.88s cubic-bezier(.18,.72,.20,1) forwards}
      .li-move .li-smoke:after{animation:liMistDrift 1.72s ease-out .08s forwards}
      .li-handoff .li-smoke{opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      @keyframes liSmokeClear{0%{opacity:1}42%{opacity:.82}78%{opacity:.26}100%{opacity:0}}
      @keyframes liFogDrift{0%{opacity:.98;transform:translate3d(-5%,3%,0);filter:blur(21px)}48%{opacity:.60;transform:translate3d(1%,-1%,0);filter:blur(15px)}100%{opacity:0;transform:translate3d(9%,-4%,0);filter:blur(8px)}}
      @keyframes liMistDrift{0%{opacity:.86;transform:translate3d(7%,1%,0)}55%{opacity:.33;transform:translate3d(-1%,-1%,0)}100%{opacity:0;transform:translate3d(-9%,-3%,0)}}
      .li-badge{position:absolute;z-index:5;left:50%;top:39%;width:clamp(236px,29vw,292px);height:auto;aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:0 18px 52px rgba(0,0,0,.46);transform:translate(-50%,-50%) scale(.72);transform-origin:center;overflow:visible;opacity:0;filter:blur(8px) brightness(1.42);transition:left .86s cubic-bezier(.16,.82,.18,1),top .86s cubic-bezier(.16,.82,.18,1),width .86s cubic-bezier(.16,.82,.18,1),min-width .86s cubic-bezier(.16,.82,.18,1),transform .86s cubic-bezier(.16,.82,.18,1),opacity .50s ease,filter .62s ease,box-shadow .62s ease;will-change:left,top,width,transform,opacity,filter}
      .li-ready.li-show .li-badge,.li-ready.li-move .li-badge{opacity:1;filter:blur(0) brightness(1);transform:translate(-50%,-50%) scale(1)}
      .li-ready.li-move .li-badge{transform:translate(-50%,-50%) scale(1.035);box-shadow:0 20px 58px rgba(0,0,0,.52),0 0 38px rgba(74,154,230,.16)}
      .li-badge:before{content:"";position:absolute;inset:-13px;border-radius:50%;border:1px solid rgba(255,255,255,.60);box-shadow:0 0 0 1px rgba(74,154,230,.22),0 0 44px rgba(74,154,230,.34);opacity:0;transition:opacity .35s ease,transform .70s ease;pointer-events:none}
      .li-ready.li-move .li-badge:before{opacity:.56;transform:scale(1.10)}
      .li-handoff .li-badge:before{opacity:0!important}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important}
      html body .li.li-handoff .li-badge{left:max(31px,calc((100vw - 1420px)/2 + 31px))!important;top:36px!important;width:62px!important;min-width:62px!important;max-width:62px!important;height:62px!important;min-height:62px!important;max-height:62px!important;transform:translate(-50%,0) scale(1)!important;filter:none!important;opacity:1!important;box-shadow:0 8px 22px rgba(0,0,0,.34)!important}
      .li-tag{position:absolute;z-index:6;left:50%;top:59%;transform:translate(-50%,8px);margin:0;padding:9px 14px;border:1px solid rgba(255,255,255,.52);border-radius:999px;background:rgba(2,9,15,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff!important;white-space:nowrap;font:950 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.085em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.98),0 0 12px rgba(255,255,255,.18);opacity:0;transition:opacity .48s ease,transform .58s cubic-bezier(.2,.8,.2,1)}
      .li-ready.li-move .li-tag{opacity:1;transform:translate(-50%,0)}
      .li-handoff .li-tag{opacity:0!important;transform:translate(-50%,-12px)!important}
      .li-skip{position:absolute;z-index:7;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:opacity .35s ease}
      .li-handoff .li-skip{opacity:0;pointer-events:none}
      @media(max-width:767px){
        .li-scene img{object-position:61% 45%;transform-origin:61% 45%}
        html body .li.li-show .li-badge,html body .li.li-move .li-badge{left:50%!important;top:38.5%!important;width:min(52vw,206px)!important;min-width:174px!important;max-width:206px!important;height:auto!important;min-height:0!important;max-height:none!important}
        html body .li.li-handoff .li-badge{left:50%!important;top:4px!important;width:56px!important;min-width:56px!important;max-width:56px!important;height:56px!important;min-height:56px!important;max-height:56px!important;transform:translate(-50%,0) scale(1)!important}
        html body .li .li-tag{top:59%!important;font-size:12px!important;letter-spacing:.05em!important;padding:9px 13px!important}
      }
      @media(max-width:430px){html body .li.li-show .li-badge,html body .li.li-move .li-badge{width:min(51vw,198px)!important;min-width:170px!important;max-width:198px!important}}
      .li-reduced .li-light-sweep,.li-reduced .li-smoke,.li-reduced .li-smoke:before,.li-reduced .li-smoke:after{display:none!important}
      .li-reduced .li-scene img{filter:none!important;opacity:1!important;transform:scale(1.015)!important;transition-duration:.42s!important}
      .li-reduced .li-badge{filter:none!important;opacity:1!important;transition-duration:.42s!important}
      .li-reduced .li-tag{opacity:0!important}
      @media(prefers-reduced-motion:reduce){.li{transition-duration:.14s!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high" onLoad={()=>setSceneReady(true)} onError={()=>setSceneReady(true)}/></div>
    <div className="li-light-sweep" aria-hidden="true"/>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128" onLoad={()=>setLogoReady(true)} onError={()=>setLogoReady(true)}/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>;
}
