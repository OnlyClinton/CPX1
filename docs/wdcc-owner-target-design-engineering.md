# WDCC Owner Target — Detailed Design + Engineering Contract

Status: PREVIEW-ONLY acceptance contract for PR #494. No production promotion is authorized by this document.

## 1. Source of truth and precedence

The newest owner-supplied four-image WDCC reference set controls visual design. It supersedes older notes where they conflict.

Logo usage is now explicit:
- Intro: large centered **round WDCC badge** over the Tampa/flag-Challenger scene.
- Public storefront/header and customer conversion pages: **horizontal WDCC wordmark** as shown in the newest public-site references.
- Dealer portal: **round WDCC dealer badge** in dealer chrome/sidebar/topbar, with the WDCC Dealer Portal identity.

No generic dealer template, no substitute logo, no placeholder brand art, and no overlapping/moving car layer are acceptable.

## 2. Global visual system

### Color
- Background black: #02070C
- Deep navy: #061521 / #071622
- WDCC red: #EF1424 to #FF2638
- Electric blue accent: #0576E8 to #0C86FF
- Primary white: #FFFFFF
- Light canvas: #F5F7F8
- Border gray: #DFE5E9
- Muted text: #657583
- Positive green: #0B9C52

Red is reserved primarily for one dominant action per screen and high-priority status. Blue is an informational/brand accent, not a competing primary CTA.

### Typography
- Headlines: condensed/heavy visual character, uppercase where shown by mockup, optical tracking approximately -4% to -5% for hero display.
- Hero headline: exactly three visual lines: BAD CREDIT? / NO CREDIT? / WE DON'T CARE.
- Section titles: heavy, high-contrast, short line lengths.
- Body copy: compact and readable; never tiny, low-contrast, or squeezed into desktop metrics on mobile.
- Dealer data tables: dense but readable; labels 11–13 px desktop equivalent, values 13–16 px depending hierarchy.

### Spacing/radius
- Public content max width: approximately 1420 px on wide desktop.
- Card radius: 6–10 px. Avoid oversized consumer-app pill styling except phone/call controls and status pills.
- Section rhythm: dark hero -> bright benefits/inventory -> dark financing -> bright trust/footer transition.
- Desktop vertical section padding: typically 46–64 px.
- Mobile vertical section padding: typically 30–42 px.

### Iconography
Use simple high-contrast line icons. Public benefit icons use red circles/outlines on white. Dealer chrome icons remain compact and operational.

## 3. Public storefront architecture

### 3.1 Opening intro
- Full viewport Tampa skyline + American-flag Challenger composition.
- One fixed scene image; no translated, sliding, duplicated, split, or independently moving car layer.
- Large centered round WDCC badge.
- Initial atmosphere may be soft-focus/smoky; it resolves smoothly to clear.
- Only whole-screen fade is allowed on exit.
- Motion duration should feel premium but brief; reduced-motion users skip it.
- Skip Intro remains accessible.

Engineering acceptance:
- No horizontal overflow.
- Badge and scene have no transform animation.
- Image assets load before visual proof is considered valid.
- Intro cannot block app indefinitely on asset or JS failure.

### 3.2 Utility strip + main header
Desktop:
- 28 px utility strip with TAMPA BAY, IN-HOUSE FINANCING, and direct Sean phone emphasis.
- 78 px main header.
- Left: horizontal WDCC wordmark.
- Center: Inventory, Financing, How It Works, Reviews, About Us, Contact.
- Right: one dominant GET PRE-APPROVED red CTA.
- Both utility and header remain pinned.

Mobile:
- Compact utility strip.
- Hamburger left.
- Horizontal WDCC wordmark centered.
- True circular red phone button right.
- Dropdown/overlay nav uses 44+ px tap targets.
- No dead band between pinned header and hero.

