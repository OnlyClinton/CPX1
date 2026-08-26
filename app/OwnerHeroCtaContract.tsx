"use client";

import {useEffect} from "react";

export default function OwnerHeroCtaContract(){
  useEffect(()=>{
    const apply=()=>{
      const actions=document.querySelector("main.reference-home.locked-storefront .rh-hero-actions");
      if(!actions)return;
      const approve=actions.querySelector('a[href^="/get-approved"]');
      const inventory=actions.querySelector('a[href="/inventory"]');
      if(approve){approve.textContent="Get pre-approved →";approve.setAttribute("aria-label","Get pre-approved");}
      if(inventory){inventory.textContent="Browse inventory →";inventory.setAttribute("aria-label","Browse inventory");}
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    const stop=window.setTimeout(()=>observer.disconnect(),4000);
    return()=>{window.clearTimeout(stop);observer.disconnect();};
  },[]);
  return null;
}
