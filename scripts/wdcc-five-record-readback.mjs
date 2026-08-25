import crypto from 'node:crypto';
import fs from 'node:fs';
import { get, head, put, BlobPreconditionFailedError } from '@vercel/blob';
import { chromium } from 'playwright';

const DEALER = process.env.DEALER || 'https://dealer.wedontcarecars.com';
const statePath = 'private/state/platform-v3.json';
const screenDir = '/tmp/readback-screens';
fs.mkdirSync(screenDir, { recursive: true });

const expected = {
  leads: {
    callSean: { id: 'lead_0ecbb749-6f7f-4ca4-b49a-393f4689929e', source: 'call-sean' },
    testDrive: { id: 'lead_f1fb0db1-7970-4376-b3e4-592382334985', source: 'schedule-test-drive' },
    getApproved: { id: 'lead_ef99c54b-ee9f-4ec1-9b58-7a542a869c3b', source: 'get-approved' },
  },
  vehicles: {
    accord: { id: 'ab4a0f36-da7c-4bc7-9bcf-f643465aa1eb', stock: 'R36TEST-DASH-ACCORD-32851023472-1' },
    escape: { id: '3c355c4c-6864-40fc-9605-905a201bc01a', stock: 'R36TEST-DASH-ESCAPE-32851023472-1' },
  },
};

let dealerId = '', dealerEmail = '', password = '', cookieHeader = '', sessionValue = '';
const result = { ok: false, expected, feeds: {}, rendered: {}, cleanupIdentity: null, error: null };

function fail(message, extra) { const e = new Error(message); e.extra = extra; throw e; }
async function stableState() {
  for (let i = 0; i < 6; i++) {
    const a = await head(statePath);
    const r = await get(statePath, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) fail('STATE_READ_FAILED');
    const chunks = []; for await (const x of r.stream) chunks.push(x);
    const raw = Buffer.concat(chunks), b = await head(statePath);
    if (a.etag === b.etag) return { raw, etag: b.etag, state: JSON.parse(raw.toString('utf8')) };
  }
  fail('STATE_TOO_HOT');
}
async function createUser() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const before = await stableState(), s = before.state, now = new Date().toISOString();
    password = `WdccReadback-${crypto.randomBytes(18).toString('base64url')}!`;
    const salt = crypto.randomBytes(24), digest = crypto.scryptSync(password, salt, 64);
    dealerId = `readback-${crypto.randomUUID()}`; dealerEmail = `readback-${Date.now()}@invalid.example`;
    s.users = Array.isArray(s.users) ? s.users : []; s.audit = Array.isArray(s.audit) ? s.audit : [];
    s.users.push({ id: dealerId, email: dealerEmail, username: dealerEmail, displayName: 'WDCC Five Record Readback', role: 'dealer_agent', tenantId: 'wdcc', status: 'active', disabled: false, passwordHash: `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}` });
    s.audit.push({ id: crypto.randomUUID(), at: now, action: 'qa.five_record.readback_user_create', actor: 'github-actions', dealerId });
    s.revision = Number(s.revision || 0) + 1; s.updatedAt = now;
    try { await put(statePath, JSON.stringify(s, null, 2) + '\n', { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ifMatch: before.etag }); return; }
    catch (e) { if (e instanceof BlobPreconditionFailedError && attempt < 5) continue; throw e; }
  }
}
async function cleanupUser() {
  if (!dealerId) return { ok: true, removed: 0 };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const before = await stableState(), s = before.state, users = Array.isArray(s.users) ? s.users : [];
    s.users = users.filter(u => u.id !== dealerId); s.audit = Array.isArray(s.audit) ? s.audit : [];
    s.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: 'qa.five_record.readback_user_cleanup', actor: 'github-actions', dealerId });
    s.revision = Number(s.revision || 0) + 1; s.updatedAt = new Date().toISOString();
    try { await put(statePath, JSON.stringify(s, null, 2) + '\n', { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ifMatch: before.etag }); return { ok: true, removed: users.length - s.users.length }; }
    catch (e) { if (e instanceof BlobPreconditionFailedError && attempt < 5) continue; throw e; }
  }
}
async function api(path) {
  const r = await fetch(`${DEALER}${path}`, { headers: { accept: 'application/json', cookie: cookieHeader, origin: DEALER }, redirect: 'manual' });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}
