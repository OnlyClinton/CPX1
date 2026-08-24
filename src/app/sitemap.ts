import type { MetadataRoute } from "next";
import { inventoryVehicles } from "./data";

const origin = "https://wedontcarecars.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-08-23T00:00:00.000Z");
  const pages = [
    ["", "daily", 1],
    ["/inventory", "daily", 0.95],
    ["/get-approved", "monthly", 0.9],
    ["/financing", "monthly", 0.8],
    ["/contact", "monthly", 0.8],
    ["/about", "monthly", 0.65],
    ["/reviews", "monthly", 0.6],
    ["/privacy", "yearly", 0.2],
    ["/terms", "yearly", 0.2],
  ] as const;

  return [
    ...pages.map(([path, changeFrequency, priority]) => ({ url: `${origin}${path}`, lastModified: updated, changeFrequency, priority })),
    ...inventoryVehicles.filter((vehicle) => vehicle.status === "available").map((vehicle) => ({
      url: `${origin}/inventory/${vehicle.slug}`,
      lastModified: updated,
      changeFrequency: "daily" as const,
      priority: 0.9,
      images: vehicle.images,
    })),
  ];
}
