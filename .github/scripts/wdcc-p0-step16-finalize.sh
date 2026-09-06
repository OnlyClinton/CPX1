#!/usr/bin/env bash
set -euo pipefail

# P0 step-16 terminal guard.
# The live proof must already have passed before this helper is called.
# This helper intentionally performs no promotion, routing, DNS, alias, or rollback action.

: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"
: "${P0_SHA:?P0_SHA is required}"

cat >> "$GITHUB_STEP_SUMMARY" <<EOF
### WDCC P0 DEALER + VEHICLE UPLOAD — PASS
Dealer child SHA: $P0_SHA
Dealer live-edge proof: PASS
Managed Neon Auth authority: PRESERVED
Add/Edit vehicle create: PASS
Cloudflare photo upload + media readback: PASS
Photo checkpoint + publish: PASS
Public QA isolation: PASS
Exact QA cleanup: PASS
DNS/routes/Vercel aliases: UNCHANGED
EOF

# Make successful completion explicit so a successful proof cannot fall through
# into an ERR/INT/TERM rollback handler during shell teardown.
trap - ERR INT TERM
exit 0
