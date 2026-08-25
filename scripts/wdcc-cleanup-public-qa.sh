#!/usr/bin/env bash
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN required}"

TEAM=cpxagency
ORG_ID=team_G6jmETRRl8fV3KfivPOdj8JM
PROJECT_ID=prj_a3oclCcy4sbA2tge4BX7VAKXE4KR
STORE_ID=store_cNUyQRVlXtyvZQ5N
LIVE=https://wdcc-cpx-launch-cpxagency.vercel.app
ROLLBACK_SHA=d6c886ec252441ae46f7a7eb166521b2f5f09492
QA1=QA-LOAD-32819132897-1
QA2=QA-LOAD-32819198581-1

npm ci >/dev/null
npm install --global vercel@59.3.0 >/dev/null

AUTHDIR=/tmp/wdcc-public-qa-auth
rm -rf "$AUTHDIR"; mkdir -p "$AUTHDIR/.vercel"
printf '{"orgId":"%s","projectId":"%s"}\n' "$ORG_ID" "$PROJECT_ID" > "$AUTHDIR/.vercel/project.json"
(cd "$AUTHDIR" && vercel env pull "$AUTHDIR/env" --yes --environment=production --token="$VERCEL_TOKEN" --scope="$TEAM" >/dev/null)
grep -q '^VERCEL_OIDC_TOKEN=' "$AUTHDIR/env" || { echo P0:PHOENIX_OIDC_TOKEN_MISSING >&2; exit 78; }
set -a; . "$AUTHDIR/env"; set +a
export BLOB_STORE_ID="$STORE_ID"
unset BLOB_READ_WRITE_TOKEN || true
echo "::add-mask::$VERCEL_OIDC_TOKEN"

code="$(curl -sS -o /tmp/public-qa-live-before.json -w '%{http_code}' "$LIVE/api/health?qa_cleanup=${GITHUB_RUN_ID:-manual}")"
test "$code" = 200
jq -e --arg sha "$ROLLBACK_SHA" '.ok==true and .degraded==false and .commit==$sha' /tmp/public-qa-live-before.json >/dev/null

cat >/tmp/wdcc-public-qa-cleanup.mjs <<'NODE'
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
  if(!Array.isArray(s.vehicles)) throw Error('STATE_CONTRACT_INVALID');
  const matches=s.vehicles.filter(v=>stocks.has(String(v.stock||'')));
  if(matches.length!==2) throw Error(`QA_EXACT_MATCH_COUNT_${matches.length}`);
  const pending=matches.filter(v=>String(v.status||'').toLowerCase()!=='archived');
  if(!pending.length){
    result={ok:true,noOp:true,revision:Number(s.revision||0),found:matches.map(v=>({id:v.id,stock:v.stock,status:v.status}))};
    break;
  }
  const now=new Date().toISOString();
  const backup=`private/state/backups/platform-v3-pre-public-qa-archive-r${Number(s.revision||0)}-${crypto.randomUUID()}.json`;
  await put(backup,raw,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',...auth});
  const archived=[];
  s.vehicles=s.vehicles.map(v=>{
    if(!stocks.has(String(v.stock||''))) return v;
    archived.push({id:v.id,stock:v.stock,fromStatus:v.status});
    return {...v,status:'archived',qa:true,updatedAt:now,qaCleanupAt:now};
  });
  s.audit=Array.isArray(s.audit)?s.audit:[];
  s.audit.push({id:crypto.randomUUID(),at:now,action:'qa.public_inventory.archive_exact',actor:'github-actions',run:process.env.GITHUB_RUN_ID||null,stocks:[...stocks],vehicleIds:archived.map(x=>x.id),backup});
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
if(!result) throw Error('QA_CLEANUP_NO_RESULT');
console.log(JSON.stringify(result));
NODE
GITHUB_RUN_ID="${GITHUB_RUN_ID:-manual}" node /tmp/wdcc-public-qa-cleanup.mjs | tee /tmp/wdcc-public-qa-cleanup.json
jq -e '.ok==true' /tmp/wdcc-public-qa-cleanup.json >/dev/null

curl -fsS "$LIVE/api/inventory?qa_cleanup_verify=${GITHUB_RUN_ID:-manual}" -o /tmp/public-qa-inventory-after.json
jq -e --arg a "$QA1" --arg b "$QA2" '.ok==true and ([.items[]? | select(.stock==$a or .stock==$b)] | length)==0' /tmp/public-qa-inventory-after.json >/dev/null
code="$(curl -sS -o /tmp/public-qa-live-after.json -w '%{http_code}' "$LIVE/api/health?qa_cleanup_after=${GITHUB_RUN_ID:-manual}")"
test "$code" = 200
jq -e --arg sha "$ROLLBACK_SHA" '.ok==true and .degraded==false and .commit==$sha' /tmp/public-qa-live-after.json >/dev/null

echo PUBLIC_QA_CLEANUP=PASS
