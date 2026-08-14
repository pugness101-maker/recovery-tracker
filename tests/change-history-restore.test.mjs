import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeData(overrides = {}) {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [{
            id: 'log-1',
            substanceId: COKE_ID,
            date: '2026-07-28',
            amount: 0.5,
            unit: 'g',
            transactionType: 'use',
            type: 'quick',
            purchaseId: 'purchase-1',
            inventoryAffects: true
        }],
        purchases: [{
            id: 'purchase-1',
            substanceId: COKE_ID,
            date: '2026-07-01',
            quantity: 3.5,
            quantityBought: 3.5,
            remainingAmount: 3,
            unit: 'g',
            totalCost: 280
        }],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [{
            id: 'taper-stable-1',
            name: 'Coke taper',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: true,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            startingDailyAverage: 2,
            goalDailyAverage: 0.5,
            reductionAmount: 0.25,
            createdAt: '2026-07-01T10:00:00.000Z',
            updatedAt: '2026-07-01T10:00:00.000Z'
        }],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true },
        ...overrides
    };
}

function setup(data = makeData()) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.resetNormalizeAppDataInvocationCount();
    return rt;
}

test('restore uses exactly one normalization pass', () => {
    const rt = setup();
    rt.pushChangeHistory('before-edit', { summary: 'Snapshot' });
    const entryId = rt.loadChangeHistory()[0].id;
    rt.__getTestAppData().logs = [];
    rt.resetNormalizeAppDataInvocationCount();

    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });

    assert.equal(rt.getNormalizeAppDataInvocationCount(), 1);
});

test('restore preserves record counts and IDs from snapshot', () => {
    const rt = setup();
    rt.pushChangeHistory('before-edit', { summary: 'Snapshot' });
    const entryId = rt.loadChangeHistory()[0].id;
    const snapshot = rt.loadChangeHistory()[0].snapshot;

    rt.__getTestAppData().logs = [];
    rt.__getTestAppData().taperPlansV2 = [];
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });

    const data = rt.__getTestAppData();
    assert.equal(data.logs.length, snapshot.logs.length);
    assert.equal(data.purchases.length, snapshot.purchases.length);
    assert.equal(data.taperPlansV2.length, snapshot.taperPlansV2.length);
    assert.equal(data.logs[0].id, 'log-1');
    assert.equal(data.purchases[0].id, 'purchase-1');
    assert.equal(data.taperPlansV2[0].id, 'taper-stable-1');
});

test('restore does not duplicate logs, purchases, or tapers', () => {
    const rt = setup();
    rt.pushChangeHistory('baseline', { summary: 'Baseline' });
    const entryId = rt.loadChangeHistory()[0].id;

    rt.__getTestAppData().logs.push({
        id: 'log-extra',
        substanceId: COKE_ID,
        date: '2026-07-29',
        amount: 1,
        unit: 'g',
        transactionType: 'use',
        type: 'quick'
    });
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });

    const data = rt.__getTestAppData();
    assert.equal(data.logs.length, 1);
    assert.equal(data.purchases.length, 1);
    assert.equal(data.taperPlansV2.length, 1);
    assert.equal(data.logs.filter(l => l.id === 'log-1').length, 1);
});

function restoreFingerprint(data) {
    return JSON.stringify({
        logs: (data.logs || []).map(l => ({
            id: l.id,
            substanceId: l.substanceId,
            purchaseId: l.purchaseId || l.linkedPurchaseId || l.inventoryId || null,
            amount: l.amount
        })),
        purchases: (data.purchases || []).map(p => ({ id: p.id, remainingAmount: p.remainingAmount })),
        tapers: (data.taperPlansV2 || []).map(p => ({ id: p.id, name: p.name, substanceId: p.substanceId }))
    });
}

test('restoring the same history entry twice yields identical data', () => {
    const rt = setup();
    rt.pushChangeHistory('baseline', { summary: 'Baseline' });
    const entryId = rt.loadChangeHistory()[0].id;

    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });
    const first = restoreFingerprint(rt.__getTestAppData());

    rt.__getTestAppData().logs = [];
    rt.__getTestAppData().purchases = [];
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });
    const second = restoreFingerprint(rt.__getTestAppData());

    assert.equal(first, second);
});

test('entry.snapshot JSON is unchanged after restore', () => {
    const rt = setup();
    rt.pushChangeHistory('baseline', { summary: 'Baseline' });
    const entry = rt.loadChangeHistory()[0];
    const snapshotBefore = JSON.stringify(entry.snapshot);

    rt.__getTestAppData().logs = [];
    rt.restoreChangeHistoryEntry(entry.id, { confirmRestore: false });

    assert.equal(JSON.stringify(entry.snapshot), snapshotBefore);
    assert.notEqual(entry.snapshot, rt.__getTestAppData());
});

test('restore keeps inventory purchase links stable', () => {
    const rt = setup();
    rt.pushChangeHistory('baseline', { summary: 'Baseline' });
    const entryId = rt.loadChangeHistory()[0].id;

    rt.__getTestAppData().logs[0].purchaseId = null;
    rt.__getTestAppData().logs[0].inventoryAffects = false;
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });

    const log = rt.__getTestAppData().logs[0];
    assert.equal(log.purchaseId, 'purchase-1');
    assert.equal(log.inventoryAffects, true);
    assert.equal(rt.getLogPurchaseId(log), 'purchase-1');
});

test('restore keeps taper IDs stable', () => {
    const rt = setup();
    rt.pushChangeHistory('baseline', { summary: 'Baseline' });
    const entryId = rt.loadChangeHistory()[0].id;

    rt.__getTestAppData().taperPlansV2[0].id = 'mutated-id';
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });

    assert.equal(rt.__getTestAppData().taperPlansV2[0].id, 'taper-stable-1');
});
