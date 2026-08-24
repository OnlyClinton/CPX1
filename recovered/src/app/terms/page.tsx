import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = {
  title: "Website Terms",
  description: "WDCC website terms covering inventory, pricing, financing information and direct contact requests.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PublicPage eyebrow="Effective August 23, 2026" title="Website terms." description="Important limits and disclosures for WDCC inventory, financing information and contact requests.">
      <div className="legal-copy">
        <h2>Inventory and availability</h2><p>Vehicle availability, mileage, condition, equipment and photographs can change or require verification. Contact Sean before traveling or relying on a listing.</p>
        <h2>Pricing and down payments</h2><p>Advertised cash prices and down payments are informational and may be corrected if a listing contains an error. Taxes, title, registration, dealer fees and optional products may be additional unless expressly stated otherwise.</p>
        <h2>Financing</h2><p>Submitting a starter request is not a credit application, offer or guarantee of approval. Final approval and terms depend on identity, income, residence, available down payment, vehicle and applicable dealer or lender requirements.</p>
        <h2>No vehicle-history guarantee</h2><p>Website summaries do not replace an inspection or a current third-party vehicle-history report. Request the available records and inspect the vehicle before purchase.</p>
        <h2>Acceptable use</h2><p>Do not misuse the site, submit false information, attempt unauthorized access or interfere with site availability. For questions, call 813-516-4752.</p>
      </div>
    </PublicPage>
  );
}
