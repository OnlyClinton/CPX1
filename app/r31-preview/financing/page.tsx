import Link from "next/link";
import {Footer} from "../../components";
import {R31Header} from "../R31Chrome";
import styles from "../content-preview.module.css";

export default function R31FinancingPage(){
  return <>
    <R31Header/>
    <main className={styles.page}>
      <section className={styles.hero}><div className="wrap"><span>IN-HOUSE FINANCING</span><h1>START WITH THE REAL NUMBERS.</h1><p>WDCC keeps the first conversation simple: pick a real vehicle, see its listed price and down payment, then talk directly with Sean about the next step. Final terms remain subject to approval.</p></div></section>
      <section className={`wrap ${styles.content}`}>
        <div className={styles.grid}>
          <article className={styles.card}><strong>01</strong><b>CHOOSE A REAL VEHICLE</b><p>Start from dealer-published inventory instead of a generic application with no vehicle context.</p></article>
          <article className={styles.card}><strong>02</strong><b>SEE THE STARTING POINT</b><p>Cash price, listed down payment and mileage stay visible so the conversation starts from the same numbers.</p></article>
          <article className={styles.card}><strong>03</strong><b>TALK DIRECTLY TO SEAN</b><p>Confirm budget, vehicle fit and what information is needed before you spend time making a trip.</p></article>
        </div>
        <div className={styles.actions}><Link href="/r31-preview/get-approved?source=r31-financing-page">GET PRE-APPROVED →</Link><Link href="/r31-preview/inventory?source=r31-financing-page">BROWSE INVENTORY →</Link></div>
      </section>
    </main>
    <Footer/>
  </>;
}
