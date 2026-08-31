"use client";

import {useCallback,useState} from "react";
import FinalCTAContract from "./FinalCTAContract";
import LockedIntro from "./LockedIntro";
import ReferenceCloneHome from "./ReferenceCloneHome";

// Preview composition: cinematic opening + corrected live storefront surface.
export default function Hybrid2vfDHome(){
  const[motionReady,setMotionReady]=useState(false);
  const handleIntroComplete=useCallback(()=>setMotionReady(true),[]);
  return <>
    <LockedIntro onComplete={handleIntroComplete}/>
    <ReferenceCloneHome motionReady={motionReady}/>
    <FinalCTAContract/>
  </>;
}
