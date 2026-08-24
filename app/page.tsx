import Link from"next/link";
import TrackedCallLink from"./TrackedCallLink";
import{Footer,Header,Intro,VehicleGrid}from"./components";

export default function Home(){
  return <><Intro/><Header/><main>
    <section className="premiumHero">
      <div className="heroPhoto" aria-hidden="true"/>
      <div className="heroGlow" aria-hidden="true"/>
      <div className="wrap heroContent">
        <div className="eyebrow">TAMPA BAY · DRIVE TODAY</div>
        <h1><span className="redWord">BAD CREDIT?</span><br/><span className="blueWord">NO CREDIT?</span><br/>WE DON'T CARE.</h1>
        <p className="lede">In-house financing. Low down payments. Fast approvals. Straight answers. Get on the road without the runaround.</p>
        <div className="actions">
          <Link className="cta primary" href="/schedule-test-drive?source=hero-test-drive">SCHEDULE A TEST DRIVE →</Link>
          <Link className="cta secondary" href="/get-approved?source=hero-get-approved">GET PRE-APPROVED →</Link>
          <TrackedCallLink className="cta contact" source="hero-call-sean">CALL SEAN →</TrackedCallLink>
        </div>
        <div className="heroCall"><TrackedCallLink source="hero-phone">☎ CALL SEAN <b>813-516-4752</b></TrackedCallLink></div>
      </div>
    </section>

    <section className="benefitBand"><div className="wrap"><div className="benefitGrid">
      <article><div className="benefitIcon">✓</div><strong>FAST APPROVALS</strong><span>Quick, straightforward decisions.</span></article>
      <article><div className="benefitIcon">$</div><strong>LOW DOWN PAYMENTS</strong><span>Options designed around real buyers.</span></article>
      <article><div className="benefitIcon">▣</div><strong>DRIVE TODAY</strong><span>Move from interest to the road.</span></article>
      <article><div className="benefitIcon">◇</div><strong>BUILD YOUR CREDIT</strong><span>Ask what programs may apply.</span></article>
    </div></div></section>

    <section className="section inventoryPremium"><div className="wrap">
      <div className="sectionHead"><div><div className="eyebrow muted">FEATURED INVENTORY</div><h2>Vehicles ready now.</h2><p className="muted">Cash price and down payment shown clearly.</p></div><Link className="inventoryViewAll" href="/inventory">VIEW ALL INVENTORY →</Link></div>
      <VehicleGrid limit={5}/>
    </div></section>

    <section id="how-it-works" className="financePremium"><div className="wrap">
      <h2>IN-HOUSE FINANCING. <em>WE MAKE IT EASY.</em></h2>
      <div className="financeSteps">
        <article><div className="stepNum">1</div><b>START ONLINE</b><p>Send the basics in minutes.</p></article>
        <article><div className="stepNum">2</div><b>TALK TO SEAN</b><p>Get a straight answer and confirm your options.</p></article>
        <article><div className="stepNum">3</div><b>CHOOSE YOUR CAR</b><p>Pick from actual available inventory.</p></article>
        <article><div className="stepNum">4</div><b>DRIVE TODAY</b><p>Schedule pickup or a test drive.</p></article>
      </div>
    </div></section>

    <section className="trustPremium"><div className="wrap">
      <div className="trustLead"><div><div className="eyebrow">WHY CUSTOMERS CHOOSE WDCC</div><h2>REAL PEOPLE. REAL APPROVALS.</h2></div><TrackedCallLink className="trustCall" source="trust-call-sean">CALL OR TEXT SEAN<br/><b>813-516-4752</b></TrackedCallLink></div>
      <div className="trust">
        <div><strong>100% IN-HOUSE</strong><span>Financing done right here.</span></div>
        <div><strong>NO RUNAROUND</strong><span>Fast answers and clear next steps.</span></div>
        <div><strong>REAL INVENTORY</strong><span>Dealer-published vehicles only.</span></div>
        <div><strong>SECURE PROCESS</strong><span>Your information is handled carefully.</span></div>
      </div>
    </div></section>
  </main><Footer/></>
}
