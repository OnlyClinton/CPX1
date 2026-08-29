"use client";

import LockedIntro from "./LockedIntro";
import Exact2vfDHome from "./Exact2vfDHome";

// Preview-only composition: cinematic opening + exact 2vfD storefront.
export default function Hybrid2vfDHome(){
  return <>
    <LockedIntro/>
    <style>{`.intro-sequence{display:none!important}`}</style>
    <Exact2vfDHome/>
  </>;
}
