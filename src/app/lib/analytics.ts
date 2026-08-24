"use client";

export type WdccEventName =
  | "page_view"
  | "inventory_open"
  | "vehicle_open"
  | "vehicle_view"
  | "call_click"
  | "text_click"
  | "apply_start"
  | "test_drive_start"
  | "trade_start"
  | "contact_start"
  | "lead_submit"
  | "share_click"
  | "save_click"
  | "filter_use";

type EventValue = string | number | boolean | null;
type EventMetadata = Record<string, EventValue | undefined>;

const SESSION_KEY = "wdcc-session-v1";
const ATTRIBUTION_KEY = "wdcc-attribution-v1";

function safeStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function getSessionId() {
  const existing = safeStorage(window.sessionStorage, SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    // Analytics must never block the buying flow.
  }
  return id;
}

function getAttribution() {
  const saved = safeStorage(window.localStorage, ATTRIBUTION_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, string>;
    } catch {
      // Replace malformed browser state below.
    }
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer ? new URL(document.referrer) : null;
  const sameOriginReferrer = referrer?.origin === window.location.origin;
  const attribution = {
    source: params.get("utm_source") || (!sameOriginReferrer && referrer?.hostname) || "direct",
    medium: params.get("utm_medium") || (!sameOriginReferrer && referrer ? "referral" : "none"),
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    term: params.get("utm_term") || "",
    landingPath: `${window.location.pathname}${window.location.search}`,
  };

  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Attribution is optional and must not affect the storefront.
  }
  return attribution;
}

export function trackEvent(name: WdccEventName, metadata: EventMetadata = {}) {
  if (typeof window === "undefined") return;

  const attribution = getAttribution();
  const payload = JSON.stringify({
    name,
    path: window.location.pathname,
    sessionId: getSessionId(),
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    content: attribution.content,
    term: attribution.term,
    landingPath: attribution.landingPath,
    ...metadata,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // A telemetry failure must never interrupt a shopper.
  }
}
