import{Footer,Header,VehicleGrid}from"../components";
import styles from"./inventory-page.module.css";

export default function Inventory(){return <><Header/><main className={styles.page}><section className={styles.hero}><p className={styles.eyebrow}>Live Tampa Bay inventory</p><h1>Find your next car.</h1><p className={styles.lead}>Real vehicles, clear cash prices, estimated down payments, and the details you need to choose confidently.</p></section><section className={styles.section}><VehicleGrid/></section></main><Footer/></>}
