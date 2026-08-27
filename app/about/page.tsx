import Link from "next/link";
import TrackedCallLink from "../TrackedCallLink";
import {WdccPublicFooter,WdccPublicHeader} from "../WdccPublicChrome";
import styles from "./about.module.css";

export default function AboutPage(){
  return <>
    <WdccPublicHeader/>
    <main className={styles.page}>
      <section className={styles.hero}>
        <img src="/wdcc-hero-v2.webp" alt="American flag Challenger with Tampa Bay skyline" width="1672" height="941"/>
        <div className={styles.shade}/>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>WE DON&apos;T CARE CARS · TAMPA BAY</p>
          <h1>Car buying without the runaround.</h1>
          <p className={styles.lede}>Clear inventory, direct help and financing options designed to get the conversation moving.</p>
          <div className={styles.actions}>
            <Link href="/inventory">Browse Inventory</Link>
            <Link className={styles.secondary} href="/get-approved?source=about">Get Pre-Approved</Link>
          </div>
        </div>
      </section>

      <section className={styles.body}>
        <div className={styles.intro}>
          <p className={styles.kicker}>THE WDCC APPROACH</p>
          <h2>Simple information. Real conversation. A clear next step.</h2>
          <p>We Don&apos;t Care Cars is built around making the shopping process easier to understand. Start with the vehicles, see the numbers shown on the listing, and reach a real person when you need help.</p>
        </div>
        <div className={styles.grid}>
          <article><span>01</span><h3>Shop what&apos;s shown</h3><p>Browse current inventory and vehicle details before deciding what deserves your time.</p></article>
          <article><span>02</span><h3>Talk through financing</h3><p>Use the pre-approval path to start the financing conversation without guessing at the next step.</p></article>
          <article><span>03</span><h3>Get direct help</h3><p>Questions about a vehicle or availability can go directly to Sean&apos;s team.</p></article>
        </div>
      </section>

      <section className={styles.cta}>
        <div><p>READY FOR THE NEXT STEP?</p><h2>Find the car first. We&apos;ll help with the rest.</h2></div>
        <div className={styles.ctaActions}><Link href="/inventory">View Inventory</Link><TrackedCallLink source="about-call-sean" label="Call Sean">Call Sean · 813-516-4752</TrackedCallLink></div>
      </section>
    </main>
    <WdccPublicFooter/>
  </>;
}
