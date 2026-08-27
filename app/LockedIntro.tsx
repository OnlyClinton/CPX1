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
      .li-smoke{position:absolute;opacity:0;filter:blur(7px);will-change:transform,opacity;border-radius:56% 44% 62% 38%/47% 60% 40% 53%;background:
        radial-gradient(circle at 72% 55%,rgba(250,252,253,.88) 0 9%,rgba(215,223,227,.68) 10% 19%,rgba(129,144,153,.38) 25%,transparent 43%),
        radial-gradient(circle at 49% 39%,rgba(238,242,244,.78) 0 11%,rgba(188,199,205,.55) 17%,rgba(111,128,139,.29) 27%,transparent 44%),
        radial-gradient(circle at 31% 65%,rgba(224,230,233,.70) 0 10%,rgba(164,177,185,.47) 18%,rgba(94,112,124,.24) 29%,transparent 46%),
        radial-gradient(circle at 15% 45%,rgba(204,213,218,.55) 0 8%,rgba(127,143,153,.32) 19%,transparent 39%)}
      .li-smoke:after{content:"";position:absolute;inset:8% -5% -6% 3%;border-radius:48% 52% 41% 59%/58% 42% 61% 39%;opacity:.58;filter:blur(5px);background:
        radial-gradient(circle at 68% 48%,rgba(244,247,248,.55) 0 12%,rgba(167,180,187,.30) 24%,transparent 46%),
        radial-gradient(circle at 37% 63%,rgba(214,221,225,.48) 0 11%,rgba(120,136,146,.25) 23%,transparent 44%);animation:wdccSmokeBillow .58s ease-in-out infinite alternate}
      .li-smoke.s1{left:70%;top:67%;width:31vw;height:19vw;min-width:190px;min-height:116px;max-width:430px;max-height:255px;animation:wdccBurnoutSmokeA 1.72s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s2{left:58%;top:71%;width:30vw;height:18vw;min-width:180px;min-height:108px;max-width:400px;max-height:235px;animation:wdccBurnoutSmokeB 1.68s .04s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s3{left:47%;top:74%;width:27vw;height:17vw;min-width:168px;min-height:100px;max-width:360px;max-height:215px;animation:wdccBurnoutSmokeC 1.58s .08s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke.s4{left:37%;top:77%;width:24vw;height:15vw;min-width:150px;min-height:92px;max-width:320px;max-height:195px;animation:wdccBurnoutSmokeD 1.48s .12s cubic-bezier(.16,.7,.2,1) both}
      .li-smoke-ground{position:absolute;left:25%;right:-7%;bottom:3%;height:19%;z-index:2;pointer-events:none;opacity:0;filter:blur(13px);background:
        radial-gradient(ellipse at 78% 50%,rgba(230,236,239,.38) 0 10%,rgba(132,150,160,.20) 28%,transparent 51%),
        radial-gradient(ellipse at 51% 62%,rgba(205,214,219,.30) 0 11%,rgba(112,129,140,.16) 30%,transparent 54%),
        radial-gradient(ellipse at 25% 67%,rgba(181,193,201,.20) 0 10%,transparent 43%);animation:wdccGroundSmoke 1.72s ease-out both}

      .li-badge{position:absolute;z-index:4;left:50%;top:42%;width:clamp(196px,25vw,258px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 18px 46px rgba(0,0,0,.44),0 0 0 3px rgba(255,255,255,.88)}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:63%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,1.25vw,15px)/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.72)}
      .li-skip{position:absolute;z-index:8;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(3,9,14,.82);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}

      .li-curtain{position:absolute;inset:0;z-index:7;background:#02070c;opacity:0;pointer-events:none}
      .li-exit .li-curtain{animation:wdccOpaqueHandoff .32s cubic-bezier(.4,0,.2,1) forwards}
      .li-exit .li-skip{display:none}

      @keyframes wdccBurnoutSmokeA{0%{opacity:0;transform:translate3d(16%,12%,0) scale(.30)}17%{opacity:.78}46%{opacity:.88;transform:translate3d(-8%,-8%,0) scale(.96)}100%{opacity:.08;transform:translate3d(-46%,-34%,0) scale(1.48)}}
      @keyframes wdccBurnoutSmokeB{0%{opacity:0;transform:translate3d(14%,12%,0) scale(.28)}18%{opacity:.62}49%{opacity:.72;transform:translate3d(-10%,-7%,0) scale(.94)}100%{opacity:.06;transform:translate3d(-43%,-29%,0) scale(1.43)}}
      @keyframes wdccBurnoutSmokeC{0%{opacity:0;transform:translate3d(12%,13%,0) scale(.26)}20%{opacity:.52}53%{opacity:.61;transform:translate3d(-8%,-9%,0) scale(.90)}100%{opacity:.04;transform:translate3d(-38%,-27%,0) scale(1.36)}}
      @keyframes wdccBurnoutSmokeD{0%{opacity:0;transform:translate3d(10%,15%,0) scale(.24)}22%{opacity:.42}56%{opacity:.50;transform:translate3d(-7%,-6%,0) scale(.86)}100%{opacity:.03;transform:translate3d(-32%,-22%,0) scale(1.28)}}
      @keyframes wdccSmokeBillow{0%{transform:translate3d(-2%,3%,0) scale(1,.92) rotate(-1deg)}100%{transform:translate3d(4%,-3%,0) scale(1.08,1.04) rotate(2deg)}}
      @keyframes wdccGroundSmoke{0%{opacity:0;transform:translateX(13%) scaleX(.52)}22%{opacity:.38}58%{opacity:.48;transform:translateX(-2%) scaleX(1.03)}100%{opacity:.05;transform:translateX(-24%) scaleX(1.33)}}
      @keyframes wdccOpaqueHandoff{0%{opacity:0}58%{opacity:1}100%{opacity:1}}

      @media(max-width:600px){
        .li-scene img{object-position:69% 42%;filter:saturate(1.2) contrast(1.02) brightness(1.21)}
        .li-badge{top:41%;width:min(60vw,232px)}
        .li-tag{top:61%;font-size:12px;letter-spacing:.09em}
        .li-smoke{filter:blur(6px)}
        .li-smoke.s1{left:67%;top:68%;width:52vw;height:31vw;min-width:0;min-height:0}
        .li-smoke.s2{left:52%;top:72%;width:48vw;height:30vw;min-width:0;min-height:0}
        .li-smoke.s3{left:38%;top:75%;width:44vw;height:28vw;min-width:0;min-height:0}
        .li-smoke.s4{left:25%;top:78%;width:38vw;height:25vw;min-width:0;min-height:0}
        .li-smoke-ground{left:18%;right:-9%;bottom:3%;height:18%;filter:blur(11px)}
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
