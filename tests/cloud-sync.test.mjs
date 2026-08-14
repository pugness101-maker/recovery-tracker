import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function weedSubstance() {
    return {
        id: 'weed-thc',
        name: 'Weed/THC',
        icon: '🌿',
        trackingMode: 'weed',
        primaryUnit: 'grams',
        defaultUnit: 'grams',
        units: ['grams'],
        active: true,
        isMain: true,
        taperTrackingEnabled: true
    };
}

function seedApp(rt, extra = {}) {
    const log = extra.log || makeUseLog({
        id: extra.logId || 'log-local-1',
        substanceId: 'weed-thc',
        date: '2026-08-01',
        amount: 1
    });
    log.createdAt = extra.createdAt || '2026-08-01T12:00:00.000Z';
    log.updatedAt = extra.updatedAt || log.createdAt;
    const data = makeTestData([log], [weedSubstance()]);
    data.taperPlansV2 = extra.taperPlansV2 || [];
    data.purchases = extra.purchases || [];
    data.settings = {
        ...data.settings,
        experienceMode: 'simple',
        simpleModePrefs: extra.simpleModePrefs || {
            lastSubstanceId: 'weed-thc',
            bySubstance: {
                'weed-thc': { amount: 1, unit: 'grams' }
            }
        },
        updatedAt: extra.settingsUpdatedAt || '2026-08-01T12:00:00.000Z'
    };
    if (extra.goals) data.goals = extra.goals;
    rt.__setTestAppData(data);
    rt.saveData(data);
    rt.cancelQueuedCloudSync?.();
    return rt.__getTestAppData();
}

function connectCloud(rt, options = {}) {
    const transport = rt.createMemoryCloudTransport({ configured: true, online: options.online !== false });
    rt.setCloudTransportForTests(transport);
    return transport;
}

async function signUpWithLocalData(rt, email = 'user@example.com') {
    const transport = connectCloud(rt);
    const result = await rt.cloudSignUp(email, 'password123');
    rt.cancelQueuedCloudSync();
    return { transport, result };
}

test('app still works while signed out', () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt);
    assert.equal(rt.getCloudAuthState().signedIn, false);
    const status = rt.getCloudSyncStatus();
    assert.equal(status.signedIn, false);
    assert.equal(status.label, 'Saved');
    const stored = JSON.parse(rt.__getStorageSnapshot());
    assert.equal(stored.logs[0].id, 'log-local-1');
    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(reloaded.logs.length, 1);
    assert.equal(reloaded.logs[0].amount, 1);
});

test('app still works offline', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt);
    const transport = connectCloud(rt);
    await rt.cloudSignUp('offline@example.com', 'password123');
    rt.cancelQueuedCloudSync();
    if (rt.getCloudSyncStatus().pendingBackupOffer) {
        await rt.backupLocalDataToAccount();
    }
    transport.setOnline(false);
    const before = rt.__getTestAppData().logs.length;
    rt.__getTestAppData().logs.push(makeUseLog({
        id: 'log-offline-2',
        substanceId: 'weed-thc',
        date: '2026-08-02',
        amount: 2
    }));
    const saved = rt.saveData(rt.__getTestAppData());
    rt.cancelQueuedCloudSync();
    assert.equal(saved, true);
    const sync = await rt.runCloudSyncNow();
    assert.equal(sync.ok, false);
    assert.equal(sync.error, 'offline');
    assert.equal(rt.__getTestAppData().logs.length, before + 1);
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs.some(l => l.id === 'log-offline-2'), true);
    assert.equal(rt.getCloudSyncStatus().status, 'offline');
});

test('local save happens before cloud sync', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'log-before-sync' });
    const { transport, result } = await signUpWithLocalData(rt, 'first@example.com');
    assert.equal(result.decision, 'offer-backup');
    const storedBeforePush = JSON.parse(rt.__getStorageSnapshot());
    assert.equal(storedBeforePush.logs[0].id, 'log-before-sync');
    assert.equal(transport._db.tables.use_logs.length, 0);
    await rt.backupLocalDataToAccount();
    assert.equal(transport._db.tables.use_logs.some(row => String(row.id) === 'log-before-sync'), true);
});

test('existing local data survives account creation', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'keep-me' });
    const { result } = await signUpWithLocalData(rt, 'keep@example.com');
    assert.equal(result.decision, 'offer-backup');
    assert.equal(rt.__getTestAppData().logs[0].id, 'keep-me');
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs[0].id, 'keep-me');
    assert.equal(rt.getCloudSyncStatus().pendingBackupOffer, true);
});

