import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.URL;
const sha = process.env.GITHUB_SHA;
const out = 'current-owner-proof';
if (!base || !sha || !base.includes(sha)) throw new Error(`NOT_EXACT_SHA_PREVIEW ${base || ''} ${sha || ''}`);
fs.mkdirSync(out, { recursive: true });

const result = { sha, url: base, mobile: {}, desktop: {}, dealer: {}, writes: [], pass: false };
const fail = (name, data = {}) => { throw new Error(`${name}_${JSON.stringify(data)}`); };
const watch = page => page.on('request', req => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) result.writes.push({ method: req.method(), url: req.url() });
});

async function goto200(page, path, name) {
  let status = 0;
  for (let i = 1; i <= 12; i++) {
    const join = path.includes('?') ? '&' : '?';
    const response = await page.goto(`${base}${path}${join}owner-proof=${Date.now()}-${i}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    }).catch(() => null);
    status = response?.status() || 0;
    if (status === 200) return response;
    await page.waitForTimeout(1500);
  }
  fail(`${name}_HTTP`, { status });
}

async function skipIntro(page) {
  const intro = page.locator('.li');
  if (!await intro.count()) return;
  const skip = page.getByRole('button', { name: /skip intro/i });
  if (await skip.count()) await skip.click().catch(() => {});
  await intro.waitFor({ state: 'detached', timeout: 7000 }).catch(() => {});
}

async function wireDealer(page) {
  const session = { authenticated: true, name: 'WDCC Owner Review', role: 'dealer_agent', tenantId: 'wdcc', user: { id: 'owner-visual', displayName: 'WDCC Owner Review', role: 'dealer_agent', tenantId: 'wdcc' } };
  const dashboard = { summary: { soldThisWeek: 0, newToday: 0, appointments: 0, applications: 0, messages: 0 }, inventory: [], leads: [] };
  await page.route('**/api/auth/session**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));
  await page.route('**/api/crm/dashboard**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }));
  await page.route('**/api/inventory**', r => r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"items":[]}' }) : r.abort());
  await page.route('**/api/leads**', r => r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"items":[]}' }) : r.abort());
}

const browser = await chromium.launch({ headless: true });
try {
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  watch(mobile);
  await goto200(mobile, '/?owner-review=1', 'MOBILE_HOME');
  await mobile.locator('.li').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.locator('.li-scene img').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.locator('.li-badge img').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.waitForFunction(() => [document.querySelector('.li-scene img'), document.querySelector('.li-badge img')].every(x => x && x.complete && x.naturalWidth > 0), null, { timeout: 10000 });
  await mobile.screenshot({ path: `${out}/mobile-intro.png` });
  await skipIntro(mobile);
  await mobile.locator('.reference-home').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.locator('.wdccOwnerReviewBanner').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.locator('.rh-grid > article').first().waitFor({ state: 'visible', timeout: 10000 });

  const mm = await mobile.evaluate(() => {
    const q = s => document.querySelector(s);
    const R = e => { const r = e?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2 } : null; };
    const header = q('[data-wdcc-public-chrome="header"]');
    const logo = q('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-approved"]');
    const menu = q('.rh-menu');
    const call = q('.rh-call');
    const utility = q('[data-wdcc-public-chrome="utility"]');
    const hero = q('.rh-hero');
    const art = q('.rh-hero-art');
    const benefits = q('.rh-benefits');
    const grid = q('.rh-grid');
    const cards = [...grid.children].map(R);
    const ctas = [...document.querySelectorAll('.rh-hero-actions .rh-btn')].map(e => ({ text: (e.textContent || '').trim(), ...R(e) }));
    const us = utility ? getComputedStyle(utility) : null;
    const cs = getComputedStyle(call);
    return {
      winW: innerWidth, header: R(header), logo: R(logo), menu: R(menu), call: R(call), callRadius: cs.borderTopLeftRadius,
      logoSrc: logo?.getAttribute('src') || '', logoNatural: [logo?.naturalWidth || 0, logo?.naturalHeight || 0],
      utility: R(utility), utilityDisplay: us?.display || 'none', hero: R(hero), heroLoaded: Boolean(art?.complete && art?.naturalWidth > 0),
      headline: [...document.querySelectorAll('.rh-copy h1 span')].map(x => (x.textContent || '').trim()),
      benefitTracks: getComputedStyle(benefits).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      ctas, cards, banner: (document.querySelector('.wdccOwnerReviewBanner')?.textContent || '').trim(),
      overflow: document.documentElement.scrollWidth - innerWidth
    };
  });
  if (mm.header.h < 60 || mm.header.h > 68 || Math.abs(mm.header.y) > 2) fail('MOBILE_HEADER_HEIGHT', mm);
  if (mm.logo.w < 58 || mm.logo.w > 66 || mm.logo.h < 58 || mm.logo.h > 66 || Math.abs(mm.logo.cx - mm.winW / 2) > 4 || mm.logoSrc !== '/wdcc-owner-logo' || mm.logoNatural[0] < 20) fail('MOBILE_LOGO', mm);
  if (mm.menu.w < 40 || mm.menu.w > 44 || mm.call.w < 40 || mm.call.w > 44 || Math.abs(mm.call.w - mm.call.h) > 1 || mm.callRadius !== '50%') fail('MOBILE_HEADER_CONTROLS', mm);
  if (mm.utilityDisplay !== 'none' && (mm.utility?.h || 0) > 1) fail('MOBILE_UTILITY_VISIBLE', mm);
  if (!mm.heroLoaded || Math.abs(mm.hero.y - mm.header.bottom) > 2) fail('MOBILE_HERO', mm);
  if (JSON.stringify(mm.headline) !== JSON.stringify(['BAD CREDIT?', 'NO CREDIT?', "WE DON'T CARE."])) fail('MOBILE_HEADLINE', mm);
  if (mm.benefitTracks !== 4) fail('MOBILE_BENEFITS', mm);
  if (mm.ctas.length !== 2 || mm.ctas.some(x => x.w < 340) || mm.ctas[1].y <= mm.ctas[0].bottom) fail('MOBILE_CTAS', mm);
  if (!/NOT LIVE/i.test(mm.banner) || mm.cards.length !== 5 || mm.cards[0].w < 100 || mm.cards[0].w > 135 || !mm.cards[2] || mm.cards[2].right > 390) fail('MOBILE_FEATURED_THREE_CARD_STRIP', mm);
  if (mm.overflow > 2) fail('MOBILE_OVERFLOW', mm);
  result.mobile.home = mm;
  await mobile.screenshot({ path: `${out}/mobile-home.png`, fullPage: true });

  await goto200(mobile, '/inventory?owner-review=1', 'MOBILE_INVENTORY');
  await mobile.locator('.inventoryGrid').waitFor({ state: 'visible', timeout: 10000 });
  const mi = await mobile.evaluate(() => ({
    tracks: getComputedStyle(document.querySelector('.inventoryGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    controls: Boolean(document.querySelector('.publicInventoryControls')),
    banner: (document.querySelector('.wdccOwnerReviewBanner')?.textContent || '').trim(),
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
  if (mi.tracks !== 1 || !mi.controls || !/NOT LIVE/i.test(mi.banner) || mi.overflow > 2) fail('MOBILE_INVENTORY', mi);
  result.mobile.inventory = mi;
  await mobile.screenshot({ path: `${out}/mobile-inventory.png`, fullPage: true });
  await mobileContext.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage();
  watch(desktop);
  await goto200(desktop, '/?owner-review=1', 'DESKTOP_HOME');
  await skipIntro(desktop);
  await desktop.locator('.rh-grid > article').first().waitFor({ state: 'visible', timeout: 10000 });
  const dm = await desktop.evaluate(() => {
    const art = document.querySelector('.rh-hero-art');
    const utility = document.querySelector('[data-wdcc-public-chrome="utility"]');
    const grid = document.querySelector('.rh-grid');
    const logo = document.querySelector('[data-wdcc-public-chrome="header"] img[data-wdcc-logo-art="owner-approved"]');
    return {
      heroLoaded: Boolean(art?.complete && art?.naturalWidth > 0), utilityH: utility?.getBoundingClientRect().height || 0,
      logoW: logo?.getBoundingClientRect().width || 0,
      headline: [...document.querySelectorAll('.rh-copy h1 span')].map(x => (x.textContent || '').trim()),
      benefitTracks: getComputedStyle(document.querySelector('.rh-benefits')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      gridDisplay: getComputedStyle(grid).display, gridTracks: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      cards: grid.children.length, overflow: document.documentElement.scrollWidth - innerWidth
    };
  });
  if (!dm.heroLoaded || dm.utilityH < 20 || dm.logoW < 60 || JSON.stringify(dm.headline) !== JSON.stringify(['BAD CREDIT?', 'NO CREDIT?', "WE DON'T CARE."]) || dm.benefitTracks !== 4 || dm.gridDisplay !== 'grid' || dm.gridTracks !== 5 || dm.cards !== 5 || dm.overflow > 2) fail('DESKTOP_HOME', dm);
  result.desktop.home = dm;
  await desktop.screenshot({ path: `${out}/desktop-home.png`, fullPage: true });

  await goto200(desktop, '/inventory?owner-review=1', 'DESKTOP_INVENTORY');
  await desktop.locator('.inventoryGrid').waitFor({ state: 'visible', timeout: 10000 });
  const di = await desktop.evaluate(() => ({
    tracks: getComputedStyle(document.querySelector('.inventoryGrid')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    controls: Boolean(document.querySelector('.publicInventoryControls')),
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
  if (di.tracks !== 3 || !di.controls || di.overflow > 2) fail('DESKTOP_INVENTORY', di);
  result.desktop.inventory = di;
  await desktop.screenshot({ path: `${out}/desktop-inventory.png`, fullPage: true });

  const dealer = await desktopContext.newPage();
  watch(dealer);
  await wireDealer(dealer);
  for (const spec of [
    { name: 'dashboard', path: '/dealer', selector: '.dealerDashboardLocked' },
    { name: 'inventory', path: '/dealer/inventory', selector: '.inventoryContract' },
    { name: 'editor', path: '/dealer/inventory/new', selector: '.editVehicleApp' }
  ]) {
    await goto200(dealer, spec.path, `DEALER_${spec.name.toUpperCase()}`);
    await dealer.locator(spec.selector).waitFor({ state: 'visible', timeout: 10000 });
    if (spec.name === 'editor') {
      const steps = await dealer.locator('.stepper button').count();
      if (steps !== 5) fail('DEALER_EDITOR_STEPS', { steps });
      result.dealer.editor = { steps };
      const photos = dealer.locator('.stepper button').filter({ hasText: /photos/i }).first();
      await photos.click();
      await dealer.locator('[data-wizard-stage="photos"]').waitFor({ state: 'visible', timeout: 10000 });
    }
    await dealer.screenshot({ path: `${out}/dealer-${spec.name}-desktop.png`, fullPage: true });
  }
  await desktopContext.close();

  if (result.writes.length) fail('OWNER_PROOF_WRITE_REQUESTS', result.writes);
  result.pass = true;
  fs.writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2) + '\n');
  console.log('WDCC_CURRENT_OWNER_APPROVAL_PASS', JSON.stringify({
    sha, mobileHeader: mm.header.h, mobileLogo: mm.logo.w, mobileBenefits: mm.benefitTracks,
    mobileCardWidth: mm.cards[0].w, desktopCards: dm.cards, writes: result.writes.length
  }));
} finally {
  await browser.close();
}
