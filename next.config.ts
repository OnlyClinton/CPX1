import type { NextConfig } from "next";

const baselineHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" }
];

const storefrontHeaders = [
  ...baselineHeaders,
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://wedontcarecars.com https://www.wedontcarecars.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
      "connect-src 'self' https://dealer.wedontcarecars.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests"
    ].join("; ")
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Access-Control-Allow-Origin", value: "https://wedontcarecars.com" },
  { key: "Vary", value: "Origin" }
];

const dealerHeaders = [
  ...baselineHeaders,
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
      "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests"
    ].join("; ")
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Access-Control-Allow-Origin", value: "https://dealer.wedontcarecars.com" },
  { key: "Vary", value: "Origin" }
];

const privilegedApiHeaders = [
  ...baselineHeaders,
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Access-Control-Allow-Origin", value: "https://dealer.wedontcarecars.com" },
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Vary", value: "Origin" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/inventory/:id", destination: "/vehicle/:id", permanent: true },
      { source: "/financing", destination: "/get-approved?source=legacy-financing", permanent: true },
      { source: "/about", destination: "/#how-it-works", permanent: true },
      { source: "/reviews", destination: "/#how-it-works", permanent: true }
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: storefrontHeaders },
      { source: "/dealer/:path*", headers: dealerHeaders },
      { source: "/api/auth/:path*", headers: privilegedApiHeaders },
      { source: "/api/inventory/:path*", headers: privilegedApiHeaders },
      { source: "/api/upload", headers: privilegedApiHeaders }
    ];
  }
};

export default nextConfig;
