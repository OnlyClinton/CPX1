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
    const exit=window.setTimeout(()=>setPhase("exit"),1800);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},2080);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-visual-proof","wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .28s ease}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:64% 45%;filter:saturate(1.24) contrast(1.03) brightness(1.27);transform:none!important;animation:none!important;transition:none!important}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,0) 66%,rgba(2,7,12,.08) 82%,rgba(2,7,12,.22) 100%)}
      .li-smoke{position:absolute;inset:-5%;z-index:3;pointer-events:none;opacity:.92;background:radial-gradient(circle at 50% 42%,rgba(225,233,240,.20) 0%,rgba(158,176,190,.10) 28%,rgba(5,13,20,.08) 58%,rgba(5,13,20,.20) 100%);backdrop-filter:blur(12px) saturate(.90);-webkit-backdrop-filter:blur(12px) saturate(.90);animation:liSmokeClear .92s cubic-bezier(.22,.72,.18,1) .16s forwards}
      @keyframes liSmokeClear{0%{opacity:.92;backdrop-filter:blur(12px) saturate(.90);-webkit-backdrop-filter:blur(12px) saturate(.90)}58%{opacity:.38;backdrop-filter:blur(5px) saturate(.98);-webkit-backdrop-filter:blur(5px) saturate(.98)}100%{opacity:0;backdrop-filter:blur(0) saturate(1);-webkit-backdrop-filter:blur(0) saturate(1)}}
      .li-badge{position:absolute;z-index:4;left:50%;top:39%;width:clamp(220px,28vw,280px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 16px 46px rgba(0,0,0,.42),0 0 0 3px rgba(255,255,255,.92);transform:translate(-50%,-50%)!important;animation:none!important;transition:none!important}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important;transform:none!important;animation:none!important;transition:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:58%;transform:translateX(-50%);margin:0;padding:7px 11px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(2,9,15,.54);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);color:#fff;white-space:nowrap;font:900 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.82);opacity:1}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.46);border-radius:999px;background:rgba(3,9,14,.74);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}
      @media(max-width:600px){
        .li-scene img{object-position:61% 45%;filter:saturate(1.25) contrast(1.02) brightness(1.30)}
        html body .li .li-badge{top:38.5%!important;width:min(68vw,260px)!important}
        html body .li .li-tag{top:57%!important;font-size:13px!important;letter-spacing:.065em!important;padding:8px 11px!important}
        .li-smoke{inset:-7%;backdrop-filter:blur(13px) saturate(.88);-webkit-backdrop-filter:blur(13px) saturate(.88)}
      }
      @media(max-width:430px){
        html body .li .li-badge{width:min(66vw,252px)!important}
        html body .li .li-tag{font-size:12px!important;letter-spacing:.055em!important}
      }
      @media(prefers-reduced-motion:reduce){html:not(.wdcc-visual-proof) .li{display:none!important}.li-smoke{animation:none!important;opacity:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-smoke" aria-hidden="true"/>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
