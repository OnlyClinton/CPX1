import InventoryGrid from"../InventoryGrid";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Inventory(){
  return <>
    <WdccPublicHeader/>
    <main className="inventoryPage wdcc-public-page">
      <section className="inventoryTop"><div className="wrap"><div className="eyebrow">TAMPA BAY · INVENTORY</div><h1><span style={{color:"#ef1f2f"}}>SHOP</span> INVENTORY.</h1><p className="lede">Great vehicles. Low payments. Drive today.</p></div></section>
      <section className="section light"><div className="wrap"><InventoryGrid/></div></section>
      <section className="inventoryReadyBand" aria-label="Get pre-approved"><div className="wrap inventoryReadyInner"><span className="inventoryReadyIcon" aria-hidden="true">◴</span><div><h2>READY TO DRIVE YOUR NEXT CAR?</h2><p>Get pre-approved in minutes with no impact to your credit score.</p></div><a href="/get-approved?source=inventory-ready-band">GET PRE-APPROVED <span aria-hidden="true">→</span></a></div></section>
      <section className="inventoryTrustBand"><div className="wrap inventoryTrustGrid"><div><span aria-hidden="true">✓</span><strong>FAST APPROVALS</strong><small>Quick, straightforward decisions.</small></div><div><span aria-hidden="true">$</span><strong>LOW DOWN PAYMENTS</strong><small>Options designed around real buyers.</small></div><div><span aria-hidden="true">▱</span><strong>DRIVE TODAY</strong><small>Move from interest to the road.</small></div><div><span aria-hidden="true">◇</span><strong>BUILD YOUR CREDIT</strong><small>Ask what programs may apply.</small></div></div></section>
      <a className="inventoryMobilePreapprove" href="/get-approved?source=inventory-mobile-sticky">GET PRE-APPROVED <span aria-hidden="true">→</span></a>
    </main>
    <WdccPublicFooter/>
    <style>{`
      /* Route-local final authority: public inventory is 3-up desktop, 1-up mobile. */
      @media (min-width:768px){
        html body main.inventoryPage.wdcc-public-page section.section.light > div.wrap > div.inventoryGrid.wdccVehicleGrid:not(.wdccListView){
          display:grid!important;
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
          gap:18px!important;
        }
      }
      @media (max-width:767px){
        html body main.inventoryPage.wdcc-public-page section.section.light > div.wrap > div.inventoryGrid.wdccVehicleGrid:not(.wdccListView){
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          gap:12px!important;
        }
      }
    `}</style>
  </>;
}