test('empty cloud data cannot wipe populated local data', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'must-survive' });
    const { transport, result } = await signUpWithLocalData(rt, 'emptycloud@example.com');
    assert.equal(result.decision, 'offer-backup');
    const refused = await rt.runCloudSyncNow({ decision: 'pull' });
    assert.equal(refused.skipped, 'pending-backup-offer');
    const stillRefused = await rt.runCloudSyncNow({
        decision: 'pull',
        allowWhileOfferPending: true
    });
    assert.equal(stillRefused.skipped, 'refused-empty-overwrite');
    assert.equal(rt.__getTestAppData().logs[0].id, 'must-survive');
    assert.equal(transport._db.tables.use_logs.length, 0);
});

test('same record is not duplicated during repeated sync', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'once-only' });
    const { transport } = await signUpWithLocalData(rt, 'dup@example.com');
    await rt.backupLocalDataToAccount();
    await rt.runCloudSyncNow();
    await rt.runCloudSyncNow();
    const rows = transport._db.tables.use_logs.filter(row => String(row.id) === 'once-only');
    assert.equal(rows.length, 1);
    assert.equal(rt.__getTestAppData().logs.filter(l => String(l.id) === 'once-only').length, 1);
});

test('records remain isolated by user', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'user-one-log' });
    const { transport } = await signUpWithLocalData(rt, 'one@example.com');
    await rt.backupLocalDataToAccount();
    const user1 = rt.getCloudAuthState().user.id;
    await rt.cloudSignOut();
    await rt.cloudSignUp('two@example.com', 'password123');
    rt.cancelQueuedCloudSync();
    const user2 = rt.getCloudAuthState().user.id;
    assert.notEqual(user1, user2);
    const user1Rows = transport._db.tables.use_logs.filter(row => row.user_id === user1);
    const user2Rows = transport._db.tables.use_logs.filter(row => row.user_id === user2);
    assert.equal(user1Rows.some(row => String(row.id) === 'user-one-log'), true);
    assert.equal(user2Rows.length, 0);
    const fetched2 = await transport.fetchCollection(user2, 'logs');
    assert.equal(fetched2.length, 0);
});

test('deleted records do not reappear from another device', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'doomed' });
    const { transport } = await signUpWithLocalData(rt, 'tomb@example.com');
    await rt.backupLocalDataToAccount();
    const data = rt.__getTestAppData();
    data.logs = data.logs.filter(l => String(l.id) !== 'doomed');
    rt.saveData(data);
    rt.cancelQueuedCloudSync();
    await rt.runCloudSyncNow();
    const remoteRow = transport._db.tables.use_logs.find(row => String(row.id) === 'doomed');
    assert.ok(remoteRow);
    assert.ok(remoteRow.deletedAt || remoteRow.payload?.deletedAt);

    const otherDevice = {
        logs: [{
            id: 'doomed',
            substanceId: 'weed-thc',
            date: '2026-08-01',
            amount: 1,
            updatedAt: '2026-08-01T12:00:00.000Z'
        }],
        purchases: [],
        taperPlansV2: [],
        settings: { updatedAt: '2026-08-01T12:00:00.000Z' }
    };
    const remote = {
        logs: [{
            id: 'doomed',
            deletedAt: remoteRow.deletedAt || remoteRow.payload.deletedAt,
            updatedAt: remoteRow.updatedAt || remoteRow.deletedAt
        }]
    };
    const merged = rt.mergeCloudAndLocalData(otherDevice, remote);
    assert.equal(merged.logs.some(l => String(l.id) === 'doomed'), false);
});

test('import/export still works', () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'export-me' });
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(exported.logs[0].id, 'export-me');
    assert.equal(Object.prototype.hasOwnProperty.call(exported, 'goals'), false);

    const other = loadRecoveryTrackerApp();
    const empty = makeTestData([], [weedSubstance()]);
    other.__setTestAppData(empty);
    const merged = other.mergeImportedData(empty, exported);
    assert.equal(merged.logs.some(l => String(l.id) === 'export-me'), true);
});

test('tapers sync correctly', async () => {
    const rt = loadRecoveryTrackerApp();
    const taper = {
        id: 'taper-weed-1',
        substanceId: 'weed-thc',
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T12:00:00.000Z',
        status: 'active',
        steps: [{ day: 1, amount: 1 }]
    };
    seedApp(rt, { logId: 'taper-log', taperPlansV2: [taper] });
    const { transport } = await signUpWithLocalData(rt, 'taper@example.com');
    await rt.backupLocalDataToAccount();
    const row = transport._db.tables.taper_plans.find(r => String(r.id) === 'taper-weed-1');
    assert.ok(row);
    assert.equal(row.payload.substanceId, 'weed-thc');
    assert.equal(rt.__getTestAppData().taperPlansV2[0].id, 'taper-weed-1');
});

