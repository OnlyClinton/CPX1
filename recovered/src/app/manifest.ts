import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WDCC · We Don't Care Cars",
    short_name: "WDCC",
    description: "Tampa Bay used-car inventory and direct in-house financing help.",
    start_url: "/",
    display: "standalone",
    background_color: "#03070b",
    theme_color: "#03070b",
    icons: [{ src: "/wdcc-logo-transparent.webp", sizes: "512x512", type: "image/webp" }],
  };
}
