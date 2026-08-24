/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatMiles, formatMoney, heroImage, inventoryVehicles, type Vehicle } from "../data";
import { trackEvent } from "../lib/analytics";

type RouteName = "home" | "inventory" | "detail";
type IntroPhase = "reveal" | "done";

const badgeClass: Record<string, string> = {
  "Great Value": "green",
  "Best Seller": "blue",
  "Clean Carfax": "purple",
  "Low Miles": "orange",
  "Available": "green",
};

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? "compact" : ""}`}>
      <img
        src="/wdcc-logo-transparent.webp"
        alt="We Don't Care Cars"
        width="512"
        height="512"
      />
    </span>
  );
}

function IntroAnimation({ onDone }: { onDone: () => void }) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [dockStyle, setDockStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    const badge = badgeRef.current;
    const headerLogo = document.querySelector<HTMLElement>(".home-header-shell .brand-logo");
    if (!badge || !headerLogo) return;

    const source = badge.getBoundingClientRect();
    const destination = headerLogo.getBoundingClientRect();
    const baseWidth = Number.parseFloat(getComputedStyle(badge).width);

    setDockStyle({
      "--wdcc-dock-x-shift": `${destination.left + destination.width / 2 - (source.left + source.width / 2)}px`,
      "--wdcc-dock-y-shift": `${destination.top + destination.height / 2 - (source.top + source.height / 2)}px`,
      "--wdcc-dock-scale": String(destination.width / baseWidth),
    } as React.CSSProperties);
  }, []);

  return (
    <div className={`intro-sequence ${dockStyle ? "intro-reveal" : "intro-prepare"}`} aria-hidden="true">
      <div
        ref={badgeRef}
        className="intro-badge"
        style={dockStyle ?? undefined}
        onAnimationEnd={(event) => {
          if (event.animationName === "wdcc-logo-handoff") onDone();
        }}
      >
        <Logo />
      </div>
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Header({ home = false, detail = false }: { home?: boolean; detail?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${home ? "header-shell home-header-shell" : "header-shell"}${detail ? " detail-header-shell" : ""}`}>
      <div className="utility-bar">
        <span>⌖ Tampa Bay</span><span>In-house financing</span><span>Sean · <b>813-516-4752</b></span>
      </div>
      <header className="site-header">
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close navigation" : "Open navigation"}><span aria-hidden="true"><i /><i /><i /></span></button>
        <Link className="logo-button" href="/" aria-label="WDCC home"><Logo /></Link>
        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Main navigation">
          <Link href="/inventory" onClick={() => setOpen(false)}>Inventory</Link>
          <Link href="/financing" onClick={() => setOpen(false)}>Financing</Link>
          <Link href="/#how-it-works" onClick={() => setOpen(false)}>How it works</Link>
          <Link href="/reviews" onClick={() => setOpen(false)}>Reviews</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About us</Link>
        </nav>
        <Link id="apply" className="btn btn-primary header-cta" href="/get-approved" onClick={() => trackEvent("apply_start", { placement: "header" })}>Get pre-approved</Link>
        <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752" onClick={() => trackEvent("call_click", { placement: "mobile_header" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z" /></svg><span><small>Call</small>Sean</span></a>
      </header>
    </div>
  );
}

