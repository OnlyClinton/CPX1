import Link from "next/link";
import {Footer} from "../../components";
import {R31Header} from "../R31Chrome";
import styles from "../content-preview.module.css";

export default function R31ReviewsPage(){
  return <>
    <R31Header/>
    <main className={styles.page}>
      <section className={styles.hero}><div className="wrap"><span>THE WDCC STANDARD</span><h1>STRAIGHT ANSWERS. REAL PEOPLE.</h1><p>This preview intentionally avoids inventing customer testimonials. Until verified review data is connected, this page shows the service standards WDCC can actually prove through its workflow.</p></div></section>
      <section className={`wrap ${styles.content}`}>
        <div className={styles.quote}><p>Real inventory should be visible before a customer calls, with the same price and down-payment starting point the team sees.</p><span>WDCC SERVICE STANDARD · INVENTORY TRANSPARENCY</span></div>
        <div className={styles.quote}><p>Customers should have a direct path to Sean instead of disappearing into a generic call-center queue.</p><span>WDCC SERVICE STANDARD · DIRECT CONTACT</span></div>
        <div className={styles.quote}><p>Lead source, vehicle interest and next action should stay connected so nobody has to start the conversation over.</p><span>WDCC SERVICE STANDARD · FOLLOW-THROUGH</span></div>
        <div className={styles.actions}><Link href="/contact?source=r31-reviews">CONTACT WDCC →</Link><Link href="/r31-preview/inventory?source=r31-reviews">SEE CURRENT INVENTORY →</Link></div>
      </section>
    </main>
    <Footer/>
  </>;
}
