# CPX RealEstate — Zero-Cash Bootstrap Release Candidate
Date: 2026-10-30 | Status: **Development / review only**

## Operating scope
- EstateOS: B2B property-operations software and data quality reporting; no unlicensed brokerage, client procurement, or contingent referral compensation.
- CPX PRIVÉ: editorial architecture / luxury concept only until rights-cleared publishing and relevant brokerage authority exist.
- HiddenMarket: internal research, **not** public property inventory.
- CPX RealEstate consumer marketplace: blocked until inventory rights, licensed partner review, data protection and QA.

## Verified initial inventory
Cloudflare D1 `cpx-estate-engine-v1` exists. At read-only audit: 6 listing rows, **all demo**, 0 lead records, no owner-rights flags and no MLS display authorization. Do not infer marketable property inventory.

## Required gates before production
1. Confirm exact source repository, production origin and deployment ownership.
2. Back up live D1 and run a tested, idempotent migration on a staged clone before production.
3. Implement authenticated tenant isolation, MFA, authorization tests, audit and privacy retention.
4. Verify all property source rights and brokerage/advertising compliance under Florida Chapter 475 and Stellar MLS rules.
5. Obtain licensed brokerage agreements before any regulated transaction or referral activity.
6. Establish written fixed-scope software contracts, invoicing and tax controls before taking payment.
7. Confirm real listing data source, accurate availability and permissioned public advertising.
8. Pass desktop/mobile, negative security and rollback QA.

## Pilot business target — NOT verified revenue
- First offer hypothesis: $249 / 30-day customer-authorized property-record operations pilot for a licensed real estate company.
- First traction gate: 3 independently signed and paid pilots; then document support burden, retention and gross contribution.
- Public prospect research register: 30 grounded Tampa Bay business listings; 70 unfilled slots. **No outreach sent.**

## Development artifacts
Complete runnable static demo, restricted-publishing schema proposal, pilot discovery drafts, and financial workbook in the ChatGPT deliverable titled **CPX_RealEstate_Zero_Cash_Launch_20261030.zip**. These do **not** deploy automatically or provide a production backend.

## Regulatory references
- https://www.flsenate.gov/Laws/Statutes/2026/Chapter475
- https://www.stellarmls.com/distribution
- https://rules.stellarmls.com/article/article-1901-idx-and-mls-grid-data-usage

No production deploys, DNS edits, MLS integrations or customer communications authorized by this development commit.
