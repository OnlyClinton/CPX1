import LeadForm from"../LeadForm";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Page(){
  return <>
    <WdccPublicHeader/>
    <main className="section light wdcc-public-page"><div className="wrap leadPage"><div className="eyebrow muted">DIRECT HUMAN HELP</div><h1>Call or Contact Us</h1><p>Send your question and Sean&apos;s team will follow up.</p><LeadForm kind="contact" source="call-sean"/></div></main>
    <WdccPublicFooter/>
  </>;
}
