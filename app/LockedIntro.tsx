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
    const dock=window.setTimeout(()=>setPhase("dock"),1880);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},3180);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",measure);window.clearTimeout(dock);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;
  const vars={"--dock-x":`${landing.x}px`,"--dock-y":`${landing.y}px`,"--dock-scale":landing.scale} as CSSProperties;

  return <div className={`li li-${phase}`} style={vars} aria-label="WDCC opening animation">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate}
      .li-backdrop,.li-scene,.li-car{position:absolute;pointer-events:none;overflow:hidden}
      .li-backdrop{inset:-5%;z-index:0;background:#02070c}
      .li-backdrop img{display:block;width:100%;height:100%;object-fit:cover;object-position:67% center;filter:blur(15px) saturate(1.14) contrast(1.08) brightness(.27);transform:scale(1.12)}
      .li-backdrop:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,5,10,.12),rgba(0,5,10,.2) 48%,rgba(0,5,10,.86)),radial-gradient(circle at 50% 42%,transparent 16%,rgba(0,0,0,.58) 100%)}
      .li-scene{inset:-2%;z-index:1}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:66% center;filter:saturate(1.08) contrast(1.07) brightness(.68)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,5,10,.02),rgba(0,5,10,.1) 54%,rgba(0,5,10,.72)),radial-gradient(circle at 52% 44%,transparent 27%,rgba(0,0,0,.28) 100%)}
      .li-car{inset:-2%;z-index:2;will-change:transform,opacity;-webkit-mask-image:radial-gradient(ellipse 43% 31% at 70% 66%,#000 0 49%,rgba(0,0,0,.96) 58%,transparent 76%);mask-image:radial-gradient(ellipse 43% 31% at 70% 66%,#000 0 49%,rgba(0,0,0,.96) 58%,transparent 76%)}
      .li-car img{display:block;width:100%;height:100%;object-fit:cover;object-position:66% center;filter:saturate(1.22) contrast(1.1) brightness(1.03) drop-shadow(0 24px 30px rgba(0,0,0,.68))}
      .li-reveal .li-car{animation:liCar 1.72s cubic-bezier(.13,.78,.15,1) both}
      .li-dock .li-car{opacity:.12;transition:opacity .55s ease}
      .li-smoke{position:absolute;z-index:3;left:61%;top:63%;width:min(1050px,112vw);height:min(500px,59vw);border-radius:50%;background:radial-gradient(ellipse,rgba(236,243,247,.46),rgba(108,135,151,.2) 38%,transparent 72%);filter:blur(35px);mix-blend-mode:screen;pointer-events:none;opacity:.38;transform:translate(-50%,-50%);animation:liSmoke 2.7s ease both}
      .li-badge{position:absolute;z-index:5;left:50%;top:43%;width:min(25vw,238px);aspect-ratio:1;display:grid;place-items:center;transform:translate(-50%,-50%);transform-origin:center;will-change:transform,opacity;border-radius:50%;background:radial-gradient(circle at 50% 42%,#fff 0 61%,#edf1f4 62% 68%,#07121c 69% 72%,transparent 73%);box-shadow:0 22px 54px rgba(0,0,0,.78),0 0 0 2px rgba(255,255,255,.8),0 0 36px rgba(239,31,47,.18)}
      .li-badge img{display:block;width:88%;height:88%;object-fit:contain;visibility:visible;opacity:1;border-radius:50%;clip-path:circle(49% at 50% 50%)}
      .li-reveal .li-badge{animation:liBadge 1.35s .72s cubic-bezier(.16,.84,.18,1) both}
      .li-badge:before{content:"";position:absolute;inset:-10%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.25),rgba(239,31,47,.08) 42%,transparent 70%);opacity:0;pointer-events:none;animation:liFlash 1.9s .55s ease-out both}
      .li-badge:after{content:"";position:absolute;inset:-7%;border-radius:50%;border:2px solid transparent;pointer-events:none;animation:liImpact 1.9s .52s ease-out both}
      .li-dock .li-badge{transform:translate(calc(-50% + var(--dock-x)),calc(-50% + var(--dock-y))) scale(var(--dock-scale));transition:transform 1.02s cubic-bezier(.2,.85,.22,1),opacity .18s linear .86s}
      .li-tag{position:absolute;z-index:6;left:50%;top:69%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(11px,2vw,14px)/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 2px 14px #000;animation:liTag 2.35s ease both}
      .li-dock .li-tag{opacity:0;transition:opacity .2s ease}
      .li-skip{position:absolute;z-index:8;right:max(20px,env(safe-area-inset-right));bottom:max(24px,calc(env(safe-area-inset-bottom) + 16px));border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(3,9,14,.72);color:#fff;padding:12px 18px;font:800 11px/1 system-ui,sans-serif;letter-spacing:.04em;backdrop-filter:blur(8px)}
      @keyframes liCar{0%{opacity:.04;transform:translate3d(46vw,3vh,0) scale(1.055)}17%{opacity:.38}68%{opacity:1;transform:translate3d(-1.5vw,0,0) scale(1.018)}84%{transform:translate3d(.7vw,0,0) scale(1.008)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      @keyframes liBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.58) rotate(-4deg)}24%{opacity:1}67%{transform:translate(-50%,-50%) scale(1.07) rotate(1deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @keyframes liImpact{0%,51%{opacity:0;border-color:transparent;box-shadow:0 0 0 0 rgba(240,31,47,0);transform:scale(.72)}63%{opacity:1;border-color:rgba(255,255,255,.92);box-shadow:0 0 0 12px rgba(240,31,47,.24)}100%{opacity:0;border-color:transparent;box-shadow:0 0 0 38px rgba(240,31,47,0);transform:scale(1.38)}}
      @keyframes liFlash{0%,51%{opacity:0;transform:scale(.76)}62%{opacity:.95;transform:scale(1)}80%{opacity:.16}100%{opacity:0;transform:scale(1.18)}}
      @keyframes liSmoke{0%{opacity:0;transform:translate(-66%,-42%) scale(.48)}34%{opacity:.52}100%{opacity:.1;transform:translate(-40%,-55%) scale(1.38)}}
      @keyframes liTag{0%,30%{opacity:0;transform:translate(-50%,8px)}50%,82%{opacity:.94;transform:translate(-50%,0)}100%{opacity:.62}}
      @media(max-width:600px){
        .li-backdrop{inset:-8%}.li-backdrop img{object-position:70% center;filter:blur(14px) saturate(1.12) contrast(1.08) brightness(.25)}
        .li-scene{inset:auto -12vw auto -12vw;top:5vh;height:49vh;-webkit-mask-image:linear-gradient(to bottom,#000 0 82%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0 82%,transparent 100%)}
        .li-scene img{object-position:70% center;filter:saturate(1.08) contrast(1.08) brightness(.67)}
        .li-car{inset:auto -12vw auto -12vw;top:5vh;height:49vh;-webkit-mask-image:radial-gradient(ellipse 58% 32% at 69% 67%,#000 0 48%,rgba(0,0,0,.94) 57%,transparent 77%);mask-image:radial-gradient(ellipse 58% 32% at 69% 67%,#000 0 48%,rgba(0,0,0,.94) 57%,transparent 77%)}
        .li-car img{object-position:70% center}
        .li-badge{top:40%;width:min(43vw,174px)}
        .li-tag{top:63%;font-size:10px;letter-spacing:.15em}
        .li-smoke{left:62%;top:49%;width:114vw;height:68vw;opacity:.3}
        @keyframes liCar{0%{opacity:.04;transform:translate3d(72vw,3vh,0) scale(1.04)}18%{opacity:.38}69%{opacity:1;transform:translate3d(-3vw,0,0) scale(1.015)}85%{transform:translate3d(1vw,0,0) scale(1.006)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-backdrop" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-car" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}