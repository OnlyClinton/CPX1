# WDCC provider split

Target topology:

- Cloudflare Workers: storefront/frontend runtime (`WDCC_RUNTIME_ROLE=frontend`)
- Railway: canonical API/state runtime (`WDCC_RUNTIME_ROLE=backend`)
- Vercel: retained as rollback/fallback during migration
- Vercel Blob: retained as the current state authority until a separate storage migration is deliberately approved

## Safety model

Production DNS is not changed by `.github/workflows/wdcc-provider-split.yml`.

The workflow must prove, in order:

1. Existing WDCC production build still passes.
2. Railway backend has a portable `SESSION_SECRET` and `BLOB_READ_WRITE_TOKEN` copied from the current canonical Phoenix authority without printing either value.
3. Railway deploys and `/api/health` reports `ok=true`, `backend=local`, and `state=readable`.
4. Cloudflare builds from the same repository, is bound to the exact healthy Railway URL, and deploys to a workers.dev staging URL.
5. Cloudflare `/api/health` reports a healthy backend and `/api/inventory` returns valid JSON.
6. Only after rendered and end-to-end acceptance should production DNS be considered for a separate cutover.

## GitHub secrets used by the automation

Existing:

- `VERCEL_TOKEN`

Provider authorization:

- `RAILWAY_TOKEN` — Railway project-scoped production token
- `RAILWAY_PROJECT_ID` — target Railway project
- `RAILWAY_SERVICE` — optional; defaults to `wdcc-backend`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WORKERS_URL` — optional fallback if the deploy log cannot resolve the workers.dev URL

No provider secret is committed to source.

## Rollback

Until a later DNS promotion is explicitly approved, the current Vercel production aliases remain unchanged. A failed Railway or Cloudflare stage cannot replace production traffic.
