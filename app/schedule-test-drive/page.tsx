import LeadForm from"../LeadForm";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Page(){
  return <>
    <WdccPublicHeader/>
    <main className="section light wdcc-public-page"><div className="wrap leadPage"><div className="eyebrow muted">READY TO DRIVE?</div><h1>Schedule a Test Drive</h1><p>Tell us what you want to see and when you can visit.</p><LeadForm kind="schedule" source="schedule-test-drive"/></div></main>
    <WdccPublicFooter/>
  </>;
}
