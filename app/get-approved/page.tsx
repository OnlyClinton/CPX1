import ApprovalLeadForm from"../ApprovalLeadForm";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Page(){
  return <>
    <WdccPublicHeader/>
    <main className="approvalBoard wdcc-public-page">
      <section className="approvalScene" aria-label="WDCC Tampa Bay pre-approval">
        <img className="approvalSceneArt" src="/wdcc-hero-v2.webp" alt="American-flag Challenger with the Tampa skyline"/>
        <div className="approvalSceneShade"/>
        <div className="approvalSceneCopy">
          <div className="eyebrow">TAMPA BAY · START HERE</div>
          <h1><span className="red">BAD CREDIT?</span><br/><span className="blue">NO CREDIT?</span><br/>WE DON&apos;T CARE.</h1>
          <p>Tell us the basics and Sean can start with your real budget, down payment and vehicle goals. This screen does not perform a hard-credit inquiry.</p>
          <ul className="approvalProof"><li>In-house financing</li><li>Real Tampa Bay team</li><li>Clear starting numbers</li><li>No hard pull on this screen</li></ul>
        </div>
      </section>
      <section className="approvalFormSide">
        <div className="approvalCard">
          <div className="approvalCardTop"><div><small>PRE-APPROVAL REQUEST</small><h2>Let&apos;s get started.</h2></div><a href="tel:18135164752">CALL SEAN<br/><b>813-516-4752</b></a></div>
          <ApprovalLeadForm/>
        </div>
      </section>
    </main>
    <section className="approvalTrust" aria-label="WDCC pre-approval trust points">
      <article><i>✓</i><div><b>NO HARD PULL HERE</b><span>This request starts a conversation; it is not a hard-credit application.</span></div></article>
      <article><i>$</i><div><b>YOUR STARTING NUMBERS</b><span>Share income and down payment so the first call is useful.</span></div></article>
      <article><i>SE</i><div><b>REAL PEOPLE</b><span>Talk directly with Sean&apos;s Tampa Bay sales team.</span></div></article>
    </section>
    <WdccPublicFooter/>
  </>;
}
