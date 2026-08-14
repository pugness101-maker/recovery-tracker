import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('Settings Account & Data keeps local backup controls and has no Cloud Sync UI', () => {
    const html = read('index.html');
    assert.match(html, /Account &amp; Data/);
    assert.match(html, /Data &amp; Backup/);
    assert.match(html, /Export JSON Backup/);
    assert.match(html, /Import JSON Backup/);
    assert.match(html, /Restore Last Backup/);
    assert.match(html, /Export CSV/);
    assert.doesNotMatch(html, /onclick="repairAppData\(\)"/);
    assert.match(html, /Data Health/);
    assert.match(html, /Repair all safe issues/);
    assert.match(html, /restoreLastAutoBackup\(\)/);
    assert.match(html, /id="settings-last-saved"/);

    assert.doesNotMatch(html, /Cloud Sync/);
    assert.doesNotMatch(html, /id="settings-cloud-sync"/);
    assert.doesNotMatch(html, /id="cloud-sync-root"/);
    assert.doesNotMatch(html, /Sign [Ii]n/);
    assert.doesNotMatch(html, /Create [Aa]ccount/);
    assert.doesNotMatch(html, /Forgot [Pp]assword/);
    assert.doesNotMatch(html, /cloud-config\.js/);
    assert.doesNotMatch(html, /supabase/i);
    assert.doesNotMatch(html, /Delete Cloud Data/);
    assert.doesNotMatch(html, /Delete Account/);
    assert.doesNotMatch(html, /confirmDeleteCloudData/);
    assert.doesNotMatch(html, /confirmDeleteAccount/);
    assert.match(html, /Delete data from this device/);
    assert.match(html, /<script src="app\.js" defer><\/script>/);
});

test('app.js has no Supabase client, auth, or cloud sync hooks', () => {
    const src = read('app.js');
    assert.doesNotMatch(src, /supabase/i);
    assert.doesNotMatch(src, /initCloudSync/);
    assert.doesNotMatch(src, /createSupabaseCloudTransport/);
    assert.doesNotMatch(src, /cloudSignUp|cloudSignIn|cloudSignOut/);
    assert.doesNotMatch(src, /onLocalDataSaved/);
    assert.doesNotMatch(src, /__RECOVERY_TRACKER_CLOUD__/);
    assert.doesNotMatch(src, /\/auth\/v1\//);
    assert.doesNotMatch(src, /function saveData\(data\)[\s\S]*onLocalDataSaved/);

    const start = src.indexOf('function initializeApp()');
    const end = src.indexOf('function refreshAppAfterDataChange()');
    const body = src.slice(start, end);
    assert.match(body, /persistLoadedAppDataIfNeeded\(\)/);
    assert.doesNotMatch(body, /initCloudSync/);
});

test('localStorage save/load still works without cloud sync', () => {
    const rt = loadRecoveryTrackerApp();
    const data = makeTestData([
        makeUseLog({ id: 'keep-local', substanceId: 'weed-thc', date: '2026-08-01', amount: 0.5 })
    ]);
    rt.__setTestAppData(data);
    assert.equal(rt.saveData(data), true);
    const snap = rt.__getStorageSnapshot();
    assert.ok(snap);
    const stored = JSON.parse(snap);
    assert.equal(stored.logs.length, 1);
    assert.equal(stored.logs[0].id, 'keep-local');
    const reloaded = rt.loadData();
    assert.equal(reloaded.logs.some(log => log.id === 'keep-local' || String(log.id) === 'keep-local'), true);
});
