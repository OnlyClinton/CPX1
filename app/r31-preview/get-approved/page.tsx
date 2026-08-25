import {Footer} from "../../components";
import {R31Header} from "../R31Chrome";
import R31ApprovalPreview from "./R31ApprovalPreview";
import styles from "./approval.module.css";

export default function R31ApprovalPage(){
  return <>
    <R31Header/>
    <main className={styles.page}>
      <section className={styles.hero}><div className="wrap"><span>GET PRE-APPROVED</span><h1>FAST START. STRAIGHT ANSWERS.</h1><p>Walk through the improved three-step WDCC financing experience without creating a real lead during QA.</p></div></section>
      <div className={`wrap ${styles.shell}`}><R31ApprovalPreview/></div>
    </main>
    <Footer/>
  </>;
}
