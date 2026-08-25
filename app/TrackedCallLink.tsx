"use client";

import type {ReactNode} from "react";
import {getAttributionContext,trackEvent} from "./attribution";

type Props={source:string;className?:string;children:ReactNode;label?:string;};
export default function TrackedCallLink({source,className,children,label}:Props){
  function track(){
    try{const a=getAttributionContext();const vehicleMatch=window.location.pathname.match(/^\/vehicle\/([^/?#]+)/);const body=JSON.stringify({sessionId:a.sessionId,anonymousUserId:a.anonymousUserId,vehicleId:vehicleMatch?decodeURIComponent(vehicleMatch[1]):undefined,source:a.source,medium:a.medium,campaign:a.campaign,content:a.content,term:a.term,clickId:a.clickId,referralCode:a.referralCode,pagePath:window.location.pathname,landingPath:a.landingPath,referrer:a.referrer,cta:source||"call-sean"});const blob=new Blob([body],{type:"application/json"});const queued=navigator.sendBeacon?navigator.sendBeacon("/api/call-intent",blob):false;if(!queued)void fetch("/api/call-intent",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true});}catch{}
    trackEvent("cta.call-sean",{cta:source,channel:"phone",phone:"+18135164752"});
  }
  return <a className={className} href="tel:+18135164752" aria-label={label} onClick={track}>{children}</a>;
}
