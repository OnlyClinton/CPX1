# WDCC Backend Recovery — RELEASE HOLD — 2026-11-02

## Immediate status
Do not promote storefront into production or issue complete security sign-off. The new storefront pages build and render, but backend state, inventory and customer submission are not confirmed functional.

## Observed read-only evidence
- Dealer production /api/health returned HTTP 503 STATE_READ_FAILED; /api/inventory returned HTTP 500 STATE_READ_FAILED.
- Phoenix launch facade /api/health returned HTTP 503; /api/inventory returned HTTP 404 DEPLOYMENT_NOT_FOUND.
- Corrected WDCC preview /api/health returned HTTP 503 and /api/inventory returned HTTP 404 DEPLOYMENT_NOT_FOUND.
- Dealer runtime logs identify path private/state/platform-v3.json with authority token and Vercel Blob HTTP 400 Bad Request.
- Production Blob token is configured; the configured Blob store is private, exists and is available. Token-to-store correctness and file integrity are not established.

- Private Blob store connection metadata lists exactly one connected project, wdcc-cpx-launch, and does NOT list wdcc-dealer-portal. The dealer portal's environment still shows a production Blob token plus store ID. This mismatch is a concrete remediation target but not conclusive proof of the token's provenance.

## Non-destructive recovery sequence
1. Freeze customer-data writes and release promotion. Do not create or overwrite an empty state file or seed synthetic stock.
2. From the owning Vercel account, compare production Blob credential's store binding to the configured private store. Do not paste credentials or private data into GitHub.
3. Read-only verify private/state/platform-v3.json, its revision, and availability. If invalid, inspect authentic backups under private/state/backups/ and reconcile before an explicitly authorized restore.
4. Verify the Phoenix facade backend target and actual Vercel deployment aliases; the 404 deployment-not-found issue is separate from Blob 400.
5. Gate on HTTP 200 ok:true health and HTTP 200 valid published inventory response without QA records.
6. In an isolated consented non-production test account, verify lead persistence, idempotency, authorization-negative paths, and notifications before real customer intake.
7. Confirm rollback point, provenance, CI build, live smoke, and owner production approval before promotion.

## Prevention
Protected PR #608 includes fixed broken pages, truthful published-inventory rendering, build regression, and a provider-neutral read-only live release validator.
No customer records, production aliases, DNS, credential values or existing private state were modified by the repair.
