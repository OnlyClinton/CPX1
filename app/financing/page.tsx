import Link from "next/link";
import { Footer, Header } from "../components";

export default function FinancingPage() {
  return <><Header/><main className="section light"><div className="wrap leadPage">
    <p className="eyebrow muted">TAMPA BAY · FINANCING</p>
    <h1>Explore financing options</h1>
    <p>We Don't Care Cars offers a conversation about in-house financing. Actual financing, required down payment, and vehicle availability depend on review and approval. No approval is guaranteed.</p>
    <div className="actions"><Link className="cta red" href="/get-approved?source=financing">START PRE-APPROVAL</Link><Link className="cta" href="/inventory">VIEW PUBLISHED INVENTORY</Link><a className="cta ghost" href="tel:+18135164752">CALL 813-516-4752</a></div>
    <p>Submitting an inquiry through this site starts a conversation; it is not a final credit decision or a financing contract.</p>
  </div></main><Footer/></>;
}
