"use client";

import {useEffect,useState} from "react";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");

  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const exit=window.setTimeout(()=>setPhase("exit"),1760);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2080);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate;opacity:1!important}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#02070c}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:68% 42%;filter:saturate(1.18) contrast(1.02) brightness(1.17)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,0) 58%,rgba(2,7,12,.14) 80%,rgba(2,7,12,.42) 100%)}

      .li-smoke-field{position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none;mix-blend-mode:screen}
      .li-smoke{position:absolute;left:74%;top:72%;width:28vw;height:17vw;min-width:180px;min-height:110px;max-width:420px;max-height:250px;border-radius:50%;opacity:0;filter:blur(22px);will-change:transform,opacity,filter;background:radial-gradient(ellipse at 48% 52%,rgba(246,250,252,.86) 0%,rgba(204,220,230,.58) 24%,rgba(139,164,180,.26) 49%,rgba(78,105,124,.10) 64%,transparent 76%)}
      .li-smoke.s1{animation:wdccBurnoutSmokeA 1.72s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s2{animation:wdccBurnoutSmokeB 1.72s .10s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s3{animation:wdccBurnoutSmokeC 1.60s .22s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s4{animation:wdccBurnoutSmokeD 1.48s .34s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke-ground{position:absolute;left:49%;right:-8%;bottom:4%;height:27%;z-index:2;pointer-events:none;opacity:0;filter:blur(26px);background:linear-gradient(90deg,transparent 0%,rgba(186,204,216,.08) 20%,rgba(222,233,239,.28) 53%,rgba(245,249,251,.38) 72%,rgba(167,190,204,.12) 91%,transparent 100%);animation:wdccGroundSmoke 1.72s ease-out both}

      .li-badge{position:absolute;z-index:4;left:50%;top:42%;width:clamp(196px,25vw,258px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 18px 46px rgba(0,0,0,.44),0 0 0 3px rgba(255,255,255,.88)}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:63%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,1.25vw,15px)/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.72)}
      .li-skip{position:absolute;z-index:8;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(3,9,14,.82);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}

      .li-curtain{position:absolute;inset:0;z-index:7;background:#02070c;opacity:0;pointer-events:none}
      .li-exit .li-curtain{animation:wdccOpaqueHandoff .32s cubic-bezier(.4,0,.2,1) forwards}
      .li-exit .li-skip{display:none}

      @keyframes wdccBurnoutSmokeA{0%{opacity:0;transform:translate(-28%,-10%) scale(.20)}16%{opacity:.72}48%{opacity:.88;transform:translate(-52%,-20%) scale(.80)}100%{opacity:.05;transform:translate(-112%,-48%) scale(1.78)}}
      @keyframes wdccBurnoutSmokeB{0%{opacity:0;transform:translate(-12%,8%) scale(.18)}18%{opacity:.65}52%{opacity:.82;transform:translate(-34%,-8%) scale(.92)}100%{opacity:.04;transform:translate(-88%,-36%) scale(1.92)}}
      @keyframes wdccBurnoutSmokeC{0%{opacity:0;transform:translate(0,0) scale(.16)}22%{opacity:.56}58%{opacity:.72;transform:translate(-18%,-22%) scale(.86)}100%{opacity:.03;transform:translate(-67%,-57%) scale(1.62)}}
      @keyframes wdccBurnoutSmokeD{0%{opacity:0;transform:translate(4%,12%) scale(.15)}24%{opacity:.48}60%{opacity:.64;transform:translate(-10%,-5%) scale(.74)}100%{opacity:.02;transform:translate(-52%,-31%) scale(1.46)}}
      @keyframes wdccGroundSmoke{0%{opacity:0;transform:translateX(10%) scaleX(.38)}24%{opacity:.48}64%{opacity:.72;transform:translateX(-4%) scaleX(1.04)}100%{opacity:.06;transform:translateX(-20%) scaleX(1.42)}}
      @keyframes wdccOpaqueHandoff{0%{opacity:0}58%{opacity:1}100%{opacity:1}}

      @media(max-width:600px){
        .li-scene img{object-position:69% 42%;filter:saturate(1.2) contrast(1.02) brightness(1.21)}
        .li-badge{top:41%;width:min(60vw,232px)}
        .li-tag{top:61%;font-size:12px;letter-spacing:.09em}
        .li-smoke{left:73%;top:69%;width:58vw;height:34vw;min-width:210px;min-height:125px;filter:blur(19px)}
        .li-smoke-ground{left:31%;right:-22%;bottom:3%;height:29%;filter:blur(22px)}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke-field" aria-hidden="true">
      <div className="li-smoke-ground"/>
      <div className="li-smoke s1"/>
      <div className="li-smoke s2"/>
      <div className="li-smoke s3"/>
      <div className="li-smoke s4"/>
    </div>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
    <div className="li-curtain" aria-hidden="true"/>
  </div>
}