async function login() {
  const r = await fetch(`${DEALER}/api/auth/login`, { method: 'POST', headers: { origin: DEALER, 'content-type': 'application/json' }, body: JSON.stringify({ username: dealerEmail, email: dealerEmail, password }), redirect: 'manual' });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  if (r.status !== 200 || !json?.ok) fail(`LOGIN_${r.status}`, text.slice(0,500));
  const values = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
  const session = values.find(v => String(v).startsWith('__Host-wdcc_session=')); if (!session) fail('SESSION_COOKIE_MISSING');
  cookieHeader = values.map(v => String(v).split(';')[0]).join('; ');
  sessionValue = session.match(/^__Host-wdcc_session=([^;]+)/)?.[1] || ''; if (!sessionValue) fail('SESSION_VALUE_MISSING');
}

try {
  await createUser(); await login();
  const leads = await api('/api/leads'), inventory = await api('/api/inventory'), dashboard = await api('/api/crm/dashboard');
  if (leads.status !== 200 || inventory.status !== 200 || dashboard.status !== 200) fail('FEED_HTTP_FAILURE', { leads: leads.status, inventory: inventory.status, dashboard: dashboard.status });
  const li = Array.isArray(leads.json?.items) ? leads.json.items : [], vi = Array.isArray(inventory.json?.items) ? inventory.json.items : [], dl = Array.isArray(dashboard.json?.leads) ? dashboard.json.leads : [];
  const leadRows = {};
  for (const [key, exp] of Object.entries(expected.leads)) {
    const row = li.find(x => x.id === exp.id); if (!row) fail(`LEAD_MISSING_${key}`); if (row.source !== exp.source) fail(`LEAD_SOURCE_MISMATCH_${key}`, row);
    if (!dl.some(x => x.id === exp.id)) fail(`DASHBOARD_LEAD_MISSING_${key}`); leadRows[key] = { id: row.id, name: row.name, source: row.source, kind: row.kind, status: row.status };
  }
  const vehicleRows = {};
  for (const [key, exp] of Object.entries(expected.vehicles)) {
    const row = vi.find(x => x.id === exp.id); if (!row) fail(`VEHICLE_MISSING_${key}`); if (row.stock !== exp.stock || row.status !== 'published') fail(`VEHICLE_STATE_MISMATCH_${key}`, row);
    vehicleRows[key] = { id: row.id, year: row.year, make: row.make, model: row.model, trim: row.trim, stock: row.stock, status: row.status, photoCount: Array.isArray(row.photoPathnames) ? row.photoPathnames.length : 0 };
  }
  result.feeds = { ok: true, http: { leads: leads.status, inventory: inventory.status, dashboard: dashboard.status }, leads: leadRows, vehicles: vehicleRows };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: '__Host-wdcc_session', value: sessionValue, domain: 'dealer.wedontcarecars.com', path: '/', httpOnly: true, secure: true, sameSite: 'Strict' }]);
    const page = await context.newPage();
    await page.goto(`${DEALER}/dealer`, { waitUntil: 'networkidle' }); await page.screenshot({ path: `${screenDir}/dashboard.png`, fullPage: true });
    await page.goto(`${DEALER}/dealer/leads`, { waitUntil: 'networkidle' });
    for (const row of Object.values(leadRows)) {
      const article = page.locator('article').filter({ hasText: row.name }).first(); await article.waitFor({ state: 'visible', timeout: 30000 });
      const text = (await article.innerText()).replace(/\s+/g, ' '); const label = row.source.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
      if (!text.includes(label)) fail(`RENDER_LEAD_SOURCE_MISSING_${row.id}`, text);
    }
    await page.screenshot({ path: `${screenDir}/leads.png`, fullPage: true });
    await page.goto(`${DEALER}/dealer/inventory`, { waitUntil: 'networkidle' });
    for (const row of Object.values(vehicleRows)) {
      const article = page.locator('article').filter({ hasText: row.stock }).first(); await article.waitFor({ state: 'visible', timeout: 30000 });
      const text = (await article.innerText()).replace(/\s+/g, ' ');
      for (const token of [String(row.year), row.make, row.model, row.stock]) if (!text.includes(token)) fail(`RENDER_VEHICLE_TOKEN_MISSING_${row.id}_${token}`, text);
    }
    await page.screenshot({ path: `${screenDir}/inventory.png`, fullPage: true });
    result.rendered = { ok: true, dashboardPage: true, leadsPage: true, inventoryPage: true };
  } finally { await browser.close(); }
  result.ok = true;
} catch (e) { result.error = { message: e?.message || String(e), extra: e?.extra ?? null, stack: e?.stack || null }; }
finally { try { result.cleanupIdentity = await cleanupUser(); } catch (e) { result.cleanupIdentity = { ok: false, error: e?.message || String(e) }; if (result.ok) result.ok = false; } fs.writeFileSync('/tmp/five-record-readback.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); }
if (!result.ok) process.exit(1);
