import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const REFERENCE_DATE = '2026-07-28';

function makeSubstance(id) {
    const map = {
        coke: {
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        },
        weed: {
            id: WEED_ID,
            name: 'Weed',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }
    };
    return map[id] || map.coke;
}

function makeCokePurchase(overrides = {}) {
    const quantityBought = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-07-02',
        time: '12:00',
        quantity: quantityBought,
        quantityBought,
        unit: 'g',
        totalCost: 140,
        store: overrides.store || 'Main',
        paymentMethod: 'Cash',
        buyBreakHours: overrides.buyBreakHours ?? 48,
        ...overrides,
        quantity: overrides.quantity ?? quantityBought,
        quantityBought: overrides.quantityBought ?? quantityBought
    };
}

function setup({ substances, purchases = [], logs = [] }) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances,
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true, buyMonthRunningMode: 'within-year' },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    return rt;
}

const julyPurchases = [
    makeCokePurchase({ id: 'j1', date: '2026-07-02', quantityBought: 3.5, totalCost: 140, store: 'Main' }),
    makeCokePurchase({ id: 'j2', date: '2026-07-10', quantityBought: 3.5, totalCost: 130, store: 'Downtown' }),
    makeCokePurchase({ id: 'j3', date: '2026-07-20', quantityBought: 3.5, totalCost: 145, store: 'Main' }),
    makeCokePurchase({ id: 'j4', date: '2026-07-28', quantityBought: 3.5, totalCost: 150, store: 'Downtown' })
];

const junePurchases = [
    makeCokePurchase({ id: 'jun1', date: '2026-06-05', quantityBought: 2, totalCost: 80, store: 'Main' }),
    makeCokePurchase({ id: 'jun2', date: '2026-06-20', quantityBought: 2.5, totalCost: 100, store: 'East' })
];

const julyLogs = [
    makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-07-02', amount: 1 }),
    makeUseLog({ id: 'u2', substanceId: COKE_ID, date: '2026-07-10', amount: 2 }),
    makeUseLog({ id: 'u3', substanceId: COKE_ID, date: '2026-07-20', amount: 1.5 }),
    makeUseLog({ id: 'u4', substanceId: COKE_ID, date: '2026-07-28', amount: 0.5 })
];

function assertDatasetConsistency(rt, substanceId) {
    const dataset = rt.buildInsightsDataset(substanceId);
    const storeTotal = dataset.storeSummaries.reduce((sum, row) => sum + row.cost, 0);
    assert.equal(storeTotal, dataset.buyTotals.cost);
    assert.equal(dataset.buyMonthRows.reduce((sum, row) => sum + row.cost, 0), dataset.buyTotals.cost);
    assert.equal(dataset.buyPurchaseDetails.reduce((sum, row) => sum + row.cost, 0), dataset.buyTotals.cost);
    return dataset;
}

test('today preset includes only today records', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('today');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, REFERENCE_DATE);
    assert.equal(dataset.bounds.endDate, REFERENCE_DATE);
    assert.equal(dataset.purchases.length, 1);
    assert.equal(dataset.logs.length, 1);
    assert.equal(dataset.buyTotals.cost, 150);
});

test('this week includes only current week intersecting records', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('this-week');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, '2026-07-26');
    assert.equal(dataset.bounds.endDate, REFERENCE_DATE);
    assert.equal(dataset.purchases.length, 1);
    assert.equal(dataset.logs.length, 1);
});

test('last week includes prior week only', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('last-week');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, '2026-07-19');
    assert.equal(dataset.bounds.endDate, '2026-07-25');
    assert.equal(dataset.purchases.length, 1);
    assert.equal(dataset.logs.length, 1);
});

test('this month includes July records through reference date', () => {
    const rt = setup({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
        purchases: [...julyPurchases, ...junePurchases],
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('this-month');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, '2026-07-01');
    assert.equal(dataset.bounds.endDate, REFERENCE_DATE);
    assert.equal(dataset.purchases.length, 4);
    assert.equal(dataset.buyTotals.cost, 565);
});

test('last month includes June only', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [...julyPurchases, ...junePurchases],
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('last-month');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, '2026-06-01');
    assert.equal(dataset.bounds.endDate, '2026-06-30');
    assert.equal(dataset.purchases.length, 2);
    assert.equal(dataset.buyTotals.cost, 180);
    assert.equal(dataset.buyMonthRows[0].runningPurchased, 4.5);
});

test('this year includes records from January through reference date', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'jan', date: '2026-01-15', quantityBought: 1, totalCost: 40 }),
            ...julyPurchases
        ],
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('this-year');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.bounds.startDate, '2026-01-01');
    assert.equal(dataset.purchases.length, 5);
    assert.equal(dataset.buyTotals.cost, 605);
});

test('custom range partial month aggregates only in-range purchases', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('custom', '2026-07-10', '2026-07-20');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.buyMonthRows.length, 1);
    assert.equal(dataset.buyMonthRows[0].purchaseCount, 2);
    assert.equal(dataset.buyMonthRows[0].cost, 275);
    assert.equal(dataset.monthlySummaries.length, 1);
    assert.equal(dataset.monthlySummaries[0].totalUsage, 3.5);
});

