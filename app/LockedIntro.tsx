"use client";

import {useEffect,useState} from "react";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const proofHold=params.has("visual-mobile")||params.has("visual-desktop")||navigator.webdriver===true;
    if(proofHold){
      document.documentElement.classList.add("wdcc-visual-proof","wdcc-intro-active");
      return()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active")};
    }
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const exit=window.setTimeout(()=>setPhase("exit"),2250);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2690);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .44s cubic-bezier(.22,.72,.18,1)}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(1.24) contrast(1.03) brightness(1.27);transform:none!important;animation:none!important;transition:none!important}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,.01) 0%,rgba(2,7,12,0) 56%,rgba(2,7,12,.08) 80%,rgba(2,7,12,.26) 100%)}
      .li-smoke{position:absolute;inset:-7%;z-index:3;overflow:hidden;pointer-events:none;opacity:1;background:
        radial-gradient(ellipse at 20% 38%,rgba(236,242,247,.24) 0%,rgba(181,196,207,.11) 24%,transparent 53%),
        radial-gradient(ellipse at 78% 57%,rgba(225,234,241,.18) 0%,rgba(148,168,182,.09) 30%,transparent 58%),
        linear-gradient(180deg,rgba(15,31,43,.08),rgba(5,13,20,.22));
        backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96);
        animation:liSmokeClear 1.08s cubic-bezier(.16,.80,.24,1) .10s forwards}
      .li-smoke:before,.li-smoke:after{content:"";position:absolute;inset:-8%;pointer-events:none;border-radius:50%;opacity:1}
      .li-smoke:before{background:
        radial-gradient(ellipse at 34% 50%,rgba(245,248,250,.22) 0%,rgba(184,199,210,.11) 30%,transparent 60%),
        radial-gradient(ellipse at 66% 38%,rgba(226,235,241,.18) 0%,rgba(170,188,201,.09) 28%,transparent 57%);
        filter:blur(18px);animation:liFogLift 1.62s cubic-bezier(.18,.72,.20,1) .08s forwards}
      .li-smoke:after{background:linear-gradient(112deg,transparent 18%,rgba(255,255,255,.08) 43%,rgba(221,233,241,.05) 51%,transparent 72%);filter:blur(11px);animation:liMistSheen 1.52s ease-out .18s forwards}
      @keyframes liSmokeClear{
        0%{opacity:1;backdrop-filter:blur(15px) saturate(.86) contrast(.96);-webkit-backdrop-filter:blur(15px) saturate(.86) contrast(.96)}
        42%{opacity:.82;backdrop-filter:blur(10px) saturate(.92) contrast(.98);-webkit-backdrop-filter:blur(10px) saturate(.92) contrast(.98)}
        76%{opacity:.28;backdrop-filter:blur(3px) saturate(.99) contrast(1);-webkit-backdrop-filter:blur(3px) saturate(.99) contrast(1)}
        100%{opacity:0;backdrop-filter:blur(0) saturate(1) contrast(1);-webkit-backdrop-filter:blur(0) saturate(1) contrast(1)}
      }
      @keyframes liFogLift{0%{opacity:.96;filter:blur(18px)}45%{opacity:.58;filter:blur(14px)}78%{opacity:.18;filter:blur(10px)}100%{opacity:0;filter:blur(8px)}}
      @keyframes liMistSheen{0%{opacity:.72}50%{opacity:.34}78%{opacity:.12}100%{opacity:0}}
      .li-badge{position:absolute;z-index:4;left:50%;top:39%;width:clamp(220px,28vw,280px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 16px 46px rgba(0,0,0,.42),0 0 0 3px rgba(255,255,255,.92);transform:translate(-50%,-50%)!important;animation:none!important;transition:none!important}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important;transform:none!important;animation:none!important;transition:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:58%;transform:translateX(-50%);margin:0;padding:7px 11px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(2,9,15,.54);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);color:#fff;white-space:nowrap;font:900 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.82);opacity:0;animation:liTagResolve .86s ease-out .34s forwards}
      @keyframes liTagResolve{from{opacity:0}to{opacity:1}}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      @media(max-width:600px){
        .li-scene img{object-position:61% 45%;filter:saturate(1.25) contrast(1.02) brightness(1.30)}
        html body .li .li-badge{top:38.5%!important;width:min(68vw,260px)!important}
        html body .li .li-tag{top:57%!important;font-size:13px!important;letter-spacing:.065em!important;padding:8px 11px!important}
        .li-smoke{inset:-9%;backdrop-filter:blur(16px) saturate(.84);-webkit-backdrop-filter:blur(16px) saturate(.84)}
      }
      @media(max-width:430px){
        html body .li .li-badge{width:min(66vw,252px)!important}
        html body .li .li-tag{font-size:12px!important;letter-spacing:.055em!important}
      }
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-smoke,.li-smoke:before,.li-smoke:after,.li-tag{animation:none!important;opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
