import Link from "next/link";
import TrackedCallLink from "../TrackedCallLink";
import styles from "./r31-preview.module.css";

export function R31Header(){
  return <>
    <div className={styles.utilityBar}>
      <div className={`wrap ${styles.utilityInner}`}>
        <div className={styles.utilityLeft}>
          <span>⌖ TAMPA BAY</span><span>★ IN-HOUSE FINANCING</span><span>★ LOW PAYMENTS</span><span>★ DRIVE TODAY</span>
        </div>
        <div className={styles.utilityRight}>SALES: <b>(813) 516-4752</b><span>•</span><span>Se Habla Español</span></div>
      </div>
    </div>
    <header className={styles.r31Header}>
      <div className={`wrap ${styles.headerInner}`}>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation"><span></span><span></span><span></span></summary>
          <nav>
            <Link prefetch={false} href="/r31-preview/inventory?source=r31-mobile-nav">INVENTORY</Link>
            <Link prefetch={false} href="/r31-preview/financing?source=r31-mobile-nav">FINANCING</Link>
            <Link prefetch={false} href="/r31-preview/#how-it-works">HOW IT WORKS</Link>
            <Link prefetch={false} href="/r31-preview/reviews?source=r31-mobile-nav">REVIEWS</Link>
            <Link prefetch={false} href="/r31-preview/about?source=r31-mobile-nav">ABOUT US</Link>
            <Link prefetch={false} href="/contact?source=r31-preview-mobile-nav">CONTACT</Link>
          </nav>
        </details>
        <Link prefetch={false} className={`logoBrand ${styles.logo}`} href="/r31-preview" aria-label="We Don't Care Cars preview home">
          <img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" />
        </Link>
        <nav className={styles.desktopNav} aria-label="R31 preview navigation">
          <Link prefetch={false} href="/r31-preview/inventory?source=r31-nav">INVENTORY</Link>
          <Link prefetch={false} href="/r31-preview/financing?source=r31-nav">FINANCING</Link>
          <Link prefetch={false} href="/r31-preview/#how-it-works">HOW IT WORKS</Link>
          <Link prefetch={false} href="/r31-preview/reviews?source=r31-nav">REVIEWS</Link>
          <Link prefetch={false} href="/r31-preview/about?source=r31-nav">ABOUT US</Link>
          <Link prefetch={false} href="/contact?source=r31-preview-nav">CONTACT</Link>
        </nav>
        <TrackedCallLink className={styles.headerPhone} source="r31-preview-header-phone">☎ <b>(813) 516-4752</b></TrackedCallLink>
        <Link prefetch={false} className={styles.headerApply} href="/r31-preview/get-approved?source=r31-header-apply">GET PRE-APPROVED</Link>
        <TrackedCallLink className={styles.mobileCall} source="r31-preview-mobile-call" label="Call Sean">☎</TrackedCallLink>
      </div>
    </header>
    <nav className={`stickyCtaBar ${styles.mobileDock}`} aria-label="R31 quick actions">
      <Link prefetch={false} href="/schedule-test-drive?source=r31-preview-sticky">TEST DRIVE</Link>
      <Link prefetch={false} href="/r31-preview/get-approved?source=r31-sticky-approved">GET APPROVED</Link>
      <TrackedCallLink source="r31-preview-sticky-call" label="Call Sean">CALL SEAN</TrackedCallLink>
    </nav>
  </>;
}
