"use client";

import Link from "next/link";
import {useState} from "react";
import TrackedCallLink from "./TrackedCallLink";
import {WDCC_CORRECT_LOGO_DATA_URI} from "./wdccCorrectLogoData";
import styles from "./WdccPublicChrome.module.css";

export function WdccPublicHeader(){
  const[open,setOpen]=useState(false);
  const close=()=>setOpen(false);
  return <>
    <div className={`rh-utility wdcc-public-utility ${styles.utility}`} data-wdcc-public-chrome="utility">
      <div className={`rh-utility-inner ${styles.utilityInner}`}>
        <span>⌖ TAMPA BAY</span>
        <span>★ IN-HOUSE FINANCING</span>
        <span>★ LOW PAYMENTS</span>
        <span>★ DRIVE TODAY</span>
        <TrackedCallLink source="public-utility-phone" label="Call Sean">SALES: <b>(813) 516-4752</b></TrackedCallLink>
        <span className={styles.spanish}>Se Habla Español</span>
      </div>
    </div>
    <header className={`rh-header wdcc-public-header ${styles.header}`} data-wdcc-public-chrome="header">
      <div className={`rh-header-inner ${styles.inner}`}>
        <button className={`rh-menu ${styles.menu}`} type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} aria-controls="wdcc-public-nav" onClick={()=>setOpen(v=>!v)}>☰</button>
        <Link className={`rh-logo logoBrand ${styles.logo}`} href="/" aria-label="We Don't Care Cars home" onClick={close}>
          <img className="rh-logo-art" data-wdcc-logo-art="owner-approved" src={WDCC_CORRECT_LOGO_DATA_URI} alt="We Don't Care Cars" width="128" height="128"/>
        </Link>
        <nav id="wdcc-public-nav" className={`rh-nav ${styles.nav}${open?` open ${styles.navOpen}`:""}`} aria-label="Main navigation">
          <Link href="/inventory" onClick={close}>Inventory</Link>
          <Link href="/get-approved?source=nav-financing" onClick={close}>Financing</Link>
          <Link href="/#how-it-works" onClick={close}>How It Works</Link>
          <Link href="/#reviews" onClick={close}>Reviews</Link>
          <Link href="/about" onClick={close}>About Us</Link>
          <Link href="/contact?source=nav-contact" onClick={close}>Contact</Link>
        </nav>
        <div className={`rh-header-actions ${styles.actions}`}>
          <TrackedCallLink className={styles.desktopPhone} source="public-header-desktop-phone" label="Call Sean">☎ <b>(813) 516-4752</b></TrackedCallLink>
          <Link className={`rh-header-primary ${styles.primary}`} href="/get-approved" aria-label="GET PRE-APPROVED">GET PRE-APPROVED</Link>
        </div>
        <TrackedCallLink className={`rh-call ${styles.call}`} source="public-header-phone" label="Call Sean"><span>Call Sean</span></TrackedCallLink>
      </div>
    </header>
  </>;
}

export function WdccPublicFooter(){
  return <footer className={`rh-footer wdcc-public-footer ${styles.footer}`} data-wdcc-public-chrome="footer">
    <div className={`rh-footer-inner ${styles.footerInner}`}>
      <span><b>WDCC</b> · WE DON&apos;T CARE CARS</span>
      <span>Serving Tampa Bay · Confirm availability before visiting</span>
      <TrackedCallLink source="public-footer-phone" label="Call Sean">813-516-4752</TrackedCallLink>
    </div>
  </footer>;
}