### 3.3 Homepage hero
Desktop:
- Tampa/Challenger image is the dominant visual field, not a small image card.
- Copy occupies left ~40–47%; car remains dominant center/right.
- Skyline remains visible and bright enough to read as Tampa night.
- Exact headline: BAD CREDIT? / NO CREDIT? / WE DON'T CARE.
- Proof bullets: In-house financing; Low down payments; Fast approvals; Drive today with confidence.
- Primary CTA: GET PRE-APPROVED -> /get-approved.
- Secondary CTA: BROWSE INVENTORY -> /inventory.
- Do not add a third equally weighted CTA.

Mobile:
- Scene remains the hero background, not an isolated art block above a black text block.
- Copy overlays the lower portion with controlled dark gradient.
- Headline remains three lines with no unwanted wrapping.
- CTAs stack full width.
- Car and skyline remain visible above/behind copy.

### 3.4 Benefits row
Four items on desktop, 2x2 on mobile:
- FAST APPROVALS
- LOW DOWN PAYMENTS
- DRIVE TODAY
- SAFE & SECURE

White background, red circular icons, concise supporting copy.

### 3.5 Featured inventory
- Desktop reference target is five compact cards across at wide viewport; at medium desktop/tablet fall to three columns.
- Mobile uses a horizontal swipe carousel, approximately 82% viewport card width, center snapping, visible position dots.
- Data must be canonical, published, customer-visible inventory only.
- Never use hero art or synthetic demo vehicle images as a real inventory card.
- Missing vehicle media gets an honest branded "Photo coming soon" fallback.
- Vehicle card: image, badge, year/make, model/trim, price, down-payment text, mileage/transmission/drivetrain pills.
- Card click -> /vehicle/[id].

### 3.6 Financing section
Dark navy field with four equal hierarchy steps:
1. APPLY ONLINE
2. TALK TO SEAN
3. CHOOSE YOUR CAR
4. DRIVE TODAY

Desktop: four horizontal cards.
Mobile: stacked cards with number badge in fixed column and flexible text column.

### 3.7 Trust/footer
Four trust blocks:
- Tampa Bay Proud
- Straight Answers
- Real People
- Confidence Driven

Footer carries WDCC identity, Tampa Bay service statement, and Sean phone.

## 4. Public customer conversion pages

### 4.1 Get Pre-Approved
Route: /get-approved

Desktop structure:
- Same public chrome.
- Left: short conversion message over Tampa/Challenger scene.
- Right: white form card.
- Supporting inventory strip below where appropriate.

Form progression:
1. Identity/contact
2. Residence/employment/basic qualification data only as legally/operationally required
3. Review/consent
4. Submit

Minimum first-step fields:
- Full name
- Phone
- Email
- ZIP

Engineering:
- POST to lead authority with kind=approval.
- source/get-approved attribution.
- Server-side validation.
- Idempotency key.
- TCPA/contact consent text immediately adjacent to submission where required.
- PII never logged in plaintext debug output.
- On success route to shared thank-you page with submission reference.

### 4.2 Schedule Test Drive
Route: /schedule-test-drive

Step flow:
1. Vehicle
2. Date/time
3. Contact/confirm

Vehicle can be preselected by query or detail-page CTA. Submission kind=schedule. Must persist to dealer leads/appointments path, not only email.

### 4.3 Contact / Call / Text Sean
Route: /contact

- Human-first Sean page.
- Call Sean: 813-516-4752.
- Text Sean CTA uses supported SMS/deep link behavior.
- Email/contact form falls back to persisted lead creation even when notification provider is unavailable.
- Tampa Bay location block may be shown only with verified address data.

### 4.4 Quick lead sticky capture
- Compact persistent or near-footer capture; never covers critical mobile UI.
- Full name, phone, ZIP, optional email.
- One dominant GET STARTED / GET PRE-APPROVED action.
- Captures source path and UTM/referrer where available.

### 4.5 Thank-you/success
- Clear success state with large check mark.
- "We received your information" statement.
- Next actions: View Inventory / Home.
- If lead persistence failed, do not show false success; show retry/contact fallback.

