# CPX RealEstate V7 — Four-distinct-experience development release

**Status:** Development preview only. No production publish, no live backend, no lead submissions, no brokerages, no actual listings.

## The measurable release gates requested

| Dimension | User target / 10 | Verification available in this package |
|--|--:|--|
| Visual | 9.5–9.9 | Nine-page visual system, image composition and responsive screenshots; score requires independent creative review |
| Page differentiation | 7–8 | Distinct visual/interaction patterns for Marketplace, EstateOS, HiddenMarket, PRIVÉ, FlexStay |
| Content positioning | 7–8 | Rewritten product-specific copy, proof/claim audit, explicit demo labeling |
| Functionality | 7–9 | Working synthetic marketplace search, EstateOS exception workflow, parcel evidence switching, rental yield + SaaS finance calculator |
| Lead capture/conversion | 5–7 | Accessible actual signup form and optional consent; endpoint implemented but not enabled pending secure store and legal review |
| Production readiness | 2–5 | Honest development-only release with rate-limited intake blueprint and outstanding production controls |

**Do not report any of these targets as achieved numerical results based solely on the local work.**

## Four experiences

- `marketplace.html` — light search-first sample marketplace, searchable/filtered synthetic inventory, no availability claims.
- `estateos.html` — dark genuine mini task board: review/resolve, filter and CSV export, session-scoped synthetic data.
- `hiddenmarket.html` — evidence-first research view with schematic map and three synthetic, source-labeled parcel cases.
- `prive.html` — full-bleed editorial and architecture-led luxury journal; no unlicensed property marketing.

Additional: `index.html` flagship; `flexstay.html` owner-yield scenario; `founding-three.html` offer+lead form; `compare.html` peer comparison; `economics.html` contribution lab.

## Lead intake

`api/lead.js` is a Vercel Node adapter. It rejects intake unless `CPX_SITE_ORIGIN`, `CPX_LEAD_STORE_URL`, and `CPX_LEAD_STORE_TOKEN` are set. This prevents false confirmations or fake lead capture. `worker/lead-worker.js` is a sample Cloudflare Worker with isolated D1 binding and approximate per-IP/hour throttling. **This is a draft for security review, not production-complete**: it still needs Turnstile or equivalent bot mitigation, operator access policies, suppressions, retention policies, confirmed legitimate business address, consent/privacy text review, notification integrations, and abuse review.

The public form should not be advertised until the back end is deployed, tested, and the privacy notice/legal scope finalized. It explicitly tells visitors that intake is inactive when unconfigured.

## Truthful inventory status

Only `Development preview`, `Coming soon`, `Pilot applications`, `Join waitlist`, and `Temporarily unavailable` when true. Do not claim `Sold out`, `3 remaining`, `Last chance`, `Fully booked`, `Verified 10M+ records`, or `Trusted by 195+ global markets` without proof. The FTC treats false scarcity cues as deceptive dark patterns. Distinguish a firm cap of three trial places from falsely claiming they have been filled.

## Image rights

Editorial photo references use Unsplash-hosted URLs; commercial usage rights, final imagery and correct licensing still require confirmation or substitution by owned commissioned assets. Images are *not* actual listings.

## Technical boundaries

No account authentication, MLS authorization, customer tenancy, booking, billing, or production-scale rate limiting. No publishing to a production domain. Never use real customer data in the local EstateOS workflow. Privacy and legal controls are required for operating a real broker-facing product.