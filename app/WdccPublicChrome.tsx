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
        <span>⚡ IN-HOUSE FINANCING</span>
        <span>⚡ DRIVE TODAY</span>
        <TrackedCallLink source="public-utility-phone" label="Call Sean">SEAN · <b>813-516-4752</b></TrackedCallLink>
      </div>
    </div>
    <header className="rh-header wdcc-public-header" data-wdcc-public-chrome="header">
      <div className="rh-header-inner">
        <button className="rh-menu" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} aria-controls="wdcc-public-nav" onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button>
        <Link className="rh-logo" href="/" aria-label="We Don't Care Cars home" onClick={close}><img className="rh-logo-art" data-wdcc-logo-art="owner-approved" src="/wdcc-owner-logo" alt="We Don't Care Cars" width="125" height="128"/></Link>
        <nav id="wdcc-public-nav" className={`rh-nav${open?" open":""}`} aria-label="Main navigation">
          <Link href="/inventory" onClick={close}>Inventory</Link>
          <Link href="/get-approved?source=nav-financing" onClick={close}>Financing</Link>
          <Link href="/#how-it-works" onClick={close}>How It Works</Link>
          <Link href="/#reviews" onClick={close}>Reviews</Link>
          <Link href="/about" onClick={close}>About Us</Link>
        </nav>
        <div className="rh-header-actions">
          <TrackedCallLink className="rh-header-phone" source="public-header-desktop-phone" label="Call Sean">☎ <b>813-516-4752</b></TrackedCallLink>
          <Link className="rh-header-primary" href="/get-approved" aria-label="GET PRE-APPROVED">GET PRE-APPROVED</Link>
        </div>
        <TrackedCallLink className="rh-call" source="public-header-phone" label="Call Sean"><span>☎</span></TrackedCallLink>
      </div>
    </header>
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
