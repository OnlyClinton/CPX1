import LeadForm from "../LeadForm";
import{Footer,Header}from"../components";

export default function Page(){return <>
  <Header/>
  <main className="conversionPage conversionSchedule">
    <div className="conversionBackdrop" aria-hidden="true"/>
    <div className="wrap conversionGrid">
      <section className="conversionCopy">
        <p className="conversionCrumb">Home <span>›</span> Schedule a test drive</p>
        <h1>Ready to drive?<br/><strong>Choose the car.</strong><br/><em>Pick your time.</em></h1>
        <p className="conversionLead">Tell us which vehicle you want to see and when you can visit.</p>
        <ul><li>Choose from the actual published inventory</li><li>Request a preferred date and time</li><li>Confirm details directly with Sean</li><li>Get a clear answer before you make the trip</li></ul>
        <a className="conversionSean" href="tel:+18135164752"><span>Need help now?</span><strong>813-516-4752</strong><small>Call or text Sean</small></a>
      </section>
      <section className="conversionCard">
        <div className="conversionCardHead"><span>Drive today</span><h2>Schedule a test drive</h2><p>Send your preferred vehicle and visit time. The team will confirm availability.</p></div>
        <LeadForm kind="schedule" source="schedule-test-drive"/>
      </section>
    </div>
    <section className="conversionTrust wrap"><article><b>Real inventory</b><span>Request the car you actually want.</span></article><article><b>Flexible timing</b><span>Tell us when you can visit.</span></article><article><b>Straight answers</b><span>Confirm before you drive over.</span></article><article><b>Direct with Sean</b><span>Call or text the dealership.</span></article></section>
  </main>
  <Footer/>
</>}