test('partial week custom range uses only intersecting week slice', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [],
        logs: [
            makeUseLog({ id: 'a', substanceId: COKE_ID, date: '2026-07-02', amount: 1 }),
            makeUseLog({ id: 'b', substanceId: COKE_ID, date: '2026-07-08', amount: 2 }),
            makeUseLog({ id: 'c', substanceId: COKE_ID, date: '2026-07-20', amount: 3 })
        ]
    });
    rt.setStatsDateRangeForTest('custom', '2026-07-05', '2026-07-12');
    const dataset = rt.buildInsightsDataset(COKE_ID);
    assert.equal(dataset.weeklySummaries.length, 1);
    assert.equal(dataset.weeklySummaries[0].totalUsage, 2);
    assert.equal(dataset.weeklySummaries[0].runningTotal, 2);
});

test('cross-month custom range produces separate month rows with clipped totals', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [...junePurchases, ...julyPurchases],
        logs: [
            makeUseLog({ id: 'jun', substanceId: COKE_ID, date: '2026-06-25', amount: 1 }),
            makeUseLog({ id: 'jul', substanceId: COKE_ID, date: '2026-07-05', amount: 2 })
        ]
    });
    rt.setStatsDateRangeForTest('custom', '2026-06-20', '2026-07-10');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    assert.equal(dataset.buyMonthRows.length, 2);
    const june = dataset.buyMonthRows.find(row => row.monthKey === '2026-06');
    const july = dataset.buyMonthRows.find(row => row.monthKey === '2026-07');
    assert.equal(june.purchaseCount, 1);
    assert.equal(july.purchaseCount, 2);
    assert.equal(dataset.monthlySummaries.length, 2);
});

test('cross-year custom range keeps running totals within displayed months', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'dec', date: '2025-12-20', quantityBought: 5, totalCost: 200 }),
            makeCokePurchase({ id: 'jan', date: '2026-01-10', quantityBought: 2, totalCost: 80 })
        ],
        logs: []
    });
    rt.setStatsDateRangeForTest('custom', '2025-12-01', '2026-01-31');
    const rows = rt.getBuyMonthSummaryRows(COKE_ID, rt.buildInsightsDataset(COKE_ID).bounds);
    const jan = rows.find(row => row.monthKey === '2026-01');
    const dec = rows.find(row => row.monthKey === '2025-12');
    assert.equal(dec.runningPurchased, 5);
    assert.equal(jan.runningPurchased, 2);
});

test('substance switching rebuilds filtered dataset independently', () => {
    const rt = setup({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
        purchases: [
            makeCokePurchase({ id: 'c1', date: '2026-07-10', totalCost: 100 }),
            {
                id: 'w1',
                substanceId: WEED_ID,
                date: '2026-07-10',
                quantity: 5,
                quantityBought: 5,
                unit: 'g',
                totalCost: 50,
                store: 'Green'
            }
        ],
        logs: [
            makeUseLog({ id: 'c-use', substanceId: COKE_ID, date: '2026-07-10', amount: 1 }),
            makeUseLog({ id: 'w-use', substanceId: WEED_ID, date: '2026-07-10', amount: 4 })
        ]
    });
    rt.setStatsDateRangeForTest('this-month');
    const coke = rt.buildInsightsDataset(COKE_ID);
    const weed = rt.buildInsightsDataset(WEED_ID);
    assert.equal(coke.buyTotals.cost, 100);
    assert.equal(weed.buyTotals.cost, 50);
    assert.equal(coke.logs.length, 1);
    assert.equal(weed.logs.length, 1);
});

test('csv export rows match filtered purchase details', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('custom', '2026-07-10', '2026-07-20');
    const dataset = rt.buildInsightsDataset(COKE_ID);
    const detailCost = dataset.buyPurchaseDetails.reduce((sum, row) => sum + row.cost, 0);
    assert.equal(detailCost, dataset.buyTotals.cost);
    assert.equal(dataset.buyPurchaseDetails.length, 2);
});

test('break metrics use only filtered purchases', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'old', date: '2026-06-01', buyBreakHours: 1000 }),
            makeCokePurchase({ id: 'in', date: '2026-07-10', buyBreakHours: 24 }),
            makeCokePurchase({ id: 'in2', date: '2026-07-20', buyBreakHours: 48 })
        ],
        logs: []
    });
    rt.setStatsDateRangeForTest('this-month');
    const dataset = rt.buildInsightsDataset(COKE_ID);
    assert.equal(dataset.buyBreakMetrics.purchases, 2);
    assert.equal(dataset.buyBreakMetrics.average, (24 + 48) / 2);
    assert.equal(dataset.buyBreakMetrics.longest, 48);
});

test('all insights sections share the same spending total', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: julyPurchases,
        logs: julyLogs
    });
    rt.setStatsDateRangeForTest('this-month');
    const dataset = assertDatasetConsistency(rt, COKE_ID);
    const weekCost = dataset.buyWeeklySummaries.reduce((sum, row) => sum + row.cost, 0);
    assert.equal(weekCost, dataset.buyTotals.cost);
    assert.ok(dataset.weeklySummaries.length > 0);
    assert.ok(dataset.monthlySummaries.length > 0);
});
