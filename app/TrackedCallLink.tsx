"use client";

import type {ReactNode} from "react";
import {trackEvent} from "./attribution";

type Props={
  source:string;
  className?:string;
  children:ReactNode;
  label?:string;
};

export default function TrackedCallLink({source,className,children,label}:Props){
  function track(){
    trackEvent("cta.call-sean",{cta:source,channel:"phone",phone:"+18135164752"});
  }
  return <a className={className} href="tel:+18135164752" aria-label={label} onClick={track}>{children}</a>;
}
