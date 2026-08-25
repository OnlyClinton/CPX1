import crypto from 'node:crypto';
import fs from 'node:fs';
import { get, head, put, BlobPreconditionFailedError } from '@vercel/blob';
import { chromium } from 'playwright';

const DEALER = process.env.DEALER || 'https://dealer.wedontcarecars.com';
const run = process.env.RUN_TAG || `manual-${Date.now()}`;
const statePath = 'private/state/platform-v3.json';
const resultPath = '/tmp/five-record-proof.json';
const screenDir = '/tmp/screens';
fs.mkdirSync(screenDir, { recursive: true });

let dealerId = '';
let dealerEmail = '';
let password = '';
let cookieHeader = '';
let sessionValue = '';
const result = {
  ok: false,
  run,
  login: null,
  leads: {},
  vehicles: {},
  feeds: {},
  rendered: {},
  cleanupIdentity: null,
  error: null,
};

function fail(message, extra) {
  const err = new Error(message);
  if (extra !== undefined) err.extra = extra;
  throw err;
}

async function stableState() {
  for (let i = 0; i < 6; i++) {
    const before = await head(statePath);
    const response = await get(statePath, { access: 'private', useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream) fail('STATE_READ_FAILED');
    const chunks = [];
    for await (const chunk of response.stream) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const after = await head(statePath);
    if (before.etag === after.etag) return { raw, etag: after.etag, state: JSON.parse(raw.toString('utf8')) };
  }
  fail('STATE_TOO_HOT');
}

async function createQaIdentity() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const before = await stableState();
    const state = before.state;
    const now = new Date().toISOString();
    const salt = crypto.randomBytes(24);
    password = `WdccFive-${crypto.randomBytes(18).toString('base64url')}!`;
    const digest = crypto.scryptSync(password, salt, 64);
    const passwordHash = `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
    dealerId = `five-proof-${crypto.randomUUID()}`;
    dealerEmail = `five-proof-${run}@invalid.example`;
    state.users = Array.isArray(state.users) ? state.users : [];
    state.audit = Array.isArray(state.audit) ? state.audit : [];
    state.users.push({
      id: dealerId,
      email: dealerEmail,
      username: dealerEmail,
      displayName: `WDCC Five Record Proof ${run}`,
      role: 'dealer_agent',
      tenantId: 'wdcc',
      status: 'active',
      disabled: false,
      passwordHash,
    });
    const backup = `private/state/backups/platform-v3-pre-five-proof-r${Number(state.revision || 0)}-${crypto.randomUUID()}.json`;
    await put(backup, before.raw, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' });
    state.audit.push({ id: crypto.randomUUID(), at: now, action: 'qa.five_record.user_create', actor: 'github-actions', run, dealerId, backup });
    state.revision = Number(state.revision || 0) + 1;
    state.updatedAt = now;
    try {
      await put(statePath, JSON.stringify(state, null, 2) + '\n', { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ifMatch: before.etag });
      return;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < 5) continue;
      throw error;
    }
  }
}

async function cleanupQaIdentity() {
  if (!dealerId) return { ok: true, removed: 0 };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const before = await stableState();
    const state = before.state;
    const users = Array.isArray(state.users) ? state.users : [];
    state.users = users.filter((u) => u.id !== dealerId);
    state.audit = Array.isArray(state.audit) ? state.audit : [];
    state.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: 'qa.five_record.user_cleanup', actor: 'github-actions', run, dealerId });
    state.revision = Number(state.revision || 0) + 1;
    state.updatedAt = new Date().toISOString();
    try {
      await put(statePath, JSON.stringify(state, null, 2) + '\n', { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ifMatch: before.etag });
      return { ok: true, removed: users.length - state.users.length };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < 5) continue;
      throw error;
    }
  }
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    headers.cookie = cookieHeader;
    headers.origin = DEALER;
  }
  const response = await fetch(`${DEALER}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { response, status: response.status, json, text };
}

async function login() {
  const response = await fetch(`${DEALER}/api/auth/login`, {
    method: 'POST',
    headers: { origin: DEALER, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ username: dealerEmail, email: dealerEmail, password }),
    redirect: 'manual',
  });
  const text = await response.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (response.status !== 200 || !json?.ok) fail(`LOGIN_HTTP_${response.status}`, text.slice(0, 500));
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  const sessionCookie = setCookies.find((value) => String(value).startsWith('__Host-wdcc_session='));
  if (!sessionCookie) fail('SESSION_COOKIE_MISSING', setCookies);
  cookieHeader = setCookies.map((value) => String(value).split(';')[0]).join('; ');
  const match = sessionCookie.match(/^__Host-wdcc_session=([^;]+)/);
  sessionValue = match?.[1] || '';
  if (!sessionValue) fail('SESSION_VALUE_MISSING');
  const session = await api('/api/auth/session', { auth: true });
  if (session.status !== 200 || !session.json?.authenticated || String(session.json?.user?.role || '').toLowerCase() !== 'dealer_agent') fail(`SESSION_INVALID_${session.status}`, session.text);
  result.login = { ok: true, loginHttp: response.status, sessionHttp: session.status, dealerEmail };
}

