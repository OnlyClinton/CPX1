/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Link from "next/link";
import TrackedLink from "./TrackedLink";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
};

export default function PublicPage({
  eyebrow,
  title,
  description,
  children,
  primaryLabel = "Get pre-approved",
  primaryHref = "/get-approved",
}: Props) {
  return (
    <div className="wdcc-app content-site">
      <header className="content-header">
        <Link className="content-logo" href="/" aria-label="WDCC home">
          <img src="/wdcc-logo-transparent.webp" alt="We Don't Care Cars" width="512" height="512" />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/inventory">Inventory</Link>
          <Link href="/financing">Financing</Link>
          <Link href="/reviews">Reviews</Link>
          <Link href="/about">About</Link>
        </nav>
        <TrackedLink className="content-call" href="tel:+18135164752" eventName="call_click" eventData={{ placement: "content_header" }}>
          Call Sean
        </TrackedLink>
        <details className="content-menu">
          <summary aria-label="Open navigation"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/inventory">Inventory</Link>
            <Link href="/financing">Financing</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </details>
      </header>

      <main className="content-page">
        <section className="content-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <div className="content-deck">{description}</div>
          <div className="content-hero-actions">
            <TrackedLink className="btn btn-primary" href={primaryHref} eventName={primaryHref === "/get-approved" ? "apply_start" : "contact_start"} eventData={{ placement: "content_hero" }}>
              {primaryLabel} →
            </TrackedLink>
            <TrackedLink className="btn btn-outline" href="sms:+18135164752" eventName="text_click" eventData={{ placement: "content_hero" }}>
              Text Sean
            </TrackedLink>
          </div>
        </section>
        <section className="content-body">{children}</section>
      </main>

      <footer className="content-footer">
        <div><strong>WDCC · We Don&apos;t Care Cars</strong><span>Serving Tampa Bay · Confirm availability before visiting</span></div>
        <nav aria-label="Footer navigation"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav>
      </footer>

      <div className="mobile-action-bar" aria-label="Quick actions">
        <TrackedLink className="mobile-dock-drive" href="/contact" eventName="test_drive_start" eventData={{ placement: "mobile_bar" }}>Test drive</TrackedLink>
        <TrackedLink className="mobile-dock-qualify" href="/get-approved" eventName="apply_start" eventData={{ placement: "mobile_bar" }}>Get qualified</TrackedLink>
        <TrackedLink className="mobile-dock-contact" href="tel:+18135164752" eventName="call_click" eventData={{ placement: "mobile_bar" }}>Call Sean</TrackedLink>
      </div>
    </div>
  );
}
