"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WdccIntro from "./WdccIntro";

type Vehicle = {
  id?: string;
  slug?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  downPayment?: number;
  down_payment?: number;
  mileage?: number;
  primaryPhotoPathname?: string;
  primary_image_url?: string;
  image?: string;
  status?: string;
  stock?: string;
  stock_id?: string;
  badges?: string[];
  bodyStyle?: string;
  body_style?: string;
  transmission?: string;
  drivetrain?: string;
};

const fallback: Vehicle[] = [
  { id: "2004-nissan-350z", slug: "2004-nissan-350z", year: 2004, make: "Nissan", model: "350Z", price: 4900, downPayment: 2000, mileage: 154000, image: "/assets/cars/2004-nissan-350z-1.webp", bodyStyle: "Car", drivetrain: "RWD" },
  { id: "2016-ford-f150-limited", slug: "2016-ford-f150-limited", year: 2016, make: "Ford", model: "F-150", trim: "Limited", price: 15000, downPayment: 6000, mileage: 164000, image: "/assets/cars/2016-ford-f150-limited-1.webp", bodyStyle: "Truck", transmission: "Automatic" },
  { id: "2019-honda-pilot", slug: "2019-honda-pilot", year: 2019, make: "Honda", model: "Pilot", price: 7900, downPayment: 3000, mileage: 380000, image: "/assets/cars/2019-honda-pilot-1.webp", bodyStyle: "SUV", transmission: "Automatic" },
  { id: "2019-kia-sportage", slug: "2019-kia-sportage", year: 2019, make: "Kia", model: "Sportage", price: 12900, downPayment: 2500, mileage: 92000, image: "/assets/cars/2019-kia-sportage-1.webp", bodyStyle: "SUV", drivetrain: "FWD" },
  { id: "2019-toyota-rav4", slug: "2019-toyota-rav4", year: 2019, make: "Toyota", model: "RAV4", price: 17900, downPayment: 3500, mileage: 86000, image: "/assets/cars/2019-toyota-rav4-1.webp", bodyStyle: "SUV", transmission: "Automatic" },
];

function customerVisible(vehicle: any) {
  const status = String(vehicle?.status || "").toLowerCase();
  const badges = (Array.isArray(vehicle?.badges) ? vehicle.badges : []).map((badge: any) => String(badge).toUpperCase());
  const stock = String(vehicle?.stock || vehicle?.stock_id || "").toUpperCase();
  return status === "published"
    && Number(vehicle?.year) > 1900
    && String(vehicle?.make || "").trim() !== ""
    && String(vehicle?.model || "").trim() !== ""
    && Number(vehicle?.price || vehicle?.cashPrice) > 0
    && !stock.startsWith("R36TEST-")
    && !badges.includes("R36-TEST");
}

function photo(vehicle: Vehicle) {
  if (vehicle.primaryPhotoPathname) return `/api/media?p=${encodeURIComponent(vehicle.primaryPhotoPathname)}`;
  return vehicle.primary_image_url || vehicle.image || "/wdcc-hero-2vfd-1d7a0e4f.webp";
}

function vehicleHref(vehicle: Vehicle) {
  return vehicle.slug ? `/inventory/${vehicle.slug}` : `/vehicle/${encodeURIComponent(String(vehicle.id || ""))}`;
}

