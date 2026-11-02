#!/usr/bin/env bash
set -eu

STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h"
PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR"
DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB"
CURRENT_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
BRANCH="${VERCEL_GIT_COMMIT_REF:-}"

# Owner-requested preview QA for this one WDCC repair branch and verified project.
# Preserve the default ignore policy for every other project and branch.
if [ "$CURRENT_PROJECT_ID" = "prj_Ov6OomlySBxvTBf0j5cqcAQHDiPK" ] && [ "$BRANCH" = "fix/wdcc-public-route-inventory-truth-20261102" ]; then
  echo "WDCC controlled route-fix preview lane; continue build."
  exit 1
fi

case "$CURRENT_PROJECT_ID" in
  "$STOREFRONT_PROJECT_ID")
    case "$BRANCH" in release/wdcc-*) echo "WDCC storefront release lane; continue build."; exit 1;; esac
    ;;
  "$PHOENIX_PROJECT_ID")
    case "$BRANCH" in release/phoenix-*) echo "WDCC launch release lane; continue build."; exit 1;; esac
    ;;
  "$DEALER_PROJECT_ID")
    case "$BRANCH" in release/dealer-*) echo "WDCC dealer release lane; continue build."; exit 1;; esac
    ;;
esac

echo "Skipping non-release Vercel build for project=${CURRENT_PROJECT_ID:-unknown} branch=${BRANCH:-unknown}"
exit 0
