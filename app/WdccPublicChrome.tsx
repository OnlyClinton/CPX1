"use client";

import Link from "next/link";
import {useState} from "react";
import TrackedCallLink from "./TrackedCallLink";

export function WdccPublicHeader(){
  const[open,setOpen]=useState(false);
  const close=()=>setOpen(false);
  return <>
    <div className="rh-utility wdcc-public-utility" data-wdcc-public-chrome="utility">
      <div className="rh-utility-inner">
        <span>⌖ TAMPA BAY</span>
        <span>★ IN-HOUSE FINANCING</span>
        <span>★ LOW PAYMENTS</span>
        <span>★ DRIVE TODAY</span>
        <TrackedCallLink source="public-utility-phone" label="Call Sean">SALES: <b>(813) 516-4752</b></TrackedCallLink>
        <span className="rh-espanol">Se Habla Español</span>
      </div>
    </div>
    <header className="rh-header wdcc-public-header" data-wdcc-public-chrome="header">
      <div className="rh-header-inner">
        <button className="rh-menu" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} aria-controls="wdcc-public-nav" onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button>
        <Link className="rh-logo" href="/" aria-label="We Don't Care Cars home" onClick={close}>
          <img className="rh-logo-art" data-wdcc-logo-art="owner-wordmark" src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="142" height="58" fetchPriority="high"/>
          <span className="rh-logo-wordmark-fallback" aria-hidden="true"><b>WD<span>CC</span></b><small>WE DON&apos;T CARE CARS</small></span>
        </Link>
        <nav id="wdcc-public-nav" className={`rh-nav${open?" open":""}`} aria-label="Main navigation">
          <Link href="/inventory" onClick={close}>Inventory</Link>
          <Link href="/get-approved?source=nav-financing" onClick={close}>Financing</Link>
          <Link href="/#how-it-works" onClick={close}>How It Works</Link>
          <Link href="/#reviews" onClick={close}>Reviews</Link>
          <Link href="/contact" onClick={close}>About Us</Link>
          <Link href="/contact" onClick={close}>Contact</Link>
        </nav>
        <div className="rh-header-actions">
          <TrackedCallLink className="rh-header-phone" source="public-header-desktop-phone" label="Call Sean">☎ <b>(813) 516-4752</b></TrackedCallLink>
          <Link className="rh-header-primary" href="/get-approved" aria-label="GET PRE-APPROVED">GET PRE-APPROVED</Link>
        </div>
        <TrackedCallLink className="rh-call" source="public-header-phone" label="Call Sean"><span>☎</span></TrackedCallLink>
      </div>
    </header>
    <style jsx global>{`
      @media(min-width:768px) and (max-width:1180px){
        html body .wdcc-public-header .rh-logo{width:116px!important;min-width:116px!important;max-width:116px!important}
        html body .wdcc-public-header .rh-logo>img.rh-logo-art[data-wdcc-logo-art="owner-wordmark"]{width:112px!important;min-width:112px!important;max-width:112px!important}
      }
      html body .wdcc-public-header .rh-logo{position:relative!important}
      html body .wdcc-public-header .rh-logo>img.rh-logo-art[data-wdcc-logo-art="owner-wordmark"]{opacity:0!important}
      html body .wdcc-public-header .rh-logo-wordmark-fallback{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;width:132px;color:#fff;pointer-events:none;filter:drop-shadow(0 3px 7px rgba(0,0,0,.72))}
      html body .wdcc-public-header .rh-logo-wordmark-fallback b{display:block;margin:0;font:1000 italic 34px/.72 Arial Black,Impact,system-ui,sans-serif;letter-spacing:-.085em;color:#f7f9fb;white-space:nowrap;transform:skewX(-4deg);transform-origin:left center}
      html body .wdcc-public-header .rh-logo-wordmark-fallback b span{color:#ef1727}
      html body .wdcc-public-header .rh-logo-wordmark-fallback small{display:block;margin-top:6px;padding-left:3px;font:950 6.5px/1 Arial,system-ui,sans-serif;letter-spacing:.025em;color:#f7f9fb;white-space:nowrap}
      @media(max-width:1180px){html body .wdcc-public-header .rh-logo-wordmark-fallback{width:112px}.wdcc-public-header .rh-logo-wordmark-fallback b{font-size:30px}.wdcc-public-header .rh-logo-wordmark-fallback small{font-size:5.8px;margin-top:5px}}
      @media(max-width:767px){html body .wdcc-public-header .rh-logo-wordmark-fallback{left:50%;right:auto;width:96px;align-items:center;transform:translateX(-50%)}.wdcc-public-header .rh-logo-wordmark-fallback b{font-size:27px;transform:skewX(-4deg)}.wdcc-public-header .rh-logo-wordmark-fallback small{font-size:5.1px;margin-top:4px;padding-left:0}}
    `}</style>
  </>;
}

export function WdccPublicFooter(){
  return <footer className="rh-footer wdcc-public-footer" data-wdcc-public-chrome="footer">
    <div className="rh-footer-inner">
      <span><b>WDCC</b> · WE DON&apos;T CARE CARS</span>
      <span>Serving Tampa Bay · In-house financing</span>
      <TrackedCallLink source="public-footer-phone" label="Call Sean">813-516-4752</TrackedCallLink>
    </div>
  </footer>;
}