function BenefitStrip() {
  const benefits = [
    ["◴", "Fast answers", "Talk directly to Sean"],
    ["$", "Listed down payments", "See the number before you call"],
    ["▣", "Schedule a test drive", "Choose a time and confirm"],
    ["◇", "Financing options", "Final terms are subject to approval"],
  ];
  return (
    <section className="benefit-strip" aria-label="WDCC benefits">
      {benefits.map(([icon, title, copy]) => (
        <article key={title}>
          <Icon>{icon}</Icon><div><strong>{title}</strong><span>{copy}</span></div>
        </article>
      ))}
    </section>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <article className="vehicle-card">
      <Link className="vehicle-image" href={`/inventory/${vehicle.slug}`} onClick={() => trackEvent("vehicle_open", { vehicle: vehicle.slug, placement: "vehicle_card" })} aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}>
        <img src={vehicle.images[0]} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`} />
        <span className="image-count">1/{vehicle.images.length}</span>
        <span className="card-badges">
          {vehicle.badges.slice(0, 1).map((badge) => <span className={badgeClass[badge] || "blue"} key={badge}>{badge}</span>)}
        </span>
      </Link>
      <div className="vehicle-card-body">
        <p className="eyebrow">{vehicle.year} {vehicle.make}</p>
        <Link className="vehicle-title" href={`/inventory/${vehicle.slug}`} onClick={() => trackEvent("vehicle_open", { vehicle: vehicle.slug, placement: "vehicle_title" })}>{vehicle.model} {vehicle.trim}</Link>
        <strong className="vehicle-price">{formatMoney(vehicle.price)}</strong>
        <p className="vehicle-payment">{formatMoney(vehicle.downPayment)} down <b>•</b> {formatMiles(vehicle.mileage)} miles</p>
        <div className="spec-pills"><span>{vehicle.bodyType}</span><span>{vehicle.transmission}</span><span>{vehicle.drivetrain}</span></div>
      </div>
    </article>
  );
}

function Home({ vehicles }: { vehicles: Vehicle[] }) {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const preferred = ["2004-nissan-350z", "2016-ford-f150-limited", "2019-honda-pilot", "2019-kia-sportage", "2019-toyota-rav4"];
  const featured = vehicles.filter((v) => v.featured && v.status === "available").sort((a, b) => preferred.indexOf(a.slug) - preferred.indexOf(b.slug)).slice(0, 5);
  return (
    <>
      <section className="hero" style={{ "--hero-image": `url(${heroImage})` } as React.CSSProperties}>
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="hero-kicker">Tampa Bay · Drive today</p>
          <h1>Bad credit?<br /><em>No credit?</em><br /><strong>We don&apos;t care.</strong></h1>
          <p className="hero-lead">In-house financing. Listed down payments.<br />Direct answers from Sean.<br />Get on the road without the runaround.</p>
          <div className="hero-actions" aria-label="Choose your next step">
            <Link className="btn btn-primary hero-cta-test" href="/contact" onClick={() => trackEvent("test_drive_start", { placement: "hero" })}>Schedule a test drive <span>→</span></Link>
            <Link className="btn btn-outline hero-cta-qualify" href="/get-approved" onClick={() => trackEvent("apply_start", { placement: "hero" })}>Get qualified <span>→</span></Link>
            <Link className="hero-call hero-cta-contact" href="/contact" onClick={() => trackEvent("contact_start", { placement: "hero" })} aria-label="Contact WDCC"><span><small>Questions or ready?</small><strong>Contact us</strong></span><b aria-hidden="true">→</b></Link>
          </div>
        </div>
        <div className="hero-car-glow" />
      </section>
      <BenefitStrip />

      <section className="inventory-showcase">
        <div className="section-heading"><div><span className="section-kicker">Featured inventory</span><h2>Vehicles ready now.</h2><p className="section-deck">Cash price and down payment shown clearly.</p></div><Link className="text-link" href="/inventory" onClick={() => trackEvent("inventory_open", { placement: "featured" })}>View all inventory →</Link></div>
        <div className="featured-carousel" aria-roledescription="carousel" aria-label="Featured vehicles">
          <button className="carousel-arrow carousel-prev" onClick={() => setFeaturedIndex((featuredIndex - 1 + featured.length) % featured.length)} aria-label="Previous featured vehicle">‹</button>
          <div className="featured-grid">
            {featured.map((vehicle, index) => <div className={index === featuredIndex ? "featured-slide active" : "featured-slide"} key={vehicle.id}><VehicleCard vehicle={vehicle} /></div>)}
          </div>
          <button className="carousel-arrow carousel-next" onClick={() => setFeaturedIndex((featuredIndex + 1) % featured.length)} aria-label="Next featured vehicle">›</button>
          <div className="carousel-dots" role="tablist" aria-label="Choose featured vehicle">{featured.map((vehicle, index) => <button className={index === featuredIndex ? "active" : ""} onClick={() => setFeaturedIndex(index)} aria-label={`Show ${vehicle.year} ${vehicle.make} ${vehicle.model}`} aria-selected={index === featuredIndex} role="tab" key={vehicle.id} />)}</div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading"><div><span className="section-kicker">One simple process. No hoops. No hassle.</span><h2>In-house financing <strong>made easy.</strong></h2></div></div>
        <div className="steps-grid">
          <article><span>01</span><h3>Start online</h3><p>Prepare the basics, review the text on your phone, then send it to Sean.</p></article>
          <article><span>02</span><h3>Talk to Sean</h3><p>Confirm your down payment and find the right vehicle fit.</p></article>
          <article><span>03</span><h3>Choose your car</h3><p>Shop our inventory online or see it in person.</p></article>
          <article><span>04</span><h3>Drive today</h3><p>Schedule pickup or a test drive and leave with confidence.</p></article>
        </div>
      </section>

      <section className="about-section trust-grid" id="reviews">
        <article><span className="trust-icon">☆</span><div><h3>Tampa Bay proud</h3><p>Local dealer. Local community.</p></div></article>
        <article><span className="trust-icon">•••</span><div><h3>Straight answers</h3><p>Ask directly about pricing, fees and terms.</p></div></article>
        <article><span className="trust-avatar">SE</span><div><h3>Real people</h3><p>Talk to Sean. Not a call center.</p></div></article>
        <article><span className="trust-icon">✓</span><div><h3>Confidence driven</h3><p>We make it happen when others can&apos;t.</p></div></article>
      </section>
    </>
  );
}

function Inventory({ vehicles }: { vehicles: Vehicle[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [make, setMake] = useState("All makes");
  const [maxPrice, setMaxPrice] = useState("Any price");
  const [sort, setSort] = useState("Best match");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = vehicles.filter((v) => {
      if (v.status !== "available") return false;
      if (type !== "All" && v.bodyType !== type) return false;
      if (make !== "All makes" && v.make !== make) return false;
      if (maxPrice !== "Any price" && v.price > Number(maxPrice)) return false;
      return !needle || `${v.year} ${v.make} ${v.model} ${v.trim}`.toLowerCase().includes(needle);
    });
    return result.sort((a, b) => sort === "Price low" ? a.price - b.price : sort === "Price high" ? b.price - a.price : sort === "Lowest miles" ? a.mileage - b.mileage : Number(b.featured) - Number(a.featured));
  }, [vehicles, query, type, make, maxPrice, sort]);

  const makes = Array.from(new Set(vehicles.map((v) => v.make))).sort();
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const cards = visible.slice((page - 1) * pageSize, page * pageSize);

  const chooseType = (value: string) => { setType(value); setPage(1); };
  return (
    <main className="inventory-page">
      <div className="page-title"><h1>Inventory</h1><p>Quality vehicles. Easy financing.</p></div>
      <div className="inventory-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search make, model, or keyword…" aria-label="Search inventory" /></label>
        <button className="btn btn-outline filter-button" onClick={() => document.querySelector(".filter-row")?.classList.toggle("mobile-open")}>☷ Filters</button>
      </div>
      <div className="type-tabs" role="tablist">
        {["All", "Car", "Truck", "SUV"].map((item) => <button role="tab" aria-selected={type === item} className={type === item ? "active" : ""} onClick={() => chooseType(item)} key={item}>{item === "All" ? "All vehicles" : `${item}s`} <span>({vehicles.filter((v) => v.status === "available" && (item === "All" || v.bodyType === item)).length})</span></button>)}
      </div>
      <div className="filter-row">
        <label><span>Make</span><select value={make} onChange={(e) => { setMake(e.target.value); setPage(1); }}><option>All makes</option>{makes.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label><span>Maximum price</span><select value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}><option>Any price</option><option value="5000">$5,000</option><option value="8000">$8,000</option><option value="12000">$12,000</option><option value="16000">$16,000</option></select></label>
        <label><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option>Best match</option><option>Price low</option><option>Price high</option><option>Lowest miles</option></select></label>
        <button className="clear-filters" onClick={() => { setQuery(""); setType("All"); setMake("All makes"); setMaxPrice("Any price"); setSort("Best match"); setPage(1); }}>Clear all</button>
      </div>
      <div className="inventory-result-row"><strong>{visible.length} vehicles</strong><span>Confirm availability with Sean</span></div>
      {cards.length ? <div className="inventory-grid">{cards.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div> : <div className="empty-state"><h2>No exact matches</h2><p>Clear a filter or search a different vehicle.</p><button className="btn btn-primary" onClick={() => { setQuery(""); setType("All"); setMake("All makes"); setMaxPrice("Any price"); }}>Show all inventory</button></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>← Previous</button>{Array.from({ length: pageCount }, (_, i) => <button className={page === i + 1 ? "active" : ""} onClick={() => setPage(i + 1)} key={i}>{i + 1}</button>)}<button disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next →</button></div>
    </main>
  );
}

function VehicleDetail({ vehicle }: { vehicle: Vehicle }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [saved, setSaved] = useState(() => typeof window !== "undefined" && localStorage.getItem(`saved-${vehicle.id}`) === "1");
  const [tab, setTab] = useState("Overview");

  const toggleSave = () => { const next = !saved; setSaved(next); localStorage.setItem(`saved-${vehicle.id}`, next ? "1" : "0"); trackEvent("save_click", { vehicle: vehicle.slug }); };
  const share = async () => {
    trackEvent("share_click", { vehicle: vehicle.slug });
    const data = { title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, text: `${formatMoney(vehicle.price)} at WDCC`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else { await navigator.clipboard?.writeText(window.location.href); window.dispatchEvent(new CustomEvent("wdcc-toast", { detail: "Vehicle link copied" })); }
  };

  return (
    <main className="detail-page">
      <Link className="back-link" href="/inventory">← Back to inventory</Link>
      <section className="detail-shell">
        <div className="gallery">
          <div className="main-photo"><img src={vehicle.images[imageIndex]} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}, view ${imageIndex + 1}`} /><div className="gallery-badges">{vehicle.badges.map((badge) => <span className={badgeClass[badge] || "blue"} key={badge}>{badge}</span>)}</div></div>
          <div className="thumb-row">{vehicle.images.map((image, index) => <button className={index === imageIndex ? "active" : ""} onClick={() => setImageIndex(index)} key={image}><img src={image} alt={`View ${index + 1}`} /></button>)}</div>
        </div>
        <aside className="vehicle-summary">
          <div className="summary-actions"><button onClick={toggleSave}>{saved ? "♥ Saved" : "♡ Save"}</button><button onClick={share}>↗ Share</button></div>
          <p className="eyebrow">{vehicle.year} {vehicle.make}</p><h1>{vehicle.model} {vehicle.trim}</h1>
          <span className="stock-status">In stock · Confirm availability with Sean</span>
          <strong className="detail-price">{formatMoney(vehicle.price)}</strong>{vehicle.payment > 0 && <span className="estimated-payment">Est. {formatMoney(vehicle.payment)} / mo*</span>}
          <dl className="vehicle-spec-list">
            <div><dt>Down payment</dt><dd>{formatMoney(vehicle.downPayment)}</dd></div><div><dt>Mileage</dt><dd>{formatMiles(vehicle.mileage)}</dd></div><div><dt>Transmission</dt><dd>{vehicle.transmission}</dd></div><div><dt>Engine</dt><dd>{vehicle.engine}</dd></div><div><dt>Drivetrain</dt><dd>{vehicle.drivetrain}</dd></div><div><dt>VIN</dt><dd>{vehicle.vin}</dd></div>
          </dl>
          <div className="detail-actions"><Link className="btn btn-primary" href={`/contact?intent=test-drive&vehicle=${vehicle.slug}`} onClick={() => trackEvent("test_drive_start", { vehicle: vehicle.slug, placement: "vehicle_detail" })}>Schedule test drive</Link><Link className="btn btn-outline" href={`/get-approved?vehicle=${vehicle.slug}`} onClick={() => trackEvent("apply_start", { vehicle: vehicle.slug, placement: "vehicle_detail" })}>Get qualified</Link><a className="btn btn-quiet" href="tel:+18135164752" onClick={() => trackEvent("call_click", { vehicle: vehicle.slug, placement: "vehicle_detail" })}>Contact us</a></div>
        </aside>
      </section>
      <section className="detail-content">
        <div className="detail-tabs">{["Overview", "Equipment", "Specifications", "Vehicle history"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        {tab === "Overview" && <div className="overview-grid"><article><h2>About this vehicle</h2><p>{vehicle.description}</p><div className="condition-pills"><span>✓ Listed as available</span><span>✓ Direct financing help</span><span>✓ Current details from Sean</span></div></article><article><h2>Highlights</h2><div className="highlight-grid">{vehicle.highlights.map((item) => <span key={item}>✓ {item}</span>)}</div></article></div>}
        {tab === "Equipment" && <div className="tab-panel"><h2>Confirm installed equipment</h2><p>Equipment varies by vehicle and has not been guessed from the model name. Call or text Sean for the current option list and an in-person check.</p><a className="btn btn-dark" href="tel:+18135164752" onClick={() => trackEvent("call_click", { vehicle: vehicle.slug, placement: "equipment_tab" })}>Call Sean</a></div>}
        {tab === "Specifications" && <div className="tab-panel"><h2>Vehicle specifications</h2><dl className="spec-table"><div><dt>Body</dt><dd>{vehicle.bodyType}</dd></div><div><dt>Exterior</dt><dd>{vehicle.exterior}</dd></div><div><dt>Interior</dt><dd>{vehicle.interior}</dd></div><div><dt>Engine</dt><dd>{vehicle.engine}</dd></div></dl></div>}
        {tab === "Vehicle history" && <div className="tab-panel"><h2>Request the current report</h2><p>No title or accident claim is shown here unless it has been verified. Ask Sean for the records currently available for this exact vehicle before purchase.</p><a className="btn btn-dark" href={`sms:+18135164752?body=${encodeURIComponent(`Please send the current history information for the ${vehicle.year} ${vehicle.make} ${vehicle.model}.`)}`} onClick={() => trackEvent("text_click", { vehicle: vehicle.slug, placement: "history_tab" })}>Text Sean</a></div>}
      </section>
      <div className="mobile-detail-bar"><strong>{formatMoney(vehicle.price)}</strong><Link href={`/contact?intent=test-drive&vehicle=${vehicle.slug}`} onClick={() => trackEvent("test_drive_start", { vehicle: vehicle.slug, placement: "mobile_detail" })}>Test drive</Link></div>
    </main>
  );
}