### 4.6 Financing/how-it-works information
- Explain in-house process without overclaiming approval.
- FAQ accordion.
- CTA remains GET PRE-APPROVED.

## 5. Public inventory/detail architecture

### 5.1 Inventory route /inventory
Desktop:
- Dark page shell/chrome.
- Filter/sort toolbar.
- Three-column or wider-density grid depending viewport and target mockup; maintain readable card width.

Mobile:
- Compact filters/sort.
- Cards retain image and pricing hierarchy.
- No desktop table squeezed into phone width.

Filtering fields:
- Make/model
- Body style
- Price
- Mileage
- Status/availability where relevant

### 5.2 Vehicle detail /vehicle/[id]
- Large gallery.
- Vehicle title, price, down payment, mileage, transmission, fuel, drivetrain.
- Description.
- Highlights.
- Payment estimate clearly labeled as estimate, with disclaimer.
- Primary CTA: Schedule Test Drive.
- Secondary CTA: Call Sean.
- Get Pre-Approved remains contextual, not a third competing equal button.

## 6. Dealer portal architecture

### 6.1 Shell
- Dark dealer chrome, compact WDCC round badge, WDCC DEALER PORTAL identity.
- Desktop left navigation + top utility actions.
- Mobile converts navigation to drawer/bottom/compact controls without shrinking the desktop rail.
- Light operational canvas inside dark shell where shown by reference.

Core navigation:
- Dashboard
- Inventory
- Leads
- Appointments/Test Drives
- Customers/Applications
- Messages
- Reports/Analytics
- Settings

### 6.2 Dashboard
Target hierarchy:
- KPI row: New Leads, Applications, Approved, Sold This Week.
- Leads Overview trend chart.
- Leads by Source donut.
- Top Performing Vehicles.
- Recent Activity.
- Quick actions: Add Vehicle, Add Lead, View Calendar, Send Campaign.

Engineering:
- GET /api/crm/dashboard.
- Every KPI displays timestamp/scope internally so stale numbers can be diagnosed.
- Empty states replace fake sample charts.
- Dealer tenant authorization enforced server-side.

### 6.3 All Vehicles / Inventory
- Dense desktop table/list with image thumbnail and columns for Vehicle, Price, Mileage, Views, Leads, Status.
- Search by make/model/stock.
- Status/type/sort filters.
- + Add Vehicle dominant action.
- Mobile uses cards with the same essential information.
- Dealer inventory includes authorized QA/internal records as appropriate; customer storefront continues to filter them.

### 6.4 Import Vehicles
Four-step import workflow:
1. Choose source/file
2. Map/validate fields
3. Review conflicts/errors
4. Import results

Supported engineering behavior:
- CSV or supported source input.
- Validation preview before mutation.
- Duplicate/VIN/stock conflict detection.
- Per-row success/failure report.
- No partial silent failure.

### 6.5 Add/Edit Vehicle — five-step wizard
1. INFO
   - Year, make, model, trim
   - Body style, exterior/interior
   - VIN and stock
   - Mileage
2. PRICING
   - Cash price
   - Down payment
   - Finance/payment metadata if supported
3. PHOTOS
   - Camera
   - Upload Files
   - Drag & Drop
   - Up to configured max photos
   - Reorder primary image
   - Delete/retry individual upload
4. DETAILS
   - Description
   - Features/highlights
   - Mechanical/fuel/transmission/drivetrain
5. REVIEW
   - Readiness checklist
   - Preview
   - Save Draft
   - Publish/Submit

Engineering rules:
- Draft vehicle can exist before photos.
- Publish requires configured required fields and at least one valid photo.
- UI must preserve partially completed steps.
- Upload returns durable pathname/asset reference, never only an in-browser object URL.
- PATCH existing vehicle; POST only for new creation.
- No stored-XSS from description/features; render escaped/sanitized content.

### 6.6 Listing Readiness
Prominent component, not hidden helper text.
Checks:
- Required identity fields
- VIN/stock validity
- Price
- Mileage
- Primary photo
- Description
- Publish status

