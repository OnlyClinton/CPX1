"use client";

import {useEffect} from "react";
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

export default function AttributionTracker(){
  useEffect(()=>{
    try{
      const a=getAttributionContext();
      const path=window.location.pathname;
      const vehicleMatch=path.match(/^\/vehicle\/([^/?#]+)/);
      trackEvent("page_view",{
        vehicleId:vehicleMatch?decodeURIComponent(vehicleMatch[1]):undefined,
        metadata:{pageType:vehicleMatch?"vehicle":path==="/"?"home":path.startsWith("/inventory")?"inventory":path.startsWith("/get-approved")?"approval":path.startsWith("/schedule-test-drive")?"schedule":path.startsWith("/contact")?"contact":"other",sessionId:a.sessionId}
      });
    }catch{}
    const click=(event:MouseEvent)=>{
      const target=event.target as Element|null;const anchor=target?.closest?.("a[href]") as HTMLAnchorElement|null;if(!anchor)return;
      const name=classify(anchor.href);if(!name)return;
      let vehicleId:string|undefined;try{const p=new URL(anchor.href).pathname.match(/^\/vehicle\/([^/?#]+)/);if(p)vehicleId=decodeURIComponent(p[1]);}catch{}
      trackEvent(name,{cta:anchor.textContent?.trim().slice(0,100)||undefined,vehicleId});
    };
    document.addEventListener("click",click,true);
    return()=>document.removeEventListener("click",click,true);
  },[]);
  return null;
}
