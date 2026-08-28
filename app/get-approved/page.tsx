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
          <div className="eyebrow">HOME　›　GET PRE-APPROVED</div>
          <h1><span>GET PRE-APPROVED</span><br/><span className="red">IN MINUTES.</span><br/><span className="red">DRIVE TODAY.</span></h1>
          <p>Simple. Secure. No impact on your credit score.</p>
          <ul className="approvalProof"><li>Fast approvals — usually in minutes</li><li>In-house financing for all credit types</li><li>No pressure — just honest help</li><li>Talk directly with Sean — real answers</li></ul>
          <div className="approvalSean"><span>QUESTIONS? TALK TO SEAN</span><a href="tel:18135164752">☎ <b>(813) 516-4752</b></a><small>Call or Text Anytime</small></div>
        </div>
      </section>
      <section className="approvalFormSide" id="preapproval-form">
        <div className="approvalCard">
          <div className="approvalCardTop"><div><h2>GET PRE-APPROVED</h2><p>Take 2 minutes to complete our secure pre-approval.<br/>No SSN required to get started.</p></div></div>
          <ApprovalLeadForm/>
        </div>
      </section>
    </main>
    <section className="approvalTrust" aria-label="WDCC pre-approval trust points">
      <article><i>✓</i><div><b>FAST APPROVALS</b><span>Get approved in minutes, not days.</span></div></article>
      <article><i>◇</i><div><b>IN-HOUSE FINANCING</b><span>We work with all credit types.</span></div></article>
      <article><i>☏</i><div><b>DIRECT WITH SEAN</b><span>Talk to Sean directly. Get real answers.</span></div></article>
      <article><i>0</i><div><b>HIDDEN FEES</b><span>Clear starting numbers and direct help.</span></div></article>
    </section>
    <section className="approvalLower" aria-label="WDCC Tampa Bay buyer support">
      <div className="approvalLowerGrid">
        <article className="approvalCustomerProof"><h3>WHAT OUR CUSTOMERS SAY</h3><div className="approvalStars" aria-label="Five star service focus">★★★★★</div><p>Straight answers, clear next steps, and direct contact with Sean from application through pickup.</p></article>
        <article className="approvalTampaProof"><h3>WE&apos;RE TAMPA BAY PROUD</h3><div className="approvalTampaFeatures"><div><i>⌂</i><b>TAMPA BAY</b><span>Local inventory</span></div><div><i>✓</i><b>FAST APPROVALS</b><span>Simple next steps</span></div><div><i>◇</i><b>IN-HOUSE FINANCING</b><span>Multiple credit profiles</span></div><div><i>☏</i><b>DIRECT WITH SEAN</b><span>Call or text anytime</span></div></div></article>
      </div>
      <div className="approvalReady"><div><b>READY TO DRIVE?</b><span>Get pre-approved now and see what you qualify for.</span></div><a href="#preapproval-form">GET PRE-APPROVED NOW <span aria-hidden="true">→</span></a><div className="approvalReadyPhone"><b>☎ (813) 516-4752</b><small>Call or Text Sean Anytime</small></div></div>
    </section>
    <WdccPublicFooter/>
  </>;
}