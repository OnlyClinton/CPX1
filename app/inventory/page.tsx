import InventoryGrid from"../InventoryGrid";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Inventory(){
  return <>
    <WdccPublicHeader/>
    <main className="inventoryPage wdcc-public-page">
      <section className="inventoryTop"><div className="wrap"><div className="eyebrow">INVENTORY</div><h1>FIND THE RIGHT CAR.</h1><p className="lede">Cash price, estimated down payment, mileage and the details that matter. No weekly-payment gimmicks.</p></div></section>
      <section className="section light"><div className="wrap"><InventoryGrid/></div></section>
    </main>
    <WdccPublicFooter/>
  </>;
}
