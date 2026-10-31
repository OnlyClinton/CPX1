# CPX RealEstate Design Contract — enforce before every future release

**Status: V8 design-system contract, October 30, 2026. This is a working quality program, not certification.**

## Core principle
Do not present a powerful-looking but nonfunctional product as complete. The interface must be more precise than the marketing. Apple-style design discipline is *clarity, craft, simplicity and focus*, not imitation or endless animation.

### Four independent product identities — mandatory

1. **Marketplace:** bright search-first product; location, price, rental duration, all-in costs, verified availability and search-state feedback. CTA goes to **Marketplace**, never EstateOS.
2. **EstateOS:** dense enterprise operations console; actionable exceptions, clear statuses, mobile cards, export, customer workflow value. CTA goes to B2B founding evaluation.
3. **HiddenMarket:** evidence-first research terminal, traceable source/status/authorization. CTA goes to **research-interest** intake.
4. **CPX PRIVÉ:** quiet architectural editorial, restrained wordmark, one exceptional hero, art-direction and qualified concierge inquiry. CTA NEVER opens SaaS pilot. No invented inventory, sales prices or sponsorship claims.

FlexStay receives its own owner-side underwriting/eligibility flow. Shared design tokens and identity are allowed; shared sales funnels are not.

### Release blockers (automated where possible)
- All internal links resolve; all visible CTAs do what they promise; no decorative/inert controls.
- No fake sold-out messages, arbitrary scarcity, fabricated customer counts, fabricated performance metrics or testimonials.
- Real listings require explicit marketing permission; examples are visibly marked synthetic.
- Original branding: CPX architectural **skyline on lettermark**, no oval/fish silhouette, chrome WordArt or fake corporate seal.
- Headings must define a specific customer job; cut vague claims like "revolutionizing property intelligence".
- Essential information must not hide behind a mobile horizontal-scroll table; minimum interactive target size aim 44px.
- Text contrast WCAG AA aim ≥4.5:1 for standard text, ≥3:1 for qualifying large text. Test rendered colors in review.
- Every product has a distinct intent-specific contact entry. Marketing opt-in separately unchecked.
- Unconfigured API returns `503`; no simulated success; no storage of customer PII in browser demo.
- Deploy only after auth, tenant isolation, auditability, image/data rights, legal/brokerage review, bot protection, retention, rollback, and verified HTTPS.
- No production mutations, bulk prospecting or paid ads from preview.
- Use actual desktop/mobile screenshots to sign off *each* page; don't award design scores automatically.

### Product-quality acceptance targets
| Product quality | Target | Evidence required |
|---|---|---|
| Visual | 9.5–9.9 subjective ambition | human visual sign-off of all desktop/mobile screens and images |
| Differentiation | 7–8 | clear independent layouts and product-specific CTA tests |
| Content | 7–8 | copy review for accuracy, clarity and specific jobs |
| Functional demo | 7–9 ambition | test genuine end-to-end workflow; real integrations required for production score |
| Lead conversion | 5–7 initial ambition | API tests and real attributed, consented lead receipt on secure staging |
| Readiness | 2–5 initially | honest environment-specific readiness report |

### Review order
1. Customer journey & job-to-be-done
2. Actual behavior / data truthfulness
3. Security and compliance
4. Mobile-first usability
5. Visual hierarchy, imagery and contrast
6. Conversion source and data attribution
7. Performance budget and rollback
8. Peer critique and independent visual acceptance

**Never advance to the next phase if P0 issues remain.** A score is meaningless without passing the gate.