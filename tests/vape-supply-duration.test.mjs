import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

function localDateTimeMs(y, m, d, h = 12, min = 0) {
    return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function localIso(y, m, d, h = 12, min = 0) {
    return new Date(localDateTimeMs(y, m, d, h, min)).toISOString();
}

function makeNicotineData({ purchases = [], logs = [] } = {}) {
    return {
        substances: [{
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            color: '#78909c',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function makeVapePurchase(overrides = {}) {
    return {
        id: 'purchase-vape-1',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-23',
        time: '12:00',
        fullPuffCount: 20000,
        quantity: 20000,
        quantityBought: 20000,
        unit: 'puffs',
        percentBoughtAt: 100,
        startingPuffsLeft: 20000,
        remainingAmount: 20000,
        remainingPuffs: 20000,
        nicotineMgPerMl: 50,
        totalCost: 25,
        notes: 'Foger Switch Pro',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('active vape bought 5 days ago uses purchase date span', () => {
    const purchase = makeVapePurchase({ date: '2026-07-23', time: '12:00' });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const asOfMs = localDateTimeMs(2026, 7, 28, 12, 0);

    const realNow = Date.now;
    Date.now = () => asOfMs;
    try {
        const ms = rt.getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
        assert.equal(ms, 5 * DAY_MS);

        const label = rt.formatVapeSupplyDurationLabel(purchase, ms, data);
        assert.equal(label, 'Used for 5 days so far');

        const metrics = rt.getPurchaseSupplyMetrics(purchase);
        assert.equal(metrics.supplyDurationLabel, 'Used for 5 days so far');
        assert.equal(metrics.supplyDurationMs, 5 * DAY_MS);

        const lifecycle = rt.getVapePurchaseLifecycleMetrics(purchase, asOfMs, data);
        assert.equal(lifecycle.durationLabel, 'Used for 5 days so far');
    } finally {
        Date.now = realNow;
    }
});

test('depleted vape uses explicit depletion timestamp', () => {
    const purchase = makeVapePurchase({
        date: '2026-07-01',
        time: '12:00',
        isDepleted: true,
        remainingAmount: 0,
        remainingPuffs: 0,
        depletedAt: localIso(2026, 7, 6, 12, 0)
    });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, Date.now(), data);
    assert.equal(ms, 5 * DAY_MS);

    const label = rt.formatVapeSupplyDurationLabel(purchase, ms, data);
    assert.equal(label, 'Lasted 5 days');

    const endAt = rt.getVapePurchaseSupplyEndAt(purchase, Date.now(), data);
    assert.equal(endAt.getTime(), localDateTimeMs(2026, 7, 6, 12, 0));
});

test('depleted vape with partial days shows days and hours', () => {
    const purchase = makeVapePurchase({
        date: '2026-07-01',
        time: '06:00',
        isDepleted: true,
        remainingAmount: 0,
        remainingPuffs: 0,
        depletedAt: localIso(2026, 7, 3, 12, 0)
    });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, Date.now(), data);
    assert.equal(ms, 2 * DAY_MS + 6 * HOUR_MS);
    assert.equal(
        rt.formatVapeSupplyDurationLabel(purchase, ms, data),
        'Lasted 2 days 6 hours'
    );
});

test('explicit Started Using date overrides purchase date', () => {
    const purchase = makeVapePurchase({
        date: '2026-07-01',
        time: '12:00',
        startedAt: localIso(2026, 7, 10, 8, 0)
    });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const asOfMs = localDateTimeMs(2026, 7, 15, 8, 0);

    const startAt = rt.getVapePurchaseSupplyStartAt(purchase, data);
    assert.equal(startAt.getTime(), localDateTimeMs(2026, 7, 10, 8, 0));

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
    assert.equal(ms, 5 * DAY_MS);
    assert.equal(
        rt.formatVapeSupplyDurationLabel(purchase, ms, data),
        'Used for 5 days so far'
    );
});

test('distributed percent-left child logs do not set supply start when purchase date exists', () => {
    const purchase = makeVapePurchase({ date: '2026-07-23', time: '12:00' });
    const parentLog = {
        id: 'log-checkpoint-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-27',
        startTime: '18:00',
        endTime: '18:05',
        amount: 0,
        unit: 'puffs',
        logMode: 'percent_remaining',
        percentRemaining: 80,
        isPercentLeftCheckpoint: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    const childLog = {
        id: 'log-child-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-24',
        amount: 100,
        unit: 'puffs',
        logMode: 'vape_puffs',
        isEstimatedFromPercentLeft: true,
        parentPercentLogId: 'log-checkpoint-1',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    const data = makeNicotineData({
        purchases: [purchase],
        logs: [parentLog, childLog]
    });
    const rt = setup(data);
    const asOfMs = localDateTimeMs(2026, 7, 28, 12, 0);

    const startAt = rt.getVapePurchaseSupplyStartAt(purchase, data);
    assert.equal(startAt.getTime(), localDateTimeMs(2026, 7, 23, 12, 0));

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
    assert.equal(ms, 5 * DAY_MS);
});

test('edited checkpoint date does not reset inventory start date', () => {
    const purchase = makeVapePurchase({ date: '2026-07-23', time: '12:00' });
    const checkpoint = {
        id: 'log-checkpoint-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-20',
        startTime: '10:00',
        endTime: '10:05',
        amount: 0,
        unit: 'puffs',
        logMode: 'percent_remaining',
        percentRemaining: 90,
        isPercentLeftCheckpoint: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    const data = makeNicotineData({ purchases: [purchase], logs: [checkpoint] });
    const rt = setup(data);
    const asOfMs = localDateTimeMs(2026, 7, 28, 12, 0);

    const startAt = rt.getVapePurchaseSupplyStartAt(purchase, data);
    assert.equal(startAt.getTime(), localDateTimeMs(2026, 7, 23, 12, 0));

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
    assert.equal(ms, 5 * DAY_MS);
    assert.equal(
        rt.formatVapeSupplyDurationLabel(purchase, ms, data),
        'Used for 5 days so far'
    );
});

test('local-time boundaries use elapsed hours not calendar day count', () => {
    const purchase = makeVapePurchase({ date: '2026-07-23', time: '23:00' });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const asOfMs = localDateTimeMs(2026, 7, 24, 1, 0);

    const ms = rt.getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
    assert.equal(ms, 2 * HOUR_MS);
    assert.equal(
        rt.formatVapeSupplyDurationLabel(purchase, ms, data),
        'Used for 2 hours so far'
    );
});

test('JSON export includes computed vape supply duration fields', () => {
    const purchase = makeVapePurchase({ date: '2026-07-23', time: '12:00' });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);

    const realNow = Date.now;
    Date.now = () => localDateTimeMs(2026, 7, 28, 12, 0);
    try {
        const exported = rt.cleanExportData(data).purchases[0];
        assert.equal(exported.supplyDurationMs, 5 * DAY_MS);
        assert.equal(exported.supplyDurationLabel, 'Used for 5 days so far');
    } finally {
        Date.now = realNow;
    }
});
