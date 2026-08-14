import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';

function baseSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true,
        active: true,
        isMain: true
    };
}

function setup(current = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData({
        substances: [baseSubstance()],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        taperPlans: {},
        taperPlansV2: [],
        settings: { currency: '$', substanceSettings: {} },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true },
        ...current
    });
    return rt;
}

function legacyTaperPlan(overrides = {}) {
    return {
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 2,
        goalDailyAverage: 0.5,
        reductionAmount: 0.25,
        isPrimary: true,
        isPaused: false,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        ...overrides
    };
}

function v2TaperPlan(overrides = {}) {
    return {
        id: 'taper-v2-1',
        name: 'V2 taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-15T10:00:00.000Z',
        ...overrides
    };
}

function idLessBackup() {
    return {
        substances: [baseSubstance()],
        logs: [{
            substanceId: COKE_ID,
            date: '2026-07-28',
            amount: 0.5,
            unit: 'g',
            transactionType: 'use',
            type: 'quick',
            notes: 'no id log'
        }],
        purchases: [{
            substanceId: COKE_ID,
            date: '2026-07-20',
            quantity: 1,
            unit: 'g',
            cost: 50,
            remainingAmount: 0.5
        }],
        taperPlans: {},
        taperPlansV2: [],
        settings: { currency: '$', substanceSettings: {} },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

test('importing the same id-less backup twice does not increase record counts', () => {
    const rt = setup();
    const incoming = rt.normalizeImportedAppData(idLessBackup());
    rt.assignStableIdsToImportRecords(incoming);

    const first = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    const afterFirst = {
        logs: first.logs.length,
        purchases: first.purchases.length
    };
    const second = rt.mergeImportedData(first, incoming);
    assert.equal(second.logs.length, afterFirst.logs);
    assert.equal(second.purchases.length, afterFirst.purchases);
    assert.equal(second.logs[0].id, first.logs[0].id);
    assert.equal(second.purchases[0].id, first.purchases[0].id);
    assert.match(String(second.logs[0].id), /^import-log-/);
});

test('id-less records receive deterministic stable IDs', () => {
    const rt = setup();
    const a = rt.assignStableIdsToImportRecords(rt.normalizeImportedAppData(idLessBackup()));
    const b = rt.assignStableIdsToImportRecords(rt.normalizeImportedAppData(idLessBackup()));
    assert.equal(a.logs[0].id, b.logs[0].id);
    assert.equal(a.purchases[0].id, b.purchases[0].id);
});

test('importing legacy taper data twice does not create duplicate V2 tapers', () => {
    const rt = setup({ taperPlansV2: [v2TaperPlan()] });
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        taperPlans: {
            [COKE_ID]: legacyTaperPlan({ name: 'Legacy only', updatedAt: '2026-06-01T00:00:00.000Z' })
        },
        taperPlansV2: []
    });
    rt.assignStableIdsToImportRecords(incoming);

    const first = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    assert.equal(first.taperPlansV2.length, 1, 'V2 should win over stale legacy duplicate');

    const second = rt.mergeImportedData(first, incoming);
    assert.equal(second.taperPlansV2.length, 1);
});

test('legacy taper promotes into V2 when V2 is empty', () => {
    const rt = setup();
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        taperPlans: {
            [COKE_ID]: legacyTaperPlan({ id: 'legacy-taper-1', name: 'Legacy promote' })
        }
    });
    rt.assignStableIdsToImportRecords(incoming);
    const merged = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    assert.equal(merged.taperPlansV2.length, 1);
    assert.equal(merged.taperPlansV2[0].id, 'legacy-taper-1');
    assert.equal(merged.taperPlansV2[0].name, 'Legacy promote');
});

test('V2 data wins over older legacy copies on merge', () => {
    const rt = setup({
        taperPlansV2: [v2TaperPlan({ name: 'Newer V2', updatedAt: '2026-08-15T10:00:00.000Z' })]
    });
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        taperPlans: {
            [COKE_ID]: legacyTaperPlan({
                name: 'Stale legacy',
                updatedAt: '2026-06-01T00:00:00.000Z'
            })
        }
    });
    const merged = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    assert.equal(merged.taperPlansV2.length, 1);
    assert.equal(merged.taperPlansV2[0].name, 'Newer V2');
});

