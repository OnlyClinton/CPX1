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

      .li-smoke-field{position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none}
      .li-smoke{position:absolute;left:61%;top:70%;width:37vw;height:19vw;min-width:220px;min-height:112px;max-width:520px;max-height:265px;opacity:0;filter:blur(8px) contrast(1.02);will-change:transform,opacity;border-radius:58% 42% 55% 45%/46% 58% 42% 54%;background:
        radial-gradient(ellipse 42% 40% at 20% 57%,rgba(244,247,248,.78) 0 20%,rgba(199,208,213,.58) 31%,rgba(126,140,149,.30) 45%,transparent 66%),
        radial-gradient(ellipse 46% 38% at 44% 42%,rgba(234,239,241,.72) 0 21%,rgba(183,194,201,.49) 32%,rgba(105,121,132,.25) 47%,transparent 67%),
        radial-gradient(ellipse 48% 44% at 66% 61%,rgba(222,229,232,.64) 0 22%,rgba(162,175,182,.42) 34%,rgba(91,108,120,.22) 50%,transparent 70%),
        radial-gradient(ellipse 44% 36% at 86% 45%,rgba(204,214,219,.52) 0 20%,rgba(137,151,160,.33) 34%,rgba(77,95,108,.16) 50%,transparent 69%)}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;pointer-events:none;border-radius:56% 44% 62% 38%/54% 42% 58% 46%}
      .li-smoke:before{inset:16% -10% 4% 8%;opacity:.58;filter:blur(5px);background:
        radial-gradient(ellipse 48% 42% at 28% 55%,rgba(235,240,242,.55) 0 23%,rgba(151,165,174,.30) 38%,transparent 62%),
        radial-gradient(ellipse 52% 38% at 69% 49%,rgba(212,220,224,.46) 0 22%,rgba(123,139,149,.24) 38%,transparent 64%);animation:wdccSmokeShear .54s ease-in-out infinite alternate}
      .li-smoke:after{inset:-2% 8% 28% 18%;opacity:.46;filter:blur(4px);background:
        radial-gradient(ellipse 44% 48% at 34% 55%,rgba(247,249,250,.58) 0 19%,rgba(176,188,195,.34) 34%,transparent 62%),
        radial-gradient(ellipse 48% 42% at 72% 44%,rgba(221,227,230,.42) 0 20%,rgba(128,143,152,.22) 37%,transparent 64%);animation:wdccSmokeBillow .66s ease-in-out infinite alternate}
      .li-smoke.s1{animation:wdccBurnoutSmokeA 1.72s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s2{top:72%;width:39vw;height:20vw;animation:wdccBurnoutSmokeB 1.68s .05s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s3{top:69%;width:35vw;height:18vw;animation:wdccBurnoutSmokeC 1.58s .10s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s4{top:74%;width:33vw;height:17vw;animation:wdccBurnoutSmokeD 1.48s .15s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke-ground{position:absolute;left:59%;right:-13%;bottom:3%;height:20%;z-index:2;pointer-events:none;opacity:0;filter:blur(12px);background:
        radial-gradient(ellipse 48% 72% at 14% 46%,rgba(230,236,239,.38) 0 19%,rgba(144,158,167,.23) 35%,transparent 62%),
        radial-gradient(ellipse 58% 68% at 47% 57%,rgba(211,219,223,.31) 0 20%,rgba(119,135,145,.18) 37%,transparent 65%),
        radial-gradient(ellipse 56% 62% at 82% 61%,rgba(188,199,205,.23) 0 19%,rgba(95,113,124,.13) 38%,transparent 66%);animation:wdccGroundSmoke 1.72s ease-out both}

      .li-badge{position:absolute;z-index:4;left:50%;top:42%;width:clamp(196px,25vw,258px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 18px 46px rgba(0,0,0,.44),0 0 0 3px rgba(255,255,255,.88)}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:63%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,1.25vw,15px)/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.72)}
      .li-skip{position:absolute;z-index:8;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(3,9,14,.82);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}

      .li-curtain{position:absolute;inset:0;z-index:7;background:#02070c;opacity:0;pointer-events:none}
      .li-exit .li-curtain{animation:wdccOpaqueHandoff .32s cubic-bezier(.4,0,.2,1) forwards}
      .li-exit .li-skip{display:none}

      @keyframes wdccBurnoutSmokeA{0%{opacity:0;transform:translate3d(-24%,16%,0) scale(.28,.38)}16%{opacity:.82}46%{opacity:.90;transform:translate3d(-14%,-2%,0) scale(.92,.88)}100%{opacity:.08;transform:translate3d(18%,-24%,0) scale(1.38,1.20)}}
      @keyframes wdccBurnoutSmokeB{0%{opacity:0;transform:translate3d(-23%,18%,0) scale(.26,.34)}18%{opacity:.58}50%{opacity:.68;transform:translate3d(9%,-1%,0) scale(.94,.82)}100%{opacity:.06;transform:translate3d(43%,-20%,0) scale(1.42,1.12)}}
      @keyframes wdccBurnoutSmokeC{0%{opacity:0;transform:translate3d(-22%,17%,0) scale(.25,.32)}20%{opacity:.46}53%{opacity:.57;transform:translate3d(32%,-6%,0) scale(.90,.78)}100%{opacity:.04;transform:translate3d(65%,-27%,0) scale(1.34,1.05)}}
      @keyframes wdccBurnoutSmokeD{0%{opacity:0;transform:translate3d(-21%,19%,0) scale(.24,.30)}23%{opacity:.36}56%{opacity:.46;transform:translate3d(54%,-2%,0) scale(.86,.72)}100%{opacity:.03;transform:translate3d(88%,-19%,0) scale(1.27,.98)}}
      @keyframes wdccSmokeShear{0%{transform:translate3d(-3%,4%,0) scale(1,.90) rotate(-1deg)}100%{transform:translate3d(5%,-2%,0) scale(1.10,1.02) rotate(1.5deg)}}
      @keyframes wdccSmokeBillow{0%{transform:translate3d(-2%,4%,0) scale(.98,.92) rotate(-1.5deg)}100%{transform:translate3d(4%,-5%,0) scale(1.08,1.07) rotate(2deg)}}
      @keyframes wdccGroundSmoke{0%{opacity:0;transform:translateX(-9%) scaleX(.38)}20%{opacity:.36}56%{opacity:.48;transform:translateX(2%) scaleX(.92)}100%{opacity:.05;transform:translateX(24%) scaleX(1.28)}}
      @keyframes wdccOpaqueHandoff{0%{opacity:0}58%{opacity:1}100%{opacity:1}}

      @media(max-width:600px){
        .li-scene img{object-position:69% 42%;filter:saturate(1.2) contrast(1.02) brightness(1.21)}
        .li-badge{top:41%;width:min(60vw,232px)}
        .li-tag{top:61%;font-size:12px;letter-spacing:.09em}
        .li-smoke{left:60%;top:69%;width:46vw;height:25vw;min-width:0;min-height:0;filter:blur(7px) contrast(1.02)}
        .li-smoke.s2{top:72%;width:49vw;height:27vw}
        .li-smoke.s3{top:68%;width:44vw;height:24vw}
        .li-smoke.s4{top:74%;width:42vw;height:23vw}
        .li-smoke-ground{left:58%;right:-22%;bottom:3%;height:19%;filter:blur(10px)}
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
