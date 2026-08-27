from pathlib import Path

p=Path('.github/workflows/wdcc-cloudflare-r2-cutover.yml')
s=p.read_text()
old='''      - name: Create or verify private R2 authority
        shell: bash
        run: |
          set -euo pipefail
          set +e
          npx wrangler r2 bucket create "$R2_BUCKET" 2>&1 | tee /tmp/r2-create.log
          rc=${PIPESTATUS[0]}
          set -e
          if [ "$rc" -ne 0 ] && ! grep -Eqi 'already exists|already been taken|exists' /tmp/r2-create.log; then
            exit "$rc"
          fi
          echo "R2_BUCKET_READY=$R2_BUCKET"
'''
new='''      - name: Create or verify private R2 authority
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p /tmp/wdcc-r2
          set +e
          npx wrangler r2 bucket list --json >/tmp/r2-buckets.json 2>/tmp/r2-list.err
          list_rc=$?
          set -e
          if [ "$list_rc" -ne 0 ]; then
            cat /tmp/r2-list.err >&2 || true
            echo "::error::R2 bucket listing failed before any mutation. The Cloudflare token must be able to read R2 for account $CLOUDFLARE_ACCOUNT_ID." >&2
            exit "$list_rc"
          fi
          if node -e 'const fs=require("fs");const b=process.argv[1];const raw=JSON.parse(fs.readFileSync("/tmp/r2-buckets.json","utf8"));const a=Array.isArray(raw)?raw:(Array.isArray(raw?.buckets)?raw.buckets:(Array.isArray(raw?.result)?raw.result:[]));process.exit(a.some(x=>String(x?.name||x?.bucket_name||"")===b)?0:1)' "$R2_BUCKET"; then
            echo "R2_BUCKET_READY=$R2_BUCKET (existing)"
          else
            set +e
            npx wrangler r2 bucket create "$R2_BUCKET" 2>&1 | tee /tmp/r2-create.log
            create_rc=${PIPESTATUS[0]}
            set -e
            if [ "$create_rc" -ne 0 ]; then
              echo "::error::R2 bucket $R2_BUCKET is absent and creation failed. See r2-create.log; no state or media was written." >&2
              exit "$create_rc"
            fi
            echo "R2_BUCKET_READY=$R2_BUCKET (created)"
          fi
'''
if old not in s:
    if 'wrangler r2 bucket list --json' in s:
        print('R2 preflight already corrected')
        raise SystemExit(0)
    raise SystemExit('R2_AUTHORITY_BLOCK_NOT_FOUND')
s=s.replace(old,new,1)
needle='''            /tmp/wdcc-seed/missing-media.json\n'''
if needle in s and '/tmp/r2-buckets.json' not in s.split('name: wdcc-cloudflare-r2-cutover-',1)[-1]:
    s=s.replace(needle,needle+'''            /tmp/r2-buckets.json\n            /tmp/r2-list.err\n            /tmp/r2-create.log\n''',1)
p.write_text(s)
print('R2 authority preflight corrected')
