# Big Cat Motors R2 — Isolated Release Lane

Surface: `big-cat-motors`

## Hard boundaries
- Dedicated Vercel project: `big-cat-motors-prod` / `prj_wftsVV93Xe2B5TH6Ssrd0CXYVX0I`
- WDCC storefront and `dealer.wedontcarecars.com` are not production targets for this release.
- Big Cat public `/dealer/*` routes hand off to the shared dealer portal with `tenant=big-cat-motors`.
- `bigcatmotors.com` remains candidate/unverified until ownership and DNS are proven.
- Preview indexing stays disabled until explicit production approval.

## R2 visual contract
- Mustang/lion hero identity.
- Black / graphite / controlled yellow system.
- Premium editorial automotive typography and negative space.
- Vehicle-first inventory cards and test-drive-first conversion path.
- Mobile takeover navigation and reduced-motion support.

## Cloudflare lane
- Worker: `big-cat-motors-edge`
- Queue: `bigcat-lead-events`
- R2: `big-cat-motors-media`
- Tenant stamping on edge lead events.
- Optional HMAC signature on CRM webhook delivery.

## Release gates
1. Build and typecheck green on exact SHA.
2. Desktop and mobile visual evidence approved on exact SHA.
3. Shared inventory read proves `tenant=big-cat-motors` isolation.
4. Durable lead and appointment write proven.
5. Cloudflare health and queue/R2 write proven.
6. Only then attach verified Big Cat domain and enable indexing.

No provider API tokens belong in this repository. GitHub Actions secrets / Vercel environment secrets / Cloudflare secrets are the only approved credential locations.