#!/usr/bin/env bash
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID required}"

TEAM="cpxagency"
ORG_ID="team_G6jmETRRl8fV3KfivPOdj8JM"
PHOENIX_PROJECT="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR"
CANDIDATE_SHA="188392c81696da5d0d61f5c6f0bec45f490a232d"
ROLLBACK_SHA="d6c886ec252441ae46f7a7eb166521b2f5f09492"
LIVE="https://wdcc-cpx-launch-cpxagency.vercel.app"
STORE_ID="store_cNUyQRVlXtyvZQ5N"
QA1="QA-LOAD-32819132897-1"
QA2="QA-LOAD-32819198581-1"
STATE_PATH="private/state/platform-v3.json"

WORKDIR="${1:-$PWD}"
cd "$WORKDIR"
test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"

npm ci
npm install --global vercel@59.3.0 >/dev/null
rm -rf /tmp/node_modules
ln -s "$PWD/node_modules" /tmp/node_modules

# Production is a protected rollback baseline. Do not proceed unless it is still healthy and pinned.
code="$(curl -sS -o /tmp/live-before.json -w '%{http_code}' "$LIVE/api/health?safe_oidc=$GITHUB_RUN_ID")"
test "$code" = 200
jq -e --arg sha "$ROLLBACK_SHA" '.ok==true and .degraded==false and .commit==$sha' /tmp/live-before.json >/dev/null

