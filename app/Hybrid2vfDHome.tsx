"use client";

import LockedIntro from "./LockedIntro";
import Exact2vfDHome from "./Exact2vfDHome";

export default function Hybrid2vfDHome(){
  return <>
    <LockedIntro/>
    <style>{`.intro-sequence{display:none!important}`}</style>
    <Exact2vfDHome/>
  </>;
}
