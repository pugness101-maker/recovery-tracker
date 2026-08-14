import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sql = fs.readFileSync(
    path.join(root, 'supabase/migrations/001_recovery_tracker_cloud.sql'),
    'utf8'
);

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

test('migration enables RLS on every user-owned table', () => {
    TABLES.forEach(table => {
        const enabled = new RegExp(`alter table public\\.${table} enable row level security;`, 'i');
        assert.match(sql, enabled, `${table} must enable RLS`);
    });
});

test('migration scopes every table to user_id = auth.uid()', () => {
    TABLES.forEach(table => {
        const policy = new RegExp(
            `create policy "${table}_own"[\\s\\S]*?using \\(user_id = auth\\.uid\\(\\)\\)[\\s\\S]*?with check \\(user_id = auth\\.uid\\(\\)\\)`,
            'i'
        );
        assert.match(sql, policy, `${table} must use user_id = auth.uid()`);
    });
});

test('migration does not create a goals table and does not grant tables to anon', () => {
    assert.doesNotMatch(sql, /create table if not exists public\.goals/i);
    assert.doesNotMatch(sql, /grant select, insert, update, delete on public\.\w+ to anon/i);
});
