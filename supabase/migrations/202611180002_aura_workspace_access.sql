begin;
-- AuraTrade-only grants. The shared project's Auth users and policies for other apps are not modified.
create table aura_private.desk_leads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table aura_private.desk_leads enable row level security;
revoke all on aura_private.desk_leads from public, anon, authenticated;

create or replace function aura_private.current_desk_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users as u
    where u.id = (select auth.uid()) and u.deleted_at is null
      and not coalesce(u.is_anonymous, false) and (u.banned_until is null or u.banned_until <= now())
      and (u.raw_app_meta_data ->> 'aura_role' = 'admin'
        or exists (select 1 from aura_private.desk_leads as lead where lead.user_id = u.id))
  );
$$;
revoke all on function aura_private.current_desk_admin() from public, anon;
grant execute on function aura_private.current_desk_admin() to authenticated;

-- Use the same decision in Node, settings RLS, and the role switcher. Never read user-editable metadata.
create function public.aura_workspace_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', case when desk_admin then 'admin' else 'member' end,
    'canUseGroq', desk_admin or coalesce(u.raw_app_meta_data -> 'aura_ai' = 'true'::jsonb, false)
  )
  from auth.users as u
  cross join lateral (select aura_private.current_desk_admin() as desk_admin) as access
  where u.id = (select auth.uid()) and u.deleted_at is null
    and not coalesce(u.is_anonymous, false) and (u.banned_until is null or u.banned_until <= now());
$$;
revoke all on function public.aura_workspace_access() from public, anon;
grant execute on function public.aura_workspace_access() to authenticated;

-- A valid account alone does not reserve calls or write quota rows.
create or replace function public.aura_consume_research_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); count_now integer; hour_now timestamptz := date_trunc('hour', now(), 'UTC');
begin
  if uid is null or not coalesce((public.aura_workspace_access() ->> 'canUseGroq')::boolean, false) then return false; end if;
  insert into aura_private.research_quota as quota (id, period, calls) values (uid, hour_now, 1)
  on conflict (id) do update set period = excluded.period, calls = case when quota.period <> excluded.period then 1 else quota.calls + 1 end
  where quota.period <> excluded.period or quota.calls < 20
  returning calls into count_now;
  return coalesce(count_now <= 20, false);
end $$;
commit;
