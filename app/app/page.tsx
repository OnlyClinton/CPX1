import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "WDCC Dealer App | Web Portal & Android Download",
  description:
    "Open the We Don't Care Cars dealer portal in your browser or download the Android dealer app.",
  alternates: { canonical: "/app" },
  openGraph: {
    title: "WDCC Dealer App",
    description: "Inventory, vehicle photos, leads and publishing from one dealer workspace.",
    url: "/app",
    images: [{ url: "/wdcc-official-logo.webp", width: 512, height: 512 }],
  },
};

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function DealerAppPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/app" aria-label="WDCC Dealer App home">
          <Image
            src="/wdcc-logo-transparent.webp"
            alt="We Don't Care Cars"
            width={82}
            height={82}
            priority
          />
          <span>
            <strong>WDCC · DEALER PORTAL</strong>
            <small>Inventory operations</small>
          </span>
        </Link>
        <Link className={styles.headerLink} href="/dealer">
          Dealer sign in <ArrowIcon />
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span /> BUILT FOR THE LOT
          </p>
          <h1>Run your inventory from anywhere.</h1>
          <p className={styles.intro}>
            Add vehicles, upload real photos, manage leads and publish listings from one fast,
            secure dealer workspace.
          </p>

          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/dealer">
              Open Web Portal <ArrowIcon />
            </Link>
            <a className={styles.downloadAction} href="/app/download/android">
              <DownloadIcon /> Download Android
            </a>
          </div>

          <div className={styles.platformNote}>
            <span className={styles.statusDot} />
            <p>
              <strong>Web:</strong> Android, iPhone, tablet and desktop
              <br />
              <strong>Android app:</strong> Android 8.0 or newer
            </p>
          </div>
        </div>

        <div className={styles.productStage} aria-label="WDCC dealer dashboard preview">
          <div className={styles.stageGlow} />
          <div className={styles.portalPreview}>
            <div className={styles.previewTopbar}>
              <Image
                src="/wdcc-logo-transparent.webp"
                alt=""
                width={62}
                height={62}
              />
              <div>
                <strong>WDCC · DEALER PORTAL</strong>
                <span>Inventory operations</span>
              </div>
              <i>LIVE</i>
            </div>

            <div className={styles.previewBody}>
              <div className={styles.previewHeading}>
                <div>
                  <span>GOOD MORNING, SEAN</span>
                  <h2>Dealer Dashboard</h2>
                </div>
                <Link href="/dealer/inventory/new">+ Add Vehicle</Link>
              </div>

              <div className={styles.metricGrid}>
                <article>
                  <strong>23</strong>
                  <span>Total Vehicles</span>
                </article>
                <article>
                  <strong>18</strong>
                  <span>Customer Live</span>
                </article>
                <article>
                  <strong>12</strong>
                  <span>New Leads</span>
                </article>
                <article>
                  <strong>5</strong>
                  <span>Appointments</span>
                </article>
              </div>

              <div className={styles.vehicleCard}>
                <div className={styles.vehicleImage}>
                  <Image
                    src="/assets/hero-car.webp"
                    alt="Vehicle listing preview"
                    fill
                    sizes="(max-width: 840px) 86vw, 420px"
                    priority
                  />
                  <span>PRIMARY</span>
                </div>
                <div className={styles.vehicleCopy}>
                  <small>RECENT VEHICLE</small>
                  <h3>2020 Dodge Challenger SXT</h3>
                  <strong>$24,995</strong>
                  <p>41K miles · Automatic · Published</p>
                  <div className={styles.readiness}>
                    <span>Listing readiness</span>
                    <b>100%</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-label="Dealer app features">
        <article>
          <span>01</span>
          <h2>Add cars fast</h2>
          <p>Capture the VIN, pricing, specs and status without leaving the vehicle.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Real car photos</h2>
          <p>Use the camera or photo library, set the primary image and review before publishing.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Publish with confidence</h2>
          <p>See listing readiness, save a private draft, then publish to customer inventory.</p>
        </article>
      </section>

      <footer className={styles.footer}>
        <Image src="/wdcc-logo-transparent.webp" alt="" width={52} height={52} />
        <p>
          <strong>We Don&apos;t Care Cars</strong>
          <span>Authorized dealer access only</span>
        </p>
        <a href="tel:+18135164752">(813) 516-4752</a>
      </footer>
    </main>
  );
}

