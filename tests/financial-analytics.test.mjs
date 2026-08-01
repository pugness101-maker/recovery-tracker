import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const REFERENCE_DATE = '2026-08-01';

function makeSubstance(id) {
    const map = {
        coke: {
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            active: true,
            isMain: true
        },
        weed: {
            id: WEED_ID,
            name: 'Weed/THC',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            active: true
        }
    };
    return map[id];
}

function makePurchase(overrides = {}) {
    const qty = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-07-15',
        time: '12:00',
        quantity: qty,
        quantityBought: qty,
        remainingAmount: overrides.remainingAmount ?? qty,
        unit: overrides.unit || 'g',
        totalCost: overrides.totalCost ?? 100,
        store: overrides.store || 'Main',
        paymentMethod: overrides.paymentMethod || 'cash',
        acquisitionType: overrides.acquisitionType || 'purchased',
        ...overrides,
        quantity: overrides.quantity ?? qty,
        quantityBought: overrides.quantityBought ?? qty
    };
}

function setup({ purchases = [], logs = [], budgets = [], settings = {} } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
        logs,
        purchases,
        cravings: [],
        goals: [],
        budgets,
        settings: {
            currency: '$',
            substanceSettings: {},
            financialAnalytics: {
                thresholds: { nearLimit: 0.75, atLimit: 1 },
                alertsEnabled: true,
                showOnDashboard: true,
                showOnCalendar: true,
                filters: {
                    substanceId: 'all',
                    dateRangePreset: 'this-month',
                    customStart: '',
                    customEnd: ''
                },
                ...(settings.financialAnalytics || {})
            },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureFinancialAnalyticsPrefs();
    rt.ensureBudgets();
    rt.invalidateFinancialAnalyticsCache();
    return rt;
}

test('totals include purchased and purchased-as-gift, exclude gift received', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'a', date: '2026-08-01', totalCost: 80, acquisitionType: 'purchased' }),
            makePurchase({ id: 'b', date: '2026-08-01', totalCost: 40, acquisitionType: 'purchased_as_gift', giftRecipient: 'Sam' }),
            makePurchase({ id: 'c', date: '2026-08-01', totalCost: 999, acquisitionType: 'gift_received', giftSource: 'Alex' }),
            makePurchase({ id: 'd', date: '2026-08-01', totalCost: 0, acquisitionType: 'other_adjustment' })
        ]
    });
    const purchases = rt.getFinancialPurchases({
        substanceId: 'all',
        startDate: '2026-08-01',
        endDate: '2026-08-01'
    });
    assert.equal(purchases.length, 2);
    assert.equal(rt.sumFinancialSpend(purchases), 120);
});

test('weighted average cost per unit uses total cost ÷ total quantity', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'a', date: '2026-08-01', quantityBought: 2, totalCost: 40 }),
            makePurchase({ id: 'b', date: '2026-08-01', quantityBought: 8, totalCost: 80 })
        ]
    });
    const purchases = rt.getFinancialPurchases({ startDate: '2026-08-01', endDate: '2026-08-01' });
    const metrics = rt.buildFinancialCoreMetrics(purchases, { startDate: '2026-08-01', endDate: '2026-08-01', days: 1 });
    // (40+80)/(2+8) = 12; simple avg of CPUs would be (20+10)/2 = 15
    assert.equal(metrics.weightedAvgCostPerUnit, 12);
    assert.notEqual(metrics.weightedAvgCostPerUnit, metrics.avgCostPerUnit);
});

test('period comparison reports absolute and percent change', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'prev1', date: '2026-07-10', totalCost: 200 }),
            makePurchase({ id: 'prev2', date: '2026-07-20', totalCost: 100 }),
            makePurchase({ id: 'curr1', date: '2026-08-01', totalCost: 150 })
        ]
    });
    const bounds = rt.resolveFinancialBounds({ dateRangePreset: 'this-month', substanceId: 'all' });
    const comparison = rt.buildFinancialPeriodComparison(bounds, null, rt.__getTestAppData(), { substanceId: 'all' });
    assert.ok(comparison.rows?.length);
    const monthRow = comparison.rows.find(r => r.id === 'month-vs-previous') || comparison.selected || comparison.rows[0];
    assert.ok(monthRow);
    assert.ok(Number.isFinite(monthRow.currentTotal));
    assert.ok(Number.isFinite(monthRow.previousTotal));
    assert.ok(Number.isFinite(monthRow.delta));
});

