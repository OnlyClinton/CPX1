# CPX RealEstate v5 — Premium operating-system concept

**Date:** 2026-10-30  |  **Status:** Isolated development preview. No live listings, customer accounts, MLS integration, payment processing, or licensed brokerage services.

## Seven designed pages

- `index.html`: executive flagship, product architecture, operational advantage and cash discipline
- `marketplace.html`: rights-gated residential marketplace experience; illustrative categories only
- `estateos.html`: private-operations product concept with 30 public business research records and filters
- `hiddenmarket.html`: off-market research product with explicit permission/marketing gates
- `compare.html`: eight sourced incumbent comparisons, legacy-versus-CPX workflows, interactive vacancy-cost scenario
- `prive.html`: extraordinary estates, private islands, castles and penthouses editorial, no representations of active inventory
- `economics.html`: interactive software MRR, contribution, and break-even calculator, pricing hypotheses

Shared HTML/CSS/JS assets live in `assets/`. Research records live in `research/`. Source photography uses public Unsplash-hosted example images, which are editorial design references only; verify and secure media licensing/permissions before commercial deployment. User images may be unavailable offline (color fallback deliberately designed). Fonts are loaded from Google Fonts with system fallbacks.

## Strategic shift informed by October 2026 vendor research

Free basic listings make simple posting non-defensible. Product differentiation should focus on verifiable source freshness, owner-approved publishing, independent B2B workflow automation, evidence-backed cost comparison and proof of economic value. Suggested revenue sequence: fixed-scope pilot -> recurring software -> media/editorial production -> authorized listings and transaction compensation only through a properly licensed brokerage.

## Grounded baseline

30 researched organizations, 70 unfilled prospect positions, 0 EstateOS outreach, 0 paid pilots, 0 authorized public listings. Previous Cloudflare D1 holds six demonstration records, not linked to this front-end. No connected live database queries in preview.

## Security design

Static JS uses DOM escaping for any organization names inserted into HTML; source links originate from a curated research CSV, not user input. No payment or customer submission forms. The Vercel security headers require same-origin JS and CSP allowing local script only. Staging requests use `noindex`. **No authentication exists**—not suitable for real private data. Local QA is not a penetration test or live infrastructure stress test.

## Validation

Local Chromium `set_content` with network-dependent assets stripped tested the rendered DOM at 1440px and 390px across all pages; no JS exceptions or horizontal overflow; navigation and interactive calculator/filter behavior verified; output in `tests/qa_results.json`. Local rendering uses a research JSON stub to validate 30 rows. Live Vercel headers, asset delivery and image availability require independent staging checks.

## Critical release gates

1. Confirm domain and deployment authority and restrict unprotected demo environments as appropriate.
2. Verify external load, route availability, HTTP security headers and anonymous denial before launch.
3. Build production authentication, organization isolation, RBAC, audit logging and data retention before customer data.
4. Secure signed owner, broker and feed licenses before public listings.
5. Complete Florida real estate licensing and advertising review; do not accept commissions through an unlicensed technology entity.
6. Verify photo rights; integrate billing and real service terms only after compliance review.
7. Validate paid customer demand and contribution before moving into other regions.

## Source URLs

- https://www.apartments.com/rental-manager/list-property-for-rent
- https://support.turbotenant.com/en/articles/4003980-is-there-a-cost-to-sign-up-for-turbotenant
- https://www.buildium.com/pricing/
- https://www.propstream.com/pricing
- https://www.propertyradar.com/pricing
- https://www.zillow.com/premier-agent/
- https://www.luxurypresence.com/plans-and-pricing/
- https://www.jamesedition.com/real_estate