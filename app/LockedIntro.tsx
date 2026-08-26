"use client";

import type {CSSProperties} from "react";
import {useEffect,useState} from "react";

type Phase="reveal"|"dock"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("reveal");
  const[landing,setLanding]=useState({x:0,y:0,scale:.32});

  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const measure=()=>{
      const target=document.querySelector(".logoBrand img") as HTMLElement|null;
      const badge=document.querySelector(".li-badge") as HTMLElement|null;
      if(!target||!badge)return;
      const tr=target.getBoundingClientRect();
      const br=badge.getBoundingClientRect();
      const originX=br.left+br.width/2;
      const originY=br.top+br.height/2;
      const bw=br.width||220;
      setLanding({x:tr.left+tr.width/2-originX,y:tr.top+tr.height/2-originY,scale:Math.max(.22,Math.min(.62,tr.width/bw))});
    };
    const raf=requestAnimationFrame(()=>requestAnimationFrame(measure));
    window.addEventListener("resize",measure);
    const dock=window.setTimeout(()=>setPhase("dock"),1950);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},3050);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const vars={"--dock-x":`${landing.x}px`,"--dock-y":`${landing.y}px`,"--dock-scale":landing.scale} as CSSProperties;

  return <div className={`li li-${phase}`} style={vars} aria-label="WDCC opening animation">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate}
      .li-backdrop{display:none!important}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#02070c}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:66% center;filter:saturate(1.12) contrast(1.06) brightness(.82)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,.02) 0%,rgba(2,7,12,.03) 40%,rgba(2,7,12,.35) 67%,#02070c 100%),radial-gradient(circle at 52% 42%,transparent 30%,rgba(0,0,0,.20) 100%)}
      .li-smoke{display:none!important}
      .li-badge{position:absolute;z-index:5;left:50%;top:43%;width:min(23vw,220px);aspect-ratio:1;display:grid;place-items:center;transform:translate(-50%,-50%);transform-origin:center;will-change:transform,opacity;border-radius:50%;background:radial-gradient(circle at 50% 42%,#fff 0 61%,#edf1f4 62% 68%,#07121c 69% 72%,transparent 73%);box-shadow:0 20px 48px rgba(0,0,0,.72),0 0 0 2px rgba(255,255,255,.75),0 0 30px rgba(239,31,47,.16)}
      .li-badge img{display:block;width:90%;height:90%;object-fit:contain;visibility:visible;opacity:1;border-radius:50%;clip-path:circle(49% at 50% 50%);background:transparent}
      .li-reveal .li-badge{animation:liBadge 1.25s .48s cubic-bezier(.16,.84,.18,1) both}
      .li-badge:before{content:"";position:absolute;inset:-9%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),rgba(239,31,47,.07) 42%,transparent 70%);opacity:0;pointer-events:none;animation:liFlash 1.65s .48s ease-out both}
      .li-badge:after{content:"";position:absolute;inset:-6%;border-radius:50%;border:2px solid transparent;pointer-events:none;animation:liImpact 1.65s .45s ease-out both}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--dock-x)),calc(-50% + var(--dock-y))) scale(var(--dock-scale));transition:transform .88s cubic-bezier(.2,.85,.22,1),opacity .16s linear .72s}
      .li-tag{position:absolute;z-index:6;left:50%;top:70%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,1.35vw,15px)/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 2px 14px #000;animation:liTag 2.1s ease both}
      .li-dock .li-tag{opacity:0;transition:opacity .18s ease}
      .li-skip{position:absolute;z-index:8;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));border:1px solid rgba(255,255,255,.38);border-radius:999px;background:rgba(3,9,14,.78);color:#fff;padding:12px 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}
      @keyframes liBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.72)}25%{opacity:1}72%{transform:translate(-50%,-50%) scale(1.04)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liImpact{0%,48%{opacity:0;border-color:transparent;box-shadow:0 0 0 0 rgba(240,31,47,0);transform:scale(.78)}61%{opacity:.9;border-color:rgba(255,255,255,.84);box-shadow:0 0 0 10px rgba(240,31,47,.20)}100%{opacity:0;border-color:transparent;box-shadow:0 0 0 30px rgba(240,31,47,0);transform:scale(1.28)}}
      @keyframes liFlash{0%,48%{opacity:0;transform:scale(.82)}60%{opacity:.75;transform:scale(1)}82%{opacity:.12}100%{opacity:0;transform:scale(1.12)}}
      @keyframes liTag{0%,26%{opacity:0;transform:translate(-50%,7px)}48%,84%{opacity:.94;transform:translate(-50%,0)}100%{opacity:.72}}
      @media(max-width:600px){
        .li-scene{inset:0;background:#02070c}
        .li-scene img{position:absolute;width:138vw;height:auto;max-width:none;left:50%;top:7vh;transform:translateX(-50%);object-fit:contain;object-position:center;filter:saturate(1.14) contrast(1.06) brightness(.88)}
        .li-scene:after{background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,.02) 34%,rgba(2,7,12,.24) 50%,rgba(2,7,12,.74) 64%,#02070c 78%,#02070c 100%)}
        .li-badge{top:42%;width:min(41vw,160px)}
        .li-tag{top:68%;font-size:12px;letter-spacing:.12em}
        .li-skip{right:14px;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));padding:11px 16px;font-size:12px}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-badge"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
