# WDCC Target Architecture & Engineering Blueprint

Status: implementation blueprint
Branch: `wdcc-architecture-engineering-v1`
Visual reference: supplied desktop/mobile comps for storefront, inventory, pre-approval, dealer dashboard, all-vehicles management, and add/edit-vehicle flows.

## 1. Product boundary

WDCC is one platform with two surfaces sharing one canonical domain model:

- **Customer storefront** — conversion-first public experience for inventory discovery, vehicle details, pre-approval, test-drive, and direct contact.
- **Dealer operations portal** — authenticated inventory, lead, application, appointment, reporting, and publishing workflows.

The public site and dealer portal must not maintain separate copies of vehicle or lead state. They read/write the same canonical ledgers through server-side services.

## 2. Target system topology

```text
Browser / Mobile
   |
   +-- Public Next.js App Router pages
   |     /, /inventory, /vehicle/[id], /get-approved, /contact
   |
   +-- Dealer Next.js App Router pages
         /dealer, /dealer/leads, /dealer/inventory, /dealer/inventory/new
         |
         v
Server routes / service layer
   +-- Auth / session policy
   +-- Inventory service
   +-- Lead service
   +-- Application service
   +-- Analytics / attribution service
   +-- Notification outbox
   +-- Audit event writer
         |
         +-- Canonical operational ledger (existing durable dealer ledger)
         +-- Object/photo storage (Vercel Blob)
         +-- Analytics/event ledger
         +-- Notification transports
```

## 3. Architecture principles

1. **Single source of truth** — one canonical vehicle record, one lead record, one application record.
2. **Server-authoritative writes** — the browser never decides publish state, readiness, ownership, or audit semantics.
3. **Idempotent mutations** — lead submits, photo completion, publish, archive, and status transitions accept/derive stable idempotency keys.
4. **Append-only audit trail** — every meaningful mutation writes an immutable event with correlation ID, actor, before/after status, timestamp, and source.
5. **Read-your-write verification** — critical writes are read back before the UI claims success.
6. **Public/private separation** — only `published` vehicles are public; drafts/QA/internal records stay dealer-only.
7. **Responsive parity** — mobile is a first-class layout, not a shrunk desktop view.
8. **No mock data in production UI** — KPI cards, readiness, listings, lead counts, and recent activity are computed from live data or explicitly marked unavailable.

## 4. Domain model

### Vehicle

```ts
type VehicleStatus = 'draft' | 'needs_info' | 'published' | 'archived' | 'sold';

type Vehicle = {
  id: string;
  stockNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyStyle?: string;
  drivetrain?: string;
  transmission?: string;
  fuelType?: string;
  engine?: string;
  mileage: number;
  price: number;
  downPayment?: number;
  description?: string;
  photos: VehiclePhoto[];
  primaryPhotoId?: string;
  status: VehicleStatus;
  readiness: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

### Lead

```ts
type LeadSource = 'test_drive' | 'preapproval' | 'contact' | 'phone' | 'walk_in' | 'referral';

