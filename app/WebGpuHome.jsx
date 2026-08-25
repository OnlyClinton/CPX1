"use client";

import Exact2vfDHome from "./Exact2vfDHome";
import WdccCinematicIntro from "./WdccCinematicIntro";

export default function WebGpuHome(){
  return <>
    <style>{`.wdcc-webgpu-shell .intro-sequence{display:none!important}`}</style>
    <WdccCinematicIntro/>
    <div className="wdcc-webgpu-shell"><Exact2vfDHome/></div>
  </>;
}
