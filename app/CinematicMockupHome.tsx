"use client";

import {useEffect,useState} from "react";
import Exact2vfDHome from "./Exact2vfDHome";

export default function CinematicMockupHome(){
  const[done,setDone]=useState(false);

  useEffect(()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduced){setDone(true);return}
    document.documentElement.classList.add("wdcc-intro-active");
    const t=setTimeout(()=>setDone(true),3520);
    return()=>{clearTimeout(t);document.documentElement.classList.remove("wdcc-intro-active")};
  },[]);

  useEffect(()=>{if(done)document.documentElement.classList.remove("wdcc-intro-active")},[done]);

  return <>
    {!done&&<div className="cinematic cinematic-enter cinematic-v2" data-wdcc-intro="challenger-tampa-v1" aria-label="WDCC opening animation" onWheel={()=>setDone(true)} onTouchMove={()=>setDone(true)}>
      <div className="cinScene" aria-hidden="true"/>
      <div className="cinVignette" aria-hidden="true"/>
      <div className="cinSmoke one" aria-hidden="true"/>
      <div className="cinSmoke two" aria-hidden="true"/>
      <img className="cinLogo" src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars"/>
      <p className="cinTagline">Tampa Bay · Drive today</p>
      <button className="skipIntro" type="button" onClick={()=>setDone(true)}>Skip intro</button>
    </div>}
    <Exact2vfDHome/>
  </>
}
