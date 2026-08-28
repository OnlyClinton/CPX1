# WDCC locked visual + functional contract

This branch is preview/candidate-only. It must not move production aliases, Cloudflare production routes, DNS, provider records, Vercel production aliases, database schema, or production data.

## Controlling visual contract

The acceptance source of truth for this lane is:

- static Tampa skyline + American-flag Challenger opening/hero composition;
- centered owner-approved round intro logo with short smoke/soft-focus-to-crisp handoff;
- **large owner-approved round persistent public-header logo**;
- pinned utility/header chrome, with mobile hamburger navigation and call control remaining usable;
- mobile Featured Inventory as one readable swipe/snap card per position;
- responsive section sizing without horizontal overflow;
- **three-column public inventory grid on wide desktop** and compact one-column horizontal vehicle rows on mobile;
- dealer workflow remains usable without pointer-event overlap;
- Add/Edit remains a real five-stage Info / Pricing / Photos / Details / Review flow;
- **Add Vehicle is a clean new record** and Edit Vehicle alone may preload an existing vehicle;
- verified/recovered first-party media only; no fabricated vehicle photography;
- global credit remains `© 2026 We Don't Care Cars. All Rights Reserved.` and `Designed & engineered by CPX.agency · CHYPHNX`.

Compatibility warning for older source-lock jobs: the historical assertions `persistent public header uses the compact WDCC wordmark` and `Mobile public header keeps hamburger left, centered WDCC wordmark` are **superseded**. They may remain as literal compatibility text only; they are not visual acceptance criteria.

## Functional contract

- Existing authenticated WDCC session remains authoritative.
- Existing `/api/inventory`, `/api/inventory/:id`, `/api/upload`, `/api/media`, and CRM APIs remain the backend contract.
- Public storefront uses dealer-published customer-visible inventory and excludes QA/internal inventory.
- Missing vehicle media must never substitute the Challenger hero; use an honest unavailable-media state.
- All Vehicles reads canonical dealer inventory and keeps search/filter/sort/actions functional.
- Edit PATCHes an existing record rather than creating a duplicate.
- Add creates a clean draft, uploads media through the existing upload path, checkpoints photo pathnames, and publishes only after the final save succeeds.
- Primary photo selection persists through `primaryPhotoPathname`.
- Internal-only listings remain excluded from shopper inventory.
- Dealer dashboard uses CRM/inventory responses rather than hard-coded operational counts.

## Exact-head acceptance gate

Do not merge or promote until the exact branch head has all of the following:

1. build success;
2. isolated no-production-route `workers.dev` preview;
3. exact-SHA proof at 390px mobile, Android Desktop-site width, and wide desktop;
4. round persistent header, centered round intro, pinned chrome, mobile menu/call controls, mobile swipe carousel, three-column desktop public inventory, and responsive no-overflow checks;
5. clean Add Vehicle state, five wizard stages, single-column mobile editor fields, Photos controls/readiness/preview, and direct pointer hit-testing of dealer controls;
6. zero unintended browser write requests in visual proof;
7. explicit owner approval of that exact preview.

## Hard release boundary

No merge, production promotion, alias/DNS change, production Cloudflare route change, provider mutation, schema change, or production-data mutation is authorized by this contract or its proof workflows. Production remains untouched until the exact current SHA is visually approved and release control explicitly permits the next action.
