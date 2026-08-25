"use client";

import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
import {getAttributionContext,trackEvent} from "./attribution";

function classify(href:string){
  try{
    const u=new URL(href,window.location.origin);const p=u.pathname;
    if(p.startsWith("/schedule-test-drive"))return "cta.schedule-test-drive";
    if(p.startsWith("/get-approved"))return "cta.get-approved";
    if(p.startsWith("/contact"))return "cta.contact";
    if(p.startsWith("/inventory"))return "inventory.open";
    if(p.startsWith("/vehicle/"))return "vehicle.open";
  }catch{}
  return "";
}

function pageType(path:string){
  return path.match(/^\/vehicle\//)?"vehicle":path==="/"?"home":path.startsWith("/inventory")?"inventory":path.startsWith("/get-approved")?"approval":path.startsWith("/schedule-test-drive")?"schedule":path.startsWith("/contact")?"contact":path.startsWith("/dealer")?"dealer":"other";
}

export default function AttributionTracker(){
  const pathname=usePathname()||"/";
  const lastPage=useRef("");

  useEffect(()=>{
    try{
      const key=`${pathname}${window.location.search}`;
      if(lastPage.current===key)return;
      lastPage.current=key;
      const a=getAttributionContext();
      const vehicleMatch=pathname.match(/^\/vehicle\/([^/?#]+)/);
      trackEvent("page_view",{
        vehicleId:vehicleMatch?decodeURIComponent(vehicleMatch[1]):undefined,
        metadata:{pageType:pageType(pathname),sessionId:a.sessionId,url:key}
      });
    }catch{}
  },[pathname]);

  useEffect(()=>{
    const click=(event:MouseEvent)=>{
      const target=event.target as Element|null;const anchor=target?.closest?.("a[href]") as HTMLAnchorElement|null;if(!anchor)return;
      const name=classify(anchor.href);if(!name)return;
      let vehicleId:string|undefined;try{const p=new URL(anchor.href).pathname.match(/^\/vehicle\/([^/?#]+)/);if(p)vehicleId=decodeURIComponent(p[1]);}catch{}
      trackEvent(name,{cta:anchor.textContent?.trim().replace(/\s+/g," ").slice(0,100)||undefined,vehicleId,metadata:{destination:anchor.href}});
    };
    document.addEventListener("click",click,true);
    return()=>document.removeEventListener("click",click,true);
  },[]);
  return null;
}
