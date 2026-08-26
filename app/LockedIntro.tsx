"use client";

import {useEffect,useState} from "react";

type Phase="show"|"exit"|"done";

export default function LockedIntro(){
  const[phase,setPhase]=useState<Phase>("show");

  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setPhase("done");return}
    document.documentElement.classList.add("wdcc-intro-active");
    const exit=window.setTimeout(()=>setPhase("exit"),1500);
    const done=window.setTimeout(()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")},1820);
    return()=>{window.clearTimeout(exit);window.clearTimeout(done);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  const finish=()=>{document.documentElement.classList.remove("wdcc-intro-active");setPhase("done")};
  if(phase==="done")return null;

  return <div className={`li li-${phase}`} aria-label="WDCC opening intro">
    <style>{`
      .wdcc-intro-active{overflow:hidden!important}
      .li{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050d14;isolation:isolate;opacity:1;transition:opacity .32s ease}
      .li-exit{opacity:0;pointer-events:none}
      .li-scene{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050d14}
      .li-scene img{display:block;width:100%;height:100%;object-fit:cover;object-position:68% 42%;filter:saturate(1.18) contrast(1.02) brightness(1.17)}
      .li-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,7,12,0) 0%,rgba(2,7,12,0) 58%,rgba(2,7,12,.14) 80%,rgba(2,7,12,.42) 100%)}
      .li-badge{position:absolute;z-index:4;left:50%;top:42%;width:clamp(196px,25vw,258px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:#fff;box-shadow:0 18px 46px rgba(0,0,0,.44),0 0 0 3px rgba(255,255,255,.88)}
      .li-badge img{display:block;width:96%;height:96%;object-fit:contain;border-radius:50%;clip-path:circle(48% at 50% 50%);filter:none!important}
      .li-tag{position:absolute;z-index:5;left:50%;top:63%;transform:translateX(-50%);margin:0;color:#fff;white-space:nowrap;font:900 clamp(12px,1.25vw,15px)/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.72)}
      .li-skip{position:absolute;z-index:6;right:max(18px,env(safe-area-inset-right));bottom:max(20px,calc(env(safe-area-inset-bottom) + 14px));min-height:44px;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(3,9,14,.82);color:#fff;padding:0 18px;font:850 12px/1 system-ui,sans-serif;letter-spacing:.03em;backdrop-filter:blur(8px)}
      @media(max-width:600px){
        .li-scene img{object-position:69% 42%;filter:saturate(1.2) contrast(1.02) brightness(1.21)}
        .li-badge{top:41%;width:min(60vw,232px)}
        .li-tag{top:61%;font-size:12px;letter-spacing:.09em}
      }
      @media(prefers-reduced-motion:reduce){.li{display:none!important}}
    `}</style>
    <div className="li-scene" aria-hidden="true"><img src="/wdcc-hero-v2.webp" alt="" width="1672" height="941" fetchPriority="high"/></div>
    <div className="li-badge"><img src="/wdcc-official-logo.webp" alt="We Don't Care Cars" width="512" height="512"/></div>
    <p className="li-tag">We Don't Care Cars · Tampa Bay</p>
    <button className="li-skip" type="button" onClick={finish}>Skip intro</button>
  </div>
}
