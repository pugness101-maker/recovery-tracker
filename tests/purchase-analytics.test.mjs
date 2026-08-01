import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const REFERENCE_DATE = '2026-08-01';

function makePurchase(overrides = {}) {
    const qty = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-07-20',
        time: overrides.time || '12:00',
        quantity: qty,
        quantityBought: qty,
        remainingAmount: overrides.remainingAmount ?? qty,
        unit: overrides.unit || 'g',
        totalCost: overrides.totalCost ?? 100,
        store: overrides.store || 'Main Store',
        acquisitionType: overrides.acquisitionType || 'purchased',
        paymentMethod: overrides.paymentMethod || 'cash',
        ...overrides,
        quantity: overrides.quantity ?? qty,
        quantityBought: overrides.quantityBought ?? qty
    };
}

function setup(purchases = []) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [],
        purchases,
        cravings: [],
        goals: [],
        budgets: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            purchaseAnalytics: {
                filters: {
                    substanceId: 'all',
                    dateRangePreset: 'all-time',
                    customStart: '',
                    customEnd: ''
                }
            }
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensurePurchaseAnalyticsPrefs();
    return rt;
}

test('weighted cost per unit uses total spend ÷ total quantity', () => {
    const rt = setup([
        makePurchase({ id: 'a', date: '2026-07-10', quantityBought: 2, totalCost: 100, store: 'A' }),
        makePurchase({ id: 'b', date: '2026-07-20', quantityBought: 8, totalCost: 200, store: 'B' })
    ]);
    const data = rt.__getTestAppData();
    const purchases = rt.getPurchaseAnalyticsSpendPurchases({
        substanceId: 'all',
        dateRangePreset: 'all-time'
    }, data);
    const dash = rt.buildPurchaseDashboardMetrics(purchases, data);
    assert.equal(dash.averageCostPerUnit, 30);
    assert.equal(dash.totalSpent, 300);
    assert.equal(dash.totalPurchases, 2);
});

test('gift received excluded from spend; purchased as gift included', () => {
    const rt = setup([
        makePurchase({ id: 'pay', date: '2026-07-10', totalCost: 80, quantityBought: 2, acquisitionType: 'purchased' }),
        makePurchase({ id: 'gift-buy', date: '2026-07-12', totalCost: 40, quantityBought: 1, acquisitionType: 'purchased_as_gift', giftRecipient: 'Sam' }),
        makePurchase({ id: 'recv', date: '2026-07-14', totalCost: 999, quantityBought: 5, acquisitionType: 'gift_received', giftSource: 'Alex' })
    ]);
    const data = rt.__getTestAppData();
    const all = rt.getPurchaseAnalyticsPurchases({ substanceId: 'all', dateRangePreset: 'all-time' }, data);
    const spend = rt.getPurchaseAnalyticsSpendPurchases({ substanceId: 'all', dateRangePreset: 'all-time' }, data);
    assert.equal(all.length, 3);
    assert.equal(spend.length, 2);
    assert.equal(rt.purchaseAnalyticsCountsTowardSpend(all.find(p => p.id === 'recv')), false);
    const dash = rt.buildPurchaseDashboardMetrics(all, data);
    assert.equal(dash.totalSpent, 120);
});

test('purchase frequency computes average days and shortest interval', () => {
    const rt = setup([
        makePurchase({ id: 'a', date: '2026-07-01', totalCost: 50 }),
        makePurchase({ id: 'b', date: '2026-07-08', totalCost: 50 }),
        makePurchase({ id: 'c', date: '2026-07-10', totalCost: 50 })
    ]);
    const purchases = rt.getPurchaseAnalyticsSpendPurchases({
        substanceId: 'all',
        dateRangePreset: 'all-time'
    }, rt.__getTestAppData());
    const freq = rt.buildPurchaseFrequencyMetrics(purchases);
    assert.equal(freq.shortestIntervalDays, 2);
    assert.ok(freq.averageDaysBetweenPurchases > 0);
    assert.ok(freq.longestNoPurchaseStreak >= 0);
});

test('supplier analytics aggregates spend and top substance', () => {
    const rt = setup([
        makePurchase({ id: 'a', date: '2026-07-01', store: 'Dealer Dan', totalCost: 60, quantityBought: 2 }),
        makePurchase({ id: 'b', date: '2026-07-15', store: 'Dealer Dan', totalCost: 90, quantityBought: 3 }),
        makePurchase({ id: 'c', date: '2026-07-20', store: 'Other', totalCost: 30, quantityBought: 1 })
    ]);
    const purchases = rt.getPurchaseAnalyticsPurchases({
        substanceId: 'all',
        dateRangePreset: 'all-time'
    }, rt.__getTestAppData());
    const suppliers = rt.buildSupplierAnalytics(purchases, rt.__getTestAppData());
    const dan = suppliers.find(s => /dealer dan/i.test(s.name));
    assert.ok(dan);
    assert.equal(dan.totalPurchases, 2);
    assert.equal(dan.totalSpent, 150);
    assert.equal(dan.averageCostPerUnit, 30);
});

test('price tracking builds monthly averages without averaging unit prices incorrectly', () => {
    const rt = setup([
        makePurchase({ id: 'a', date: '2026-06-10', quantityBought: 2, totalCost: 100 }),
        makePurchase({ id: 'b', date: '2026-06-20', quantityBought: 8, totalCost: 200 })
    ]);
    const purchases = rt.getPurchaseAnalyticsSpendPurchases({
        substanceId: 'all',
        dateRangePreset: 'all-time'
    }, rt.__getTestAppData());
    const price = rt.buildPriceTrackingMetrics(purchases, rt.__getTestAppData());
    assert.ok(price.series.length >= 1);
    const june = price.series[0].monthlyAverage.find(m => m.month === '2026-06');
    assert.ok(june);
    assert.equal(june.average, 30);
});

test('export csv includes dashboard and supplier sections', () => {
    const rt = setup([
        makePurchase({ id: 'a', date: '2026-07-01', store: 'Main', totalCost: 40, quantityBought: 2 })
    ]);
    const data = rt.__getTestAppData();
    data.settings.purchaseAnalytics.filters.dateRangePreset = 'all-time';
    const dataset = rt.buildPurchaseAnalyticsDataset(data, {
        bypassCache: true,
        filters: { substanceId: 'all', dateRangePreset: 'all-time' }
    });
    const rows = rt.buildPurchaseAnalyticsCsvRows(dataset);
    assert.ok(rows.some(r => r[0] === 'Dashboard' && r[1] === 'totalSpent'));
    assert.ok(rows.some(r => r[0] === 'Supplier'));
    assert.ok(rows.some(r => r[0] === 'Store'));
});
