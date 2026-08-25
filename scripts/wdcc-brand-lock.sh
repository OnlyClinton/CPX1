#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "BRAND_LOCK_FAILED: $*" >&2; exit 1; }

[[ -s public/wdcc-logo-transparent.webp ]] || fail "missing public/wdcc-logo-transparent.webp"
[[ -s public/wdcc-hero-v2.webp ]] || fail "missing public/wdcc-hero-v2.webp"

# The R31/R25 visual source of truth uses these canonical assets.
# Prevent dealer/admin runtime code from drifting back to retired branding.
if grep -RIn --exclude-dir='.next' --exclude-dir='node_modules' --exclude='*.map' \
  'wdcc-official-logo\.webp' app/dealer app/admin app/PortalExperience.tsx 2>/dev/null; then
  fail "retired wdcc-official-logo.webp referenced by dealer/admin runtime"
fi

# Canonical auth entry points are /dealer and /admin. Legacy login paths may only
# exist in redirect stubs, never as a destination in protected runtime pages.
if grep -RIn --exclude='page.tsx' '/dealer/login' app/dealer 2>/dev/null; then
  fail "protected dealer runtime still points to /dealer/login"
fi

# Ensure the two canonical portal pages and source-of-truth asset references exist.
grep -q 'PortalExperience mode="dealer"' app/dealer/page.tsx || fail "dealer canonical portal missing"
grep -q 'PortalExperience mode="admin"' app/admin/page.tsx || fail "admin canonical portal missing"
grep -q 'wdcc-logo-transparent.webp' app/PortalExperience.tsx || fail "portal shell not using canonical logo"
grep -q 'wdcc-hero-v2.webp' app/PortalExperience.tsx || fail "portal shell not using canonical hero"

echo "BRAND_LOCK_OK: canonical WDCC logo, hero, and portal entry points verified"