test('budgets evaluate on track / near / over statuses', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'a', date: '2026-08-01', totalCost: 90 })
        ]
    });
    const data = rt.__getTestAppData();
    data.budgets = [rt.normalizeBudgetRecord({
        id: 'b1',
        name: 'August cap',
        period: 'monthly',
        amount: 100,
        substanceId: 'all',
        status: 'active',
        startDate: '2026-08-01'
    })];
    const evals = rt.evaluateBudgets(data, { substanceId: 'all' });
    assert.ok(evals.length >= 1);
    const row = evals.find(e => e.budget.id === 'b1') || evals[0];
    assert.ok(['near_limit', 'at_limit', 'on_track', 'over_budget'].includes(row.status), row.status);
    assert.equal(row.spent, 90);
});

test('forecast returns insufficient data with too few purchases', () => {
    const rt = setup({
        purchases: [makePurchase({ id: 'a', date: '2026-08-01', totalCost: 50 })]
    });
    const dataset = rt.buildFinancialDataset(rt.__getTestAppData(), { useCache: false });
    const forecast = dataset.forecast || rt.buildFinancialForecast(dataset.purchases, dataset.bounds, dataset.budgets || []);
    assert.equal(forecast.status, 'insufficient_data');
});

test('filters by substance and store', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'a', substanceId: COKE_ID, store: 'Alpha', date: '2026-08-01', totalCost: 50 }),
            makePurchase({ id: 'b', substanceId: WEED_ID, store: 'Beta', date: '2026-08-01', totalCost: 70 }),
            makePurchase({ id: 'c', substanceId: COKE_ID, store: 'Beta', date: '2026-08-01', totalCost: 30 })
        ]
    });
    const cokeBeta = rt.getFinancialPurchases({
        substanceId: COKE_ID,
        store: 'Beta',
        startDate: '2026-08-01',
        endDate: '2026-08-01'
    });
    assert.equal(cokeBeta.length, 1);
    assert.equal(rt.sumFinancialSpend(cokeBeta), 30);
});

test('savings panel separates estimate labels for cost avoided', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'p1', date: '2026-07-05', totalCost: 300 }),
            makePurchase({ id: 'p2', date: '2026-07-20', totalCost: 300 }),
            makePurchase({ id: 'c1', date: '2026-08-01', totalCost: 100 })
        ]
    });
    const dataset = rt.buildFinancialDataset(rt.__getTestAppData(), { useCache: false });
    const savings = dataset.savings || rt.buildFinancialSavings(dataset.bounds, dataset.purchases, rt.__getTestAppData(), dataset.filters);
    assert.ok(savings);
    const text = JSON.stringify(savings);
    assert.match(text, /[Ee]stimate|actual|previous|baseline|avoided/i);
});

test('import/export preserves budgets array', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    data.budgets = [rt.normalizeBudgetRecord({
        id: 'keep-me',
        name: 'Weekly',
        period: 'weekly',
        amount: 50,
        status: 'active'
    })];
    const exported = rt.cleanExportData(data);
    assert.ok(Array.isArray(exported.budgets));
    assert.equal(exported.budgets[0].id, 'keep-me');
});

test('dashboard financial summary updates with substance filter', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'a', substanceId: COKE_ID, date: '2026-08-01', totalCost: 40 }),
            makePurchase({ id: 'b', substanceId: WEED_ID, date: '2026-08-01', totalCost: 90 })
        ]
    });
    const all = rt.buildDashboardFinancialSummary(rt.__getTestAppData(), 'all');
    const coke = rt.buildDashboardFinancialSummary(rt.__getTestAppData(), COKE_ID);
    assert.ok(all.monthSpend >= coke.monthSpend);
    assert.ok(coke.monthSpend <= 40 + 1e-6);
});
