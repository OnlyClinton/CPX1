#!/usr/bin/env bash
set -euo pipefail

REPO="OnlyClinton/CPX1"
ZONE="wedontcarecars.com"

echo '=== WDCC INFRA CLOSEOUT BOOTSTRAP ==='
command -v gh >/dev/null || { echo 'FAIL: gh CLI not installed'; exit 1; }
command -v curl >/dev/null || { echo 'FAIL: curl not installed'; exit 1; }
command -v jq >/dev/null || { echo 'FAIL: jq not installed'; exit 1; }

gh auth status >/dev/null

read -rsp "Cloudflare zone token (hidden): " CF_ZONE_TOKEN
echo
[ -n "$CF_ZONE_TOKEN" ] || { echo 'FAIL: empty token'; exit 1; }

CHECK="$(curl -fsS "https://api.cloudflare.com/client/v4/zones?name=$ZONE&status=active" -H "Authorization: Bearer $CF_ZONE_TOKEN")"
echo "$CHECK" | jq -e '.success==true and (.result|length)==1' >/dev/null || { echo 'FAIL: token cannot read the WDCC zone'; exit 1; }
ZONE_ID="$(echo "$CHECK" | jq -r '.result[0].id')"
[ "$ZONE_ID" = '53f5a816cfbba0c31d6d12fe46af05a1' ] || { echo "FAIL: unexpected zone id $ZONE_ID"; exit 1; }

echo 'Cloudflare zone access verified.'
printf '%s' "$CF_ZONE_TOKEN" | gh secret set CLOUDFLARE_ZONE_API_TOKEN -R "$REPO"
unset CF_ZONE_TOKEN CHECK

echo 'GitHub secret installed.'
gh workflow run wdcc-infra-closeout.yml -R "$REPO"

echo
echo 'Closeout workflow dispatched.'
echo 'It will: audit DNS, guard dealer proxy cutover with rollback, ensure CAA, audit/repair safe Proton records, enable DNSSEC, publish the DS record, and re-test dealer + storefront.'
echo
echo 'Only provider actions that may remain after the workflow:'
echo '  1) Add the exact DS record from GitHub issue #317 at GoDaddy if parent DS is absent.'
echo '  2) Create/enable sean@wedontcarecars.com in Proton if that address still bounces.'
echo '  3) Copy Proton DKIM CNAME values from Proton Admin only if issue #317 reports DKIM missing.'
echo
echo 'Do not paste the Cloudflare token into chat.'