type Lead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  vehicleId?: string;
  vehicleInterest?: string;
  pipelineStage: string;
  priority?: number;
  attribution?: Attribution;
  createdAt: string;
  dealerFirstResponseAt?: string;
};
```

### Attribution

Persist first-touch and current-touch values independently:

- source / medium / campaign / term / content
- referrer
- landing path
- click IDs
- session ID
- CTA identifier
- vehicle context

### AuditEvent

```ts
type AuditEvent = {
  id: string;
  correlationId: string;
  entityType: 'vehicle' | 'lead' | 'application' | 'auth' | 'notification';
  entityId: string;
  action: string;
  actor: { type: 'dealer' | 'customer' | 'system'; id?: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
};
```

## 5. UI architecture

### Shared design system

Build a small internal system instead of duplicating CSS per page:

```text
app/ui/
  primitives/
    Button.tsx
    Card.tsx
    Badge.tsx
    Input.tsx
    Select.tsx
    Progress.tsx
  layout/
    PublicHeader.tsx
    DealerShell.tsx
    MobileDealerNav.tsx
    PageContainer.tsx
  vehicle/
    VehicleCard.tsx
    VehicleGallery.tsx
    VehicleSpecs.tsx
    VehicleReadiness.tsx
  lead/
    LeadSourceBadge.tsx
    PipelineStage.tsx
  analytics/
    KpiCard.tsx
    ActivityFeed.tsx
```

### Visual system from the approved comps

- Base: near-black / charcoal chrome for headers and dealer portal.
- Primary action: WDCC red.
- Secondary emphasis: electric blue.
- Content canvas: white / soft neutral on public inventory and dealer forms.
- Cards: 10–14px radius, controlled shadow, thin neutral borders.
- Typography: condensed/strong display treatment for marketing headlines; high-legibility sans-serif for operations.
- Desktop shell: fixed left dealer navigation + top utility bar + scrollable main canvas.
- Mobile dealer shell: top bar + bottom navigation; never retain desktop sidebar.
- Minimum tap target: 44px.
- Main public CTAs remain visible without horizontal scrolling.

## 6. Route map

### Public

- `/` — flagship landing page / financing-first hero / featured inventory
- `/inventory` — searchable/filterable catalog
- `/vehicle/[id]` — customer VDP
- `/get-approved` — multi-step pre-approval
- `/contact` — direct contact / call Sean

### Dealer

- `/dealer` or `/dealer/dashboard` — operational dashboard
- `/dealer/inventory` — all vehicles
- `/dealer/inventory/new` — 5-step create/edit vehicle wizard
- `/dealer/inventory/[id]/edit` — same wizard in edit mode
- `/dealer/leads` — lead queue and pipeline
- `/dealer/applications` — finance applications
- `/dealer/appointments` — scheduled actions/test drives
- `/dealer/reports` — source, conversion, inventory lifecycle metrics
- `/dealer/settings` — dealer/profile/configuration

## 7. Add/Edit Vehicle workflow

Implement one state machine shared by create and edit:

```text
INFO -> PRICING -> PHOTOS -> DETAILS -> REVIEW -> PUBLISH
```

Rules:

- Save draft is available at every step.
- Each completed photo upload receives its own durable checkpoint.
- First photo defaults to primary but can be reordered.
- Readiness is server-calculated; UI only renders it.
- `Publish` is enabled only when server readiness policy passes.
- Publish response is not treated as success until the public inventory read path confirms the new version.
- Failure returns a correlation ID and preserves the draft.

Suggested readiness policy:

```text
vehicle core fields        25%
pricing                    20%
primary photo              20%
minimum gallery threshold  10%
description                10%
stock/VIN identity         10%
public verification         5%
```

## 8. Inventory management workflow

Dealer inventory table/card views must expose:

- year / make / model / trim
- stock number
- primary image
- price / down payment
- mileage
- status
- readiness
- edit / preview / view / archive/sold actions

Desktop uses a table; mobile uses cards. Data semantics must remain identical.

## 9. Public inventory workflow

Public filters are query-driven and URL-addressable:

```text
/inventory?make=Dodge&model=Challenger&maxPrice=25000&sort=featured
```

Requirements:

- server-safe validation of filter values
- no drafts or QA inventory returned
- stable sort order
- responsive card/grid/list modes
- vehicle cards use the canonical image and vehicle ID
- all CTA events write attribution before navigation where possible

## 10. Pre-approval workflow

The supplied design becomes a three-stage customer flow:

1. Your info
2. Your vehicle / budget
3. Review + consent

Minimum initial data:

- full name
- phone
- email
- monthly income or income band
- target down payment
- desired vehicle / vehicle ID
- referral source
- consent + timestamp

Do not collect SSN in the first lightweight lead step. Any future sensitive financing workflow must move to a separately hardened, purpose-built path.

## 11. Dashboard metrics

Dashboard cards must be computed from real records for a selected date range:

- new leads
- applications
- approvals
- sold
- lead source distribution
- response coverage
- top-performing vehicles
- recent activity

No hard-coded demo counts.

## 12. API/service contract

Recommended server-side facade:

```text
GET    /api/public/inventory
GET    /api/public/vehicle/:id
POST   /api/leads
POST   /api/applications
GET    /api/dealer/dashboard
GET    /api/dealer/inventory
POST   /api/dealer/inventory
PATCH  /api/dealer/inventory/:id
POST   /api/dealer/inventory/:id/photos/authorize
POST   /api/dealer/inventory/:id/photos/complete
POST   /api/dealer/inventory/:id/publish
POST   /api/dealer/inventory/:id/archive
GET    /api/dealer/audit
```

The repo may retain existing route names during migration, but page components should depend on typed service contracts rather than storage implementation details.

## 13. Security engineering

- HttpOnly, Secure, SameSite session cookie.
- Dealer routes require authenticated server checks, not only client redirects.
- Role checks for inventory publish/archive and reporting.
- CSRF protection for authenticated mutation routes.
- Input schemas with explicit field allowlists and size limits.
- MIME/type/size enforcement for photo uploads.
- Content-disposition and safe object naming for stored media.
- Rate limits for public lead/application endpoints.
- PII never written to client analytics payloads.
- Secrets remain server-only.
- Audit every auth-sensitive mutation.

## 14. Reliability engineering

Critical vehicle publish sequence:

```text
validate
 -> persist draft version
 -> verify photo checkpoints
 -> calculate readiness
 -> atomically mark published
 -> read canonical record
 -> verify public projection
 -> append audit event
 -> return success
```

If public verification fails, return a non-success state and keep enough state to retry safely; do not silently delete the draft.

Lead sequence:

```text
accept request
 -> validate/idempotency check
 -> persist canonical lead
 -> append audit event
 -> enqueue notification/outbound sync
 -> return accepted
```

Notification failure must not erase the lead.

## 15. Observability

Every request that mutates business data carries `correlationId`.

Capture:

- route / action
- actor
- entity ID
- duration
- result
- storage read/write result
- notification result
- public verification result

Dealer UI exposes an authenticated audit/log page for vehicle and lead traces.

## 16. Performance budgets

Public mobile target:

- LCP <= 2.5s on production representative network
- CLS <= 0.1
- hero media optimized and responsive
- below-fold inventory images lazy loaded
- no heavy client chart library required for the first dealer dashboard; lightweight SVG/CSS or server summaries are preferred

## 17. Accessibility

- keyboard navigation for all dealer actions
- visible focus states
- semantic labels for form controls
- alt text for vehicles/logo
- color is never the only status indicator
- AA contrast target for operational text

## 18. Engineering delivery plan

### Phase A — foundation

- extract shared design tokens/primitives
- establish `DealerShell` and mobile nav
- type domain DTOs
- stabilize service facades around existing ledger APIs

### Phase B — dealer inventory

- rebuild All Vehicles to match approved desktop/mobile composition
- rebuild Add/Edit Vehicle wizard with server readiness
- preserve existing durable upload/publish/audit path

### Phase C — dealer dashboard + leads

- remodel dashboard around real metrics/activity
- retain current CRM behavior while replacing presentation
- add source and date-range views

### Phase D — public conversion surfaces

- rebuild public inventory
- rebuild pre-approval page
- normalize CTA tracking and vehicle continuity

### Phase E — acceptance

- responsive visual regression at 390, 768, 1440 widths
- lead E2E
- upload/publish/readback E2E
- draft isolation test
- auth/unauthorized mutation tests
- outage/retry tests

## 19. Definition of done

A screen is not complete because it resembles the comp. It is complete only when:

1. Desktop and mobile match the approved information hierarchy.
2. All displayed business data is live or explicitly unavailable.
3. Mutations are durable and auditable.
4. Public/dealer state remains consistent after refresh.
5. Failed requests produce actionable UI feedback and correlation IDs.
6. Authentication and authorization are enforced server-side.
7. E2E tests prove lead persistence and vehicle publish visibility.
8. The live production deployment is promoted only after preview validation.
