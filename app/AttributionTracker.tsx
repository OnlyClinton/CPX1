"use client";

import {useEffect} from "react";
import {getAttributionContext,trackEvent} from "./attribution";

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
  },[]);
  return null;
}
