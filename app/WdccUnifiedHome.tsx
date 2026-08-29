"use client";

import Exact2vfDHome from "./Exact2vfDHome";
import LockedIntro from "./LockedIntro";

/**
 * Preview-only synthesis shell:
 * - exact 2vfD storefront composition
 * - current cinematic opening
 * - current dealer/admin/API stack inherited from the V32 hybrid base
 *
 * Exact2vfDHome still contains its historical intro implementation. It is
 * suppressed here so the opening runs once through LockedIntro instead of
 * stacking two animations.
 */
export default function WdccUnifiedHome(){
  return <>
    <LockedIntro/>
    <style>{`.intro-sequence{display:none!important}`}</style>
    <Exact2vfDHome/>
  </>;
}
