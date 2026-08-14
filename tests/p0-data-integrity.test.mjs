import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const STORAGE_KEY = 'recovery-tracker-v2';
const COKE_ID = 'coke';
const NICOTINE_ID = 'nicotine';

function snapshotLogs(data) {
    return JSON.stringify(data.logs || []);
}

function snapshotPurchases(data) {
    return JSON.stringify(data.purchases || []);
}

function snapshotTapers(data) {
    return JSON.stringify(data.taperPlansV2 || []);
}

function makeVapeHealthData() {
    return {
        substances: [
            {
                id: NICOTINE_ID,
                name: 'Nicotine',
                trackingMode: 'nicotine',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                costTrackingEnabled: true,
                taperTrackingEnabled: true,
                active: true
            }
        ],
        logs: [
            {
                id: 'vape-log-1',
                substanceId: NICOTINE_ID,
                nicotineProductType: 'vape',
                date: '2026-07-28',
                amount: 50,
                unit: 'puffs',
                transactionType: 'use',
                type: 'quick',
                logMode: 'vape_puffs',
                purchaseId: 'vape-purchase-1'
            }
        ],
        purchases: [
            {
                id: 'vape-purchase-1',
                substanceId: NICOTINE_ID,
                date: '2026-07-01',
                quantity: 500,
                quantityBought: 500,
                remainingAmount: 450,
                remainingPuffs: 450,
                unit: 'puffs',
                totalCost: 25,
                nicotineProductType: 'vape',
                fullPuffCount: 500
            }
        ],
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            vapeInventoryLinkV2: true,
            vapePuffsV1: true,
            taperPlansV2: true
        }
    };
}

function fullyNormalizedCokeData() {
    const data = {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g', 'mg'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }],
        logs: [
            {
                id: 101,
                substanceId: COKE_ID,
                date: '2026-07-26',
                startTime: '10:00',
                endTime: '11:00',
                amount: 0.5,
                unit: 'g',
                transactionType: 'use',
                type: 'session',
                breakHours: null,
                breakMinutes: null,
                breakText: '—'
            },
            {
                id: 102,
                substanceId: COKE_ID,
                date: '2026-07-26',
                startTime: '19:00',
                endTime: '20:00',
                amount: 0.4,
                unit: 'g',
                transactionType: 'use',
                type: 'session',
                breakHours: 8,
                breakMinutes: 480,
                breakText: '8h'
            }
        ],
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID,
            experienceMode: 'advanced'
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            vapeInventoryLinkV2: true,
            vapePuffsV1: true,
            experienceModeV1: true,
            taperPlansV2: true
        }
    };
    return data;
}

test('Data Health scan does not mutate live logs, purchases, or tapers', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeVapeHealthData());
    const before = rt.__getTestAppData();
    const logsBefore = snapshotLogs(before);
    const purchasesBefore = snapshotPurchases(before);
    const tapersBefore = snapshotTapers(before);

    rt.scanDataHealth(before);

    const after = rt.__getTestAppData();
    assert.equal(snapshotLogs(after), logsBefore);
    assert.equal(snapshotPurchases(after), purchasesBefore);
    assert.equal(snapshotTapers(after), tapersBefore);
});

test('Data Health preview does not mutate live logs, purchases, or tapers', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeVapeHealthData());
    const before = rt.__getTestAppData();
    const logsBefore = snapshotLogs(before);
    const purchasesBefore = snapshotPurchases(before);
    const tapersBefore = snapshotTapers(before);

    rt.previewDataHealthRepairs(rt.scanDataHealth(before));

    const after = rt.__getTestAppData();
    assert.equal(snapshotLogs(after), logsBefore);
    assert.equal(snapshotPurchases(after), purchasesBefore);
    assert.equal(snapshotTapers(after), tapersBefore);
});

