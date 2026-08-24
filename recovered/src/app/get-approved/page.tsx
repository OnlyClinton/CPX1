import type { Metadata } from "next";
import LeadRequestForm from "../components/LeadRequestForm";
import PublicPage from "../components/PublicPage";
import { inventoryVehicles } from "../data";

export const metadata: Metadata = {
  title: "Get Pre-Approved",
  description: "Start a direct WDCC pre-approval request for a Tampa Bay used vehicle. No SSN, banking password or hard credit pull is collected on this page.",
  alternates: { canonical: "/get-approved" },
  openGraph: { title: "Get Pre-Approved | WDCC", description: "Share the basics, then send the request directly to Sean by text.", url: "/get-approved" },
};

export default async function GetApprovedPage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const selectedVehicle = inventoryVehicles.some((item) => item.slug === vehicle) ? vehicle : undefined;
  return (
    <PublicPage eyebrow="Direct in-house financing" title="Start your pre-approval." description="Share the basics, review the message on your phone, and send it directly to Sean. This page does not ask for an SSN or banking password." primaryLabel="Call Sean" primaryHref="tel:+18135164752">
      <div className="content-grid">
        <article><span>01</span><h2>Tell us the basics</h2><p>Your contact details, general income range and available down payment help Sean start the conversation.</p></article>
        <article><span>02</span><h2>Send the text</h2><p>The form prepares a message in your phone&apos;s text app. You review it before anything is sent.</p></article>
        <article><span>03</span><h2>Choose a vehicle</h2><p>Sean confirms availability, financing terms and the right fit from current inventory.</p></article>
      </div>
      <section className="form-card"><h2>Pre-approval request</h2><p>No guarantee of approval. Final terms depend on identity, income, vehicle and lender or dealer requirements.</p><LeadRequestForm mode="apply" selectedVehicle={selectedVehicle} /></section>
    </PublicPage>
  );
}
