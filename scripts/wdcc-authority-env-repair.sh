#!/usr/bin/env bash
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN required}"
TEAM_ID="team_G6jmETRRl8fV3KfivPOdj8JM"
PHOENIX_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR"
STORE_ID="store_cNUyQRVlXtyvZQ5N"
SECRET="$(openssl rand -base64 72 | tr -d '\n')"
test "${#SECRET}" -ge 64
api="https://api.vercel.com/v10/projects/${PHOENIX_ID}/env?upsert=true&teamId=${TEAM_ID}"
jq -n --arg v "$STORE_ID" '{key:"BLOB_STORE_ID",value:$v,type:"plain",target:["production","preview"]}' >/tmp/wdcc-store-env.json
jq -n --arg v "$SECRET" '{key:"SESSION_SECRET",value:$v,type:"sensitive",target:["production","preview"]}' >/tmp/wdcc-session-env.json
curl -fsS -X POST "$api" -H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/wdcc-store-env.json >/tmp/wdcc-store-response.json
curl -fsS -X POST "$api" -H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/wdcc-session-env.json >/tmp/wdcc-session-response.json
rm -f /tmp/wdcc-session-env.json

# Sensitive variables are intentionally non-decryptable. Verify presence/type/targets by metadata only.
curl -fsS "https://api.vercel.com/v10/projects/${PHOENIX_ID}/env?teamId=${TEAM_ID}" -H "Authorization: Bearer $VERCEL_TOKEN" >/tmp/wdcc-env-list.json
jq -e '[.envs[]|select(.key=="SESSION_SECRET" and .type=="sensitive" and (.target|index("production")!=null))]|length>=1' /tmp/wdcc-env-list.json >/dev/null
jq -e --arg sid "$STORE_ID" '[.envs[]|select(.key=="BLOB_STORE_ID" and (.target|index("production")!=null))]|length>=1' /tmp/wdcc-env-list.json >/dev/null

mkdir -p .vercel
printf '{"orgId":"%s","projectId":"%s"}\n' "$TEAM_ID" "$PHOENIX_ID" > .vercel/project.json
cat > .wdcc-envverify.mjs <<'NODE'
import {get} from '@vercel/blob';
const store=process.env.BLOB_STORE_ID;
let readable=false,revision=null,error=null;
try{const r=await get('private/state/platform-v3.json',{access:'private',useCache:false});if(r?.statusCode===200&&r.stream){const c=[];for await(const x of r.stream)c.push(x);const s=JSON.parse(Buffer.concat(c).toString('utf8'));readable=true;revision=Number(s.revision||0)}}catch(e){error=String(e?.message||e)}
console.log('VERIFY='+JSON.stringify({store,readable,revision,error}));
NODE
env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID vercel env run --environment=production --token="$VERCEL_TOKEN" --scope=cpxagency -- node .wdcc-envverify.mjs | tee /tmp/wdcc-envverify.log
grep '^VERIFY=' /tmp/wdcc-envverify.log | tail -1 | cut -d= -f2- >/tmp/wdcc-envverify.json
cat /tmp/wdcc-envverify.json | jq .
jq -e --arg sid "$STORE_ID" '.store==$sid and .readable==true' /tmp/wdcc-envverify.json >/dev/null