test('clear-orphan-substance quarantines log and reports applied count', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData({
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            active: true
        }],
        logs: [{
            id: 'orphan-log',
            substanceId: 'missing-substance',
            date: '2026-07-26',
            amount: 0.1,
            unit: 'g',
            transactionType: 'use',
            type: 'quick'
        }],
        purchases: [],
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    });

    const report = rt.scanDataHealth(rt.__getTestAppData());
    const orphan = report.issues.find(i => i.fix === 'clear-orphan-substance');
    assert.ok(orphan);
    assert.equal(rt.isDataHealthIssueSafe(orphan), false);

    const result = rt.applyDataHealthRepairs(report, {
        fixIds: [orphan.id],
        skipBackup: true,
        skipSave: true,
        runMaintenance: false
    });
    assert.equal(result.applied, 1);
    assert.equal(result.skippedUnhandled, 0);

    const log = rt.__getTestAppData().logs.find(l => l.id === 'orphan-log');
    assert.equal(log.substanceId, undefined);
    assert.equal(log.dataHealthOrphanSubstanceId, 'missing-substance');
    assert.equal(log.needsReview, true);
});

test('applyDataHealthRepairs reports skippedUnhandled for unknown fix types', () => {
    const rt = loadRecoveryTrackerApp();
    const fakeReport = {
        issues: [{
            id: 'fake-1',
            fix: 'nonexistent-fix',
            payload: {}
        }]
    };
    const result = rt.applyDataHealthRepairs(fakeReport, {
        fixIds: ['fake-1'],
        skipBackup: true,
        skipSave: true,
        runMaintenance: false
    });
    assert.equal(result.applied, 0);
    assert.equal(result.skippedUnhandled, 1);
});

test('round-tripped normalized storage loads without persist-after-load flag', () => {
    const rt1 = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(fullyNormalizedCokeData()) }
    });
    if (rt1.__getAppDataPersistAfterLoad()) {
        rt1.persistLoadedAppDataIfNeeded();
    }
    const roundTripped = rt1.__getStorageSnapshot();

    const rt2 = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: roundTripped }
    });
    assert.equal(rt2.__getAppDataPersistAfterLoad(), false);
});

test('legacy storage missing migration flags triggers persist-after-load', () => {
    const saved = fullyNormalizedCokeData();
    delete saved.migrations.taperPlansV2;
    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(saved) }
    });
    assert.equal(rt.__getAppDataPersistAfterLoad(), true);
});

test('persistLoadedAppDataIfNeeded skips save when data is already current', () => {
    const rt1 = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(fullyNormalizedCokeData()) }
    });
    if (rt1.__getAppDataPersistAfterLoad()) {
        rt1.persistLoadedAppDataIfNeeded();
    }
    const roundTripped = rt1.__getStorageSnapshot();

    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: roundTripped }
    });
    assert.equal(rt.__getAppDataPersistAfterLoad(), false);
    const before = rt.__getStorageSnapshot();
    rt.persistLoadedAppDataIfNeeded();
    assert.equal(rt.__getStorageSnapshot(), before);
});

test('persistLoadedAppDataIfNeeded saves once when migration changed data', () => {
    const saved = fullyNormalizedCokeData();
    delete saved.migrations.taperPlansV2;
    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(saved) }
    });
    assert.equal(rt.__getAppDataPersistAfterLoad(), true);
    rt.persistLoadedAppDataIfNeeded();
    assert.equal(rt.__getAppDataPersistAfterLoad(), false);
    const stored = JSON.parse(rt.__getStorageSnapshot());
    assert.equal(stored.migrations.taperPlansV2, true);
});

test('loading stored data twice does not require a second persist', () => {
    const saved = fullyNormalizedCokeData();
    delete saved.migrations.taperPlansV2;
    const rt1 = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(saved) }
    });
    assert.equal(rt1.__getAppDataPersistAfterLoad(), true);
    rt1.persistLoadedAppDataIfNeeded();
    const snapshotAfterFirstSave = rt1.__getStorageSnapshot();

    const rt2 = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: snapshotAfterFirstSave }
    });
    assert.equal(rt2.__getAppDataPersistAfterLoad(), false);
    rt2.persistLoadedAppDataIfNeeded();
    assert.equal(rt2.__getStorageSnapshot(), snapshotAfterFirstSave);

    rt2.__reloadTestAppDataFromStorage();
    assert.equal(rt2.__getAppDataPersistAfterLoad(), false);
    rt2.persistLoadedAppDataIfNeeded();
    assert.equal(rt2.__getStorageSnapshot(), snapshotAfterFirstSave);
});