async function createLead(kind, source, label, phone) {
  const key = `wdcc-qa-five-${label.toLowerCase().replace(/\s+/g, '-')}-${run}`;
  const name = `WDCC Dashboard Test ${label} ${run}`;
  const payload = {
    qa: true,
    kind,
    source,
    name,
    phone,
    email: `qa-${label.toLowerCase().replace(/\s+/g, '-')}-${run}@invalid.example`,
    vehicleInterest: 'Dashboard end-to-end proof',
    preferredTime: 'QA only',
    message: 'Automated WDCC contract verification - leave visible in dealer dashboard for inspection.',
    consent: true,
    idempotencyKey: key,
  };
  const response = await fetch(`${DEALER}/api/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key, origin: DEALER },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (![200, 201].includes(response.status) || !json?.ok || !json?.persisted || !json?.item?.id) fail(`LEAD_${label}_HTTP_${response.status}`, text.slice(0, 800));
  if (json.item.source !== source || json.item.kind !== kind) fail(`LEAD_${label}_ATTRIBUTION_MISMATCH`, json.item);
  return {
    id: json.item.id,
    name,
    kind,
    source,
    status: json.item.status,
    notificationEmail: json.notifications?.email || 'unknown',
    notificationSms: json.notifications?.sms || 'unknown',
  };
}

async function createVehicle(spec) {
  const created = await api('/api/inventory', { method: 'POST', auth: true, body: spec });
  if (created.status !== 201 || !created.json?.ok || !created.json?.item?.id) fail(`VEHICLE_CREATE_${spec.stock}_${created.status}`, created.text.slice(0, 800));
  const item = created.json.item;
  const photo = `media/wdcc/${item.id}/dashboard-proof-${spec.stock.toLowerCase()}-${run}.png`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlV1GQAAAAASUVORK5CYII=', 'base64');
  await put(photo, png, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/png' });
  const checkpoint = await api(`/api/inventory/${encodeURIComponent(item.id)}`, { method: 'PATCH', auth: true, body: { photoPathnames: [photo], primaryPhotoPathname: photo } });
  if (checkpoint.status !== 200 || !checkpoint.json?.ok || !(checkpoint.json?.item?.photoPathnames || []).includes(photo)) fail(`VEHICLE_PHOTO_${spec.stock}_${checkpoint.status}`, checkpoint.text.slice(0, 800));
  const published = await api(`/api/inventory/${encodeURIComponent(item.id)}`, { method: 'PATCH', auth: true, body: { status: 'published' } });
  if (published.status !== 200 || !published.json?.ok || published.json?.item?.status !== 'published') fail(`VEHICLE_PUBLISH_${spec.stock}_${published.status}`, published.text.slice(0, 1000));
  return {
    id: item.id,
    year: spec.year,
    make: spec.make,
    model: spec.model,
    trim: spec.trim,
    stock: spec.stock,
    status: published.json.item.status,
    photo,
    storefrontVerification: published.json?.storefront?.verification || 'not_reported',
    storefrontExpected: published.json?.storefront?.expected || 'not_reported',
  };
}

async function verifyFeeds(callLead, testLead, approvalLead, car1, car2) {
  const leads = await api('/api/leads', { auth: true });
  if (leads.status !== 200) fail(`LEAD_FEED_${leads.status}`, leads.text.slice(0, 500));
  const inventory = await api('/api/inventory', { auth: true });
  if (inventory.status !== 200) fail(`INVENTORY_FEED_${inventory.status}`, inventory.text.slice(0, 500));
  const dashboard = await api('/api/crm/dashboard', { auth: true });
  if (dashboard.status !== 200) fail(`DASHBOARD_FEED_${dashboard.status}`, dashboard.text.slice(0, 500));

  const leadItems = Array.isArray(leads.json?.items) ? leads.json.items : [];
  const inventoryItems = Array.isArray(inventory.json?.items) ? inventory.json.items : [];
  const dashboardLeads = Array.isArray(dashboard.json?.leads) ? dashboard.json.leads : [];
  const checks = [
    [callLead, 'call-sean'], [testLead, 'schedule-test-drive'], [approvalLead, 'get-approved'],
  ];
  for (const [lead, source] of checks) {
    if (!leadItems.some((x) => x.id === lead.id && x.source === source)) fail(`LEAD_FEED_RECORD_MISSING_${source}`);
    if (!dashboardLeads.some((x) => x.id === lead.id)) fail(`DASHBOARD_LEAD_MISSING_${source}`);
  }
  for (const car of [car1, car2]) {
    if (!inventoryItems.some((x) => x.id === car.id && x.status === 'published')) fail(`INVENTORY_RECORD_MISSING_${car.stock}`);
  }
  result.feeds = {
    ok: true,
    leadFeedHttp: leads.status,
    inventoryFeedHttp: inventory.status,
    dashboardFeedHttp: dashboard.status,
    dealerLeadCount: leadItems.length,
    dealerInventoryCount: inventoryItems.length,
    dashboardLeadCount: dashboardLeads.length,
  };
}

async function verifyRendered(callLead, testLead, approvalLead, car1, car2) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: '__Host-wdcc_session', value: sessionValue, domain: 'dealer.wedontcarecars.com', path: '/', httpOnly: true, secure: true, sameSite: 'Strict' }]);
    const page = await context.newPage();

    await page.goto(`${DEALER}/dealer`, { waitUntil: 'networkidle' });
    if (!page.url().includes('/dealer')) fail('RENDER_DASHBOARD_NOT_REACHED', page.url());
    await page.waitForFunction(([a, b, c]) => document.body.innerText.includes(a) && document.body.innerText.includes(b) && document.body.innerText.includes(c), [callLead.name, testLead.name, approvalLead.name], { timeout: 30000 });
    await page.screenshot({ path: `${screenDir}/dashboard.png`, fullPage: true });

    await page.goto(`${DEALER}/dealer/leads`, { waitUntil: 'networkidle' });
    await page.waitForFunction(([a, b, c]) => document.body.innerText.includes(a) && document.body.innerText.includes(b) && document.body.innerText.includes(c), [callLead.name, testLead.name, approvalLead.name], { timeout: 30000 });
    const leadText = await page.locator('body').innerText();
    for (const label of ['Call Sean', 'Schedule Test Drive', 'Get Approved']) if (!leadText.includes(label)) fail(`RENDER_SOURCE_LABEL_MISSING_${label}`);
    await page.screenshot({ path: `${screenDir}/leads.png`, fullPage: true });

    await page.goto(`${DEALER}/dealer/inventory`, { waitUntil: 'networkidle' });
    await page.waitForFunction(([a, b]) => document.body.innerText.includes(a) && document.body.innerText.includes(b), [car1.stock, car2.stock], { timeout: 30000 });
    const inventoryText = await page.locator('body').innerText();
    if (!inventoryText.includes(`${car1.year} ${car1.make} ${car1.model} ${car1.trim}`)) fail('RENDER_VEHICLE1_NAME_MISSING');
    if (!inventoryText.includes(`${car2.year} ${car2.make} ${car2.model} ${car2.trim}`)) fail('RENDER_VEHICLE2_NAME_MISSING');
    await page.screenshot({ path: `${screenDir}/inventory.png`, fullPage: true });

    result.rendered = { ok: true, dashboard: true, leads: true, inventory: true };
  } finally {
    await browser.close();
  }
}

try {
  await createQaIdentity();
  await login();

  const callLead = await createLead('contact', 'call-sean', 'Call Sean', '813-555-0141');
  const testLead = await createLead('schedule', 'schedule-test-drive', 'Test Drive', '813-555-0142');
  const approvalLead = await createLead('approval', 'get-approved', 'Get Approved', '813-555-0143');
  result.leads = { callSean: callLead, testDrive: testLead, getApproved: approvalLead };

  const car1 = await createVehicle({ year: 2018, make: 'Honda', model: 'Accord', trim: 'EX', price: 15995, downPayment: 2200, mileage: 78210, stock: `R36TEST-DASH-ACCORD-${run}`, description: 'Dealer upload QA vehicle. Keep visible in dealer portal for dashboard proof.' });
  const car2 = await createVehicle({ year: 2020, make: 'Ford', model: 'Escape', trim: 'SE', price: 17495, downPayment: 2500, mileage: 64320, stock: `R36TEST-DASH-ESCAPE-${run}`, description: 'Dealer upload QA vehicle. Keep visible in dealer portal for dashboard proof.' });
  result.vehicles = { accord: car1, escape: car2 };

  await verifyFeeds(callLead, testLead, approvalLead, car1, car2);
  await verifyRendered(callLead, testLead, approvalLead, car1, car2);
  result.ok = true;
} catch (error) {
  result.error = { message: error?.message || String(error), extra: error?.extra ?? null, stack: error?.stack || null };
} finally {
  try { result.cleanupIdentity = await cleanupQaIdentity(); }
  catch (error) { result.cleanupIdentity = { ok: false, error: error?.message || String(error) }; if (result.ok) result.ok = false; }
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (!result.ok) process.exit(1);
