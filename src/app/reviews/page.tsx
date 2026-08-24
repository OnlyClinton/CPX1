import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = {
  title: "Customer Experience & Reviews",
  description: "See the customer-experience standards WDCC follows and contact Sean directly with questions about a vehicle or financing.",
  alternates: { canonical: "/reviews" },
  openGraph: { title: "WDCC Customer Experience", description: "Clear numbers, direct contact and no invented ratings or testimonials.", url: "/reviews" },
};

export default function ReviewsPage() {
  return (
    <PublicPage eyebrow="No made-up testimonials" title="Judge us by the experience." description="WDCC does not publish an invented star rating. We focus on the standards you can verify during your own call, visit and purchase.">
      <div className="content-grid">
        <article><span>01</span><h2>Straight answers</h2><p>Ask about price, mileage, condition, availability and financing. If a detail needs confirming, we say so.</p></article>
        <article><span>02</span><h2>Visible numbers</h2><p>Current listings show the advertised cash price and down payment instead of making you request basic figures.</p></article>
        <article><span>03</span><h2>Real contact</h2><p>Call or text Sean directly before you travel, especially to confirm that a vehicle is still available.</p></article>
      </div>
      <section className="content-panel"><h2>Already worked with WDCC?</h2><p>Tell Sean about the experience—what worked and what should improve. Direct feedback is how the process gets better.</p></section>
    </PublicPage>
  );
}
