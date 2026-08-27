import LeadForm from"../LeadForm";
import{WdccPublicFooter,WdccPublicHeader}from"../WdccPublicChrome";

export default function Page(){
  return <>
    <WdccPublicHeader/>
    <main className="section light wdcc-public-page"><div className="wrap leadPage"><div className="eyebrow muted">START HERE</div><h1>Get Approved</h1><p>Start the conversation without a hard-credit application on this page.</p><LeadForm kind="approval" source="get-approved"/></div></main>
    <WdccPublicFooter/>
  </>;
}
