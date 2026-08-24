const allowedEvents = new Set([
  "page_view",
  "inventory_open",
  "vehicle_open",
  "vehicle_view",
  "call_click",
  "text_click",
  "apply_start",
  "test_drive_start",
  "trade_start",
  "contact_start",
  "lead_submit",
  "share_click",
  "save_click",
  "filter_use",
]);

const allowedFields = [
  "name",
  "path",
  "sessionId",
  "source",
  "medium",
  "campaign",
  "content",
  "term",
  "landingPath",
  "pageType",
  "vehicle",
  "placement",
  "requestType",
  "filter",
] as const;

function clean(value: unknown) {
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) return Response.json({ ok: false }, { status: 413 });

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!allowedEvents.has(String(body.name || ""))) return Response.json({ ok: false }, { status: 400 });

    const event: Record<string, string | number | boolean> = {};
    for (const field of allowedFields) {
      const value = clean(body[field]);
      if (value !== undefined) event[field] = value;
    }

    console.log(JSON.stringify({
      level: "info",
      message: "wdcc_conversion",
      requestId: request.headers.get("x-vercel-id") || "local",
      receivedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      ...event,
    }));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "wdcc_conversion_rejected",
      requestId: request.headers.get("x-vercel-id") || "local",
      error: error instanceof Error ? error.message : "invalid_payload",
      durationMs: Date.now() - startedAt,
    }));
    return Response.json({ ok: false }, { status: 400 });
  }
}
