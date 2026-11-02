import Link from "next/link";
import { Footer, Header } from "../components";

export default function ReviewsPage() {
  return <><Header/><main className="section light"><div className="wrap leadPage">
    <p className="eyebrow muted">CUSTOMER FEEDBACK</p>
    <h1>Reviews and customer experiences</h1>
    <p>Verified customer reviews have not been published to this page. We do not display invented reviews or unverified star ratings.</p>
    <p>Have a question about a vehicle, the purchasing process, or financing? Contact the dealership directly for current details.</p>
    <div className="actions"><Link className="cta red" href="/contact?source=reviews">CONTACT US</Link><Link className="cta" href="/inventory">VIEW INVENTORY</Link></div>
  </div></main><Footer/></>;
}
