import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NICOTINE_ID = 'nicotine';

function makeSubstance(id, overrides = {}) {
    const defaults = {
        coke: { id: COKE_ID, name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true },
        weed: { id: WEED_ID, name: 'Weed', trackingMode: 'weed', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true },
        nicotine: { id: NICOTINE_ID, name: 'Nicotine', trackingMode: 'nicotine', primaryUnit: 'puffs', defaultUnit: 'puffs', costTrackingEnabled: true, taperTrackingEnabled: true }
    };
    return { ...(defaults[id] || defaults.coke), ...overrides };
}

function makeData({ substance, purchases = [], taperPlansV2 = [] }) {
    return {
        substances: [substance],
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    };
}

function makeCokePurchase(overrides = {}) {
    return {
        id: overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-07-01',
        time: '12:00',
        quantity: 7,
        quantityBought: 7,
        unit: 'g',
        totalCost: 255,
        ...overrides
    };
}

function makeVapePurchase(overrides = {}) {
    return {
        id: overrides.id || `purchase-vape-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-01',
        time: '12:00',
        fullPuffCount: 20000,
        quantity: 20000,
        quantityBought: 20000,
        unit: 'puffs',
        totalCost: 22,
        ...overrides
    };
}

function makeCokeTaperPlan(overrides = {}) {
    return {
        id: 'taper-coke-1',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        reductionType: 'reduce-amount',
        startDate: '2026-07-01',
        endDate: '2026-07-28',
        startingDailyAverage: 1,
        goalDailyAverage: 0.5,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', weeklyMax: 7, dailyTarget: 1 },
            { week: 2, weekStart: '2026-07-08', weekEnd: '2026-07-14', weeklyMax: 6, dailyTarget: 0.9 },
            { week: 3, weekStart: '2026-07-15', weekEnd: '2026-07-21', weeklyMax: 5, dailyTarget: 0.8 },
            { week: 4, weekStart: '2026-07-22', weekEnd: '2026-07-28', weeklyMax: 4, dailyTarget: 0.7 }
        ],
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('cumulative amount bought across multiple weeks', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, quantity: 7 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-10', quantityBought: 3.5, quantity: 3.5 }),
        makeCokePurchase({ id: 'p3', date: '2026-07-24', quantityBought: 3.3, quantity: 3.3 }),
        makeCokePurchase({ id: 'p4', date: '2026-07-26', quantityBought: 3.7, quantity: 3.7 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[1].cumulativePurchaseTotals.quantity, 10.5);
    assert.equal(data.rows[2].cumulativePurchaseTotals.quantity, 10.5);
    assert.equal(data.rows[3].cumulativePurchaseTotals.quantity, 17.5);
});

test('cumulative spending across multiple weeks', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', totalCost: 255 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-10', totalCost: 125 }),
        makeCokePurchase({ id: 'p3', date: '2026-07-24', totalCost: 155 }),
        makeCokePurchase({ id: 'p4', date: '2026-07-26', totalCost: 155 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].runningAmountSpent, 255);
    assert.equal(data.rows[1].runningAmountSpent, 380);
    assert.equal(data.rows[2].runningAmountSpent, 380);
    assert.equal(data.rows[3].runningAmountSpent, 690);
});

test('week with no purchases keeps cumulative totals', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-24', quantityBought: 3, totalCost: 50 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[1].weeklyPurchaseTotals.quantity, 0);
    assert.equal(data.rows[1].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[1].runningAmountSpent, 100);
});

test('plan start date resets cumulative totals', () => {
    const purchases = [
        makeCokePurchase({ id: 'p0', date: '2026-06-20', quantityBought: 20, totalCost: 500 }),
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 })
    ];
    const plan = makeCokeTaperPlan({ startDate: '2026-07-01' });
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('cross-month week includes purchases through week end', () => {
    const plan = makeCokeTaperPlan({
        weeklyTargets: [{
            week: 1, weekStart: '2026-07-28', weekEnd: '2026-08-03', weeklyMax: 7, dailyTarget: 1
        }]
    });
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-30', quantityBought: 2, totalCost: 40 }),
        makeCokePurchase({ id: 'p2', date: '2026-08-01', quantityBought: 3, totalCost: 60 })
    ];
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].weeklyPurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('substance filtering excludes other substances', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 5, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-03', substanceId: WEED_ID, quantityBought: 10, totalCost: 200 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({
        substance: makeSubstance('coke'),
        purchases,
        taperPlansV2: [plan]
    }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('archived purchase exclusion', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 5, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-03', quantityBought: 9, totalCost: 180, archivedAt: '2026-07-03T12:00:00.000Z' })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
});

test('editing a purchase does not double-count', () => {
    const purchases = [makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 })];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    let data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);

    const appData = rt.__getTestAppData();
    appData.purchases[0].quantityBought = 4;
    appData.purchases[0].quantity = 4;
    appData.purchases[0].totalCost = 80;
    data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 4);
    assert.equal(data.rows[0].runningAmountSpent, 80);
});

test('hiding and restoring optional columns', () => {
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [makeCokeTaperPlan()] }));
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const variantKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, plan);
    const baseOrder = rt.getEffectiveColumnOrder('taperByWeek', variantKey);

    rt.saveTableColumnConfig('taperByWeek', {
        order: baseOrder,
        visible: {
            week: true,
            dates: true,
            planned: true,
            used: true,
            difference: true,
            status: true,
            runningAmountBought: false,
            runningAmountSpent: false
        },
        widths: {}
    }, variantKey);

    let order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    assert.ok(!order.includes('runningAmountBought'));
    assert.ok(!order.includes('runningAmountSpent'));

    rt.saveTableColumnConfig('taperByWeek', {
        order: baseOrder,
        visible: {
            week: true,
            dates: true,
            planned: true,
            used: true,
            difference: true,
            status: true,
            runningAmountBought: true,
            runningAmountSpent: true
        },
        widths: {}
    }, variantKey);

    order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    assert.ok(order.includes('runningAmountBought'));
    assert.ok(order.includes('runningAmountSpent'));
});

test('column settings persistence per plan type', () => {
    const rt = setup(makeData({ substance: makeSubstance('nicotine'), taperPlansV2: [] }));
    const vapePlan = {
        substanceId: NICOTINE_ID,
        reductionType: 'nicotine-vape-purchase'
    };
    const cokePlan = { substanceId: COKE_ID, reductionType: 'reduce-amount' };
    const vapeKey = rt.getTaperByWeekColumnVariantKey(NICOTINE_ID, vapePlan);
    const cokeKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, cokePlan);

    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status', 'runningAmountBought'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true,
            runningAmountBought: true, buyInterval: true
        },
        widths: { runningAmountBought: 150 }
    }, vapeKey);

    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true,
            runningAmountBought: false
        },
        widths: {}
    }, cokeKey);

    const reloaded = rt.loadColumnSettingsStore();
    const vapeStorage = reloaded[rt.resolveColumnStorageKey('taperByWeek', vapeKey)];
    const cokeStorage = reloaded[rt.resolveColumnStorageKey('taperByWeek', cokeKey)];
    assert.equal(vapeStorage.visible.runningAmountBought, true);
    assert.equal(vapeStorage.widths.runningAmountBought, 150);
    assert.equal(cokeStorage.visible.runningAmountBought, false);
});

test('nicotine vape plan counts running vapes bought', () => {
    const purchases = [
        makeVapePurchase({ id: 'v1', date: '2026-07-02' }),
        makeVapePurchase({ id: 'v2', date: '2026-07-10' })
    ];
    const plan = {
        id: 'taper-vape',
        substanceId: NICOTINE_ID,
        reductionType: 'nicotine-vape-purchase',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', actualPurchases: 1 },
            { week: 2, weekStart: '2026-07-08', weekEnd: '2026-07-14', actualPurchases: 1 }
        ]
    };
    const rt = setup(makeData({ substance: makeSubstance('nicotine'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(NICOTINE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.vapes, 1);
    assert.equal(data.rows[1].cumulativePurchaseTotals.vapes, 2);
    assert.match(
        rt.formatTaperRunningAmountBought(data.rows[1].cumulativePurchaseTotals, plan, NICOTINE_ID, 'puffs'),
        /2 vapes/
    );
});
