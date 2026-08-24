import WDCCApp from "../components/WDCCApp";
import { formatMoney, inventoryVehicles } from "../data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Used Cars for Sale in Tampa Bay",
  description: "Browse current WDCC used-car inventory with listed cash prices, down payments, mileage and direct in-house financing help.",
  alternates: { canonical: "/inventory" },
  openGraph: {
    title: "Current Used-Car Inventory | WDCC",
    description: "See available WDCC vehicles, listed prices, down payments and mileage.",
    url: "/inventory",
  },
};

const inventorySchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "WDCC used-car inventory",
  url: "https://wedontcarecars.com/inventory",
  numberOfItems: inventoryVehicles.filter((vehicle) => vehicle.status === "available").length,
  itemListElement: inventoryVehicles.filter((vehicle) => vehicle.status === "available").map((vehicle, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `https://wedontcarecars.com/inventory/${vehicle.slug}`,
    name: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim(),
    item: {
      "@type": "Vehicle",
      name: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim(),
      image: vehicle.images[0],
      mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileage, unitCode: "SMI" },
      offers: { "@type": "Offer", price: vehicle.price, priceCurrency: "USD", availability: "https://schema.org/InStock", description: `${formatMoney(vehicle.downPayment)} listed down payment` },
    },
  })),
}).replace(/</g, "\\u003c");

export default function InventoryPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: inventorySchema }} /><WDCCApp initialRoute="inventory" /></>;
}
