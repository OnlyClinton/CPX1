import crypto from "node:crypto";
import {neon} from "@neondatabase/serverless";
import type {State} from "./store";

function databaseUrl(){
  return String(process.env.WDCC_DATABASE_URL||process.env.DATABASE_URL||"").trim();
}

export function postgresStateConfigured(){
  return Boolean(databaseUrl());
}

function normalize(value:any):State{
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

function canonicalize(value:any):any{
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  }
  return value;
}

export function postgresStateChecksum(state:State){
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(state))).digest("hex");
}

function sqlClient(){
  const url=databaseUrl();
  if(!url)throw Error("STATE_POSTGRES_URL_MISSING");
  return neon(url);
}

export async function readPostgresState():Promise<State>{
  const sql=sqlClient();
  const rows:any[]=await sql.query(
    "SELECT revision,state,checksum_sha256 FROM public.wdcc_platform_state WHERE singleton_id=1 LIMIT 1",
    []
  ) as any[];
  if(!rows.length)throw Error("STATE_POSTGRES_EMPTY");

  const revision=Number(rows[0]?.revision||0);
  const state=normalize(rows[0]?.state||{});
  if(state.revision!==revision)throw Error("STATE_POSTGRES_REVISION_MISMATCH");
  const checksum=postgresStateChecksum(state);
  if(checksum!==String(rows[0]?.checksum_sha256||""))throw Error("STATE_POSTGRES_CHECKSUM_MISMATCH");
  return state;
}

export async function writePostgresState(input:State):Promise<State>{
  const expectedRevision=Number(input?.revision||0);
  const nextRevision=expectedRevision+1;
  const now=new Date().toISOString();
  const state=normalize({...input,revision:nextRevision,updatedAt:now});
  const checksum=postgresStateChecksum(state);
  const sourceLocator=String(process.env.WDCC_DATABASE_SOURCE_LABEL||"wdcc-neon").trim()||"wdcc-neon";
  const sql=sqlClient();

  const rows:any[]=await sql.query(
    `WITH gate AS (
       SELECT 1 AS ok
       WHERE EXISTS (
         SELECT 1 FROM public.wdcc_platform_state
         WHERE singleton_id=1 AND revision=$1
       ) OR (
         $1=0 AND NOT EXISTS (
           SELECT 1 FROM public.wdcc_platform_state WHERE singleton_id=1
         )
       )
     ), upserted AS (
       INSERT INTO public.wdcc_platform_state(
         singleton_id,revision,state,checksum_sha256,source_provider,source_locator,source_revision,updated_at
       )
       SELECT 1,$2,$3::jsonb,$4,'postgres',$5,$2,now() FROM gate
       ON CONFLICT (singleton_id) DO UPDATE SET
         revision=EXCLUDED.revision,
         state=EXCLUDED.state,
         checksum_sha256=EXCLUDED.checksum_sha256,
         source_provider=EXCLUDED.source_provider,
         source_locator=EXCLUDED.source_locator,
         source_revision=EXCLUDED.source_revision,
         updated_at=now()
       WHERE public.wdcc_platform_state.revision=$1
       RETURNING revision
     ), history AS (
       INSERT INTO public.wdcc_platform_state_history(
         revision,state,checksum_sha256,source_provider,source_locator,source_revision,cause
       )
       SELECT $2,$3::jsonb,$4,'postgres',$5,$2,'write' FROM upserted
       ON CONFLICT (revision,checksum_sha256) DO NOTHING
       RETURNING revision
     )
     SELECT revision FROM upserted`,
    [expectedRevision,nextRevision,JSON.stringify(state),checksum,sourceLocator]
  ) as any[];

  if(!rows.length)throw Error("STATE_WRITE_CONFLICT");
  return state;
}
