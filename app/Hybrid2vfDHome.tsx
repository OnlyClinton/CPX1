"use client";

import {useCallback,useState} from "react";
import LockedIntro from "./LockedIntro";
import Exact2vfDHomeLive from "./Exact2vfDHomeLive";

// Preview composition: cinematic opening + corrected live storefront surface.
export default function Hybrid2vfDHome(){
  const[motionReady,setMotionReady]=useState(false);
  const handleIntroComplete=useCallback(()=>setMotionReady(true),[]);
  return <>
    <LockedIntro onComplete={handleIntroComplete}/>
    <Exact2vfDHomeLive motionReady={motionReady}/>
  </>;
}
