import Link from "next/link";

export default function FinancingPage(){
  return <main className="financing-page">
    <header className="financing-header">
      <Link className="financing-logo" href="/" aria-label="We Don't Care Cars home"/>
      <nav aria-label="Financing navigation"><Link href="/inventory">Inventory</Link><Link href="/">Home</Link><Link className="financing-call" href="/get-approved?source=financing-page">Get Pre-Approved</Link></nav>
    </header>
    <section className="financing-hero">
      <div>
        <span className="financing-kicker">Tampa Bay · In-House Financing</span>
        <h1>Bad credit?<br/><em>No credit?</em><br/><strong>We don't care.</strong></h1>
        <p>Clear starting numbers. Straight answers. A simple path from application to keys.</p>
        <div className="financing-actions"><Link href="/get-approved?source=financing-page-hero">Get Pre-Approved →</Link><Link href="/inventory?source=financing-page-hero">Browse Inventory →</Link></div>
      </div>
    </section>
    <section className="financing-process">
      <div className="financing-heading"><span>One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div>
      <div className="financing-steps">
        <article><b>1</b><h3>Apply Online</h3><p>Send the basics securely in a few minutes.</p></article>
        <article><b>2</b><h3>Talk to Sean</h3><p>Confirm budget, down payment and vehicle fit.</p></article>
        <article><b>3</b><h3>Choose Your Car</h3><p>Shop real inventory online or in person.</p></article>
        <article><b>4</b><h3>Drive Today</h3><p>Schedule pickup or a test drive.</p></article>
      </div>
    </section>
    <section className="financing-proof">
      <div><b>Fast Approvals</b><span>Quick, straightforward decisions.</span></div>
      <div><b>Low Down Payments</b><span>Options designed around real buyers.</span></div>
      <div><b>Real Inventory</b><span>Shop vehicles that are actually available.</span></div>
      <div><b>Direct Help</b><span>Call Sean at 813-516-4752.</span></div>
    </section>
  </main>;
}
