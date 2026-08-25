# WDCC Release Checklist — 188392c

Release candidate: `release/wdcc-188392c-ready`
Exact SHA: `188392c81696da5d0d61f5c6f0bec45f490a232d`

## Preflight — no deployment

- [ ] Release branch still resolves to the exact SHA above.
- [ ] `npm ci` and `npm run build` pass.
- [ ] Canonical logo `public/wdcc-logo-transparent.webp` exists.
- [ ] Canonical hero `public/wdcc-hero-v2.webp` exists.
- [ ] No runtime code references `wdcc-official-logo.webp`.
- [ ] `/api/inventory` route exists in the candidate.
- [ ] `/dealer` and `/admin` are present.
- [ ] Phoenix production environment has `SESSION_SECRET` and Blob authority (`BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID`).
- [ ] Dealer and storefront point to `https://wdcc-cpx-launch-cpxagency.vercel.app` when an explicit backend URL is configured.
- [ ] Candidate local E2E passes against canonical services.

## First deployment slot

Use one deployment only. Do not run storefront, dealer, and Phoenix retries in parallel.

1. Deploy the frozen release candidate.
2. Confirm `/api/health` returns JSON and HTTP 200.
3. Confirm `/api/inventory` returns JSON and HTTP 200. HTML or 404 is an automatic NO-GO.
4. Confirm logo, Tampa/car hero, intro/animation and mobile CTA bar render.
5. Confirm `/dealer` and `/admin` render at their canonical URLs.
6. Authenticate dealer and admin accounts and verify session persistence and role boundaries.
7. Submit Schedule Test Drive, Get Approved and Contact leads.
8. Confirm all three leads appear in the dealer/admin operational view and retain attribution.
9. Confirm lead notification delivery succeeds without a 550 bounce.
10. Create a vehicle draft, attach/read a photo, publish, verify dealer inventory, and verify a legitimate published vehicle is public.
11. Confirm QA/test inventory remains excluded publicly.
12. Run cleanup and verify no QA leads or vehicles remain active.

## Promotion gate

Move production aliases only when every live acceptance item above passes. Any P0 failure is a NO-GO and leaves the existing safe alias in place.

## Rollback

Dealer safe fallback: `wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app`

Do not search for a rollback target during an incident. Use the manifest and the known-good fallback first, then diagnose offline.
