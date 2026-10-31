# WDCC 50–70 Evidence-Readiness Sprint — Release Control

Status: **Protected draft PR; production unchanged.** Baseline from October 30, 2026 is **30/100** under the 66-case, weighted, evidence-based acceptance matrix. That is not a design grade or an accepted invoice amount.

## Work completed in this branch
- Real About page (also remove legacy Next redirect to homepage).
- Canonical sitemap and robots endpoint, per-page descriptions and canonicals, private-route noindex.
- `www.wedontcarecars.com` host-specific 308 redirect to apex.
- Shared password-policy function that was missing and blocking TypeScript compilation; existing sign-in recovery link and reset endpoints preserved.
- Default unscoped anonymous storefront inventory reads use the public contract; role-gated dealer inventory calls request `?scope=dealer`. Unhealthy upstream responses no longer masquerade as healthy empty inventory.
- Recovery-ID vehicle images resolve to the verified static image host when dealer deployment does not have those files. These images must be confirmed to depict the actual currently offered used vehicles before any public acceptance claim.
- Display says "listings" rather than "available now" for unverified stock; when canonical feed fails it visibly warns users about provisional recovery references.
- Source static assertions, Next compilation/typecheck/media verification and localhost smoke; scoped GET-only monitoring.
- Replace the previously manually dispatched production acceptance workflow's mutating lead/inventory POST actions **in this branch only** with read-only evidence and immutable archived results.

## Critical blockers before public release
1. Determine the two real Vercel project identifiers and exact serving commits: storefront `prj_We7xkAkB5Qy31Pt17USSkQFE0u7h`; dealer `prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB`. Verify both receive the same approved code changes through controlled preview targets.
2. Vercel preview deployment quota: API reported 402 `api-deployments-free-per-day`. No plan or billing change authorized.
3. Existing owner visual acceptance gate requires approval for the **exact PR head SHA** after visual review. No fake approval, bypass, merges or silent alias changes.
4. Test with owner-issued disposable credentials: login/logout, dealer/admin object-scoped permissions, login reset email delivery via Neon Auth, session expiry, inventory CRUD and photo uploads.
5. Confirm real stock availability and proper photos; a 96-record health count includes all storage entries and **is not** 96 published vehicles. Five recovery records dated August 29 are not independently proven available.
6. Lead persistence/CRM/notification delivery to preauthorized staging inbox/phone must pass; health previously reported email, SMS, webhook as not configured. Never generate production leads just to improve scores.
7. Review actual HSTS coverage and Cloudflare origin TLS + WDCC DNSSEC pending before any high-risk domain updates.
8. Obtain review for the existing possible litigation/service relationship, contractual warranties, IP and scope before changing production service.

## Automated controls
- GitHub Actions `.github/workflows/wdcc-acceptance.yml`: PR static checks, typecheck, immutable media and actual Next.js compiled localhost route smoke; default-branch scheduled exact-host GET-only production observations and 30-day evidence artifact retention.
- Existing CPX hourly security/identity watch: read-only WDCC endpoint, deploy, cert and regression tracking incorporated without taking another automation task slot.
- No automatic PR approval, merge, production deployment, DNS mutation, password reset, CRM writes or checkout/lead submissions.

## Scoring rule
Do not award production readiness credit until independent verification is performed against **actual production code** or a reviewed preview with owner-authorized end-to-end acceptance. A passing local compile or static test proves that source builds; it cannot demonstrate actual inventory availability, real password email delivery, successful customer conversions, complete accessibility or regulatory compliance.

## Rollback
Preserve prechange Vercel deployment IDs, DNS export, checkout commit, settings export and screenshots before release. Stage production without assigning the domain if possible, verify canary, then obtain owner visual approval and promote. Roll back to recorded deployment in case of unexpected errors. Avoid altering original data/lead records or modifying historical invoices.

## Recommended evidence retention
Keep an immutable Git PR/commit record, deployment ID and exact SHA, CI logs and screenshots, a signed test-account acceptance checklist and original relevant customer/contract records. Disclose to legal counsel which results were observed, mocked, unverified or retrospective estimates.
