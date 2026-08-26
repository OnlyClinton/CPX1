"use client";

import {useEffect,useState} from "react";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");

  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const exit=window.setTimeout(()=>setPhase("exit"),1350);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},1700);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#02070c;isolation:isolate;opacity:1;transition:opacity .34s ease}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#02070c}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:67% 46%;filter:saturate(1.16) contrast(1.06) brightness(.92)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,.02) 46%,rgba(2,7,12,.20) 66%,rgba(2,7,12,.88) 100%)}
      .li-badge{position:absolute;z-index:4;left:50%;top:46%;width:min(25vw,238px);aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 18px 52px rgba(0,0,0,.68),0 0 0 3px rgba(255,255,255,.72);animation:liBrand .55s ease-out both}
      .li-badge img{display:block;width:94%;height:94%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);background:transparent}
      .li-tag{position:absolute;z-index:5;left:50%;top:69%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(13px,1.35vw,16px)/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 2px 14px #000;opacity:.96}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(3,9,14,.82);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}
      @keyframes liBrand{from{opacity:0;transform:translate(-50%,-50%) scale(.965)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @media(max-width:1365px){
        .li-scene img{position:absolute;width:min(118vw,1100px);height:auto;max-width:none;left:50%;top:7vh;transform:translateX(-50%);object-fit:contain;object-position:center;filter:saturate(1.18) contrast(1.06) brightness(.95)}
        .li-scene:after{background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,.01) 38%,rgba(2,7,12,.20) 53%,rgba(2,7,12,.72) 68%,#02070c 82%,#02070c 100%)}
        .li-badge{top:47%;width:min(46vw,220px)}
        .li-tag{top:68%;font-size:13px;letter-spacing:.12em}
        .li-skip{right:14px;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));padding:0 17px;font-size:12px}
      }
      @media(max-width:520px){
        .li-scene img{width:128vw;top:9vh}
        .li-badge{top:46%;width:min(48vw,190px)}
        .li-tag{top:67%;font-size:12px;letter-spacing:.11em}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" data-fallback="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
