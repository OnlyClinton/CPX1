"use client";

import type {CSSProperties} from "react";
import {useEffect,useState} from "react";

type Phase="reveal"|"dock"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("reveal");
  const[landing,setLanding]=useState({x:0,y:0,scale:.26});

  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const measure=()=>{
      const target=document.querySelector(".logoBrand img") as HTMLElement|null;
      const badge=document.querySelector(".li-badge") as HTMLElement|null;
      if(!target||!badge)return;
      const tr=target.getBoundingClientRect();
      const br=badge.getBoundingClientRect();
      const originX=window.innerWidth*.5;
      const originY=window.innerHeight*.43;
      const bw=br.width||300;
      setLanding({x:tr.left+tr.width/2-originX,y:tr.top+tr.height/2-originY,scale:Math.max(.16,Math.min(.5,tr.width/bw))});
    };
    const raf=requestAnimationFrame(()=>requestAnimationFrame(measure));
    window.addEventListener("resize",measure);
    const dock=window.setTimeout(()=>setPhase("dock"),1550);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2850);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const vars={"--dock-x":`${landing.x}px`,"--dock-y":`${landing.y}px`,"--dock-scale":landing.scale} as CSSProperties;

  return <div className={`li li-${phase}`} style={vars} aria-label="WDCC opening animation">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate}
      .li-scene,.li-car{position:absolute;inset:0;pointer-events:none}
      .li-scene{z-index:0;overflow:hidden}
      .li-scene img,.li-car img{display:block;width:100%;height:100%;object-fit:cover;object-position:68% center;visibility:visible;opacity:1}
      .li-scene img{filter:saturate(1.12) contrast(1.07) brightness(.98);animation:liScene 2.85s cubic-bezier(.2,.8,.2,1) both}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,5,10,.08),rgba(0,5,10,.08) 53%,rgba(0,5,10,.58)),radial-gradient(circle at 50% 45%,transparent 30%,rgba(0,0,0,.34) 100%)}
      .li-car{z-index:2;will-change:transform,opacity;-webkit-mask-image:radial-gradient(ellipse 38% 25% at 72% 67%,#000 0 48%,rgba(0,0,0,.96) 58%,transparent 75%);mask-image:radial-gradient(ellipse 38% 25% at 72% 67%,#000 0 48%,rgba(0,0,0,.96) 58%,transparent 75%)}
      .li-car img{filter:saturate(1.28) contrast(1.12) brightness(1.08) drop-shadow(0 25px 28px rgba(0,0,0,.72))}
      .li-reveal .li-car{animation:liCar 1.55s cubic-bezier(.12,.78,.16,1) both}
      .li-dock .li-car{opacity:.14;transition:opacity .6s ease}
      .li-smoke{position:absolute;z-index:3;left:58%;top:57%;width:min(1000px,110vw);height:min(480px,58vw);border-radius:50%;background:radial-gradient(ellipse,rgba(220,231,236,.42),rgba(109,136,151,.22) 38%,transparent 72%);filter:blur(35px);mix-blend-mode:screen;pointer-events:none;opacity:.42;transform:translate(-50%,-50%);animation:liSmoke 2.5s ease both}
      .li-badge{position:absolute;z-index:5;left:50%;top:43%;width:min(57vw,350px);aspect-ratio:1;display:grid;place-items:center;transform:translate(-50%,-50%);transform-origin:center;will-change:transform,opacity}
      .li-badge img{display:block;width:100%;height:100%;object-fit:contain;visibility:visible;opacity:1;filter:drop-shadow(0 18px 44px rgba(0,0,0,.92)) drop-shadow(0 0 20px rgba(255,255,255,.18))}
      .li-reveal .li-badge{animation:liBadge 1.55s cubic-bezier(.16,.84,.18,1) both}
      .li-badge:after{content:"";position:absolute;inset:-10%;border-radius:50%;border:2px solid transparent;pointer-events:none;animation:liImpact 1.62s ease-out both}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--dock-x)),calc(-50% + var(--dock-y))) scale(var(--dock-scale));transition:transform 1s cubic-bezier(.2,.85,.22,1),opacity .18s linear .82s}
      .li-tag{position:absolute;z-index:6;left:50%;top:68%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,3vw,16px)/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;text-shadow:0 2px 14px #000;animation:liTag 2.1s ease both}
      .li-dock .li-tag{opacity:0;transition:opacity .2s ease}
      .li-skip{position:absolute;z-index:8;right:max(20px,env(safe-area-inset-right));bottom:max(24px,calc(env(safe-area-inset-bottom) + 16px));border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(3,9,14,.72);color:#fff;padding:13px 20px;font:800 12px/1 system-ui,sans-serif}
      @keyframes liScene{0%{opacity:.76;transform:scale(1.08)}20%{opacity:1}100%{opacity:1;transform:scale(1.01)}}
      @keyframes liCar{0%{opacity:0;transform:translate3d(56vw,4vh,0) scale(1.02)}18%{opacity:.45}68%{opacity:1;transform:translate3d(-2vw,0,0) scale(1.02)}84%{transform:translate3d(1vw,0,0) scale(1.02)}100%{opacity:1;transform:translate3d(0,0,0) scale(1.02)}}
      @keyframes liBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.62) rotate(-4deg)}20%{opacity:1}65%{transform:translate(-50%,-50%) scale(1.08) rotate(1deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liImpact{0%,62%{opacity:0;border-color:transparent;box-shadow:0 0 0 0 rgba(240,31,47,0);transform:scale(.74)}71%{opacity:1;border-color:rgba(255,255,255,.82);box-shadow:0 0 0 12px rgba(240,31,47,.23)}100%{opacity:0;border-color:transparent;box-shadow:0 0 0 34px rgba(240,31,47,0);transform:scale(1.34)}}
      @keyframes liSmoke{0%{opacity:0;transform:translate(-62%,-45%) scale(.55)}36%{opacity:.5}100%{opacity:.14;transform:translate(-42%,-54%) scale(1.3)}}
      @keyframes liTag{0%,25%{opacity:0;transform:translate(-50%,10px)}46%,82%{opacity:.95;transform:translate(-50%,0)}100%{opacity:.72}}
      @media(max-width:600px){
        .li-scene img,.li-car img{object-position:74% center}
        .li-car{-webkit-mask-image:radial-gradient(ellipse 52% 27% at 72% 66%,#000 0 46%,rgba(0,0,0,.95) 57%,transparent 76%);mask-image:radial-gradient(ellipse 52% 27% at 72% 66%,#000 0 46%,rgba(0,0,0,.95) 57%,transparent 76%)}
        .li-badge{top:40%;width:min(64vw,292px)}
        .li-tag{top:66%;font-size:12px;letter-spacing:.13em}
        .li-smoke{left:64%;top:55%;width:122vw;height:72vw}
        @keyframes liCar{0%{opacity:0;transform:translate3d(72vw,4vh,0) scale(1.01)}20%{opacity:.45}70%{opacity:1;transform:translate3d(-3vw,0,0) scale(1.01)}86%{transform:translate3d(1.2vw,0,0) scale(1.01)}100%{opacity:1;transform:translate3d(0,0,0) scale(1.01)}}
      }
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-car" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">Tampa Bay · Drive today</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
