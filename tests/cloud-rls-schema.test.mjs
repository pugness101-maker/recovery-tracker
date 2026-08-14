import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(root, 'supabase/migrations');
const sql001 = fs.readFileSync(
    path.join(migrationsDir, '001_recovery_tracker_cloud.sql'),
    'utf8'
);
const sql002 = fs.readFileSync(
    path.join(migrationsDir, '002_secure_definer_privileges.sql'),
    'utf8'
);
const allSql = `${sql001}\n${sql002}`;

const TABLES = [
    'profiles',
    'user_settings',
    'substances',
    'use_logs',
    'purchases',
    'taper_plans',
    'contacts',
    'cravings',
    'budgets'
];

function functionBody(sql, name) {
    const start = sql.indexOf(`create or replace function public.${name}()`);
    assert.ok(start >= 0, `${name} must be defined`);
    const end = sql.indexOf('$$;', start);
    assert.ok(end > start, `${name} body must close`);
    return sql.slice(start, end);
}

function grantsAfterLastRevoke(sql, fnName, role) {
    const needle = `function public.${fnName}()`;
    const grant = `grant execute on function public.${fnName}() to ${role}`;
    const revoke = `revoke all on function public.${fnName}() from ${role}`;
    const lastGrant = sql.toLowerCase().lastIndexOf(grant);
    const lastRevoke = sql.toLowerCase().lastIndexOf(revoke);
    return { lastGrant, lastRevoke, hasGrant: lastGrant >= 0, hasRevoke: lastRevoke >= 0 };
}

test('migration enables RLS on every user-owned table', () => {
    TABLES.forEach(table => {
        const enabled = new RegExp(`alter table public\\.${table} enable row level security;`, 'i');
        assert.match(sql001, enabled, `${table} must enable RLS`);
    });
});

test('migration scopes every table to user_id = auth.uid()', () => {
    TABLES.forEach(table => {
        const policy = new RegExp(
            `create policy "${table}_own"[\\s\\S]*?using \\(user_id = auth\\.uid\\(\\)\\)[\\s\\S]*?with check \\(user_id = auth\\.uid\\(\\)\\)`,
            'i'
        );
        assert.match(sql001, policy, `${table} must use user_id = auth.uid()`);
    });
});

test('migration does not create a goals table and does not grant tables to anon', () => {
    assert.doesNotMatch(sql001, /create table if not exists public\.goals/i);
    assert.doesNotMatch(allSql, /grant select, insert, update, delete on public\.\w+ to anon/i);
});

test('delete_own_cloud_data is the only client SECURITY DEFINER RPC', () => {
    const body = functionBody(sql001, 'delete_own_cloud_data');
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /uid uuid := auth\.uid\(\)/);
    assert.match(body, /if uid is null/);
    TABLES.forEach(table => {
        assert.match(body, new RegExp(`delete from public\\.${table} where user_id = uid`, 'i'));
    });

    const auth = grantsAfterLastRevoke(sql001, 'delete_own_cloud_data', 'authenticated');
    assert.equal(auth.hasRevoke, true);
    assert.equal(auth.hasGrant, true);
    assert.ok(auth.lastGrant > auth.lastRevoke, 'authenticated EXECUTE must be re-granted after revoke');

    ['public', 'anon'].forEach(role => {
        const info = grantsAfterLastRevoke(sql001, 'delete_own_cloud_data', role);
        assert.equal(info.hasRevoke, true, `must revoke ${role} on delete_own_cloud_data`);
        assert.equal(info.hasGrant, false, `must not grant ${role} on delete_own_cloud_data`);
    });
});

test('ensure_own_profile is not callable by public, anon, or authenticated', () => {
    const body = functionBody(sql001, 'ensure_own_profile');
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /uid uuid := auth\.uid\(\)/);
    assert.match(body, /insert into public\.profiles/);
    assert.match(body, /pg_catalog\.now\(\)/);

    ['public', 'anon', 'authenticated'].forEach(role => {
        const info = grantsAfterLastRevoke(sql001, 'ensure_own_profile', role);
        assert.equal(info.hasRevoke, true, `must revoke ${role} on ensure_own_profile`);
        assert.equal(
            info.hasGrant && info.lastGrant > info.lastRevoke,
            false,
            `must not leave EXECUTE on ensure_own_profile for ${role}`
        );
    });
});

test('rls_auto_enable execute is revoked from public, anon, and authenticated', () => {
    [sql001, sql002].forEach(sql => {
        assert.match(sql, /proname = 'rls_auto_enable'/);
        assert.match(sql, /revoke all on function %s from public/);
        assert.match(sql, /revoke all on function %s from anon/);
        assert.match(sql, /revoke all on function %s from authenticated/);
        assert.match(sql, /alter function %s set search_path/);
    });
});

test('002 re-applies the same privilege fixes idempotently', () => {
    assert.match(sql002, /create or replace function public\.delete_own_cloud_data\(\)/);
    assert.match(sql002, /create or replace function public\.ensure_own_profile\(\)/);
    assert.match(sql002, /set search_path = ''/);
    assert.match(sql002, /grant execute on function public\.delete_own_cloud_data\(\) to authenticated/);
    assert.doesNotMatch(
        sql002,
        /grant execute on function public\.ensure_own_profile\(\) to authenticated/
    );
    assert.match(sql002, /revoke all on function public\.ensure_own_profile\(\) from authenticated/);
});
