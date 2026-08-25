#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "BRAND_LOCK_FAILED: $*" >&2; exit 1; }

[[ -s public/wdcc-logo-transparent.webp ]] || fail "missing public/wdcc-logo-transparent.webp"
[[ -s public/wdcc-hero-v2.webp ]] || fail "missing public/wdcc-hero-v2.webp"

if grep -RIn --exclude-dir='.next' --exclude-dir='node_modules' --exclude='*.map' \
  'wdcc-official-logo\.webp' app/dealer app/admin app/PortalExperience.tsx 2>/dev/null; then
  fail "retired wdcc-official-logo.webp referenced by dealer/admin runtime"
fi

legacy_refs="$(find app/dealer -type f \( -name '*.ts' -o -name '*.tsx' \) ! -path 'app/dealer/login/page.tsx' -print0 | xargs -0 grep -nH '/dealer/login' || true)"
if [[ -n "$legacy_refs" ]]; then
  printf '%s\n' "$legacy_refs"
  fail "protected dealer runtime still points to /dealer/login"
fi

if grep -q 'PortalExperience mode="dealer"' app/dealer/page.tsx; then
  :
elif grep -q 'DealerDashboard' app/dealer/page.tsx \
  && grep -q 'wdcc-logo-transparent.webp' app/dealer/DealerDashboard.tsx \
  && grep -q 'SALES COMMAND' app/dealer/DealerDashboard.tsx; then
  :
else
  fail "dealer canonical portal missing"
fi

grep -q 'PortalExperience mode="admin"' app/admin/page.tsx || fail "admin canonical portal missing"
grep -q 'wdcc-logo-transparent.webp' app/PortalExperience.tsx || fail "portal shell not using canonical logo"
grep -q 'wdcc-hero-v2.webp' app/PortalExperience.tsx || fail "portal shell not using canonical hero"

echo "BRAND_LOCK_OK: canonical WDCC logo, hero, and portal entry points verified"
