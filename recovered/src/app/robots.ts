import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dealer"],
    },
    sitemap: "https://wedontcarecars.com/sitemap.xml",
    host: "https://wedontcarecars.com",
  };
}
