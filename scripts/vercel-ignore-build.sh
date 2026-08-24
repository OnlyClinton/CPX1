#!/usr/bin/env bash
set -eu
STOREFRONT_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h"
CURRENT_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
if [ "$CURRENT_PROJECT_ID" = "$STOREFRONT_PROJECT_ID" ]; then
  echo "WDCC storefront release detected; continue build."
  exit 1
fi
echo "Skipping non-storefront CPX1 build during WDCC visual release: ${CURRENT_PROJECT_ID:-unknown}"
exit 0