Each failing item links/focuses to the relevant editor step.

### 6.7 Vehicle Preview
- Same basic proportion and merchandising hierarchy customers will see.
- Gallery, title, price/down payment, attributes, description.
- Schedule Test Drive + Call Sean visual hierarchy for realism.
- Preview is read-only; it cannot mutate the listing.

### 6.8 Leads
- Source tabs/filters.
- Name, phone/email, source, status, age/time.
- Lead detail opens without losing current list context.
- Lead source must preserve call-sean, schedule-test-drive, get-approved, contact, etc.
- Status transitions are audited.

### 6.9 Appointments/Test Drives
- Month/week/day calendar plus list.
- Vehicle + customer + time + status.
- Confirm/reschedule/cancel with audit trail.
- Schedule-test-drive lead may create or link appointment data.

### 6.10 Customers / Applications
- Customer profile and linked leads/appointments/application state.
- Role-limited access to sensitive application data.
- Approved/pending/declined are operational states, not inferred client-side.

### 6.11 Messages
- Conversation list + thread.
- Send action must surface provider failure clearly.
- Persist internal message/audit record where appropriate.
- No claim that SMS/email was delivered unless provider returns accepted/sent/delivered evidence.

### 6.12 Reports / Analytics
- KPI cards + trend visualizations.
- Date-range selector.
- Lead source, vehicle performance, applications, sales/appointments where data exists.
- Never fabricate missing analytics.

### 6.13 Settings
- Dealer profile
- Users & permissions
- Notifications
- Integrations
- Security
- Billing only if implemented

## 7. Engineering architecture

### Runtime separation
- Public storefront/runtime role: frontend/customer-safe reads and lead submissions.
- Dealer portal/runtime role: authenticated dealer operations.
- Canonical persistence authority remains server-side.

### Canonical API contracts
- GET /api/inventory — public/customer-visible records on storefront; authorized dealer scope in dealer runtime.
- GET/PATCH /api/inventory/[id] — protected where mutation is involved.
- POST /api/leads — kinds schedule/contact/approval and source attribution.
- GET /api/leads — authenticated dealer/admin.
- GET /api/crm/dashboard — authenticated dealer/admin.
- POST /api/upload — authenticated durable media upload.
- /api/auth/login, /api/auth/session, /api/auth/logout — session authority.

### Persistence
- Canonical state currently uses private Vercel Blob platform ledger.
- Writes use revision/CAS semantics where implemented.
- Keep backups/audit metadata.
- Do not treat Neon or other historical stores as synchronized DR unless explicitly reconciled.

### Media
- Client selects image -> authenticated upload endpoint -> durable Blob pathname -> vehicle record stores durable pathname -> read endpoint resolves media.
- Validate MIME/type/size and tenant ownership.
- Avoid base64 blobs in main state document.
- Upload failures must be individually retryable.

### Lead routing
Public form -> server validation -> canonical lead persisted -> dealer dashboard/readback -> notification dispatch.

Persistence success and notification success are separate states. A provider outage cannot make a successfully persisted lead disappear, and a notification failure must be observable/retryable.

### Auth/authorization
- Authentication proves identity.
- Tenant authorization is checked server-side for every dealer data read/write.
- Never trust tenantId supplied by browser alone.
- Session cookies use secure/httpOnly/sameSite policy appropriate to deployment.
- Admin emulate/view-as must be explicit, auditable, visibly marked, and must not bypass tenant authorization invisibly.

### Security
- Escape/sanitize dealer-entered description/features/messages.
- CSRF protections for state-changing cookie-authenticated routes where applicable.
- Rate-limit public forms and login.
- Idempotency keys on lead/create operations.
- Avoid PII in logs, build artifacts, screenshots, analytics, and URLs.
- Validate upload file names and content type.

