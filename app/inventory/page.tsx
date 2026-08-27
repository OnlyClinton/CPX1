import InventoryGrid from"../InventoryGrid";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Inventory(){
  return <>
    <WdccPublicHeader/>
    <main className="inventoryPage wdcc-public-page">
      <section className="inventoryTop"><div className="wrap"><div className="eyebrow">TAMPA BAY · INVENTORY</div><h1><span style={{color:"#ef1f2f"}}>SHOP</span> INVENTORY.</h1><p className="lede">Great vehicles. Low payments. Drive today.</p></div></section>
      <section className="section light"><div className="wrap"><InventoryGrid/></div></section>
    </main>
    <WdccPublicFooter/>
  </>;
}
