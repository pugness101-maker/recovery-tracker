import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';

function makeSubstance(id) {
    const map = {
        coke: { id: COKE_ID, name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true },
        weed: { id: WEED_ID, name: 'Weed', trackingMode: 'weed', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true }
    };
    return map[id] || map.coke;
}

function makeData({ substances, purchases = [] }) {
    return {
        substances,
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true, buyMonthRunningMode: 'within-year' },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    };
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
        ...overrides,
        quantity: overrides.quantity ?? quantityBought,
        quantityBought: overrides.quantityBought ?? quantityBought
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

const july2026Purchases = [
    makeCokePurchase({ id: 'j1', date: '2026-07-02', quantityBought: 3.5, totalCost: 140 }),
    makeCokePurchase({ id: 'j2', date: '2026-07-05', quantityBought: 3.5, totalCost: 125, store: 'Downtown' }),
    makeCokePurchase({ id: 'j3', date: '2026-07-10', quantityBought: 3.5, totalCost: 130 }),
    makeCokePurchase({ id: 'j4', date: '2026-07-20', quantityBought: 3.5, totalCost: 145 }),
    makeCokePurchase({ id: 'j5', date: '2026-07-28', quantityBought: 3.5, totalCost: 150 })
];

const june2026Purchases = Array.from({ length: 9 }, (_, index) => {
    const amount = index < 8 ? 2.8 : 2.4;
    const cost = index < 8 ? 112 : 104;
    return makeCokePurchase({
        id: `jun-${index + 1}`,
        date: `2026-06-${String(index + 1).padStart(2, '0')}`,
        quantityBought: amount,
        totalCost: cost
    });
});

test('one row per calendar month', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [...july2026Purchases, ...june2026Purchases]
    }));
    const bounds = { startDate: '2026-06-01', endDate: '2026-07-31' };
    const rows = rt.getBuyMonthSummaryRows(COKE_ID, bounds);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].monthKey, '2026-07');
    assert.equal(rows[1].monthKey, '2026-06');
    assert.equal(rows[0].purchaseCount, 5);
});

test('average cost calculated from monthly totals', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'a', date: '2026-07-02', quantityBought: 10, totalCost: 500 }),
            makeCokePurchase({ id: 'b', date: '2026-07-10', quantityBought: 7.5, totalCost: 190 })
        ]
    }));
    const bounds = { startDate: '2026-07-01', endDate: '2026-07-31' };
    const row = rt.getBuyMonthSummaryRows(COKE_ID, bounds)[0];
    assert.equal(row.purchased, 17.5);
    assert.equal(row.cost, 690);
    assert.ok(Math.abs(row.costPerUnit - (690 / 17.5)) < 0.0001);
    const perPurchaseAvgs = [500 / 10, 190 / 7.5];
    const wrongAvg = perPurchaseAvgs.reduce((s, v) => s + v, 0) / perPurchaseAvgs.length;
    assert.notEqual(row.costPerUnit, wrongAvg);
});

test('new-year running-total reset within selected year mode', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'd1', date: '2025-12-15', quantityBought: 10, totalCost: 400 }),
            makeCokePurchase({ id: 'j1', date: '2026-01-10', quantityBought: 4, totalCost: 160 })
        ]
    }));
    rt.setBuyMonthRunningMode('within-year');
    const rows = rt.getBuyMonthSummaryRows(COKE_ID, { startDate: '2025-12-01', endDate: '2026-01-31' });
    const jan = rows.find(r => r.monthKey === '2026-01');
    const dec = rows.find(r => r.monthKey === '2025-12');
    assert.equal(dec.runningPurchased, 10);
    assert.equal(jan.runningPurchased, 4);
    assert.equal(jan.runningSpent, 160);
});

test('newest-first display with chronological cumulative calculation', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'm1', date: '2026-05-10', quantityBought: 5, totalCost: 200 }),
            makeCokePurchase({ id: 'm2', date: '2026-06-10', quantityBought: 3, totalCost: 120 }),
            makeCokePurchase({ id: 'm3', date: '2026-07-10', quantityBought: 2, totalCost: 80 })
        ]
    }));
    const rows = rt.getBuyMonthSummaryRows(COKE_ID, { startDate: '2026-05-01', endDate: '2026-07-31' });
    assert.ok(rows[0].monthKey > rows[1].monthKey);
    assert.ok(rows[1].monthKey > rows[2].monthKey);
    const july = rows.find(r => r.monthKey === '2026-07');
    assert.equal(july.runningPurchased, 10);
    assert.equal(july.runningSpent, 400);
});

