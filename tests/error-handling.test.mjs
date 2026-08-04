import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

function quotaError() {
    const err = new Error('The quota has been exceeded.');
    err.name = 'QuotaExceededError';
    return err;
}

test('isStorageQuotaError recognizes quota failures without matching unrelated errors', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.isStorageQuotaError(quotaError()), true);
    assert.equal(rt.isStorageQuotaError(Object.assign(new Error('write failed'), { code: 22 })), true);
    assert.equal(rt.isStorageQuotaError(new Error('localStorage is disabled')), false);
    assert.equal(rt.isStorageQuotaError(null), false);
});

test('describeError falls back to a readable message for non-Error values', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.describeError(new Error('boom')), 'boom');
    assert.equal(rt.describeError('boom'), 'boom');
    assert.equal(rt.describeError(null), 'Unknown error');
});

test('saveData reports the failure instead of swallowing it', () => {
    const rt = loadRecoveryTrackerApp({ failStorageWrites: quotaError });
    rt.clearAppErrorLog();

    const saved = rt.saveData(makeTestData([makeUseLog({ id: 'l1', substanceId: 'weed-thc', date: '2026-07-01', amount: 1 })]));

    assert.equal(saved, false);
    const entries = rt.getAppErrorLog();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].context, 'saveData');
    assert.equal(entries[0].severity, 'error');
    assert.match(entries[0].message, /quota/i);
});

test('describeSaveFailure tells the user how to protect unsaved data', () => {
    const rt = loadRecoveryTrackerApp();
    assert.match(rt.describeSaveFailure(quotaError()), /storage is full/i);
    assert.match(rt.describeSaveFailure(quotaError()), /export a json backup/i);
    assert.match(rt.describeSaveFailure(new Error('write blocked')), /write blocked/);
});

test('recordAppError keeps a bounded, ordered error log', () => {
    const rt = loadRecoveryTrackerApp();
    rt.clearAppErrorLog();
    for (let i = 0; i < 130; i += 1) {
        rt.recordAppError(`ctx-${i}`, new Error(`err-${i}`));
    }
    const entries = rt.getAppErrorLog();
    assert.equal(entries.length, 100);
    assert.equal(entries[0].context, 'ctx-30');
    assert.equal(entries[entries.length - 1].context, 'ctx-129');
});

test('logSuppressedError records tolerated failures as warnings', () => {
    const rt = loadRecoveryTrackerApp();
    rt.clearAppErrorLog();
    rt.logSuppressedError('optionalModule', new Error('module missing'));
    const [entry] = rt.getAppErrorLog();
    assert.equal(entry.context, 'optionalModule');
    assert.equal(entry.severity, 'warn');
});

test('runWithUserFacingErrors surfaces thrown errors instead of losing them', () => {
    const rt = loadRecoveryTrackerApp();
    rt.clearAppErrorLog();

    const success = rt.runWithUserFacingErrors('ok', () => 5);
    assert.equal(success.ok, true);
    assert.equal(success.value, 5);

    const failure = rt.runWithUserFacingErrors('broken', () => { throw new Error('nope'); });
    assert.equal(failure.ok, false);
    assert.equal(failure.error.message, 'nope');
    assert.deepEqual([...rt.getAppErrorLog()].map(e => String(e.context)), ['broken']);
});

test('downloadTextFile exists so CSV exports are not silent no-ops', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(typeof rt.downloadTextFile, 'function');
    assert.equal(typeof rt.downloadBlob, 'function');
});

test('downloads report when the environment cannot download files', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.isFileDownloadSupported(), false);
    rt.clearAppErrorLog();

    assert.equal(rt.downloadTextFile('report.csv', 'a,b'), false);

    const [entry] = rt.getAppErrorLog();
    assert.equal(entry.context, 'downloadTextFile');
    assert.equal(entry.severity, 'warn');
    assert.match(entry.message, /report\.csv/);
});

test('saveColumnSettingsStore reports storage failures', () => {
    const rt = loadRecoveryTrackerApp({ failStorageWrites: quotaError });
    rt.clearAppErrorLog();

    assert.equal(rt.saveColumnSettingsStore({ useHistory: { order: ['date'] } }), false);
    assert.deepEqual([...rt.getAppErrorLog()].map(e => String(e.context)), ['saveColumnSettingsStore']);
});

test('goals & plans overview counts unevaluatable plans separately from on-track plans', () => {
    const rt = loadRecoveryTrackerApp();
    const data = makeTestData([]);
    data.goals = [];
    data.taperPlansV2 = [{
        id: 'plan-1',
        substanceId: 'weed-thc',
        status: 'active',
        weeklyTargets: [{ weekStart: '2026-01-01', weekEnd: '2026-01-07', targetAmount: 5, actualAmount: 1 }]
    }];

    const overview = rt.buildGoalsPlansOverview(data);

    assert.equal(overview.plansWithErrors, 0);
    assert.equal(overview.plansOnTrack + overview.plansAboveTarget + overview.plansWithErrors, 1);
});
