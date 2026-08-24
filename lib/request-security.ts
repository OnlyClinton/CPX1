const allowedOrigins = new Set([
  "https://dealer.wedontcarecars.com",
  "https://wedontcarecars.com",
  "https://www.wedontcarecars.com"
]);

export function isTrustedWriteRequest(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins.has(origin.toLowerCase());
}

export function securityError(status = 403) {
  return Response.json({ ok: false, error: "cross_site_request_blocked" }, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}