test('custom date-range partial month includes only in-range purchases', () => {
    const rt = setup(makeData({ substances: [makeSubstance('coke')], purchases: july2026Purchases }));
    const bounds = { startDate: '2026-07-15', endDate: '2026-07-31' };
    const row = rt.getBuyMonthSummaryRows(COKE_ID, bounds)[0];
    assert.equal(row.monthKey, '2026-07');
    assert.equal(row.purchaseCount, 2);
    assert.equal(row.purchased, 7);
    assert.equal(row.cost, 295);
});

test('deleted or archived purchase exclusion', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            ...july2026Purchases,
            makeCokePurchase({ id: 'archived', date: '2026-07-29', quantityBought: 99, totalCost: 999, archivedAt: '2026-07-29T12:00:00.000Z' })
        ]
    }));
    const row = rt.getBuyMonthSummaryRows(COKE_ID, { startDate: '2026-07-01', endDate: '2026-07-31' })[0];
    assert.equal(row.purchased, 17.5);
    assert.equal(row.cost, 690);
    assert.equal(row.purchaseCount, 5);
});

test('substance filtering excludes other substances', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
        purchases: [
            ...july2026Purchases,
            {
                id: 'weed-1',
                substanceId: WEED_ID,
                date: '2026-07-03',
                quantityBought: 50,
                totalCost: 500,
                unit: 'g'
            }
        ]
    }));
    const row = rt.getBuyMonthSummaryRows(COKE_ID, { startDate: '2026-07-01', endDate: '2026-07-31' })[0];
    assert.equal(row.purchased, 17.5);
    assert.equal(row.cost, 690);
});

test('month summary totals match store breakdown and monthly card inputs', () => {
    const rt = setup(makeData({ substances: [makeSubstance('coke')], purchases: july2026Purchases }));
    const bounds = { startDate: '2026-07-01', endDate: '2026-07-31' };
    const monthRow = rt.getBuyMonthSummaryRows(COKE_ID, bounds)[0];
    const stores = rt.getStoreBuySummaries(COKE_ID, bounds);
    const storePurchased = stores.reduce((s, row) => s + row.purchased, 0);
    const storeCost = stores.reduce((s, row) => s + row.cost, 0);
    assert.equal(monthRow.purchased, storePurchased);
    assert.equal(monthRow.cost, storeCost);
    assert.equal(monthRow.purchaseCount, stores.reduce((s, row) => s + row.count, 0));
});

test('csv export values match month summary rows', () => {
    const rt = setup(makeData({ substances: [makeSubstance('coke')], purchases: july2026Purchases }));
    const bounds = { startDate: '2026-07-01', endDate: '2026-07-31' };
    const rows = rt.getBuyMonthSummaryRows(COKE_ID, bounds).slice().reverse();
    const row = rows[0];
    assert.equal(row.purchased, 17.5);
    assert.equal(row.cost, 690);
    assert.equal(row.purchaseCount, 5);
    assert.ok(Math.abs(row.costPerUnit - 39.42857142857143) < 0.0001);
});

test('purchase details monthly running cost resets each month', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'jun-a', date: '2026-06-05', quantityBought: 2, totalCost: 100 }),
            makeCokePurchase({ id: 'jun-b', date: '2026-06-20', quantityBought: 1, totalCost: 50 }),
            makeCokePurchase({ id: 'jul-a', date: '2026-07-05', quantityBought: 3, totalCost: 120 }),
            makeCokePurchase({ id: 'jul-b', date: '2026-07-25', quantityBought: 4, totalCost: 180 })
        ]
    }));
    const rows = rt.getBuyPurchaseDetailRows(COKE_ID, { startDate: '2026-06-01', endDate: '2026-07-31' });
    const julNewest = rows.find(r => r.dateStr === '2026-07-25');
    const julOldest = rows.find(r => r.dateStr === '2026-07-05');
    const junNewest = rows.find(r => r.dateStr === '2026-06-20');
    assert.equal(julOldest.runningMonthCost, 120);
    assert.equal(julNewest.runningMonthCost, 300);
    assert.equal(junNewest.runningMonthCost, 150);
});
