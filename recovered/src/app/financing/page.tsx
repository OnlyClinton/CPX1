import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = {
  title: "In-House Auto Financing in Tampa Bay",
  description: "Learn how WDCC in-house financing works, what to prepare, and how to start a direct pre-approval request with Sean.",
  alternates: { canonical: "/financing" },
  openGraph: { title: "In-House Auto Financing | WDCC", description: "A direct, straightforward path from basic information to a vehicle and confirmed terms.", url: "/financing" },
};

const faqSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Does WDCC guarantee approval?", acceptedAnswer: { "@type": "Answer", text: "No. Approval and final terms depend on the buyer's information, available down payment, vehicle and applicable dealer or lender requirements." } },
    { "@type": "Question", name: "Does the website ask for an SSN or banking password?", acceptedAnswer: { "@type": "Answer", text: "No. The website's starter request does not collect an SSN or banking password." } },
    { "@type": "Question", name: "How do I start?", acceptedAnswer: { "@type": "Answer", text: "Use the pre-approval page to prepare a text request, or call Sean directly at 813-516-4752." } },
  ],
}).replace(/</g, "\\u003c");

export default function FinancingPage() {
  return (
    <PublicPage eyebrow="Straight answers · No runaround" title="Financing made easier." description="WDCC starts with the basics, then Sean confirms the vehicle, down payment and available terms directly with you.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />
      <div className="content-grid">
        <article><span>01</span><h2>Start small</h2><p>Send contact details, a broad income range and your available down payment. No SSN or banking password is requested online.</p></article>
        <article><span>02</span><h2>Confirm the fit</h2><p>Talk directly with Sean about the vehicle, your budget, documentation and the terms that may be available.</p></article>
        <article><span>03</span><h2>Review before signing</h2><p>Final price, payment schedule, fees and financing disclosures should be reviewed before you agree.</p></article>
      </div>
      <section className="content-panel"><h2>What to have ready</h2><ul><li>A valid driver&apos;s license or accepted identification</li><li>Current income and residence information</li><li>Your realistic down-payment amount</li><li>The vehicle you want—or the budget you need to stay within</li></ul><p>Approval is not guaranteed, and advertised down payments are subject to verification and final terms.</p></section>
    </PublicPage>
  );
}