export default function WDCCApp({ initialRoute = "home", initialSlug }: { initialRoute?: RouteName; initialSlug?: string }) {
  const [route, setRoute] = useState<RouteName>(initialRoute);
  const [slug, setSlug] = useState(initialSlug || "2004-nissan-350z");
  const vehicles = inventoryVehicles;
  const [toast, setToast] = useState("");
  const trackedPage = useRef("");
  const introEnabled = initialRoute === "home";
  const [introPhase, setIntroPhase] = useState<IntroPhase>(introEnabled ? "reveal" : "done");
  const finishIntro = useCallback(() => setIntroPhase("done"), []);

  useEffect(() => {
    if (!introEnabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedTimer = window.setTimeout(() => setIntroPhase("done"), 0);
      return () => window.clearTimeout(reducedTimer);
    }
    // The badge's animationend event owns the normal handoff. This is only a
    // failsafe in case a browser suppresses that event.
    const finishTimer = window.setTimeout(() => setIntroPhase("done"), 1450);
    return () => window.clearTimeout(finishTimer);
  }, [introEnabled]);

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      if (path === "/") setRoute("home");
      else if (path === "/inventory") setRoute("inventory");
      else { setRoute("detail"); setSlug(path.split("/").pop() || "2004-nissan-350z"); }
    };
    const onToast = (event: Event) => { setToast((event as CustomEvent).detail); setTimeout(() => setToast(""), 2600); };
    onPop();
    window.addEventListener("popstate", onPop); window.addEventListener("wdcc-toast", onToast);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("wdcc-toast", onToast); };
  }, []);

  useEffect(() => {
    const key = `${route}:${slug}`;
    if (trackedPage.current === key) return;
    trackedPage.current = key;
    trackEvent("page_view", { pageType: route, vehicle: route === "detail" ? slug : undefined });
    if (route === "detail") trackEvent("vehicle_view", { vehicle: slug });
  }, [route, slug]);

  const activeVehicle = vehicles.find((v) => v.slug === slug) || vehicles[0];

  return (
    <div className={`wdcc-app intro-state-${introPhase}`}>
      {introPhase !== "done" && <IntroAnimation onDone={finishIntro} />}
      <Header home={route === "home"} detail={route === "detail"} />
      {route === "home" && <Home vehicles={vehicles} />}
      {route === "inventory" && <Inventory vehicles={vehicles} />}
      {route === "detail" && <VehicleDetail key={activeVehicle.id} vehicle={activeVehicle} />}
      <footer className="site-footer" id="about"><Logo compact /><div><strong>WDCC · We Don&apos;t Care Cars</strong><span>Serving Tampa Bay · Confirm availability before visiting</span></div><a href="tel:+18135164752" onClick={() => trackEvent("call_click", { placement: "footer" })}>813-516-4752</a><span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span></footer>
      {route !== "detail" && <div className="mobile-action-bar" aria-label="Quick actions">
        <Link className="mobile-dock-drive" href="/contact" onClick={() => trackEvent("test_drive_start", { placement: "mobile_dock" })}>Test drive</Link>
        <Link className="mobile-dock-qualify" href="/get-approved" onClick={() => trackEvent("apply_start", { placement: "mobile_dock" })}>Get qualified</Link>
        <a className="mobile-dock-contact" href="tel:+18135164752" onClick={() => trackEvent("call_click", { placement: "mobile_dock" })}>Call Sean</a>
      </div>}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}
