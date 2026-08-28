-- Keep signed WDCC application QA leads auditable inside the dealer tenant.
-- Legacy/unmanaged QA signatures remain quarantined with no dealer assignment.

begin;

create or replace function public.wdcc_bind_lead_defaults()
returns trigger
language plpgsql
as $function$
declare
  active_count integer;
  v_dealer uuid;
  v_source uuid;
  v_source_label text;
  tenant_bound_app_qa boolean;
begin
  tenant_bound_app_qa :=
    new.dealer_id is not null
    and coalesce(new.metadata->>'schemaVersion','')='wdcc-lead-v3'
    and lower(coalesce(new.metadata->>'qa','false'))='true'
    and lower(coalesce(new.metadata->>'suppressed','false'))='true';

  if public.wdcc_is_qa_lead_row(new.external_lead_id,new.name,new.email) then
    new.status := 'test';
    if not tenant_bound_app_qa then
      new.dealer_id := null;
      new.source_id := null;
      return new;
    end if;
  end if;

  if new.dealer_id is null then
    select count(*) into active_count from public.dealers where status='active';
    if active_count=1 then
      select id into v_dealer
      from public.dealers
      where status='active'
      order by created_at
      limit 1;
      new.dealer_id := v_dealer;
    end if;
  end if;

  if new.dealer_id is not null and new.source_id is null then
    select s.id,s.profile_label into v_source,v_source_label
    from public.sources s
    where s.dealer_id=new.dealer_id
      and s.platform='website'
      and s.profile_type='direct'
    order by s.created_at
    limit 1;
    if v_source is not null then
      new.source_id := v_source;
      if coalesce(btrim(new.source_label),'')='' then
        new.source_label := coalesce(v_source_label,'Website Direct');
      end if;
    end if;
  elsif new.source_id is not null and coalesce(btrim(new.source_label),'')='' then
    select s.profile_label into v_source_label from public.sources s where s.id=new.source_id;
    if v_source_label is not null then
      new.source_label := v_source_label;
    end if;
  end if;

  return new;
end;
$function$;

comment on function public.wdcc_bind_lead_defaults() is
  'Binds operational and signed wdcc-lead-v3 QA leads to a dealer; legacy QA signatures remain unassigned.';

do $$
begin
  if exists(
    select 1 from pg_trigger
    where tgrelid='public.leads'::regclass
      and not tgisinternal and tgname='wdcc_tenant_bound_lead_defaults_before_insert_v3'
  ) then
    alter table public.leads enable trigger wdcc_tenant_bound_lead_defaults_before_insert_v3;
  elsif not exists(
    select 1
    from pg_trigger trigger_state
    join pg_proc trigger_function on trigger_function.oid=trigger_state.tgfoid
    join pg_namespace function_namespace on function_namespace.oid=trigger_function.pronamespace
    where trigger_state.tgrelid='public.leads'::regclass
      and not trigger_state.tgisinternal and trigger_state.tgenabled<>'D'
      and function_namespace.nspname='public' and trigger_function.proname='wdcc_bind_lead_defaults'
  ) then
    create trigger wdcc_tenant_bound_lead_defaults_before_insert_v3
      before insert on public.leads
      for each row execute function public.wdcc_bind_lead_defaults();
  end if;
end $$;

commit;
