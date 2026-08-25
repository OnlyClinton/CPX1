import Link from "next/link";
import {Footer} from "../../components";
import {R31Header} from "../R31Chrome";
import styles from "../content-preview.module.css";

export default function R31AboutPage(){
  return <>
    <R31Header/>
    <main className={styles.page}>
      <section className={styles.hero}><div className="wrap"><span>WE DON'T CARE CARS · TAMPA BAY</span><h1>THE NAME IS THE PROMISE.</h1><p>Bad credit or no credit should not mean wasted trips, vague inventory or a maze of handoffs. WDCC is being built around real vehicles, clear starting numbers and direct human help.</p></div></section>
      <section className={`wrap ${styles.content}`}>
        <div className={styles.aboutBand}>
          <div><h2>WHAT WDCC IS BUILT TO DO</h2><p>Keep the storefront, dealer inventory, financing interest and follow-up tied together from the first click through the next action.</p><div className={styles.actions}><Link href="/r31-preview/inventory?source=r31-about">BROWSE INVENTORY →</Link><Link href="/contact?source=r31-about">CONTACT WDCC →</Link></div></div>
          <div className={styles.principles}><div className={styles.fact}><b>REAL INVENTORY</b><p>Customer cards come from dealer-published records.</p></div><div className={styles.fact}><b>CLEAR STARTING POINT</b><p>Price and down payment stay visible where available.</p></div><div className={styles.fact}><b>DIRECT HELP</b><p>Call Sean without a call-center maze.</p></div><div className={styles.fact}><b>MOBILE FIRST</b><p>Browse, qualify and contact from the same device.</p></div></div>
        </div>
      </section>
    </main>
    <Footer/>
  </>;
}
