import Link from "next/link";
import { Footer, Header } from "../components";

export default function AboutPage() {
  return <><Header/><main className="section light"><div className="wrap leadPage">
    <p className="eyebrow muted">ABOUT WE DON'T CARE CARS</p>
    <h1>A direct approach to buying a vehicle</h1>
    <p>We Don't Care Cars serves the Tampa Bay area with vehicle listings, in-house financing inquiries, and the ability to request a test drive. Specific vehicle availability and financing terms must be confirmed with the dealership.</p>
    <p>Questions? Call Sean at <a href="tel:+18135164752">813-516-4752</a>.</p>
    <div className="actions"><Link className="cta red" href="/inventory">BROWSE VEHICLES</Link><Link className="cta" href="/schedule-test-drive?source=about">SCHEDULE A TEST DRIVE</Link><Link className="cta ghost" href="/privacy">PRIVACY INFORMATION</Link></div>
  </div></main><Footer/></>;
}
