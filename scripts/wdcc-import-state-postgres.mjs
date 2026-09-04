#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {get} from '@vercel/blob';
import {neon} from '@neondatabase/serverless';

const APPLY=process.env.APPLY==='1';
const databaseUrl=String(process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||'').trim();
const sourceFile=String(process.env.WDCC_STATE_IMPORT_FILE||'').trim();
const sourcePath=String(process.env.WDCC_STATE_IMPORT_PATH||'private/state/platform-v3.json').trim();
const sourceStore=String(process.env.WDCC_CANONICAL_BLOB_STORE_ID||'store_cNUyQRVlXtyvZQ5N').trim();
const oidcToken=String(process.env.VERCEL_OIDC_TOKEN||'').trim();
const expectedRevision=Number(process.env.WDCC_IMPORT_EXPECTED_REVISION||640);
const expectedSourceSha=String(process.env.WDCC_IMPORT_EXPECTED_SOURCE_SHA256||'').trim().toLowerCase();
const allowReplace=process.env.WDCC_IMPORT_ALLOW_REPLACE==='1';

if(!databaseUrl)throw Error('WDCC_DATABASE_URL_MISSING');

function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  return value;
}
function semanticChecksum(value){
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}
function normalize(value){
  return {
    ...value,
    revision:Number(value?.revision||0),
    tenants:Array.isArray(value?.tenants)?value.tenants:[],
    users:Array.isArray(value?.users)?value.users:[],
    vehicles:Array.isArray(value?.vehicles)?value.vehicles:[],
    leads:Array.isArray(value?.leads)?value.leads:[],
    audit:Array.isArray(value?.audit)?value.audit:[]
  };
}
async function readBlob(pathname){
  if(!oidcToken)throw Error('VERCEL_OIDC_TOKEN_MISSING');
  const response=await get(pathname,{access:'private',useCache:false,oidcToken,storeId:sourceStore});
  if(!response||response.statusCode!==200||!response.stream)throw Error(`SOURCE_BLOB_READ_FAILED:${pathname}`);
  const chunks=[];
  for await(const chunk of response.stream)chunks.push(chunk);
  return Buffer.concat(chunks);
}

const raw=sourceFile?await fs.readFile(sourceFile):await readBlob(sourcePath);
const sourceSha=crypto.createHash('sha256').update(raw).digest('hex');
if(expectedSourceSha&&sourceSha!==expectedSourceSha)throw Error('SOURCE_SHA256_MISMATCH');

const state=normalize(JSON.parse(raw.toString('utf8')));
if(!Number.isFinite(state.revision)||state.revision<expectedRevision)throw Error(`SOURCE_REVISION_TOO_OLD:${state.revision}`);
if(!Array.isArray(state.users)||!Array.isArray(state.vehicles)||!Array.isArray(state.leads)||!Array.isArray(state.audit))throw Error('SOURCE_STATE_CONTRACT_INVALID');

const targetChecksum=semanticChecksum(state);
const sourceProvider=sourceFile?'file':'vercel-blob';
const sourceLocator=sourceFile?sourceFile:`${sourceStore}:${sourcePath}`;
const counts={users:state.users.length,vehicles:state.vehicles.length,leads:state.leads.length,audit:state.audit.length,tenants:state.tenants.length};
const sql=neon(databaseUrl);
const current=await sql.query('SELECT revision,checksum_sha256 FROM public.wdcc_platform_state WHERE singleton_id=1 LIMIT 1',[]);
const existing=current[0]||null;

const plan={
  ok:true,
  apply:APPLY,
  sourceProvider,
  sourceLocator,
  sourceRevision:state.revision,
  sourceSha256:sourceSha,
  targetChecksumSha256:targetChecksum,
  counts,
  existing:existing?{revision:Number(existing.revision||0),checksumSha256:String(existing.checksum_sha256||'')}:null,
  action:existing?(Number(existing.revision||0)===state.revision&&String(existing.checksum_sha256||'')===targetChecksum?'noop':'replace'):'import'
};
console.log('WDCC_STATE_IMPORT_PLAN='+JSON.stringify(plan));

