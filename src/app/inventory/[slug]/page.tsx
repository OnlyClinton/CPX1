import WDCCApp from "../../components/WDCCApp";
import { inventoryVehicles, formatMoney } from "../../data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return inventoryVehicles.filter((vehicle) => vehicle.status === "available").map((vehicle) => ({ slug: vehicle.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = inventoryVehicles.find((item) => item.slug === slug);
  if (!vehicle) return { title: "Vehicle not found", robots: { index: false, follow: true } };
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  const description = `${formatMoney(vehicle.price)} · ${vehicle.mileage.toLocaleString()} miles · ${formatMoney(vehicle.downPayment)} listed down payment · Direct financing help from WDCC.`;
  return {
    title,
    description,
    alternates: { canonical: `/inventory/${vehicle.slug}` },
    openGraph: { title, description, type: "website", url: `/inventory/${vehicle.slug}`, images: [{ url: vehicle.images[0], alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [vehicle.images[0]] },
  };
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = inventoryVehicles.find((item) => item.slug === slug && item.status === "available");
  if (!vehicle) notFound();
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  const schema = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Vehicle",
      "@id": `https://wedontcarecars.com/inventory/${vehicle.slug}#vehicle`,
      name,
      url: `https://wedontcarecars.com/inventory/${vehicle.slug}`,
      image: vehicle.images,
      description: vehicle.description,
      vehicleModelDate: String(vehicle.year),
      manufacturer: { "@type": "Organization", name: vehicle.make },
      model: vehicle.model,
      vehicleConfiguration: vehicle.trim || undefined,
      vehicleTransmission: vehicle.transmission,
      driveWheelConfiguration: vehicle.drivetrain,
      mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileage, unitCode: "SMI" },
      offers: {
        "@type": "Offer",
        price: vehicle.price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `https://wedontcarecars.com/inventory/${vehicle.slug}`,
        seller: { "@id": "https://wedontcarecars.com/#dealer" },
        description: `${formatMoney(vehicle.downPayment)} listed down payment; financing terms subject to approval.`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://wedontcarecars.com" },
        { "@type": "ListItem", position: 2, name: "Inventory", item: "https://wedontcarecars.com/inventory" },
        { "@type": "ListItem", position: 3, name, item: `https://wedontcarecars.com/inventory/${vehicle.slug}` },
      ],
    },
  ]).replace(/</g, "\\u003c");
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} /><WDCCApp initialRoute="detail" initialSlug={slug} /></>;
}
