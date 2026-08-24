const crypto = require("node:crypto");

// This identity is isolated to the folders explicitly shared with the service
// account. The full Drive scope is required to discover and write into a folder
// created by a different account; drive.file only covers files the app created.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
let cachedToken = null;
let cachedTokenExpiresAt = 0;

function driveBackupConfig() {
  const email = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  const folderId = String(process.env.WDCC_DRIVE_VEHICLE_ARCHIVE_FOLDER_ID || "").trim();
  return {
    configured: Boolean(email && privateKey && folderId),
    email,
    privateKey,
    folderId,
    provider: "google-drive",
  };
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) return cachedToken;
  const cfg = driveBackupConfig();
  if (!cfg.configured) throw new Error("drive_backup_not_configured");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: cfg.email,
    scope: DRIVE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), cfg.privateKey).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error("drive_token_exchange_failed");
  cachedToken = payload.access_token;
  cachedTokenExpiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
  return cachedToken;
}

async function driveRequest(url, init = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch { payload = { text }; }
  if (!response.ok) throw new Error(`drive_http_${response.status}`);
  return payload;
}

function q(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeSegment(value, fallback = "vehicle") {
  const clean = String(value || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return clean || fallback;
}

async function ensureFolder(name, parentId) {
  const params = new URLSearchParams({
    q: `name='${q(name)}' and '${q(parentId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const found = await driveRequest(`${DRIVE_API}/files?${params}`);
  if (found.files?.[0]?.id) return found.files[0].id;
  const created = await driveRequest(`${DRIVE_API}/files?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!created.id) throw new Error("drive_folder_create_failed");
  return created.id;
}

async function uploadFile({ name, mimeType, body, parentId, description }) {
  const boundary = `wdcc-${crypto.randomUUID()}`;
  const metadata = {
    name,
    mimeType,
    parents: [parentId],
    description: description || "WDCC vehicle continuity backup",
  };
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,webViewLink,parents`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
}

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(password|secret|token|cookie|capability)/i.test(key)) continue;
    result[key] = scrub(entry);
  }
  return result;
}

async function vehicleFolder(vehicleId) {
  const cfg = driveBackupConfig();
  return ensureFolder(`vehicle-${safeSegment(vehicleId)}`, cfg.folderId);
}

async function backupVehicleSnapshot({ vehicle, action = "saved" }) {
  const cfg = driveBackupConfig();
  if (!cfg.configured) return { status: "not_configured", provider: cfg.provider };
  try {
    const clean = scrub(vehicle || {});
    const vehicleId = String(clean.id || clean.stock || crypto.randomUUID());
    const capturedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: 1,
      provider: "google-drive",
      capturedAt,
      action,
      vehicleId,
      vehicle: clean,
    };
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
    manifest.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const finalBytes = Buffer.from(JSON.stringify(manifest, null, 2));
    const folderId = await vehicleFolder(vehicleId);
    const file = await uploadFile({
      name: `${safeSegment(clean.stock || vehicleId)}-${action}-${capturedAt.replace(/[:.]/g, "-")}.manifest.json`,
      mimeType: "application/json",
      body: finalBytes,
      parentId: folderId,
      description: `WDCC ${action} vehicle manifest; SHA-256 ${manifest.sha256}`,
    });
    return {
      status: "verified",
      provider: cfg.provider,
      fileId: file.id,
      folderId,
      sha256: manifest.sha256,
      capturedAt,
    };
  } catch (error) {
    console.error("WDCC_DRIVE_MANIFEST_BACKUP_ERROR", error);
    return { status: "failed", provider: cfg.provider, retryable: true, error: String(error?.message || "drive_backup_failed").slice(0, 120) };
  }
}

async function backupVehicleMedia({ vehicleId, filename, body, contentType, blobUrl, blobPathname }) {
  const cfg = driveBackupConfig();
  if (!cfg.configured) return { status: "not_configured", provider: cfg.provider };
  try {
    const capturedAt = new Date().toISOString();
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const folderId = await vehicleFolder(vehicleId);
    const file = await uploadFile({
      name: `${capturedAt.replace(/[:.]/g, "-")}-${safeSegment(filename, "vehicle-photo")}`,
      mimeType: contentType,
      body: bytes,
      parentId: folderId,
      description: `WDCC original media backup; SHA-256 ${sha256}; Blob ${blobPathname || blobUrl || "unknown"}`,
    });
    return {
      status: "verified",
      provider: cfg.provider,
      fileId: file.id,
      folderId,
      sha256,
      md5Checksum: file.md5Checksum || null,
      size: Number(file.size || bytes.length),
      capturedAt,
    };
  } catch (error) {
    console.error("WDCC_DRIVE_MEDIA_BACKUP_ERROR", error);
    return { status: "failed", provider: cfg.provider, retryable: true, error: String(error?.message || "drive_backup_failed").slice(0, 120) };
  }
}

module.exports = { backupVehicleMedia, backupVehicleSnapshot, driveBackupConfig };
