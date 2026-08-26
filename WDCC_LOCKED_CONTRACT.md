# WDCC locked visual + functional contract

This branch is preview/candidate-only. It must not move production aliases, Cloudflare production routes, DNS, provider records, Vercel production aliases, or database schema.

## Release order — mandatory

1. **Visual fidelity first.** The exact candidate must match the supplied WDCC desktop/mobile references before functionality or provider extras can authorize release.
2. **Core functionality second.** After visual approval, verify storefront CTAs, auth/session, leads/dashboard readback, inventory, Add/Edit, photo upload, draft/preview/publish, and public inventory isolation.
3. **Notifications/provider extras third.** Email/SMS/webhook, Proton mailbox/DKIM and registrar DNSSEC closeout cannot outrank the visual and core-function gates.

## Mandatory Cloudflare preview + owner approval

Before this candidate can go live on **either Cloudflare production or Vercel production**, the exact visual candidate must be published to an isolated Cloudflare `workers.dev` preview URL with production routes removed. The owner must see that Cloudflare preview and explicitly approve the visual result. No merge, production deployment, alias movement, DNS change, Cloudflare production route change, or promotion is authorized before that approval.

## Visual source of truth

1. Opening intro: supplied desktop/mobile Tampa skyline + American-flag Challenger + centered circular WDCC badge + `TAMPA BAY · DRIVE TODAY`.
2. Public storefront: supplied desktop/mobile BAD CREDIT / NO CREDIT / WE DON'T CARE board.
3. Dealer dashboard: supplied light-canvas desktop/mobile dashboard board.
4. All Vehicles: supplied dark chrome + white workspace desktop/mobile inventory board.
5. Import Vehicles: supplied four-step Import Vehicles board.
6. Add/Edit Vehicle: supplied desktop/mobile five-step vehicle editor; strongest source is the full white editor board with right-side readiness/preview.
7. Photos: camera, upload, drag/drop, primary selection and removal.
8. Listing readiness: server-backed vehicle state, Save Draft, Preview, Publish/Submit.
9. Vehicle preview: shopper-facing visual preview using current form/photos.

## Functional contract

- Existing authenticated WDCC session remains authoritative.
- Existing `/api/inventory`, `/api/inventory/:id`, `/api/upload`, `/api/media`, and CRM APIs remain the backend contract.
- Public storefront uses real dealer-published inventory and excludes QA/internal inventory.
- All Vehicles reads canonical dealer inventory, searches, filters, sorts and exports CSV.
- Edit loads an existing vehicle and PATCHes it rather than creating a duplicate.
- Add creates a draft, uploads private media through `/api/upload`, checkpoints photo pathnames, and publishes only after the final PATCH succeeds.
- Primary photo selection persists through `primaryPhotoPathname`.
- Internal-only listings remain excluded from shopper inventory.
- Import parses CSV, maps columns, validates required fields and imports records as drafts for dealer review; import never auto-publishes.
- Dealer dashboard uses live CRM/inventory responses rather than hard-coded operational counts.
- Logout clears the authenticated session through the existing logout API.

## Acceptance gate

Do not merge or promote until:

- `npm run build` passes on the branch.
- Public home, dealer dashboard, inventory, import, Add/Edit, photo/readiness and preview routes compile.
- A Cloudflare `workers.dev` preview of the exact visual candidate is live and visually inspected by the owner.
- Owner explicitly approves that Cloudflare preview.
- Only after visual approval, authenticated dealer create/edit/photo/publish and storefront lead/inventory APIs retain their existing contracts.
- No production deployment, alias, DNS or Cloudflare production routing change is required to validate the source.
