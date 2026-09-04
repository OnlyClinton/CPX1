import {Footer} from "../../components";
import {R31Header} from "../R31Chrome";
import R31InventoryBrowser from "./R31InventoryBrowser";
import styles from "./inventory.module.css";

export default function R31InventoryPage(){
  return <>
    <R31Header/>
    <main className={styles.page}>
      <section className={styles.hero}><div className="wrap"><span>SHOP INVENTORY</span><h1>FIND THE RIGHT CAR.</h1><p>Real dealer-published inventory, clear starting prices, and direct paths to vehicle details or pre-approval.</p></div></section>
      <div className={`wrap ${styles.content}`}><R31InventoryBrowser/></div>
    </main>
    <Footer/>
  </>;
}
