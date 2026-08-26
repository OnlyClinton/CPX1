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
      const originX=br.left+br.width/2;
      const originY=br.top+br.height/2;
      const bw=br.width||260;
      setLanding({x:tr.left+tr.width/2-originX,y:tr.top+tr.height/2-originY,scale:Math.max(.16,Math.min(.56,tr.width/bw))});
    };
    const raf=requestAnimationFrame(()=>requestAnimationFrame(measure));
    window.addEventListener("resize",measure);
    const dock=window.setTimeout(()=>setPhase("dock"),1650);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2950);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const vars={"--dock-x":`${landing.x}px`,"--dock-y":`${landing.y}px`,"--dock-scale":landing.scale} as CSSProperties;

  return <div className={`li li-${phase}`} style={vars} aria-label="WDCC opening animation">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate}
      .li-backdrop,.li-scene{position:absolute;pointer-events:none;overflow:hidden}
      .li-backdrop{inset:-5%;z-index:0;background:#02070c}
      .li-backdrop img{display:block;width:100%;height:100%;object-fit:cover;object-position:67% center;filter:blur(15px) saturate(1.18) contrast(1.08) brightness(.34);transform:scale(1.12)}
      .li-backdrop:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,5,10,.1),rgba(0,5,10,.18) 48%,rgba(0,5,10,.82)),radial-gradient(circle at 50% 40%,transparent 18%,rgba(0,0,0,.52) 100%)}
      .li-scene{inset:-4%;z-index:1;will-change:transform,opacity}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:66% center;visibility:visible;opacity:1;filter:saturate(1.16) contrast(1.08) brightness(.92)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,5,10,.02),rgba(0,5,10,.04) 54%,rgba(0,5,10,.6)),radial-gradient(circle at 52% 44%,transparent 31%,rgba(0,0,0,.24) 100%)}
      .li-reveal .li-scene{animation:liScene 2.85s cubic-bezier(.16,.84,.18,1) both}
      .li-smoke{position:absolute;z-index:3;left:58%;top:58%;width:min(1000px,110vw);height:min(480px,58vw);border-radius:50%;background:radial-gradient(ellipse,rgba(225,235,240,.38),rgba(105,132,149,.2) 38%,transparent 72%);filter:blur(34px);mix-blend-mode:screen;pointer-events:none;opacity:.38;transform:translate(-50%,-50%);animation:liSmoke 2.6s ease both}
      .li-badge{position:absolute;z-index:5;left:50%;top:43%;width:min(29vw,270px);aspect-ratio:1;display:grid;place-items:center;transform:translate(-50%,-50%);transform-origin:center;will-change:transform,opacity;filter:drop-shadow(0 20px 46px rgba(0,0,0,.94)) drop-shadow(0 0 28px rgba(255,255,255,.14))}
      .li-badge img{display:block;width:100%;height:100%;object-fit:cover;visibility:visible;opacity:1;border-radius:50%;clip-path:circle(49% at 50% 50%)}
      .li-reveal .li-badge{animation:liBadge 1.48s cubic-bezier(.16,.84,.18,1) both}
      .li-badge:after{content:"";position:absolute;inset:-6%;border-radius:50%;border:2px solid transparent;pointer-events:none;animation:liImpact 1.72s ease-out both}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--dock-x)),calc(-50% + var(--dock-y))) scale(var(--dock-scale));transition:transform 1s cubic-bezier(.2,.85,.22,1),opacity .18s linear .82s}
      .li-tag{position:absolute;z-index:6;left:50%;top:68%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,3vw,16px)/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;text-shadow:0 2px 14px #000;animation:liTag 2.2s ease both}
      .li-dock .li-tag{opacity:0;transition:opacity .2s ease}
      .li-skip{position:absolute;z-index:8;right:max(20px,env(safe-area-inset-right));bottom:max(24px,calc(env(safe-area-inset-bottom) + 16px));border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(3,9,14,.72);color:#fff;padding:13px 20px;font:800 12px/1 system-ui,sans-serif;backdrop-filter:blur(8px)}
      @keyframes liScene{0%{opacity:.8;transform:translate3d(5%,0,0) scale(1.06)}24%{opacity:1}72%{transform:translate3d(-.8%,0,0) scale(1.015)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      @keyframes liBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.64) rotate(-4deg)}18%{opacity:1}64%{transform:translate(-50%,-50%) scale(1.08) rotate(1deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liImpact{0%,58%{opacity:0;border-color:transparent;box-shadow:0 0 0 0 rgba(240,31,47,0);transform:scale(.76)}69%{opacity:1;border-color:rgba(255,255,255,.86);box-shadow:0 0 0 12px rgba(240,31,47,.22)}100%{opacity:0;border-color:transparent;box-shadow:0 0 0 35px rgba(240,31,47,0);transform:scale(1.32)}}
      @keyframes liSmoke{0%{opacity:0;transform:translate(-62%,-45%) scale(.55)}36%{opacity:.46}100%{opacity:.12;transform:translate(-42%,-54%) scale(1.3)}}
      @keyframes liTag{0%,25%{opacity:0;transform:translate(-50%,10px)}46%,82%{opacity:.96;transform:translate(-50%,0)}100%{opacity:.74}}
      @media(max-width:600px){
        .li-backdrop{inset:-8%}.li-backdrop img{object-position:69% center;filter:blur(14px) saturate(1.18) contrast(1.08) brightness(.3)}
        .li-scene{inset:auto -10vw auto -10vw;top:8vh;height:46vh;-webkit-mask-image:linear-gradient(to bottom,#000 0 78%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0 78%,transparent 100%)}
        .li-scene img{object-position:66% center;filter:saturate(1.18) contrast(1.08) brightness(1)}
        .li-badge{top:39.5%;width:min(48vw,190px)}
        .li-tag{top:62%;font-size:12px;letter-spacing:.13em}
        .li-smoke{left:60%;top:48%;width:112vw;height:66vw;opacity:.3}
        @keyframes liScene{0%{opacity:.78;transform:translate3d(13vw,1vh,0) scale(1.08)}24%{opacity:1}72%{transform:translate3d(-1.5vw,0,0) scale(1.02)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-backdrop" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">Tampa Bay · Drive today</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
