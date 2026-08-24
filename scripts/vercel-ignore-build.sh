#!/usr/bin/env bash
set -eu
STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h"
PHOENIX_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR"
CURRENT_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
if [ "$CURRENT_PROJECT_ID" = "$STOREFRONT_PROJECT_ID" ] || [ "$CURRENT_PROJECT_ID" = "$PHOENIX_PROJECT_ID" ]; then
  echo "WDCC allowed project detected; continue build."
  exit 1
fi
echo "Skipping duplicate CPX1 build for Vercel project: ${CURRENT_PROJECT_ID:-unknown}"
exit 0
