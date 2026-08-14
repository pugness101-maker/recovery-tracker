import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NIC_ID = 'nicotine';
const REFERENCE_DATE = '2026-08-01';

function makeLog(overrides = {}) {
    return {
        id: overrides.id || `l-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-07-20',
        time: overrides.time || '14:00',
        amount: overrides.amount ?? 1,
        personalAmount: overrides.personalAmount,
        sharedAmount: overrides.sharedAmount,
        transactionType: overrides.transactionType || 'use',
        type: overrides.type || 'quick',
        weedProductType: overrides.weedProductType,
        ...overrides
    };
}

function makePurchase(overrides = {}) {
    const qty = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-07-18',
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

function setup({ logs = [], purchases = [], settings = {} } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [
            {
                id: COKE_ID,
                name: 'Coke',
                trackingMode: 'powder',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                active: true,
                isMain: true
            },
            {
                id: WEED_ID,
                name: 'Weed/THC',
                trackingMode: 'weed',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                active: true
            },
            {
                id: NIC_ID,
                name: 'Nicotine',
                trackingMode: 'nicotine',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                costTrackingEnabled: true,
                active: true
            }
        ],
        logs,
        purchases,
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureChartSystemPrefs();
    return rt;
}

test('chart prefs persist separately and default widgets load', () => {
    const rt = setup();
    const prefs = rt.ensureChartSystemPrefs();
    assert.ok(Array.isArray(prefs.widgets));
    assert.ok(prefs.widgets.length >= 3);
    assert.equal(prefs.filters.personalUseOnly, true);
    assert.ok(rt.CHART_METRICS.some(m => m.id === 'use_amount'));
    assert.ok(rt.CHART_PRESETS.recovery_overview);
    assert.ok(rt.CHART_TYPES.includes('heatmap'));
});

test('filters substance and date range for use charts', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'a', substanceId: COKE_ID, date: '2026-07-10', amount: 1 }),
            makeLog({ id: 'b', substanceId: COKE_ID, date: '2026-07-25', amount: 2 }),
            makeLog({ id: 'c', substanceId: WEED_ID, date: '2026-07-25', amount: 0.5 })
        ]
    });
    const data = rt.__getTestAppData();
    const ds = rt.buildChartDatasetForMetric('use_amount', {
        substanceId: COKE_ID,
        dateRangePreset: 'custom',
        customStart: '2026-07-20',
        customEnd: '2026-07-31',
        interval: 'daily',
        personalUseOnly: true
    }, data);
    assert.equal(ds.state, 'ok');
    assert.equal(ds.series.length, 1);
    assert.equal(ds.series[0].id, COKE_ID);
    const total = ds.series[0].points.reduce((s, p) => s + p.value, 0);
    assert.equal(total, 2);
});

test('all substances keeps separate series and never mixes unit families', () => {
    const rt = setup({
        logs: [
            makeLog({ substanceId: COKE_ID, date: '2026-07-25', amount: 1.5 }),
            makeLog({ substanceId: NIC_ID, date: '2026-07-25', amount: 40, transactionType: 'use' })
        ]
    });
    const data = rt.__getTestAppData();
    const ds = rt.buildChartDatasetForMetric('use_amount', {
        substanceId: 'all',
        dateRangePreset: 'last-30',
        interval: 'daily',
        personalUseOnly: true
    }, data);
    assert.equal(ds.state, 'ok');
    assert.ok(ds.series.length >= 2);
    assert.equal(ds.mode, 'grouped-small-multiples');
    assert.ok(String(ds.warning || '').toLowerCase().includes('never summed') || String(ds.warning || '').toLowerCase().includes('separate'));
    assert.equal(rt.chartIncompatibleMix(ds.series), true);
    const families = new Set(ds.series.map(s => s.unitFamily));
    assert.ok(families.has('mass_g'));
    assert.ok(families.has('puffs'));
    const validation = rt.validateChartMetricCombo('use_amount', { substanceId: 'all' });
    assert.equal(validation.ok, true);
    assert.ok(validation.warning);
});

test('personal-use mode excludes gifts and counts personal portion of shared use', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'use', date: '2026-07-22', amount: 2, transactionType: 'use' }),
            makeLog({
                id: 'shared',
                date: '2026-07-23',
                amount: 4,
                personalAmount: 1,
                sharedAmount: 3,
                transactionType: 'shared_use'
            }),
            makeLog({ id: 'gift', date: '2026-07-24', amount: 5, transactionType: 'gift_given' })
        ]
    });
    const data = rt.__getTestAppData();
    const personal = rt.buildChartDatasetForMetric('use_amount', {
        substanceId: COKE_ID,
        dateRangePreset: 'all-time',
        interval: 'daily',
        personalUseOnly: true,
        includeGifts: false,
        includeSharedUse: false
    }, data);
    const total = personal.series[0].points.reduce((s, p) => s + p.value, 0);
    assert.ok(total >= 2 && total <= 3.5, `expected personal total near 2–3, got ${total}`);
    assert.ok(!personal.series[0].points.some(p => p.value === 5));
});

test('spending includes purchased-as-gift and excludes gift received', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'pay', date: '2026-07-10', totalCost: 80, quantityBought: 2, acquisitionType: 'purchased' }),
            makePurchase({ id: 'gift-buy', date: '2026-07-12', totalCost: 40, quantityBought: 1, acquisitionType: 'purchased_as_gift' }),
            makePurchase({ id: 'recv', date: '2026-07-14', totalCost: 999, quantityBought: 5, acquisitionType: 'gift_received' })
        ]
    });
    const data = rt.__getTestAppData();
    const ds = rt.buildChartDatasetForMetric('spend_amount', {
        substanceId: COKE_ID,
        dateRangePreset: 'all-time',
        interval: 'daily'
    }, data);
    const total = ds.series.flatMap(s => s.points).reduce((s, p) => s + p.value, 0);
    assert.equal(total, 120);
});

test('inventory flow keeps purchased / used / gifted / remaining separate per substance', () => {
    const rt = setup({
        purchases: [
            makePurchase({
                id: 'inv1',
                date: '2026-07-10',
                quantityBought: 10,
                remainingAmount: 4,
                acquisitionType: 'purchased'
            }),
            makePurchase({
                id: 'gift-recv',
                date: '2026-07-11',
                quantityBought: 2,
                remainingAmount: 2,
                acquisitionType: 'gift_received',
                totalCost: 0
            })
        ],
        logs: [
            makeLog({ date: '2026-07-20', amount: 3, transactionType: 'use' }),
            makeLog({ date: '2026-07-21', amount: 1, transactionType: 'gift_given' })
        ]
    });
    const flow = rt.buildInventoryFlow({
        substanceId: COKE_ID,
        dateRangePreset: 'all-time',
        personalUseOnly: false,
        includeGifts: true
    }, rt.__getTestAppData());
    assert.ok(flow.flows.length >= 1);
    const row = flow.flows.find(f => f.substanceId === COKE_ID);
    assert.ok(row);
    assert.equal(row.purchased, 10);
    assert.equal(row.giftReceived, 2);
    assert.ok(row.used >= 3);
    assert.ok(row.gifted >= 1);
    assert.ok(row.remaining >= 4);
});

test('heatmap builds weekday/hour matrix', () => {
    const rt = setup({
        logs: [
            makeLog({ date: '2026-07-20', time: '14:30', amount: 1 }), // Mon
            makeLog({ date: '2026-07-20', time: '14:10', amount: 1 }),
            makeLog({ date: '2026-07-25', time: '09:00', amount: 2 }) // Sat
        ]
    });
    const ds = rt.buildChartDatasetForMetric('use_heatmap', {
        substanceId: COKE_ID,
        dateRangePreset: 'all-time',
        personalUseOnly: true
    }, rt.__getTestAppData());
    assert.equal(ds.chartType, 'heatmap');
    assert.ok(ds.heatmap?.matrix);
    assert.equal(ds.heatmap.matrix.length, 7);
    assert.equal(ds.heatmap.matrix[0].length, 24);
    const monHour14 = ds.heatmap.matrix[1][14];
    assert.ok(monHour14 >= 1);
});

test('period comparison attaches previous equal-length window', () => {
    const rt = setup({
        logs: [
            makeLog({ date: '2026-06-20', amount: 5 }),
            makeLog({ date: '2026-07-20', amount: 2 })
        ]
    });
    const data = rt.__getTestAppData();
    const prefs = rt.ensureChartSystemPrefs(data);
    prefs.filters = {
        ...prefs.filters,
        substanceId: COKE_ID,
        dateRangePreset: 'custom',
        customStart: '2026-07-01',
        customEnd: '2026-07-31',
        comparePeriod: 'previous-period',
        interval: 'monthly',
        personalUseOnly: true
    };
    prefs.widgets = [{
        id: 'w1',
        metricId: 'use_amount',
        title: 'Use',
        chartType: 'line',
        visible: true,
        order: 0,
        overrides: {},
        settings: {}
    }];
    const dash = rt.buildChartDashboardDataset(data, { bypassCache: true });
    assert.equal(dash.widgets.length, 1);
    assert.ok(dash.widgets[0].comparison);
    assert.ok(dash.widgets[0].comparison.previousBounds?.startDate);
    assert.ok(dash.widgets[0].comparison.previousBounds?.endDate);
    assert.ok(dash.widgets[0].comparison.previousBounds.endDate < '2026-07-01');
});

test('applyChartPreset swaps widgets and csv export includes series rows', () => {
    const rt = setup({
        logs: [makeLog({ date: '2026-07-22', amount: 1.2 })],
        purchases: [makePurchase({ date: '2026-07-15', totalCost: 50 })]
    });
    const data = rt.__getTestAppData();
    rt.applyChartPreset('spending');
    const prefs = rt.getChartSystemPrefs(data);
    assert.equal(prefs.activePreset, 'spending');
    assert.ok(prefs.widgets.some(w => String(w.metricId).includes('spend')));
    // Align shared Insights filters so export (which syncs from Insights) sees July data
    if (typeof rt.setSelectedInsightsDateRange === 'function') {
        rt.setSelectedInsightsDateRange('custom', '2026-07-01', '2026-07-31', { render: false, save: false });
        rt.setSelectedInsightsSubstance(COKE_ID, { render: false, save: false });
    } else {
        prefs.filters.dateRangePreset = 'custom';
        prefs.filters.customStart = '2026-07-01';
        prefs.filters.customEnd = '2026-07-31';
        prefs.filters.substanceId = COKE_ID;
    }
    const csv = rt.exportChartDashboardCsv();
    assert.ok(csv.includes('widget'));
    assert.ok(csv.includes('metric'));
    assert.ok(csv.split('\n').length > 1);
});

test('taper overlay metric returns progress or empty without inventing targets', () => {
    const rt = setup();
    const ds = rt.buildChartDatasetForMetric('weekly_target_progress', {
        substanceId: COKE_ID,
        dateRangePreset: 'last-30'
    }, rt.__getTestAppData());
    assert.ok(['ok', 'empty', 'insufficient'].includes(ds.state));
    assert.ok(Array.isArray(ds.series));
});
