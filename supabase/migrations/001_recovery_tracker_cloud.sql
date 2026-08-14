-- Recovery Tracker cloud schema
-- Apply in the Supabase SQL editor (or CLI) on a NEW project before enabling production sync.
-- Do not deploy with the service-role key in the client.

-- Every table is owned by auth.uid(). RLS is required; client filtering is not enough.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
    user_id uuid primary key references auth.users (id) on delete cascade,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    sync_version bigint not null default 1
);

-- Collection rows: stable id + user ownership + tombestone-friendly delete
create table if not exists public.substances (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.use_logs (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.purchases (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.taper_plans (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.contacts (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.cravings (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

create table if not exists public.budgets (
    user_id uuid not null references auth.users (id) on delete cascade,
    id text not null,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sync_version bigint not null default 1,
    primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.substances enable row level security;
alter table public.use_logs enable row level security;
alter table public.purchases enable row level security;
alter table public.taper_plans enable row level security;
alter table public.contacts enable row level security;
alter table public.cravings enable row level security;
alter table public.budgets enable row level security;

-- RLS: users may only access their own rows
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "substances_own" on public.substances;
create policy "substances_own" on public.substances
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "use_logs_own" on public.use_logs;
create policy "use_logs_own" on public.use_logs
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "purchases_own" on public.purchases;
create policy "purchases_own" on public.purchases
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "taper_plans_own" on public.taper_plans;
create policy "taper_plans_own" on public.taper_plans
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "contacts_own" on public.contacts;
create policy "contacts_own" on public.contacts
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "cravings_own" on public.cravings;
create policy "cravings_own" on public.cravings
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "budgets_own" on public.budgets;
create policy "budgets_own" on public.budgets
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- Authenticated users can wipe their own cloud rows (not Auth user deletion).
create or replace function public.delete_own_cloud_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not authenticated';
    end if;
    delete from public.budgets where user_id = uid;
    delete from public.cravings where user_id = uid;
    delete from public.contacts where user_id = uid;
    delete from public.taper_plans where user_id = uid;
    delete from public.purchases where user_id = uid;
    delete from public.use_logs where user_id = uid;
    delete from public.substances where user_id = uid;
    delete from public.user_settings where user_id = uid;
    delete from public.profiles where user_id = uid;
end;
$$;

revoke all on function public.delete_own_cloud_data() from public;
grant execute on function public.delete_own_cloud_data() to authenticated;

create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not authenticated';
    end if;
    insert into public.profiles (user_id)
    values (uid)
    on conflict (user_id) do update set updated_at = now();
end;
$$;

revoke all on function public.ensure_own_profile() from public;
grant execute on function public.ensure_own_profile() to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.substances to authenticated;
grant select, insert, update, delete on public.use_logs to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;
grant select, insert, update, delete on public.taper_plans to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.cravings to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;

-- Manual RLS verification (Supabase SQL editor, two test users A and B):
-- 1. Confirm: select relrowsecurity from pg_class where relname in
--    ('profiles','user_settings','substances','use_logs','purchases','taper_plans','contacts','cravings','budgets');
--    all true.
-- 2. As user A, insert a use_logs row with user_id = auth.uid().
-- 3. As user B, `select * from public.use_logs` must not return A's row.
-- 4. As user B, inserting a row with user_id = A's uuid must fail the WITH CHECK policy.
-- 5. There is no goals table. PIN hashes must never be stored in user_settings.payload.
