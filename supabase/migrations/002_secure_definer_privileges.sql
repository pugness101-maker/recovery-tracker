-- Idempotent privilege fix for projects that already applied 001_recovery_tracker_cloud.sql.
-- Safe to re-run. Fresh deploys that apply 001 then 002 get the same end state.

-- Client RPC: Delete Cloud Data. Authenticated EXECUTE is required by the app.
create or replace function public.delete_own_cloud_data()
returns void
language plpgsql
security definer
set search_path = ''
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
revoke all on function public.delete_own_cloud_data() from anon;
revoke all on function public.delete_own_cloud_data() from authenticated;
grant execute on function public.delete_own_cloud_data() to authenticated;

-- Not a client RPC. Revoke leftover 001 grants to authenticated/anon/public.
create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not authenticated';
    end if;
    insert into public.profiles (user_id)
    values (uid)
    on conflict (user_id) do update set updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.ensure_own_profile() from public;
revoke all on function public.ensure_own_profile() from anon;
revoke all on function public.ensure_own_profile() from authenticated;

-- Internal event-trigger helper. Never expose via PostgREST.
do $revoke_rls_auto_enable$
declare
    fn_sig text;
begin
    for fn_sig in
        select p.oid::regprocedure::text
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'rls_auto_enable'
    loop
        execute format('revoke all on function %s from public', fn_sig);
        execute format('revoke all on function %s from anon', fn_sig);
        execute format('revoke all on function %s from authenticated', fn_sig);
        begin
            execute format('alter function %s set search_path = ''''', fn_sig);
        exception
            when insufficient_privilege then
                null;
            when undefined_function then
                null;
        end;
    end loop;
end;
$revoke_rls_auto_enable$;