### Resilience/failure states
- Inventory provider blocked: honest unavailable state; no demo vehicles.
- Image missing: branded photo-coming-soon fallback.
- Lead notification provider failed: lead remains persisted, provider status shown internally.
- Session expired: redirect to dealer login without losing safe draft where possible.
- Upload interrupted: retain prior successful photos and allow retry.

### Observability
Each important mutation records enough metadata to diagnose:
- request/correlation id
- authenticated user id
- tenant id
- route/action
- result/status
- entity id
- timestamp

Do not include raw sensitive form fields in standard logs.

## 8. Responsive engineering matrix

### >= 1200 px
- Full public nav.
- Horizontal wordmark.
- Five-card featured row target on homepage.
- Dealer sidebar/table layouts.

### 761–1199 px
- Tighter nav or tablet treatment.
- Three-column inventory where card width allows.
- Dealer canvas may compress but keeps desktop information hierarchy.

### <= 760 px
- Hamburger + centered wordmark + circular call button.
- Full-bleed hero background with copy overlay.
- Full-width stacked primary/secondary hero CTAs.
- 2x2 benefit grid.
- Swipe inventory carousel.
- Stacked financing steps.
- Dealer tables become cards/drawer-based views.

Hard responsive gates:
- document.scrollWidth <= innerWidth + 1 px.
- tap targets >= 42–44 px where practical.
- no clipped hero headline.
- no zero-height/overlapping sticky chrome.
- no desktop sidebar/table forced into 390 px.

## 9. Accessibility
- Semantic headings in order.
- All icons with text meaning or aria-hidden.
- Form fields have labels, errors, described-by links.
- Keyboard navigation for menus, dialogs, wizard, and carousel controls.
- Focus trapping/restoration in modal preview.
- Visible focus state.
- Color contrast does not rely on red/blue alone.
- Reduced-motion intro bypass.

## 10. Performance
- Hero and intro use optimized compressed WebP/AVIF assets where supported.
- Avoid duplicate full-resolution car layers.
- Lazy-load non-critical inventory photos below fold.
- Reserve image aspect-ratio to prevent layout shift.
- Keep main hero/branding in initial critical path.
- Avoid loading dashboard chart libraries on customer storefront.

## 11. Acceptance gates

### Visual P0
- Correct logo family per context.
- Hero composition visibly matches supplied desktop/mobile target.
- Headline exact and readable.
- One dominant CTA.
- Public mobile is intentionally designed, not squeezed desktop.
- Dealer dashboard/inventory/editor visually match reference hierarchy.

### Functional P0
- Dealer login/session.
- Customer approval/contact/schedule leads persist and read back.
- Dealer dashboard sees leads.
- Add vehicle -> upload durable photo -> publish -> dealer inventory readback.
- Published customer-visible vehicle appears on public inventory when not QA/internal.
- QA test data does not leak to public storefront.

### Provider/notification P1
- Email/SMS acceptance proof where configured.
- Provider failures observable and retryable.

### Exact-SHA release packet
For the exact candidate SHA:
- isolated workers.dev URL with production routes removed
- desktop/mobile intro screenshots
- desktop/mobile homepage screenshots
- public inventory + vehicle detail proof
- get-approved, schedule-test-drive, contact, thank-you proof
- dealer dashboard, inventory, import, editor info/pricing/photos/details/review, readiness, preview, leads proof
- browser hard checks
- build/typecheck green
- functional readback green
- explicit owner visual approval

Only after those gates should merge/promotion be considered.

## 12. Immediate implementation order
1. Public brand/header/hero fidelity to newest mockup.
2. Public mobile hero and CTA hierarchy.
3. Public featured inventory density/carousel.
4. Customer conversion pages/forms and success state.
5. Dealer dashboard/inventory shell fidelity.
6. Five-step editor + durable upload/readiness/preview.
7. Leads/appointments/customers/messages/report/settings visual normalization.
8. Exact-SHA visual packet.
9. Functional acceptance/readback.
10. Notification/provider closeout.
11. Owner approval, then explicit release decision.
