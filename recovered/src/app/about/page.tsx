import type { Metadata } from "next";
import PublicPage from "../components/PublicPage";

export const metadata: Metadata = {
  title: "About We Don't Care Cars",
  description: "Learn about WDCC's direct, straightforward approach to used vehicles and in-house financing in Tampa Bay.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About WDCC", description: "Tampa Bay used cars, clear listed numbers and direct help from Sean.", url: "/about" },
};

export default function AboutPage() {
  return (
    <PublicPage eyebrow="Tampa Bay · Direct help" title="We care about getting you moving." description="The name is bold. The process is straightforward: current vehicles, listed numbers and a real person you can call or text.">
      <div className="content-grid">
        <article><span>01</span><h2>Clear inventory</h2><p>Available vehicles show the listed cash price, down payment and mileage so you can start with the real numbers.</p></article>
        <article><span>02</span><h2>Direct contact</h2><p>You talk to Sean, not a call-center maze. Call or text to confirm condition, availability and details.</p></article>
        <article><span>03</span><h2>Practical financing</h2><p>WDCC discusses the information and down payment needed for the programs that may fit your situation.</p></article>
      </div>
      <section className="content-panel"><h2>Before you visit</h2><p>Inventory can change quickly. Call or text Sean to confirm the vehicle is still available and to arrange a time.</p></section>
    </PublicPage>
  );
}