test('Goals are not reintroduced by cloud sync', async () => {
    const rt = loadRecoveryTrackerApp();
    const tapers = [{
        id: 'taper-weed-1',
        substanceId: 'weed-thc',
        updatedAt: '2026-08-01T12:00:00.000Z',
        status: 'active'
    }];
    seedApp(rt, {
        logId: 'no-goals',
        goals: [{ id: 'legacy-goal', name: 'hidden' }],
        taperPlansV2: tapers
    });
    const remote = {
        logs: [],
        purchases: [],
        taperPlansV2: [],
        settings: { experienceMode: 'simple', goals: [{ id: 'settings-goal' }] },
        goals: [{ id: 'cloud-goal', name: 'should-not-land' }]
    };
    const merged = rt.mergeCloudAndLocalData(rt.__getTestAppData(), remote);
    assert.equal((merged.goals || []).some(g => g.id === 'cloud-goal'), false);
    assert.equal(merged.taperPlansV2.some(t => t.id === 'taper-weed-1'), true);
    assert.equal(merged.taperPlansV2.some(t => /goal/i.test(String(t.id) + String(t.name || ''))), false);
    assert.equal(merged.settings?.goals, undefined);
    const { transport } = await signUpWithLocalData(rt, 'nogoals@example.com');
    await rt.backupLocalDataToAccount();
    assert.equal(Object.prototype.hasOwnProperty.call(transport._db.tables, 'goals'), false);
    assert.equal(rt.CLOUD_COLLECTIONS.some(col => col.key === 'goals' || col.table === 'goals'), false);
    const payload = transport._db.tables.user_settings[0]?.payload || {};
    assert.equal(payload.goals, undefined);
    assert.equal(payload.settings?.goals, undefined);

    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.equal(/Create goal/i.test(html), false);
    const moduleSrc = fs.readFileSync(path.join(root, 'cloud-sync.module.js'), 'utf8');
    const start = moduleSrc.indexOf('const CLOUD_COLLECTIONS');
    const end = moduleSrc.indexOf(']);', start);
    const collectionsBlock = moduleSrc.slice(start, end + 3);
    assert.equal(/goals/i.test(collectionsBlock), false);
});

test('Quick Log preferences sync', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, {
        logId: 'ql-log',
        simpleModePrefs: {
            lastSubstanceId: 'weed-thc',
            bySubstance: { 'weed-thc': { amount: 3.5, unit: 'grams' } }
        }
    });
    const { transport } = await signUpWithLocalData(rt, 'ql@example.com');
    await rt.backupLocalDataToAccount();
    const settings = transport._db.tables.user_settings[0];
    assert.equal(settings.payload.simpleModePrefs.bySubstance['weed-thc'].amount, 3.5);
    assert.equal(settings.payload.settings.simpleModePrefs.bySubstance['weed-thc'].amount, 3.5);
});

test('sync failure never corrupts local data', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'keep-on-fail' });
    const { transport } = await signUpWithLocalData(rt, 'fail@example.com');
    transport.failNextCalls(1);
    const sync = await rt.runCloudSyncNow({ allowWhileOfferPending: true, decision: 'merge' });
    assert.equal(sync.ok, false);
    assert.equal(sync.localPreserved, true);
    assert.equal(rt.__getTestAppData().logs[0].id, 'keep-on-fail');
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs[0].id, 'keep-on-fail');
});

test('sign out does not silently destroy local data', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'stay-local' });
    await signUpWithLocalData(rt, 'signout@example.com');
    await rt.cloudSignOut();
    assert.equal(rt.getCloudAuthState().signedIn, false);
    assert.equal(rt.__getTestAppData().logs[0].id, 'stay-local');
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs[0].id, 'stay-local');
});

test('legacy records without ids receive a stable id once', () => {
    const rt = loadRecoveryTrackerApp();
    const data = makeTestData([
        { substanceId: 'weed-thc', date: '2026-08-01', amount: 1, type: 'quick', transactionType: 'use' }
    ], [weedSubstance()]);
    rt.ensureSyncableRecordIds(data);
    assert.ok(data.logs[0].id);
    const firstId = data.logs[0].id;
    rt.ensureSyncableRecordIds(data);
    assert.equal(data.logs[0].id, firstId);
});

test('conflict resolution keeps later updatedAt and local on tie', () => {
    const rt = loadRecoveryTrackerApp();
    const local = {
        logs: [{ id: 'same', amount: 1, updatedAt: '2026-08-02T00:00:00.000Z', syncVersion: 1 }],
        purchases: [],
        taperPlansV2: [],
        settings: { updatedAt: '2026-08-02T00:00:00.000Z', simpleModePrefs: { lastSubstanceId: 'local' } }
    };
    const remoteNewer = {
        logs: [{ id: 'same', amount: 9, updatedAt: '2026-08-03T00:00:00.000Z', syncVersion: 1 }],
        settings: { simpleModePrefs: { lastSubstanceId: 'remote' } },
        settingsUpdatedAt: '2026-08-01T00:00:00.000Z'
    };
    const mergedNewer = rt.mergeCloudAndLocalData(local, remoteNewer);
    assert.equal(mergedNewer.logs[0].amount, 9);
    assert.equal(mergedNewer.settings.simpleModePrefs.lastSubstanceId, 'local');

    const remoteTie = {
        logs: [{ id: 'same', amount: 4, updatedAt: '2026-08-02T00:00:00.000Z', syncVersion: 1 }]
    };
    const mergedTie = rt.mergeCloudRecords(local.logs, remoteTie.logs);
    assert.equal(mergedTie.live[0].amount, 1);
});