export default function Exact2vfDHome() {
  const [introVisible, setIntroVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<Vehicle[]>(fallback);
  const logoTargetRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    fetch("/api/inventory", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const live = (payload.items || payload.inventory || []).filter(customerVisible).slice(0, 5);
        if (live.length) setItems(live);
      })
      .catch(() => {});
  }, []);

  const visible = useMemo(() => items.slice(0, 5), [items]);
  const move = (direction: number) => setActive((current) => (current + direction + visible.length) % visible.length);
  const completeIntro = useCallback(() => setIntroVisible(false), []);

  return (
    <div className="wdcc-app">
      {introVisible && <WdccIntro logoTargetRef={logoTargetRef} onComplete={completeIntro} />}

      <div className="header-shell home-header-shell">
        <div className="utility-bar">
          <span>Tampa Bay</span>
          <span>In-house financing</span>
          <span>Sean · <b>813-516-4752</b></span>
        </div>
        <header className="site-header">
          <button
            className="mobile-menu"
            type="button"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span aria-hidden="true"><i /><i /><i /></span>
          </button>
          <Link ref={logoTargetRef} className="logo-button" aria-label="We Don't Care Cars home" href="/">
            <img src="/wdcc-logo-2vfd-7f10e192.webp" alt="" width="512" height="512" />
          </Link>
          <nav className={`main-nav${menuOpen ? " open" : ""}`} aria-label="Primary navigation">
            <Link href="/inventory">Inventory</Link>
            <Link href="/financing">Financing</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/about">About us</Link>
          </nav>
          <Link className="header-cta" href="/get-approved?source=header-get-approved">Get pre-approved</Link>
          <a className="mobile-call" href="tel:+18135164752" aria-label="Call Sean at 813-516-4752">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.4 9.4c1.1 2.2 2.9 4 5.1 5.1l1.6-1.6 4.4 2.8-.7 3.7c-.2.8-.9 1.4-1.8 1.4C9.4 20.2 3.8 14.6 3.2 7c-.1-.9.5-1.6 1.4-1.8l2.6-.7Z" /></svg>
          </a>
        </header>
      </div>

      <main>
        <section className="hero" style={{ "--hero-image": "url(/wdcc-hero-2vfd-1d7a0e4f.webp)" } as CSSProperties}>
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="hero-kicker">Tampa Bay · Drive today</p>
            <h1>Bad credit?<br /><em>No credit?</em><br /><strong>We don&apos;t care.</strong></h1>
            <p className="hero-lead">In-house financing. Low down payments.<br />Fast approvals. Straight answers.<br />Get on the road without the runaround.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary hero-cta-qualify" href="/get-approved?source=hero-get-approved">Get pre-approved <span>→</span></Link>
              <Link className="btn btn-outline hero-cta-inventory" href="/inventory?source=hero-browse-inventory">Browse inventory <span>→</span></Link>
            </div>
            <a className="hero-call" href="tel:+18135164752"><span aria-hidden="true">☎</span> Call Sean <strong>813-516-4752</strong></a>
          </div>
          <div className="hero-car-glow" />
        </section>

        <section className="benefit-strip" aria-label="Why shop WDCC">
          <article><span className="icon">✓</span><div><strong>Fast approvals</strong><span>Quick, straightforward decisions.</span></div></article>
          <article><span className="icon">$</span><div><strong>Low down payments</strong><span>Options designed around real buyers.</span></div></article>
          <article><span className="icon">▣</span><div><strong>Drive today</strong><span>Move from interest to the road.</span></div></article>
          <article><span className="icon">◇</span><div><strong>Build your credit</strong><span>Ask what programs may apply.</span></div></article>
        </section>

        <section className="inventory-showcase">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Featured inventory</span>
              <h2>Vehicles ready now.</h2>
            </div>
            <Link className="text-link" href="/inventory">View all inventory →</Link>
          </div>
          <div className="featured-carousel">
            <button className="carousel-arrow carousel-prev" type="button" onClick={() => move(-1)} aria-label="Previous vehicle">‹</button>
            <div className="featured-grid">
              {visible.map((vehicle, index) => {
                const down = Number(vehicle.downPayment ?? vehicle.down_payment ?? 0);
                const tags = [vehicle.bodyStyle || vehicle.body_style, vehicle.transmission, vehicle.drivetrain].filter(Boolean).slice(0, 3);
                return (
                  <div className={`featured-slide${index === active ? " active" : ""}`} key={String(vehicle.id || vehicle.slug || index)}>
                    <article className="vehicle-card">
                      <Link className="vehicle-image" href={vehicleHref(vehicle)}>
                        <img src={photo(vehicle)} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
                        <span className="card-badges"><span>Available</span></span>
                      </Link>
                      <div className="vehicle-card-body">
                        <p className="eyebrow">{vehicle.year} {vehicle.make}</p>
                        <Link className="vehicle-title" href={vehicleHref(vehicle)}>{vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}</Link>
                        <strong className="vehicle-price">${Number(vehicle.price || 0).toLocaleString()}</strong>
                        <p className="vehicle-payment">{down ? `$${down.toLocaleString()} down` : "Call for down payment"} · {Number(vehicle.mileage || 0).toLocaleString()} miles</p>
                        <div className="spec-pills">{tags.map((tag, tagIndex) => <span key={tagIndex}>{String(tag)}</span>)}</div>
                        <Link className="vehicle-details-cta" href={vehicleHref(vehicle)}>View details <span>→</span></Link>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
            <button className="carousel-arrow carousel-next" type="button" onClick={() => move(1)} aria-label="Next vehicle">›</button>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <span className="section-kicker">One simple process. No hoops. No hassle.</span>
              <h2>In-house financing <strong>made easy.</strong></h2>
            </div>
          </div>
          <div className="steps-grid">
            <article><span>01</span><h3>Apply online</h3><p>Send basic details securely.</p></article>
            <article><span>02</span><h3>Talk to Sean</h3><p>Confirm down payment and vehicle fit.</p></article>
            <article><span>03</span><h3>Choose your car</h3><p>Shop our real inventory online or in person.</p></article>
            <article><span>04</span><h3>Drive today</h3><p>Schedule pickup or a test drive.</p></article>
          </div>
        </section>

        <section className="trust-strip" aria-label="WDCC promises">
          <article><strong>Tampa Bay proud</strong><span>Local dealer. Local community.</span></article>
          <article><strong>Straight answers</strong><span>No runaround. No hidden fees.</span></article>
          <article><strong>Real people</strong><span>Talk to Sean, not a call center.</span></article>
          <article><strong>Confidence driven</strong><span>We make it happen when others can&apos;t.</span></article>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>WDCC · We Don&apos;t Care Cars</strong><span>Serving Tampa Bay</span></div>
        <a href="tel:+18135164752">813-516-4752</a>
        <span className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span>
      </footer>

      <div className="mobile-action-bar" aria-label="Quick actions">
        <a href="tel:+18135164752" aria-label="Call Sean"><span>☎</span>Call</a>
        <a href="sms:+18135164752" aria-label="Text Sean"><span>▢</span>Text</a>
        <Link href="/get-approved?source=mobile-sticky-apply"><span>⚑</span>Apply</Link>
      </div>
    </div>
  );
}
