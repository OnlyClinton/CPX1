# WDCC Visual Baseline — LOCKED

Authoritative frontend donor:

- Deployment URL: https://wdcc-v32-storefront-a2wntmnnn-cpxagency.vercel.app/
- Vercel deployment ID: dpl_2vfDGZg6erycSF6Pmwo6yPbFSaxp
- Short identifier: 2vfD
- Vercel project: wdcc-v32-storefront
- Project ID: prj_We7xkAkB5Qy31Pt17USSkQFE0u7h
- Status at lock: READY
- Original target: production

## Release rule

2vfD is the visual source of truth. Backend, CRM, lead persistence, inventory persistence, notifications, security, analytics, and dealer/admin functionality may be repaired or upgraded underneath it, but production promotion must not materially alter the 2vfD visual presentation unless explicitly approved.

Do not substitute the 8AR, V42, V45 fallback shell, V89, or a later deployment solely because it is newer.

Required promotion gates:
1. Visual parity against 2vfD on desktop and mobile.
2. Schedule-test-drive lead persists.
3. Pre-approval lead persists.
4. Contact lead persists.
5. Dealer inventory upload persists and is visible to the customer storefront when published.
6. Admin/dealer dashboard can read the resulting records.
7. No dead routes or placeholder-only form actions.
8. Production is promoted only after the preview passes the above gates.

## 2026-08-26 preview lock

Branch `preview/wdcc-exact-mockup-20260826` is a render-only acceptance build cloned from this exact baseline. It must not be promoted until the supplied storefront and dealer screenshots are matched and explicitly approved.