if(!APPLY)process.exit(0);
if(plan.action==='noop'){
  console.log('WDCC_STATE_IMPORT_RESULT='+JSON.stringify({ok:true,noOp:true,revision:state.revision,checksumSha256:targetChecksum}));
  process.exit(0);
}
if(existing&&!allowReplace)throw Error('TARGET_STATE_EXISTS_SET_WDCC_IMPORT_ALLOW_REPLACE_1');
if(existing&&Number(existing.revision||0)>state.revision)throw Error('TARGET_REVISION_NEWER_THAN_SOURCE');

const confirm=String(process.env.WDCC_IMPORT_CONFIRM||'').trim();
if(confirm!==`IMPORT_WDCC_STATE_${state.revision}`)throw Error(`IMPORT_CONFIRMATION_REQUIRED:IMPORT_WDCC_STATE_${state.revision}`);

const evidence=JSON.stringify({counts,sourceSha256:sourceSha,targetChecksumSha256:targetChecksum});
const rows=await sql.query(
  `WITH upserted AS (
     INSERT INTO public.wdcc_platform_state(
       singleton_id,revision,state,checksum_sha256,source_provider,source_locator,source_revision,source_checksum_sha256,imported_at,updated_at
     ) VALUES (1,$1,$2::jsonb,$3,$4,$5,$1,$6,now(),now())
     ON CONFLICT (singleton_id) DO UPDATE SET
       revision=EXCLUDED.revision,
       state=EXCLUDED.state,
       checksum_sha256=EXCLUDED.checksum_sha256,
       source_provider=EXCLUDED.source_provider,
       source_locator=EXCLUDED.source_locator,
       source_revision=EXCLUDED.source_revision,
       source_checksum_sha256=EXCLUDED.source_checksum_sha256,
       imported_at=now(),
       updated_at=now()
     WHERE public.wdcc_platform_state.revision <= EXCLUDED.revision
     RETURNING revision
   ), history AS (
     INSERT INTO public.wdcc_platform_state_history(
       revision,state,checksum_sha256,source_provider,source_locator,source_revision,source_checksum_sha256,cause
     ) SELECT $1,$2::jsonb,$3,$4,$5,$1,$6,'import' FROM upserted
     ON CONFLICT (revision,checksum_sha256) DO NOTHING
     RETURNING revision
   ), evidence AS (
     INSERT INTO public.wdcc_platform_state_imports(
       source_provider,source_locator,source_revision,source_checksum_sha256,target_revision,target_checksum_sha256,status,evidence,verified_at,imported_at
     ) SELECT $4,$5,$1,$6,$1,$3,'imported',$7::jsonb,now(),now() FROM upserted
     RETURNING import_id
   )
   SELECT revision FROM upserted`,
  [state.revision,JSON.stringify(state),targetChecksum,sourceProvider,sourceLocator,sourceSha,evidence]
);
if(!rows.length)throw Error('IMPORT_ATOMIC_UPSERT_FAILED');

const verify=await sql.query('SELECT revision,state,checksum_sha256 FROM public.wdcc_platform_state WHERE singleton_id=1 LIMIT 1',[]);
if(!verify.length)throw Error('IMPORT_READBACK_MISSING');
const verifyState=normalize(verify[0].state);
const verifyChecksum=semanticChecksum(verifyState);
if(Number(verify[0].revision)!==state.revision||verifyChecksum!==targetChecksum||String(verify[0].checksum_sha256)!==targetChecksum)throw Error('IMPORT_READBACK_MISMATCH');

console.log('WDCC_STATE_IMPORT_RESULT='+JSON.stringify({ok:true,noOp:false,revision:state.revision,checksumSha256:targetChecksum,counts}));
