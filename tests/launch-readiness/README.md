# WDCC launch-readiness proof

This harness proves the complete operating path against one disposable Neon branch:

- self-provisioned branch-isolated Neon Auth identities for the dealer and platform admin, followed by real credential login;
- anonymous, dealer, and admin authorization boundaries;
- dealer draft creation, photo checkpoint, publish, dashboard visibility, and anonymous storefront visibility;
- non-QA contact, schedule, and approval lead persistence;
- a real anonymous `/contact` form submission with accessible success confirmation, followed by canonical dashboard and email proof;
- idempotent replay and one durable outbox event;
- exactly one email per non-QA contact, schedule, and approval lead delivered to a local Resend-compatible capture server, including idempotent replay proof;
- dealer dashboard lead visibility and status updates;
- recorded launch budgets: 20 seconds for key mutations and 15 seconds for dashboard reads, with a separate 60-second diagnostic transport ceiling;
- browser-rendered storefront, dealer dashboard, and admin dashboard;
- deployed schema proof for required outbox fields/defaults, validated constraints, idempotency indexes, tenant foreign key, and the enabled lead-defaults trigger;
- exact cleanup of synthetic vehicles, leads, outbox/events/consent rows, portal access/membership rows, and branch Auth users, accounts, and sessions.

The script fails before login or application writes unless Postgres reports the exact expected non-production branch, project, and endpoint IDs. It also requires the Auth URL hostname to be owned by that same branch endpoint. Mockup and recovery modes are forbidden.

Build the app and install Playwright Chromium before running. The proof starts a local Next.js development process by default so the filesystem-backed E2E media authority remains available; the separate production build still has to pass first:

```bash
npm run build
npm install --no-save playwright@1.55.0
npx playwright install chromium
node tests/launch-readiness/run.mjs
```

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `WDCC_DATABASE_URL` | Connection URL for the disposable Neon branch only |
| `WDCC_EXPECTED_NEON_BRANCH_ID` | Exact disposable branch ID returned by Neon |
| `WDCC_EXPECTED_NEON_PROJECT_ID` | Expected Neon project ID |
| `WDCC_EXPECTED_NEON_ENDPOINT_ID` | Exact read/write endpoint ID for the disposable branch |
| `WDCC_PRODUCTION_NEON_BRANCH_ID` | Production/parent branch ID; must differ from the expected branch |
| `WDCC_NEON_AUTH_URL` | Unique Auth API URL for the disposable branch endpoint |

The proof generates unique dealer/admin emails and strong passwords in memory after the branch identity gate passes, signs both users up through that branch's Neon Auth endpoint, inserts their exact normalized portal access rows, and passes the identities only to the isolated child process. Credentials are never written to the report or logs. `WDCC_E2E_AUTH_ORIGIN` may optionally select the configured trusted deployment Origin or localhost; it defaults to the trusted WDCC deployment Origin. Other optional variables are `WDCC_E2E_APP_MODE` (`dev` by default) and `WDCC_E2E_ARTIFACT_DIR`.

The manual GitHub workflow still requires one encrypted `WDCC_E2E_DATABASE_URL` repository secret because a GitHub runner cannot derive a branch credential from a branch/endpoint ID alone. No account email or password secrets are required.

Do not point this harness at the default or protected Neon branch. It is intentionally fail-closed and does not contain a production override.
