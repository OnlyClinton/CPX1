import type {Metadata} from "next";
import Link from "next/link";
import {Footer,Header} from "../components";

export const metadata:Metadata={
  title:"About We Don't Care Cars | Tampa Bay Used Vehicles",
  description:"Learn about We Don't Care Cars' Tampa Bay vehicle shopping process, vehicle availability checks and ways to contact the sales team.",
  alternates:{canonical:"/about"}
};

export default function About(){
  return <><Header/><main className="section light">
    <div className="wrap" style={{maxWidth:980}}>
      <p className="eyebrow muted">TAMPA BAY · ABOUT US</p>
      <h1>We Don't Care Cars</h1>
      <p>We help local shoppers explore used vehicles, compare posted cash prices and estimated down payments, and ask questions before visiting.</p>
      <h2>How to shop</h2>
      <p>Browse the <Link href="/inventory">vehicle listings</Link>, then confirm each vehicle's current availability, condition, final price, applicable financing terms and appointment details with our team before making a decision.</p>
      <h2>Financing and appointments</h2>
      <p>Available financing options and approvals depend on individual eligibility and lender or dealership terms. An online inquiry is not an offer of credit or a guaranteed approval.</p>
      <p><Link href="/get-approved">Ask about financing</Link> or <Link href="/schedule-test-drive">request a test drive</Link>. Submission does not guarantee an appointment until confirmed.</p>
      <h2>Contact</h2>
      <p><Link href="/contact">Contact our team</Link> or call <a href="tel:+18135164752">813-516-4752</a> to verify hours, availability and next steps.</p>
    </div>
  </main><Footer/></>;
}
