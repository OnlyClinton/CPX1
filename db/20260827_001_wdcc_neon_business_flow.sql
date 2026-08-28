-- WDCC normalized vehicle, lead, and notification authority.
-- Idempotent by construction; run on an isolated Neon branch before promotion.

begin;

alter table public.vehicles
  add column if not exists condition text,
  add column if not exists exterior_color text,
  add column if not exists interior_color text,
  add column if not exists drivetrain text,
  add column if not exists description text,
  add column if not exists visibility text not null default 'public',
  add column if not exists internal_only boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists upload_source text;

alter table public.leads
  add column if not exists monthly_income numeric,
  add column if not exists down_payment numeric,
  add column if not exists referral_source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.wdcc_outbox_events (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references public.dealers(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

alter table public.wdcc_outbox_events
  add column if not exists dealer_id uuid,
  add column if not exists aggregate_type text,
  add column if not exists aggregate_id uuid,
  add column if not exists event_type text,
  add column if not exists idempotency_key text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists attempts integer not null default 0,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  if exists(
    select 1 from public.wdcc_outbox_events
    where id is null or dealer_id is null or aggregate_type is null or aggregate_id is null
       or event_type is null or idempotency_key is null or payload is null or status is null
       or attempts is null or available_at is null or created_at is null or updated_at is null
  ) then
    raise exception 'WDCC_OUTBOX_NULL_CONTRACT_VIOLATION';
  end if;
end $$;

alter table public.wdcc_outbox_events
  alter column id set default gen_random_uuid(),
  alter column dealer_id set not null,
  alter column aggregate_type set not null,
  alter column aggregate_id set not null,
  alter column event_type set not null,
  alter column idempotency_key set not null,
  alter column payload set default '{}'::jsonb,
  alter column payload set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column attempts set default 0,
  alter column attempts set not null,
  alter column available_at set default now(),
  alter column available_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.wdcc_outbox_events'::regclass and contype='p'
  ) then
    alter table public.wdcc_outbox_events
      add constraint wdcc_outbox_events_pkey primary key(id);
  end if;
  if not exists(
    select 1
    from pg_constraint constraint_state
    join pg_attribute local_column
      on local_column.attrelid=constraint_state.conrelid and local_column.attname='dealer_id'
     and local_column.attnum=any(constraint_state.conkey)
    join pg_attribute foreign_column
      on foreign_column.attrelid=constraint_state.confrelid and foreign_column.attname='id'
     and foreign_column.attnum=any(constraint_state.confkey)
    where constraint_state.conrelid='public.wdcc_outbox_events'::regclass
      and constraint_state.confrelid='public.dealers'::regclass
      and constraint_state.contype='f'
  ) then
    alter table public.wdcc_outbox_events
      add constraint wdcc_outbox_events_dealer_fk
      foreign key(dealer_id) references public.dealers(id) on delete cascade not valid;
  end if;
end $$;

create unique index if not exists wdcc_leads_dealer_idempotency_uidx
  on public.leads(dealer_id,idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key)<>'';

create index if not exists wdcc_leads_kind_created_idx
  on public.leads(dealer_id,lead_kind,created_at desc);

create index if not exists wdcc_vehicles_public_inventory_idx
  on public.vehicles(dealer_id,updated_at desc)
  where status in ('available','published') and internal_only=false and visibility='public';

create unique index if not exists wdcc_outbox_events_idempotency_uidx
  on public.wdcc_outbox_events(idempotency_key);

create index if not exists wdcc_outbox_events_delivery_idx
  on public.wdcc_outbox_events(status,available_at,created_at)
  where aggregate_type='lead' and event_type='lead.email.requested';

create index if not exists wdcc_outbox_events_aggregate_created_idx
  on public.wdcc_outbox_events(aggregate_type,aggregate_id,created_at desc);

create index if not exists wdcc_events_lead_timeline_idx
  on public.events(lead_id,occurred_at desc)
  where lead_id is not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='wdcc_vehicles_visibility_check' and conrelid='public.vehicles'::regclass) then
    alter table public.vehicles
      add constraint wdcc_vehicles_visibility_check
      check (visibility in ('public','internal','dealer_only')) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='wdcc_leads_monthly_income_check' and conrelid='public.leads'::regclass) then
    alter table public.leads
      add constraint wdcc_leads_monthly_income_check
      check (monthly_income is null or monthly_income>=0) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='wdcc_leads_down_payment_check' and conrelid='public.leads'::regclass) then
    alter table public.leads
      add constraint wdcc_leads_down_payment_check
      check (down_payment is null or down_payment>=0) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='wdcc_outbox_status_check_v1' and conrelid='public.wdcc_outbox_events'::regclass) then
    alter table public.wdcc_outbox_events
      add constraint wdcc_outbox_status_check_v1
      check (status in ('pending','processing','delivered','failed','dead_letter')) not valid;
  end if;
end $$;

alter table public.vehicles validate constraint wdcc_vehicles_visibility_check;
alter table public.leads validate constraint wdcc_leads_monthly_income_check;
alter table public.leads validate constraint wdcc_leads_down_payment_check;
alter table public.wdcc_outbox_events validate constraint wdcc_outbox_status_check_v1;

do $$
declare
  dealer_fk_name text;
begin
  select constraint_state.conname into dealer_fk_name
  from pg_constraint constraint_state
  join pg_attribute local_column
    on local_column.attrelid=constraint_state.conrelid and local_column.attname='dealer_id'
   and local_column.attnum=any(constraint_state.conkey)
  join pg_attribute foreign_column
    on foreign_column.attrelid=constraint_state.confrelid and foreign_column.attname='id'
   and foreign_column.attnum=any(constraint_state.confkey)
  where constraint_state.conrelid='public.wdcc_outbox_events'::regclass
    and constraint_state.confrelid='public.dealers'::regclass
    and constraint_state.contype='f'
  order by constraint_state.oid
  limit 1;
  if dealer_fk_name is null then
    raise exception 'WDCC_OUTBOX_DEALER_FK_MISSING';
  end if;
  execute format('alter table public.wdcc_outbox_events validate constraint %I',dealer_fk_name);
end $$;

comment on column public.leads.metadata is
  'Versioned source/UTM/QA metadata for the WDCC public lead contract; never stores provider credentials.';
comment on table public.wdcc_outbox_events is
  'Durable post-commit delivery queue. Lead creation and email request enqueue occur in one SQL statement.';

commit;
