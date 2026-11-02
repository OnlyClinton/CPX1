import { redirect } from "next/navigation";

// Legacy marketing slugs were never canonical inventory IDs. Do not render
// unverified vehicles or translate guessed slugs into dealer inventory records.
// The inventory page always retrieves the currently published dealer records.
export default async function LegacyVehicleSlug() {
  redirect("/inventory");
}
