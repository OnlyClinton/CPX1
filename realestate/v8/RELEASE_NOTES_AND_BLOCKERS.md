# V8 — What changed and what remains

## Implemented in the local V8 release candidate
- 10 pages, including a new product-intent-specific request form.
- Marketplace / HiddenMarket / FlexStay / PRIVÉ primary CTAs route to their own approved product intents. No more luxury visitor → SaaS trial.
- CPX architectural skyline lettermark retained, refined; no fish/oval silhouette.
- Local architectural editorial image assets derived from prior synthetic visualization. They are **not real property listing photographs** and must not be described as such.
- More opulent but restrained color, serif display typography and stronger hero hierarchy. Removed third-party font dependency.
- Marketplace demonstration now has self-contained illustrative visual assets instead of blank color blocks.
- EstateOS mobile review queue becomes stacked, labeled and action-accessible. Desktop action / CSV test retained.
- HiddenMarket and FlexStay each receive product-specific research/underwriting inquiry entry points.
- All inline HTML style attributes removed; CSP runs `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`.
- Intent collection is explicitly not live while secure backend is unconfigured; direct email action remains available.
- V8 lead API and Cloudflare Worker prototypes validate content and required Turnstile credentials and fail closed, with proposed isolated D1 schema. No production DB writes.
- Automated quality gate, 20 offline browser renders, core interaction tests and API negative tests.

## Remaining launch blockers (not fixed / not claimed)
1. Live authentication, tenant isolation, role permissions, audit logs and production customer workflows.
2. D1 isolated intake service, Turnstile site and secret configuration, actual end-to-end testing and consent/retention controls.
3. Real authorized property inventory, media rights, brokerage partners, MLS/IDX agreements and jurisdiction-specific rentals.
4. Actual partner invitation response/lead analytics and compliant outbound-suppression framework.
5. Real third-party property photography for a true top-tier luxury portfolio; synthetic architectural images are interim placeholders.
6. Real-device mobile accessibility checks, independent deployed headers/security/load testing and manual 9.5/10 visual sign-off.
7. Current Vercel preview/deployment verification and separate environment authorization. This local candidate is not a live production site.

**Release status: protected development candidate — production NO GO.**