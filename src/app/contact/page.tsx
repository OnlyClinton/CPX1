import type { Metadata } from "next";
import Link from "next/link";
import LeadRequestForm from "../components/LeadRequestForm";
import PublicPage from "../components/PublicPage";
import { inventoryVehicles } from "../data";

export const metadata: Metadata = {
  title: "Contact Sean & Schedule a Test Drive",
  description: "Call, text or request a test drive with Sean at WDCC in Tampa Bay.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact WDCC", description: "Talk directly to Sean or request a Tampa Bay test drive.", url: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const selectedVehicle = inventoryVehicles.some((item) => item.slug === vehicle) ? vehicle : undefined;
  return (
    <PublicPage eyebrow="Real person · Direct answer" title="Talk directly to Sean." description="Call, text or send a test-drive request. Confirm vehicle availability before you make the trip." primaryLabel="Call 813-516-4752" primaryHref="tel:+18135164752">
      <div className="contact-cards">
        <a href="tel:+18135164752"><strong>Call Sean</strong><span>813-516-4752</span></a>
        <a href="sms:+18135164752"><strong>Text Sean</strong><span>Ask about a vehicle or financing</span></a>
        <Link href="/inventory"><strong>Shop inventory</strong><span>See all five available vehicles</span></Link>
      </div>
      <section className="form-card"><h2>Request a test drive</h2><p>Choose a preferred time. Sean will confirm the vehicle and appointment with you directly.</p><LeadRequestForm mode="test-drive" selectedVehicle={selectedVehicle} /></section>
    </PublicPage>
  );
}
