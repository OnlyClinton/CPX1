"use client";

import type {ReactNode} from "react";

type Props={
  source:string;
  className?:string;
  children:ReactNode;
  label?:string;
};

export default function TrackedCallLink({source,className,children,label}:Props){
  function track(){
    const body=JSON.stringify({
      event:"cta.call-sean",
      source,
      channel:"phone",
      phone:"+18135164752",
      path:window.location.pathname,
      at:new Date().toISOString()
    });
    try{
      if(navigator.sendBeacon){
        navigator.sendBeacon("/api/events",new Blob([body],{type:"application/json"}));
      }else{
        void fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true});
      }
    }catch{}
  }
  return <a className={className} href="tel:+18135164752" aria-label={label} onClick={track}>{children}</a>;
}
