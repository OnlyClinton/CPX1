import Link from "next/link";
import TrackedCallLink from "../TrackedCallLink";
import { Footer, Intro } from "../components";
import { R31Header } from "./R31Chrome";
import R31FeaturedInventory from "./R31FeaturedInventory";
import styles from "./r31-preview.module.css";

export default function R31PreviewPage() {
  return (
    <>
      <Intro />
      <R31Header />
      <main className={styles.preview}>
        <section className={styles.hero}>
          <div className={styles.heroImage} aria-hidden="true" />
          <div className={styles.heroSmoke} aria-hidden="true" />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={`wrap ${styles.heroCopy}`}>
            <div className={styles.crumb}>TAMPA BAY · DRIVE TODAY</div>
            <h1>
              <span className={styles.red}>BAD CREDIT?</span>
              <br />
              <span className={styles.blue}>NO CREDIT?</span>
              <br />
              WE DON&apos;T CARE.
            </h1>
            <p>
              In-house financing. Low down payments.
              <br />Fast approvals. Straight answers.
              <br />Get on the road without the runaround.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primary} href="/r31-preview/get-approved?source=r31-hero-approved">GET PRE-APPROVED →</Link>
              <Link className={styles.secondary} href="/r31-preview/inventory?source=r31-hero-inventory">BROWSE INVENTORY →</Link>
            </div>
            <div className={styles.heroCall}>
              <TrackedCallLink source="r31-preview-hero-phone">☎ CALL SEAN <b>813-516-4752</b></TrackedCallLink>
            </div>
          </div>
        </section>

        <section className={styles.benefitShell} aria-label="WDCC benefits">
          <div className={`wrap ${styles.benefits}`}>
            <article><span>✓</span><div><strong>FAST APPROVALS</strong><small>Quick, straightforward decisions.</small></div></article>
            <article><span>$</span><div><strong>LOW DOWN PAYMENTS</strong><small>Options designed around real buyers.</small></div></article>
            <article><span>▣</span><div><strong>DRIVE TODAY</strong><small>Move from interest to the road.</small></div></article>
            <article><span>◇</span><div><strong>BUILD YOUR CREDIT</strong><small>Ask what programs may apply.</small></div></article>
          </div>
        </section>

        <section className={styles.inventorySection}>
          <div className="wrap">
            <div className={styles.sectionHead}>
              <h2>FEATURED INVENTORY</h2>
              <Link href="/r31-preview/inventory?source=r31-featured-view-all">VIEW ALL INVENTORY →</Link>
            </div>
            <R31FeaturedInventory />
          </div>
        </section>

        <section className={styles.financeSection} id="how-it-works">
          <div className="wrap">
            <div className={styles.financeHead}>
              <div>
                <h2>IN-HOUSE FINANCING <em>MADE EASY.</em></h2>
                <span>ONE SIMPLE PROCESS. NO HOOPS. NO HASSLE.</span>
              </div>
              <Link href="/r31-preview/get-approved?source=r31-finance-start">START NOW →</Link>
            </div>
            <div className={styles.financeSteps}>
              <article><b>1</b><div><strong>APPLY ONLINE</strong><p>Send basic details securely.</p></div></article>
              <article><b>2</b><div><strong>TALK TO SEAN</strong><p>Confirm down payment and vehicle fit.</p></div></article>
              <article><b>3</b><div><strong>CHOOSE YOUR CAR</strong><p>Shop actual available inventory.</p></div></article>
              <article><b>4</b><div><strong>DRIVE TODAY</strong><p>Schedule pickup or a test drive.</p></div></article>
            </div>
          </div>
        </section>

        <section className={styles.trustSection}>
          <div className={`wrap ${styles.trustGrid}`}>
            <article><span>☆</span><div><strong>TAMPA BAY PROUD</strong><small>Local dealer. Local community.</small></div></article>
            <article><span>•••</span><div><strong>STRAIGHT ANSWERS</strong><small>Ask directly about pricing, fees and terms.</small></div></article>
            <article><span>SE</span><div><strong>REAL PEOPLE</strong><small>Talk to Sean. Not a call center.</small></div></article>
            <article><span>✓</span><div><strong>CONFIDENCE DRIVEN</strong><small>Clear next steps from browse to drive.</small></div></article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
