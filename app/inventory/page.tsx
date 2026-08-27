import{Footer,Header}from"../components";
import InventoryGrid from"../InventoryGrid";

export default function Inventory(){
  return <>
    <Header/>
    <main className="inventoryPage">
      <section className="inventoryTop"><div className="wrap"><div className="eyebrow">LIVE PUBLISHED INVENTORY</div><h1>FIND THE RIGHT CAR.</h1><p className="lede">Cash price, estimated down payment, mileage and the details that matter. No weekly-payment gimmicks.</p></div></section>
      <section className="section light"><div className="wrap"><InventoryGrid/></div></section>
    </main>
    <Footer/>
  </>;
}
