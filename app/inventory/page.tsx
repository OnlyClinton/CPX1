import {headers} from"next/headers";
import InventoryGrid from"../InventoryGrid";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";
import{isIsolatedWorkersDevPreview}from"../../lib/visualPreviewGate";

export default async function Inventory(){
  const allowVisualFixture=isIsolatedWorkersDevPreview(await headers());
  return <>
    <WdccPublicHeader/>
    <main className="inventoryPage wdcc-public-page">
      <section className="inventoryTop"><div className="wrap"><div className="eyebrow">TAMPA BAY · INVENTORY</div><h1><span style={{color:"#ef1f2f"}}>SHOP</span> INVENTORY.</h1><p className="lede">Great vehicles. Low payments. Drive today.</p></div></section>
      <section className="section light"><div className="wrap"><InventoryGrid allowVisualFixture={allowVisualFixture}/></div></section>
    </main>
    <WdccPublicFooter/>
  </>;
}
