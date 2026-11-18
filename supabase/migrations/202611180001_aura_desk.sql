begin;
create schema if not exists aura_private;
revoke all on schema aura_private from public, anon, authenticated;
grant usage on schema aura_private to authenticated;

create function aura_private.current_desk_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select raw_app_meta_data ->> 'aura_role' = 'admin' from auth.users where id = (select auth.uid())), false)
$$;
revoke all on function aura_private.current_desk_admin() from public, anon;
grant execute on function aura_private.current_desk_admin() to authenticated;

create table public.aura_desk_settings (
  owner uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) < 8192),
  updated_at timestamptz not null default now()
);
alter table public.aura_desk_settings enable row level security;
revoke all on public.aura_desk_settings from anon, authenticated;
grant select, insert, update on public.aura_desk_settings to authenticated;
create policy "Read own authorized settings" on public.aura_desk_settings for select to authenticated
  using ((select auth.uid()) = owner and (select aura_private.current_desk_admin()));
create policy "Insert own authorized settings" on public.aura_desk_settings for insert to authenticated
  with check ((select auth.uid()) = owner and (select aura_private.current_desk_admin()));
create policy "Update own authorized settings" on public.aura_desk_settings for update to authenticated
  using ((select auth.uid()) = owner and (select aura_private.current_desk_admin()))
  with check ((select auth.uid()) = owner and (select aura_private.current_desk_admin()));

create table aura_private.research_quota (
  id uuid primary key references auth.users(id) on delete cascade,
  period timestamptz not null,
  calls integer not null
);
create function public.aura_consume_research_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); count_now integer; hour_now timestamptz := date_trunc('hour', now(), 'UTC');
begin
  if uid is null then return false; end if;
  insert into aura_private.research_quota as quota (id, period, calls) values (uid, hour_now, 1)
  on conflict (id) do update set period = excluded.period, calls = case when quota.period <> excluded.period then 1 else quota.calls + 1 end
  where quota.period <> excluded.period or quota.calls < 20
  returning calls into count_now;
  return coalesce(count_now <= 20, false);
end $$;
revoke all on function public.aura_consume_research_quota() from public, anon;
grant execute on function public.aura_consume_research_quota() to authenticated;
commit;