# Pull Phoenix production identity into a runner-only directory. This does not mutate project env.
AUTHDIR="/tmp/wdcc-phoenix-oidc"
rm -rf "$AUTHDIR"; mkdir -p "$AUTHDIR/.vercel"
printf '{"orgId":"%s","projectId":"%s"}\n' "$ORG_ID" "$PHOENIX_PROJECT" > "$AUTHDIR/.vercel/project.json"
(cd "$AUTHDIR" && vercel env pull "$AUTHDIR/env" --yes --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" >/dev/null)
grep -q '^SESSION_SECRET=' "$AUTHDIR/env" || { echo 'P0:PHOENIX_SESSION_SECRET_MISSING' >&2; exit 78; }
grep -q '^VERCEL_OIDC_TOKEN=' "$AUTHDIR/env" || { echo 'P0:PHOENIX_OIDC_TOKEN_MISSING' >&2; exit 78; }
set -a
. "$AUTHDIR/env"
set +a
export BLOB_STORE_ID="$STORE_ID"
unset BLOB_READ_WRITE_TOKEN || true
echo "::add-mask::$SESSION_SECRET"
echo "::add-mask::$VERCEL_OIDC_TOKEN"

# Prove Phoenix OIDC can read the exact canonical ledger before spending a deployment.
cat >/tmp/probe-oidc.mjs <<'NODE'
import {get} from '@vercel/blob';
const path='private/state/platform-v3.json';
const opts={oidcToken:process.env.VERCEL_OIDC_TOKEN,storeId:process.env.BLOB_STORE_ID};
if(!opts.oidcToken||!opts.storeId) throw Error('OIDC_INPUT_MISSING');
const r=await get(path,{access:'private',useCache:false,...opts});
if(!r||r.statusCode!==200||!r.stream) throw Error('OIDC_STATE_READ_FAILED');
const chunks=[]; for await(const c of r.stream) chunks.push(c);
const s=JSON.parse(Buffer.concat(chunks).toString('utf8'));
if(!Array.isArray(s.users)||!Array.isArray(s.leads)||!Array.isArray(s.vehicles)) throw Error('STATE_CONTRACT_INVALID');
const stocks=new Set(['QA-LOAD-32819132897-1','QA-LOAD-32819198581-1']);
console.log(JSON.stringify({ok:true,authority:'oidc',storeId:process.env.BLOB_STORE_ID,revision:Number(s.revision||0),users:s.users.length,leads:s.leads.length,vehicles:s.vehicles.length,qa:(s.vehicles||[]).filter(v=>stocks.has(String(v.stock||''))).map(v=>({id:v.id,stock:v.stock,status:v.status}))}));
NODE
node /tmp/probe-oidc.mjs | tee /tmp/oidc-probe.json
jq -e --arg store "$STORE_ID" '.ok==true and .authority=="oidc" and .storeId==$store' /tmp/oidc-probe.json >/dev/null
printf 'AUTHORITY_MODE=oidc\nBLOB_STORE_ID=%s\n' "$STORE_ID" > /tmp/wdcc-safe-result.env

# Build the frozen source for production parity. Strip any static Blob token from pulled build env so token mode cannot be baked in.
rm -rf .vercel .next
mkdir -p .vercel
printf '{"orgId":"%s","projectId":"%s"}\n' "$ORG_ID" "$PHOENIX_PROJECT" > .vercel/project.json
vercel pull --yes --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" >/dev/null
if [ -f .vercel/.env.production.local ]; then
  sed -i '/^BLOB_READ_WRITE_TOKEN=/d' .vercel/.env.production.local
fi
vercel build --prod --token="$VERCEL_TOKEN" --scope="$TEAM" >/dev/null

# Deployment-scoped env only. Empty static token forces frozen blobAuthority() to its OIDC path.
out="$(vercel deploy --prebuilt --prod --skip-domain \
  --env "BLOB_READ_WRITE_TOKEN=" \
  --env "BLOB_STORE_ID=$STORE_ID" \
  --env "SESSION_SECRET=$SESSION_SECRET" \
  --token="$VERCEL_TOKEN" --scope="$TEAM" 2>&1)"
printf '%s\n' "$out"
candidate="$(printf '%s\n' "$out" | grep -Eo 'https://wdcc-cpx-launch-[a-z0-9]+-cpxagency\.vercel\.app' | head -1 || true)"
test -n "$candidate" || { echo 'P0:CANDIDATE_URL_NOT_FOUND' >&2; exit 1; }
printf 'CANDIDATE_URL=%s\n' "$candidate" >> /tmp/wdcc-safe-result.env

healthy=0
for i in $(seq 1 20); do
  code="$(curl -sS -o /tmp/candidate-before.json -w '%{http_code}' "$candidate/api/health?safe_oidc=$GITHUB_RUN_ID&try=$i" || true)"
  if [ "$code" = 200 ] && jq -e --arg sha "$CANDIDATE_SHA" '.ok==true and .degraded==false and .storage=="oidc" and .state=="readable" and .commit==$sha' /tmp/candidate-before.json >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
cat /tmp/candidate-before.json
test "$healthy" = 1 || { echo 'P0:FROZEN_CANDIDATE_OIDC_NOT_HEALTHY' >&2; exit 1; }

# The frozen backend must suppress QA rows before any production data write.
curl -fsS "$candidate/api/inventory?qa_filter_before=$GITHUB_RUN_ID" -o /tmp/candidate-inventory-before.json
jq -e --arg a "$QA1" --arg b "$QA2" '.ok==true and ([.items[]? | select(.stock==$a or .stock==$b)] | length)==0' /tmp/candidate-inventory-before.json >/dev/null || { echo 'P0:FROZEN_BACKEND_QA_FILTER_FAILED' >&2; exit 1; }

# Archive only the two leaked rows through the exact same OIDC/store authority. Backup first; CAS protects concurrent writes.
cat >/tmp/archive-exact-qa-oidc.mjs <<'NODE'
import crypto from 'node:crypto';
import {get,head,put,BlobPreconditionFailedError} from '@vercel/blob';
const path='private/state/platform-v3.json';
const stocks=new Set(['QA-LOAD-32819132897-1','QA-LOAD-32819198581-1']);
const auth={oidcToken:process.env.VERCEL_OIDC_TOKEN,storeId:process.env.BLOB_STORE_ID};
if(!auth.oidcToken||!auth.storeId) throw Error('OIDC_INPUT_MISSING');
let result=null;
for(let attempt=1;attempt<=3;attempt++){
  const meta=await head(path,auth);
  const r=await get(path,{access:'private',useCache:false,...auth});
  if(!r||r.statusCode!==200||!r.stream) throw Error('STATE_READ_FAILED');
  const chunks=[]; for await(const c of r.stream) chunks.push(c);
  const raw=Buffer.concat(chunks), s=JSON.parse(raw.toString('utf8'));
  const matches=(s.vehicles||[]).filter(v=>stocks.has(String(v.stock||'')));
  const pending=matches.filter(v=>String(v.status||'').toLowerCase()!=='archived');
  if(!pending.length){result={ok:true,noOp:true,revision:Number(s.revision||0),found:matches.map(v=>({id:v.id,stock:v.stock,status:v.status}))};break;}
  if(matches.length!==2) throw Error(`QA_EXACT_MATCH_COUNT_${matches.length}`);
  const now=new Date().toISOString();
  const backup=`private/state/backups/platform-v3-pre-qa-load-archive-r${Number(s.revision||0)}-${crypto.randomUUID()}.json`;
  await put(backup,raw,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',...auth});
  const archived=[];
  s.vehicles=(s.vehicles||[]).map(v=>{
    if(!stocks.has(String(v.stock||''))) return v;
    archived.push({id:v.id,stock:v.stock,fromStatus:v.status});
    return {...v,status:'archived',qa:true,updatedAt:now,qaCleanupAt:now};
  });
  s.audit=Array.isArray(s.audit)?s.audit:[];
  s.audit.push({id:crypto.randomUUID(),at:now,action:'qa.load_inventory.archive_exact',actor:'github-actions',run:process.env.GITHUB_RUN_ID||null,stocks:[...stocks],vehicleIds:archived.map(x=>x.id),backup});
  s.revision=Number(s.revision||0)+1;
  s.updatedAt=now;
  try{
    await put(path,JSON.stringify(s,null,2)+'\n',{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',ifMatch:meta.etag,...auth});
    result={ok:true,noOp:false,revision:s.revision,archived,backup};
    break;
  }catch(e){
    if(e instanceof BlobPreconditionFailedError && attempt<3) continue;
    throw e;
  }
}
if(!result) throw Error('QA_ARCHIVE_NO_RESULT');
console.log(JSON.stringify(result));
NODE
GITHUB_RUN_ID="$GITHUB_RUN_ID" node /tmp/archive-exact-qa-oidc.mjs | tee /tmp/qa-cleanup.json
jq -e '.ok==true' /tmp/qa-cleanup.json >/dev/null

# Verify both public backends are clean and production routing/commit was never moved.
for base in "$LIVE" "$candidate"; do
  curl -fsS "$base/api/inventory?qa_verify=$GITHUB_RUN_ID" -o /tmp/inventory-check.json
  jq -e --arg a "$QA1" --arg b "$QA2" '.ok==true and ([.items[]? | select(.stock==$a or .stock==$b)] | length)==0' /tmp/inventory-check.json >/dev/null
done
code="$(curl -sS -o /tmp/live-after.json -w '%{http_code}' "$LIVE/api/health?safe_oidc_after=$GITHUB_RUN_ID")"
test "$code" = 200
jq -e --arg sha "$ROLLBACK_SHA" '.ok==true and .degraded==false and .commit==$sha' /tmp/live-after.json >/dev/null
code="$(curl -sS -o /tmp/candidate-after.json -w '%{http_code}' "$candidate/api/health?safe_oidc_after=$GITHUB_RUN_ID")"
test "$code" = 200
jq -e --arg sha "$CANDIDATE_SHA" '.ok==true and .degraded==false and .storage=="oidc" and .state=="readable" and .commit==$sha' /tmp/candidate-after.json >/dev/null

echo 'SAFE_REPAIR_OIDC_QA_CLEANUP=PASS'
