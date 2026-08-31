import LeadForm from "../LeadForm";
import{Footer,Header}from"../components";

export default function Page(){return <>
  <Header/>
  <main className="conversionPage conversionApproval">
    <div className="conversionBackdrop" aria-hidden="true"/>
    <div className="wrap conversionGrid">
      <section className="conversionCopy">
        <p className="conversionCrumb">Home <span>›</span> Get pre-approved</p>
        <h1>Get pre-approved<br/><strong>in minutes.</strong><br/><em>Drive today.</em></h1>
        <p className="conversionLead">Simple. Direct. No hard-credit application on this page.</p>
        <ul><li>Fast first response from the WDCC team</li><li>In-house financing for many credit situations</li><li>No pressure—just a direct conversation</li><li>Talk with Sean about the actual available cars</li></ul>
        <a className="conversionSean" href="tel:+18135164752"><span>Questions? Talk to Sean</span><strong>813-516-4752</strong><small>Call or text anytime</small></a>
      </section>
      <section className="conversionCard">
        <div className="conversionCardHead"><span>Private request</span><h2>Get pre-approved</h2><p>Send the basics so Sean can follow up. No SSN is collected here.</p></div>
        <div className="conversionProgress" aria-label="Three-step approval process"><span className="active"><b>1</b>Your info</span><span><b>2</b>Your vehicle</span><span><b>3</b>Review</span></div>
        <LeadForm kind="approval" source="get-approved"/>
      </section>
    </div>
    <section className="conversionTrust wrap"><article><b>Fast first response</b><span>Start online in minutes.</span></article><article><b>In-house financing</b><span>Discuss the options that may fit.</span></article><article><b>No-pressure help</b><span>Clear, direct answers.</span></article><article><b>Direct with Sean</b><span>Call or text the dealership.</span></article></section>
  </main>
  <Footer/>
</>}
