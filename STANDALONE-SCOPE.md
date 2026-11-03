# Independent side-project boundary — 2026-11-02

This repository contains legacy dealer/WDCC work. It is retained as a **standalone side project** for maintenance and historical work product, not as a CPX/CHYPHNX core product or GHOST integration target.

Do NOT opt this service into CPX/GHOST product registries, a shared GHOST mail/alias identity, portfolio tracking, event ingestion, cross-product customer database, token/secret storage, unified analytics, or shared SSO tenant. No new CPX/CHYPHNX brand crosslinks or deployment workflows should be built from this repository.

Existing application endpoints, customer records, DNS, email delivery, and cloud deployments MUST remain operational until an independently reviewed migration/retirement plan establishes continuity and permission to change them.

Physical account isolation is **not** complete solely by writing this policy: review and segregate Cloudflare zone/Workers, Vercel team, CI scopes, GitHub repo access, credential sets and backup ownership without breaking live service. Do not expose CPX core secrets to this independent project.
