import Link from "next/link";
import DealerEditorPreview from "./DealerEditorPreview";
import styles from "./dealer-editor.module.css";

export default function R31DealerEditorPage(){
  return <main className={styles.page}>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.dealerBrand}><b>WDCC</b><span>DEALER COMMAND · R31 QA</span></div>
        <div className={styles.sideLabel}>INVENTORY</div>
        <nav className={styles.sideNav}>
          <Link href="/dealer">Dashboard</Link>
          <Link href="/dealer/inventory">All Vehicles</Link>
          <Link href="/r31-preview/dealer-editor">+ Add / Edit Vehicle</Link>
          <Link href="/dealer/inventory/logs">Vehicle Logs</Link>
          <Link href="/dealer/leads">Leads</Link>
          <Link href="/r31-preview">View R31 Storefront</Link>
        </nav>
      </aside>
      <section className={styles.main}><DealerEditorPreview/></section>
    </div>
  </main>;
}