test('delete cloud data does not clear this device or the auth user', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'device-keeps' });
    const { transport } = await signUpWithLocalData(rt, 'wipecloud@example.com');
    await rt.backupLocalDataToAccount();
    const userId = rt.getCloudAuthState().user.id;
    assert.ok(transport._db.tables.use_logs.length > 0);
    const result = await rt.cloudDeleteCloudData();
    assert.equal(result.authUserDeleted, false);
    assert.equal(transport._db.tables.use_logs.length, 0);
    assert.equal(transport._db.users.some(u => u.id === userId), true);
    assert.equal(rt.getCloudAuthState().signedIn, false);
    assert.equal(rt.__getTestAppData().logs[0].id, 'device-keeps');
});

test('delete account removes auth user and keeps local data', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'account-local' });
    const { transport } = await signUpWithLocalData(rt, 'delacct@example.com');
    await rt.backupLocalDataToAccount();
    const userId = rt.getCloudAuthState().user.id;
    const result = await rt.cloudDeleteAccount();
    assert.equal(result.authUserDeleted, true);
    assert.equal(transport._db.deletedAuthUsers.includes(userId), true);
    assert.equal(transport._db.users.some(u => u.id === userId), false);
    assert.equal(rt.getCloudAuthState().signedIn, false);
    assert.equal(rt.__getTestAppData().logs[0].id, 'account-local');
});

test('device A offline edit vs device B: newer update wins', () => {
    const rt = loadRecoveryTrackerApp();
    const deviceA = [{ id: 'same', amount: 2, updatedAt: '2026-08-10T12:00:00.000Z', syncVersion: 1 }];
    const deviceB = [{ id: 'same', amount: 9, updatedAt: '2026-08-11T08:00:00.000Z', syncVersion: 1 }];
    const merged = rt.mergeCloudRecords(deviceA, deviceB);
    assert.equal(merged.live.length, 1);
    assert.equal(merged.live[0].amount, 9);
});

test('newer live edit beats an older tombstone', () => {
    const rt = loadRecoveryTrackerApp();
    const live = [{ id: 'revived', amount: 4, updatedAt: '2026-08-12T00:00:00.000Z' }];
    const olderTombstone = [{ id: 'revived', deletedAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z' }];
    const merged = rt.mergeCloudRecords(live, olderTombstone);
    assert.equal(merged.live.length, 1);
    assert.equal(merged.live[0].amount, 4);
    assert.equal(merged.tombstones.length, 0);
});

test('rotated access token is stored and sync continues', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'rotate-me' });
    const { transport } = await signUpWithLocalData(rt, 'rotate@example.com');
    await rt.backupLocalDataToAccount();
    const before = rt.getCloudAuthState().session.accessToken;
    rt.expireStoredCloudSessionForTests();
    const fresh = await rt.ensureFreshCloudSession();
    assert.equal(fresh.ok, true);
    assert.equal(fresh.rotated, true);
    assert.notEqual(rt.getCloudAuthState().session.accessToken, before);
    assert.equal(rt.getCloudAuthState().signedIn, true);
    const sync = await rt.runCloudSyncNow();
    assert.equal(sync.ok, true);
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs[0].id, 'rotate-me');
    assert.ok(transport);
});

test('expired auth session does not corrupt local data', async () => {
    const rt = loadRecoveryTrackerApp();
    seedApp(rt, { logId: 'expire-keep' });
    const { transport } = await signUpWithLocalData(rt, 'expire@example.com');
    await rt.backupLocalDataToAccount();
    rt.expireStoredCloudSessionForTests();
    transport.failRefresh(true);
    const fresh = await rt.ensureFreshCloudSession();
    assert.equal(fresh.signedIn, false);
    assert.equal(fresh.localPreserved, true);
    assert.equal(rt.getCloudAuthState().signedIn, false);
    const sync = await rt.runCloudSyncNow();
    assert.equal(sync.localPreserved, true);
    assert.equal(rt.__getTestAppData().logs[0].id, 'expire-keep');
    assert.equal(JSON.parse(rt.__getStorageSnapshot()).logs[0].id, 'expire-keep');
});
