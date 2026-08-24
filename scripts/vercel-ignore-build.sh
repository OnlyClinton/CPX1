#!/usr/bin/env bash
set -eu
CANONICAL_PROJECT_ID="prj_We7xkAkB5Qy31Pt17USSkQFE0u7h"
CURRENT_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
if [ "$CURRENT_PROJECT_ID" = "$CANONICAL_PROJECT_ID" ]; then
  echo "WDCC canonical storefront project detected; continue build."
  exit 1
fi
echo "Skipping duplicate CPX1 build for Vercel project: ${CURRENT_PROJECT_ID:-unknown}"
exit 0
