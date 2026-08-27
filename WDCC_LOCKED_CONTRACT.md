# WDCC locked visual + functional contract

This branch is preview/candidate-only. It must not move production aliases, Cloudflare production routes, DNS, provider records, Vercel production aliases, or database schema.

## Release order — mandatory

1. **Visual fidelity first.** The exact candidate must match the supplied WDCC desktop/mobile owner boards before functionality or provider extras can authorize release.
2. **Core functionality second.** After visual approval, verify storefront CTAs, auth/session, leads/dashboard readback, inventory, Add/Edit, photo upload, draft/preview/publish, and public inventory isolation.
3. **Notifications/provider extras third.** Email/SMS/webhook, Proton mailbox/DKIM and registrar DNSSEC closeout cannot outrank the visual and core-function gates.

## Mandatory Cloudflare preview + owner approval

Before this candidate can go live on either Cloudflare production or Vercel production, the exact visual candidate must be published to an isolated Cloudflare `workers.dev` preview URL with production routes removed. The owner must see that exact preview and explicitly approve the visual result. No merge, production deployment, alias movement, DNS change, Cloudflare production route change, or promotion is authorized before that approval.

## Final visual authority — supplied Aug 27 owner boards

The owner-supplied boards below are controlling. Older persistent-round-header, giant-card, coarse-pointer hybrid, and superseded color-order assumptions must not be reintroduced.

1. `51546` — public storefront / home desktop + mobile.
2. `51543` — public inventory desktop + mobile.
3. `51075` — Get Pre-Approved desktop + mobile.
4. `51076` — dealer dashboard desktop + mobile.
5. `51522` — dealer All Vehicles desktop + mobile.
6. `51073` / `51517` — dealer Add/Edit Vehicle, Photos, Listing Readiness and Preview.
7. `50985` — owner round WDCC badge supporting asset.
8. `52671` — observed Add Vehicle defect screenshot; evidence only, not a target board.

### Public brand + intro

- The persistent public header uses the compact WDCC wordmark shown on `51546`, `51543`, and `51075`.
- Mobile public header keeps hamburger left, centered WDCC wordmark, and circular red call control right.
- The round `50985` WDCC badge remains the cinematic intro/supporting dealer brand asset. It is **not** the persistent public-header logo.
- The intro uses the static Tampa skyline + American-flag Challenger composition with centered round badge and a short smoke/soft-focus-to-crisp treatment only.

### Public storefront — `51546`

- Desktop uses a slim utility strip + compact black pinned navigation; Tampa skyline + American-flag Challenger remain dominant, with copy left and car right.
- Headline order/colors are `BAD CREDIT?` red / `NO CREDIT?` blue / `WE DON'T CARE.` white.
- Mobile hero is split like the board: vehicle art first, copy/CTAs beneath on black; do not overlay all copy over the car.
- Mobile CTAs stack full width: `GET PRE-APPROVED`, then `BROWSE INVENTORY`; Call Sean follows.
- Benefits are four across desktop and compact 2×2 mobile.
- Featured Inventory is five compact cards across wide desktop; mobile presents one readable card per snap position.
- Financing is four steps desktop and stacked mobile.

### Public inventory — `51543`

- Use the same Tampa/Challenger visual family and public wordmark chrome.
- Search/filter/sort controls remain functional.
- Wide desktop uses five compact inventory cards.
- Mobile uses compact horizontal vehicle rows/cards with image left and price/actions right; no poster-height vehicle media.
- Use canonical VehicleCard data paths and recovered/real first-party media only. Never fake vehicle photos.

### Get Pre-Approved — `51075`

- Desktop uses a dark Tampa/Challenger scene with strong left headline and a white pre-approval card on the right.
- Mobile stacks the scene above the white form card.
- Three real wizard stages remain functional and submit through the existing lead path; visual changes must not bypass consent or lead persistence.

### Dealer — `51076`, `51522`, `51073`, `51517`

- Dark navigation/header shell + light operational workspace.
- Dashboard: compact KPI cards, Leads Overview, Leads by Source, Top Performing Vehicles, Recent Activity and quick actions; mobile collapses to stacked cards with bottom navigation.
- All Vehicles: desktop stats + search/filter/sort + real table/readiness/actions; mobile compact vehicle cards + bottom navigation.
- Add/Edit remains a real five-step wizard: Info / Pricing / Photos / Details / Review.
- Photos includes Take Photo / Upload Files / Drag & Drop, gallery, Listing Readiness, Save Draft / Preview / Publish and vehicle preview.
- **Add Vehicle is a clean new record.** It must not inherit prior Edit Vehicle state. Edit Vehicle alone may preload an existing vehicle.

## Functional contract

- Existing authenticated WDCC session remains authoritative.
- Existing `/api/inventory`, `/api/inventory/:id`, `/api/upload`, `/api/media`, and CRM APIs remain the backend contract.
- Public storefront uses real dealer-published inventory and excludes QA/internal inventory.
- Missing vehicle media must never substitute the Challenger hero; show an honest non-photo placeholder instead.
- All Vehicles reads canonical dealer inventory, searches, filters, sorts and exports CSV.
- Edit loads an existing vehicle and PATCHes it rather than creating a duplicate.
- Add creates a clean draft, uploads private media through `/api/upload`, checkpoints photo pathnames, and publishes only after the final PATCH succeeds.
- Primary photo selection persists through `primaryPhotoPathname`.
- Internal-only listings remain excluded from shopper inventory.
- Import parses CSV, maps columns, validates required fields and imports records as drafts for dealer review; import never auto-publishes.
- Dealer dashboard uses live CRM/inventory responses rather than hard-coded operational counts.
- Logout clears the authenticated session through the existing logout API.

## Acceptance gate

Do not merge or promote until:

- `npm run build` passes on the exact branch head.
- Public home, inventory, pre-approval, dealer dashboard, All Vehicles, Add/Edit, photo/readiness and preview routes compile.
- An isolated no-production-route Cloudflare `workers.dev` preview of the exact SHA is live.
- Exact-current-SHA screenshots cover 390px mobile, Android Desktop-site width and wide desktop across the controlling surfaces.
- Automated public-header evidence requires the supplied-board WDCC **wordmark**, while intro evidence separately requires the round owner badge.
- Mobile menu/call controls remain usable without overlap.
- Public inventory uses real/recovered first-party media only and never substitutes the Challenger hero for missing vehicle photos.
- Add Vehicle begins clean and does not inherit an Edit Vehicle record.
- Automated browser proof records zero unintended write requests.
- Owner explicitly approves that exact Cloudflare preview.
- Only after visual approval, authenticated dealer create/edit/photo/publish and storefront lead/inventory APIs retain their existing contracts.
- No production deployment, alias, DNS or Cloudflare production routing change is required to validate this source.

## Hard release boundary

No merge, production promotion, alias/DNS change, production Cloudflare route change, provider mutation, schema change, or production-data mutation is authorized by this contract or its proof workflows. Production remains untouched until the exact current SHA is visually approved and release control explicitly permits the next action.