test('existing valid IDs are preserved on merge', () => {
    const rt = setup({
        logs: [makeUseLog({ id: 'log-keep', substanceId: COKE_ID, date: '2026-07-01', amount: 1 })],
        taperPlansV2: [v2TaperPlan({ id: 'taper-keep' })]
    });
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        logs: [{ id: 'log-keep', substanceId: COKE_ID, date: '2026-07-01', amount: 2, transactionType: 'use', type: 'quick' }],
        taperPlansV2: [v2TaperPlan({ id: 'taper-keep', name: 'Updated from import' })]
    });
    const merged = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    assert.ok(merged.logs.some(l => l.id === 'log-keep' && l.amount === 2));
    assert.ok(merged.taperPlansV2.some(p => p.id === 'taper-keep' && p.name === 'Updated from import'));
    assert.equal(merged.logs.length, 1);
    assert.equal(merged.taperPlansV2.length, 1);
});

test('deleted substance legacy taper keys do not reappear in exports', () => {
    const rt = setup({
        substances: [baseSubstance(), {
            id: 'weed',
            name: 'Weed',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }],
        taperPlansV2: [
            v2TaperPlan({ id: 'coke-taper', substanceId: COKE_ID }),
            v2TaperPlan({ id: 'weed-taper', substanceId: 'weed', name: 'Weed taper' })
        ]
    });
    rt.prepareTaperDataForPersistence(rt.__getTestAppData());
    assert.ok(rt.__getTestAppData().taperPlans[COKE_ID]);
    assert.ok(rt.__getTestAppData().taperPlans.weed);

    const data = rt.__getTestAppData();
    data.substances = data.substances.filter(s => s.id !== 'weed');
    data.taperPlansV2 = data.taperPlansV2.filter(p => p.substanceId !== 'weed');
    rt.prepareTaperDataForPersistence(data);

    assert.ok(data.taperPlans[COKE_ID]);
    assert.equal(data.taperPlans.weed, undefined);
    const exported = rt.cleanExportData(data);
    assert.equal(Object.keys(exported.taperPlans || {}).includes('weed'), false);
});

test('buildImportPreview does not mutate live app data', () => {
    const rt = setup({
        logs: [makeUseLog({ id: 'log-live', substanceId: COKE_ID, date: '2026-07-01', amount: 1 })]
    });
    const liveBefore = JSON.stringify(rt.__getTestAppData());
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        logs: [{ id: 'log-live', substanceId: COKE_ID, date: '2026-07-01', amount: 9, transactionType: 'use', type: 'quick' }]
    });
    rt.buildImportPreview(incoming, rt.__getTestAppData());
    assert.equal(JSON.stringify(rt.__getTestAppData()), liveBefore);
});

test('inventory-linked id-less purchase gets stable id across repeated merge', () => {
    const rt = setup();
    const incoming = rt.normalizeImportedAppData({
        ...idLessBackup(),
        logs: [{
            substanceId: COKE_ID,
            date: '2026-07-28',
            amount: 0.25,
            unit: 'g',
            transactionType: 'use',
            type: 'quick',
            purchaseId: 'import-purchase-stable'
        }],
        purchases: [{
            id: 'import-purchase-stable',
            substanceId: COKE_ID,
            date: '2026-07-20',
            quantity: 1,
            unit: 'g',
            cost: 50,
            remainingAmount: 0.75
        }]
    });
    rt.assignStableIdsToImportRecords(incoming);
    const first = rt.mergeImportedData(rt.__getTestAppData(), incoming);
    const second = rt.mergeImportedData(first, incoming);
    assert.equal(second.purchases.length, 1);
    assert.equal(second.logs.length, 1);
    assert.equal(second.logs[0].purchaseId, 'import-purchase-stable');
});
