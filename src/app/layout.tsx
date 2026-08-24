import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wedontcarecars.com"),
  title: {
    default: "We Don't Care Cars | Tampa Bay Used Cars",
    template: "%s | WDCC",
  },
  description: "Bad credit or no credit? Browse WDCC Tampa Bay used vehicles, listed down payments, and direct in-house financing help from Sean.",
  applicationName: "WDCC",
  category: "automotive",
  keywords: ["Tampa Bay used cars", "in-house financing Tampa", "bad credit car dealer Tampa", "low down payment cars", "WDCC"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    url: "https://wedontcarecars.com",
    siteName: "WDCC · We Don't Care Cars",
    locale: "en_US",
    title: "WDCC — We Don't Care Cars",
    description: "Bad credit? No credit? We don't care. Browse Tampa Bay inventory and apply directly.",
    images: [{ url: "/wdcc-hero-v2.webp", width: 1672, height: 941, alt: "WDCC Tampa Bay vehicle hero" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WDCC — We Don't Care Cars",
    description: "Bad credit? No credit? We don't care. Browse Tampa Bay inventory and apply directly.",
    images: ["/wdcc-hero-v2.webp"],
  },
  icons: {
    icon: "/wdcc-logo-transparent.webp",
    shortcut: "/wdcc-logo-transparent.webp",
    apple: "/wdcc-logo-transparent.webp",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#03070b",
  colorScheme: "dark",
};

const dealerSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "@id": "https://wedontcarecars.com/#dealer",
  name: "WDCC · We Don't Care Cars",
  alternateName: "WDCC",
  url: "https://wedontcarecars.com",
  logo: "https://wedontcarecars.com/wdcc-logo-transparent.webp",
  image: "https://wedontcarecars.com/wdcc-hero-v2.webp",
  telephone: "+1-813-516-4752",
  priceRange: "$",
  areaServed: { "@type": "AdministrativeArea", name: "Tampa Bay, Florida" },
  description: "Tampa Bay used vehicles with direct in-house financing, clear down payments and help from Sean.",
}).replace(/</g, "\\u003c");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: dealerSchema }} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
