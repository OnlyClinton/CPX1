# CPX RealEstate V8 — Product-led premium development candidate

Open `index.html` using a static web server (`python -m http.server 8080` from this folder) and follow routes. No API service is activated in local preview. Use synthetic data only.

### Products and pages
- `index.html`: brand flagship and four pathways.
- `marketplace.html`: search filters with synthetic properties, visual editorial imagery and renter-specific updates.
- `estateos.html`: browser-only exception review, responsive mobile task controls, CSV export.
- `flexstay.html`: rental scenario economics, distinct owner-interest route.
- `hiddenmarket.html`: sample parcel provenance and research-specific inquiry.
- `prive.html`: luxury editorial with separate private inquiry.
- `founding-three.html`: 14-day free/3 months at optional $99.99/month offer (no auto billing).
- `interest.html?product=...`: product-specific inquiries; currently fails closed until secure lead store/Turnstile are configured and tested.
- `compare.html`, `economics.html`: research/financial educational content.

### Automated gates
```
python qa/quality_gate.py
python qa/offline_browser.py  # requires playwright + chromium + beautifulsoup4
node qa/test_api.mjs
```

### Disclosures
All property images are synthetic editorial imagery derived from a CPX concept visualization. No image depicts a verified available property. Five EstateOS tasks, three HiddenMarket parcels and four Marketplace listings are demonstrations only. No signed-up customers, no live bookings or connected customer data. V8 is isolated from production.

Read `DESIGN_CONTRACT.md` before editing any page. Read `RELEASE_NOTES_AND_BLOCKERS.md` before considering deployment. Changes to production, DNS, billing, credentials and regulatory activities require appropriate approval.