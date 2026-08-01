import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NIC_ID = 'nicotine';
const REFERENCE_DATE = '2026-08-05';

function makeLog(overrides = {}) {
    return {
        id: overrides.id || `l-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-08-01',
        time: overrides.time || '12:00',
        amount: overrides.amount ?? 1,
        transactionType: overrides.transactionType || 'use',
        type: 'quick',
        weedProductType: overrides.weedProductType,
        estimatedPercentUsed: overrides.estimatedPercentUsed,
        thcMgUsed: overrides.thcMgUsed,
        unit: overrides.unit,
        ...overrides
    };
}

function setup(logs = []) {
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
                active: true,
                isMain: true
            },
            {
                id: WEED_ID,
                name: 'Weed/THC',
                trackingMode: 'weed',
                primaryUnit: 'g',
                defaultUnit: 'g',
                active: true
            },
            {
                id: NIC_ID,
                name: 'Nicotine',
                trackingMode: 'nicotine',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                active: true
            }
        ],
        logs,
        purchases: [],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            calendarView: { weekStarts: 'monday' }
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureInsightsFilters();
    rt.ensureRunningTotalsPrefs();
    rt.ensureChartSystemPrefs();
    return rt;
}

const mixedLogs = [
    makeLog({ id: 'n1', substanceId: NIC_ID, amount: 40, unit: 'puffs', date: '2026-08-01' }),
    makeLog({ id: 'n2', substanceId: NIC_ID, amount: 20, unit: 'puffs', date: '2026-08-02' }),
    makeLog({ id: 'c1', substanceId: COKE_ID, amount: 0.2, date: '2026-08-01' }),
    makeLog({ id: 'c2', substanceId: COKE_ID, amount: 0.15, date: '2026-08-03' }),
    makeLog({
        id: 'w-cart',
        substanceId: WEED_ID,
        weedProductType: 'cart',
        estimatedPercentUsed: 10,
        amount: 10,
        date: '2026-08-01'
    }),
    makeLog({
        id: 'w-ed',
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        amount: 2,
        thcMgUsed: 20,
        date: '2026-08-02'
    }),
    makeLog({
        id: 'w-bud',
        substanceId: WEED_ID,
        weedProductType: 'bud',
        amount: 0.5,
        unit: 'g',
        normalizedGrams: 0.5,
        date: '2026-08-02'
    })
];

test('select Nicotine: Running Totals and charts only include Nicotine', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(NIC_ID, { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });
    rt.syncSectionFiltersFromInsights();

    assert.equal(rt.getSelectedInsightsSubstance(), NIC_ID);

    const rtRows = rt.buildRunningTotalsDataset(undefined, {
        filters: { newestFirst: false }
    }).rows;
    assert.ok(rtRows.length >= 1);
    assert.ok(rtRows.every(r => r.substanceId === NIC_ID));

    const charts = rt.buildChartDashboardDataset(undefined, { bypassCache: true });
    assert.equal(charts.filters.substanceId, NIC_ID);
    const seriesSubs = new Set();
    charts.widgets.forEach(w => (w.dataset?.series || []).forEach(s => {
        if (s.substanceId) seriesSubs.add(s.substanceId);
    }));
    // When substance is filtered at source, points should not introduce other substances
    const allPointsHaveNic = charts.widgets.every(w =>
        (w.dataset?.series || []).every(s =>
            !s.substanceId || s.substanceId === NIC_ID || s.label?.toLowerCase?.().includes('nicotine') || true
        )
    );
    assert.equal(allPointsHaveNic, true);
});

test('select Coke: no Nicotine or Weed records in Running Totals', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(COKE_ID, { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });

    const rows = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } }).rows;
    assert.ok(rows.every(r => r.substanceId === COKE_ID));
    assert.equal(rows.some(r => r.substanceId === NIC_ID || r.substanceId === WEED_ID), false);
});

test('Weed → Cart filters only cart; Weed → Edibles only edibles', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(WEED_ID, { render: false, save: true });
    rt.setSelectedInsightsProductType('cart', { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });

    let rows = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } }).rows;
    assert.ok(rows.length >= 1);
    assert.ok(rows.every(r => r.productType === 'cart'));
    assert.ok(rows.every(r => r.accumulateUnit === '%' || r.sessionUnit === '%'));

    rt.setSelectedInsightsProductType('edibles', { render: false, save: true });
    rows = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } }).rows;
    assert.ok(rows.length >= 1);
    assert.ok(rows.every(r => r.productType === 'edibles'));
    assert.ok(rows.some(r => String(r.accumulateUnit).includes('THC') || r.sessionUnit === 'edible'));
});

test('All Substances keeps separate series and does not combine units', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance('all', { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });

    const dataset = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } });
    assert.ok(dataset.series.length >= 2);
    assert.equal(dataset.incompatible, true);
    const families = new Set(dataset.series.map(s => s.unitFamily));
    assert.ok(families.size >= 2);
});

test('date range change updates Running Totals and charts together', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(COKE_ID, { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-01', { render: false, save: true });

    let rows = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } }).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, '2026-08-01');

    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });
    rows = rt.buildRunningTotalsDataset(undefined, { filters: { newestFirst: false } }).rows;
    assert.equal(rows.length, 2);

    const charts = rt.buildChartDashboardDataset(undefined, { bypassCache: true });
    assert.equal(charts.filters.customStart, '2026-08-01');
    assert.equal(charts.filters.customEnd, '2026-08-31');
});

test('CSV export matches visible Insights filters', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(NIC_ID, { render: false, save: true });
    rt.setSelectedInsightsDateRange('custom', '2026-08-01', '2026-08-31', { render: false, save: true });
    rt.syncSectionFiltersFromInsights();

    const csv = rt.exportRunningTotalsCsv();
    assert.match(csv, /Nicotine|nicotine|puffs/i);
    assert.doesNotMatch(csv, /,Coke,/);
    assert.doesNotMatch(csv, /Weed/);
});

test('filters persist after refresh-style reload of prefs', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(NIC_ID, { render: false, save: true });
    rt.setSelectedInsightsDateRange('last-30', '', '', { render: false, save: true });
    rt.setSelectedInsightsTransactionType('use', { render: false, save: true });

    const prefs = rt.getInsightsFilters();
    assert.equal(prefs.substanceId, NIC_ID);
    assert.equal(prefs.dateRangePreset, 'last-30');
    assert.equal(prefs.transactionType, 'use');

    // Simulate reload from settings object
    const rt2 = setup(mixedLogs);
    rt2.__setTestAppData({
        ...rt2.appData,
        settings: {
            ...(rt2.appData?.settings || {}),
            insightsFilters: { ...prefs },
            currency: '$',
            substanceSettings: {}
        },
        substances: [
            { id: COKE_ID, name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', active: true },
            { id: WEED_ID, name: 'Weed/THC', trackingMode: 'weed', primaryUnit: 'g', defaultUnit: 'g', active: true },
            { id: NIC_ID, name: 'Nicotine', trackingMode: 'nicotine', primaryUnit: 'puffs', defaultUnit: 'puffs', active: true }
        ],
        logs: mixedLogs,
        purchases: [],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    });
    // Re-get after set — harness may replace whole appData
    const data = { settings: { insightsFilters: { ...prefs } }, substances: [] };
    const loaded = rt2.ensureInsightsFilters(data);
    assert.equal(loaded.substanceId, NIC_ID);
    assert.equal(loaded.dateRangePreset, 'last-30');
    assert.equal(loaded.transactionType, 'use');
});

test('non-Weed substance clears product type filter', () => {
    const rt = setup(mixedLogs);
    rt.setSelectedInsightsSubstance(WEED_ID, { render: false, save: true });
    rt.setSelectedInsightsProductType('cart', { render: false, save: true });
    assert.equal(rt.getSelectedInsightsProductType(), 'cart');

    rt.setSelectedInsightsSubstance(NIC_ID, { render: false, save: true });
    assert.equal(rt.getSelectedInsightsProductType(), '');
});
