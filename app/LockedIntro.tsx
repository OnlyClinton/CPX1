"use client";

import {useEffect,useRef,useState} from "react";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");
  const[sceneReady,setSceneReady]=useState(false);
  const[logoReady,setLogoReady]=useState(false);
  const[reduced,setReduced]=useState(false);
  const rootRef=useRef<HTMLDivElement|null>(null);
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
    const exitDelay=reduced?1100:2920;
    const doneDelay=reduced?1280:3420;
    const exit=window.setTimeout(()=>setPhase("exit"),exitDelay);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},doneDelay);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[ready,reduced,phase]);

  useEffect(()=>{
    if(!ready||reduced||phase!=="show")return;
    const root=rootRef.current;if(!root)return;
    let raf=0,last=performance.now(),angle=0;
    const start=last;
    const frame=(now:number)=>{
      const elapsed=(now-start)/1000,dt=Math.min(.034,(now-last)/1000);last=now;
      let rpm=0;
      if(elapsed<.28)rpm=8+30*(elapsed/.28);
      else if(elapsed<1.18)rpm=38-12*((elapsed-.28)/.90);
      else if(elapsed<2.35)rpm=26*(1-((elapsed-1.18)/1.17));
      angle+=rpm*dt;
      root.style.setProperty("--li-spin",`${angle}rad`);
      root.style.setProperty("--li-wheel-blur",`${Math.min(2.6,rpm*.075)}px`);
      root.style.setProperty("--li-rpm",String(Math.min(1,rpm/38)));
      root.style.setProperty("--li-road",`${Math.round(elapsed*260)}px`);
      if(elapsed<2.65)raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>cancelAnimationFrame(raf);
  },[ready,reduced,phase]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div ref={rootRef} className={`li li-${phase}${ready?" li-ready":""}${reduced?" li-reduced":""}`} data-wdcc-intro-ready={ready?"true":"false"} data-wdcc-intro-motion={reduced?"reduced":"full"} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{--li-spin:0rad;--li-wheel-blur:0px;--li-rpm:0;--li-road:0px;position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .50s cubic-bezier(.22,.72,.18,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:blur(7px) saturate(.88) contrast(.98) brightness(.88);opacity:.80;transition:none!important}
      .li-ready .li-scene img{animation:liFocus 1.34s cubic-bezier(.16,.80,.24,1) forwards!important}
      @keyframes liFocus{0%{filter:blur(7px) saturate(.88) contrast(.98) brightness(.88);opacity:.80}44%{filter:blur(3px) saturate(1.03) contrast(1.01) brightness(1.05);opacity:.94}100%{filter:blur(0) saturate(1.25) contrast(1.04) brightness(1.22);opacity:1}}
      .li-scene:after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 55%,rgba(2,7,12,.10) 78%,rgba(2,7,12,.30) 100%)}
      .li-wheel{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:url('/wdcc-hero-v2.webp');background-size:cover;background-position:64% 45%;filter:blur(var(--li-wheel-blur)) saturate(1.18) brightness(1.12);opacity:calc(.80 + var(--li-rpm)*.20);will-change:transform,filter;transform:rotate(var(--li-spin))}
      .li-wheel-front{clip-path:circle(9.2% at 77.7% 69.4%);transform-origin:77.7% 69.4%}
      .li-wheel-rear{clip-path:circle(7.9% at 96% 67.8%);transform-origin:96% 67.8%;transform:rotate(calc(var(--li-spin) * .96))}
      .li-speed{position:absolute;z-index:3;left:-30%;right:-30%;bottom:7%;height:23%;pointer-events:none;opacity:calc(var(--li-rpm)*.58);background:repeating-linear-gradient(100deg,transparent 0 78px,rgba(126,194,255,.20) 80px 82px,transparent 84px 148px,rgba(255,255,255,.09) 150px 152px,transparent 154px 214px);background-position-x:var(--li-road);filter:blur(1.4px);mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)}
      .li-sweep{position:absolute;z-index:3;top:17%;bottom:12%;left:-42%;width:31%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(160,217,255,.05) 20%,rgba(228,246,255,.30) 52%,rgba(97,179,255,.07) 76%,transparent);filter:blur(7px);opacity:0;transform:skewX(-14deg)}
      .li-ready:not(.li-reduced) .li-sweep{animation:liSweep 1.35s cubic-bezier(.22,.74,.18,1) .24s forwards}
      @keyframes liSweep{0%{left:-42%;opacity:0}18%{opacity:.72}80%{opacity:.26}100%{left:116%;opacity:0}}
      .li-smoke{position:absolute;inset:-10%;z-index:4;overflow:hidden;pointer-events:none;opacity:1;background:radial-gradient(ellipse at 18% 40%,rgba(236,242,247,.34) 0%,rgba(181,196,207,.16) 25%,transparent 54%),radial-gradient(ellipse at 80% 55%,rgba(225,234,241,.28) 0%,rgba(148,168,182,.13) 31%,transparent 59%),linear-gradient(180deg,rgba(15,31,43,.12),rgba(5,13,20,.26));backdrop-filter:blur(17px) saturate(.83);-webkit-backdrop-filter:blur(17px) saturate(.83)}
      .li-ready:not(.li-reduced) .li-smoke{animation:liSmokeClear 1.58s cubic-bezier(.16,.80,.24,1) .08s forwards}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-12%;pointer-events:none;border-radius:50%;opacity:1;will-change:opacity,transform,filter}
      .li-smoke:before{background:radial-gradient(ellipse at 32% 52%,rgba(245,248,250,.32) 0%,rgba(184,199,210,.15) 31%,transparent 61%),radial-gradient(ellipse at 68% 36%,rgba(226,235,241,.27) 0%,rgba(170,188,201,.13) 29%,transparent 58%);filter:blur(21px)}
      .li-ready:not(.li-reduced) .li-smoke:before{animation:liFogDrift 2.18s cubic-bezier(.18,.72,.20,1) .04s forwards}
      .li-smoke:after{background:linear-gradient(112deg,transparent 14%,rgba(255,255,255,.15) 40%,rgba(221,233,241,.09) 52%,transparent 76%);filter:blur(13px)}
      .li-ready:not(.li-reduced) .li-smoke:after{animation:liMistDrift 1.92s ease-out .12s forwards}
      @keyframes liSmokeClear{0%{opacity:1}42%{opacity:.84}78%{opacity:.28}100%{opacity:0}}
      @keyframes liFogDrift{0%{opacity:.98;transform:translate3d(-5%,3%,0);filter:blur(21px)}48%{opacity:.62;transform:translate3d(1%,-1%,0);filter:blur(15px)}100%{opacity:0;transform:translate3d(8%,-4%,0);filter:blur(8px)}}
      @keyframes liMistDrift{0%{opacity:.86;transform:translate3d(7%,1%,0)}55%{opacity:.34;transform:translate3d(-1%,-1%,0)}100%{opacity:0;transform:translate3d(-9%,-3%,0)}}
      .li-badge{position:absolute;z-index:5;left:50%;top:39%;width:clamp(236px,29vw,292px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:transparent;box-shadow:0 18px 52px rgba(0,0,0,.46);transform:translate(-50%,-50%);overflow:visible;opacity:0;filter:blur(8px) brightness(1.42)}
      .li-ready .li-badge{animation:liBadgeResolve 1.22s cubic-bezier(.16,.82,.22,1) .22s both}
      @keyframes liBadgeResolve{0%{opacity:0;filter:blur(8px) brightness(1.45);transform:translate(-50%,-50%) scale(.82)}52%{opacity:1;filter:blur(1px) brightness(1.16);transform:translate(-50%,-50%) scale(1.035)}100%{opacity:1;filter:blur(0) brightness(1);transform:translate(-50%,-50%) scale(1)}}
      .li-badge:before{content:"";position:absolute;inset:-13px;border-radius:50%;border:1px solid rgba(255,255,255,.60);box-shadow:0 0 0 1px rgba(74,154,230,.22),0 0 44px rgba(74,154,230,.34);opacity:0;pointer-events:none}
      .li-ready .li-badge:before{animation:liBadgeHalo 1.78s ease-out .28s both}
      @keyframes liBadgeHalo{0%{opacity:0;transform:scale(.82)}42%{opacity:.92;transform:scale(1.06)}100%{opacity:.18;transform:scale(1.14)}}
      .li-badge img{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;object-fit:contain;border-radius:0!important;clip-path:none!important;opacity:1!important;filter:drop-shadow(0 12px 28px rgba(0,0,0,.48))!important}
      .li-tag{position:absolute;z-index:6;left:50%;top:59%;transform:translateX(-50%);margin:0;padding:9px 14px;border:1px solid rgba(255,255,255,.52);border-radius:999px;background:rgba(2,9,15,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#fff!important;white-space:nowrap;font:950 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.085em;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.98),0 0 12px rgba(255,255,255,.18);opacity:0}
      .li-ready .li-tag{animation:liTagResolve .82s cubic-bezier(.2,.8,.2,1) .72s forwards}
      @keyframes liTagResolve{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
      .li-skip{position:absolute;z-index:7;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      @media(max-width:600px),(max-width:1180px) and (hover:none) and (pointer:coarse){.li-scene img{object-position:61% 45%}.li-wheel{background-position:61% 45%}.li-wheel-front{clip-path:circle(10.2% at 76.5% 70.4%);transform-origin:76.5% 70.4%}.li-wheel-rear{clip-path:circle(8.5% at 96% 69.0%);transform-origin:96% 69.0%}html body .li .li-badge{top:38.5%!important;width:min(70vw,276px)!important;min-width:238px!important}html body .li .li-tag{top:59%!important;font-size:13px!important;letter-spacing:.06em!important;padding:9px 13px!important}}
      @media(max-width:430px){html body .li .li-badge{width:min(69vw,270px)!important;min-width:236px!important}html body .li .li-tag{font-size:12px!important;letter-spacing:.05em!important}}
      .li-reduced .li-wheel,.li-reduced .li-speed,.li-reduced .li-sweep,.li-reduced .li-smoke,.li-reduced .li-smoke:before,.li-reduced .li-smoke:after{display:none!important}.li-reduced .li-scene img{animation:none!important;filter:none!important;opacity:1!important}.li-reduced .li-badge{animation:none!important;opacity:1!important;filter:none!important;transform:translate(-50%,-50%)!important}.li-reduced .li-tag{animation:none!important;opacity:1!important}
      @media(prefers-reduced-motion:reduce){.li{transition-duration:.14s!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high" onLoad={()=>setSceneReady(true)} onError={()=>setSceneReady(true)}/></div>
    <div className="li-wheel li-wheel-front" aria-hidden="true"/><div className="li-wheel li-wheel-rear" aria-hidden="true"/>
    <div className="li-speed" aria-hidden="true"/><div className="li-sweep" aria-hidden="true"/><div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img data-wdcc-intro-badge-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128" onLoad={()=>setLogoReady(true)} onError={()=>setLogoReady(true)}/></div>
    <p className="li-tag">We Don&apos;t Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
