"use client";

import {useEffect} from "react";

function enforceHeroContract(){
  const actions=document.querySelector<HTMLElement>(".reference-home .rh-hero-actions");
  if(actions){
    const links=actions.querySelectorAll<HTMLAnchorElement>("a");
    const primary=links[0];
    const secondary=links[1];
    if(primary){
      if(primary.getAttribute("href")!=="/schedule-test-drive?source=hero-test-drive")primary.setAttribute("href","/schedule-test-drive?source=hero-test-drive");
      if(primary.textContent?.trim()!=="Schedule test drive →")primary.innerHTML="Schedule test drive <span>→</span>";
    }
    if(secondary){
      if(secondary.getAttribute("href")!=="/get-approved?source=hero-get-approved")secondary.setAttribute("href","/get-approved?source=hero-get-approved");
      if(secondary.textContent?.trim()!=="Get pre-approved →")secondary.innerHTML="Get pre-approved <span>→</span>";
    }
  }
}

export default function FinalCTAContract(){
  useEffect(()=>{
    enforceHeroContract();
    const root=document.querySelector(".reference-home");
    const dock=document.querySelector<HTMLElement>(".wdcc-mobile-actions");
    if(!root)return;
    const observer=new MutationObserver(()=>enforceHeroContract());
    observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["href"]});
    const syncDock=()=>dock?.classList.toggle("is-visible",window.scrollY>140);
    syncDock();
    window.addEventListener("scroll",syncDock,{passive:true});
    return()=>{
      observer.disconnect();
      window.removeEventListener("scroll",syncDock);
    };
  },[]);

  return <>
    <style>{`
      .wdcc-mobile-actions{display:none}
      @media(max-width:760px){
        .reference-home{padding-bottom:74px}
        .wdcc-mobile-actions{position:fixed;left:10px;right:10px;bottom:10px;z-index:2147482500;display:grid;grid-template-columns:1.15fr 1fr .72fr;gap:7px;padding:7px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(3,8,14,.92);box-shadow:0 16px 38px rgba(0,0,0,.38);backdrop-filter:blur(14px);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(14px);transition:opacity .18s ease,transform .18s ease,visibility 0s linear .18s}
        .wdcc-mobile-actions.is-visible{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0);transition:opacity .18s ease,transform .18s ease}
        .wdcc-mobile-actions a{min-width:0;min-height:48px;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;border-radius:12px;padding:7px 8px;font:800 11px/1.05 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.01em}
        .wdcc-mobile-actions .test{background:#d51f2a;color:white}
        .wdcc-mobile-actions .approve{background:white;color:#07111b}
        .wdcc-mobile-actions .call{background:#0b315f;color:white}
      }
    `}</style>
    <nav className="wdcc-mobile-actions" aria-label="Quick actions">
      <a className="test" href="/schedule-test-drive?source=mobile-sticky-test-drive">Test drive</a>
      <a className="approve" href="/get-approved?source=mobile-sticky-get-approved">Get approved</a>
      <a className="call" href="tel:+18135164752">Call Sean</a>
    </nav>
  </>;
}
