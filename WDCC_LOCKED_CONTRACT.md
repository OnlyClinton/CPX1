# WDCC locked visual + functional contract

This branch is preview/candidate-only. It must not move production aliases, Cloudflare routes, DNS, provider records, or database schema.

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
- Authenticated dealer create/edit/photo/publish APIs retain their existing contracts.
- No production deployment, alias, DNS or Cloudflare routing change is required to validate the source.
