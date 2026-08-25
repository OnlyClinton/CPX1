export type VehicleStatus = "draft" | "needs_info" | "published" | "archived" | "sold";

export type VehiclePhoto = {
  id: string;
  url: string;
  position: number;
  isPrimary?: boolean;
  uploadedAt?: string;
};

export type VehicleRecord = {
  id: string;
  stockNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyStyle?: string;
  drivetrain?: string;
  transmission?: string;
  fuelType?: string;
  engine?: string;
  mileage: number;
  price: number;
  downPayment?: number;
  description?: string;
  photos: VehiclePhoto[];
  primaryPhotoId?: string;
  status: VehicleStatus;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

export type LeadSource =
  | "test_drive"
  | "preapproval"
  | "contact"
  | "phone"
  | "walk_in"
  | "referral";

export type Attribution = {
  sessionId?: string;
  cta?: string;
  referrer?: string;
  landingPath?: string;
  firstTouch?: Record<string, string | undefined>;
  currentTouch?: Record<string, string | undefined>;
  clickIds?: Record<string, string | undefined>;
};

export type LeadRecord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  vehicleId?: string;
  vehicleInterest?: string;
  pipelineStage: string;
  priority?: number;
  attribution?: Attribution;
  createdAt: string;
  dealerFirstResponseAt?: string;
};

export type AuditEvent = {
  id: string;
  correlationId: string;
  entityType: "vehicle" | "lead" | "application" | "auth" | "notification";
  entityId: string;
  action: string;
  actor: { type: "dealer" | "customer" | "system"; id?: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type VehicleReadiness = {
  score: number;
  publishable: boolean;
  checks: {
    vehicleInformation: boolean;
    pricing: boolean;
    primaryPhoto: boolean;
    gallery: boolean;
    description: boolean;
    identity: boolean;
  };
};

const nonEmpty = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/**
 * Deterministic listing-readiness calculation. The server remains authoritative;
 * clients may render this result but should not independently decide publishability.
 */
export function calculateVehicleReadiness(vehicle: Partial<VehicleRecord>): VehicleReadiness {
  const photos = Array.isArray(vehicle.photos) ? vehicle.photos : [];
  const primaryPhoto = Boolean(
    vehicle.primaryPhotoId || photos.some((photo) => photo?.isPrimary) || photos.length > 0,
  );

  const checks = {
    vehicleInformation: Boolean(
      vehicle.year && nonEmpty(vehicle.make) && nonEmpty(vehicle.model) && Number(vehicle.mileage) >= 0,
    ),
    pricing: Number(vehicle.price) > 0,
    primaryPhoto,
    gallery: photos.length >= 3,
    description: nonEmpty(vehicle.description) && String(vehicle.description).trim().length >= 20,
    identity: nonEmpty(vehicle.stockNumber) || nonEmpty(vehicle.vin),
  };

  const score =
    (checks.vehicleInformation ? 25 : 0) +
    (checks.pricing ? 20 : 0) +
    (checks.primaryPhoto ? 20 : 0) +
    (checks.gallery ? 10 : 0) +
    (checks.description ? 10 : 0) +
    (checks.identity ? 10 : 0);

  // Remaining 5% is reserved for the server-side public projection verification
  // that happens during publish, so a pre-publish record tops out at 95%.
  return {
    score,
    publishable: Object.values(checks).every(Boolean),
    checks,
  };
}
