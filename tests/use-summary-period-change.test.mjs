import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';

function makePurchase(overrides = {}) {
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: COKE_ID,
        date: '2026-07-02',
        time: '12:00',
        quantity: 3.5,
        quantityBought: 3.5,
        unit: 'g',
        totalCost: 100,
        store: 'Main',
        paymentMethod: 'Cash',
        ...overrides,
        quantity: overrides.quantity ?? overrides.quantityBought ?? 3.5,
        quantityBought: overrides.quantityBought ?? overrides.quantity ?? 3.5
    };
}

function setup(logs, purchases = []) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate('2026-08-15');
    const substances = [{
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true,
        active: true,
        isMain: true
    }];
    const data = makeTestData(logs, substances);
    data.purchases = purchases;
    data.settings = {
        ...(data.settings || {}),
        currency: '$',
        substanceSettings: {},
        spreadPercentLeftUsage: true
    };
    rt.__setTestAppData(data);
    return rt;
}

test('formatPeriodChangePercent colors decreases green when lower is better', () => {
    const rt = loadRecoveryTrackerApp();
    const down = rt.formatPeriodChangePercent(3, 10, { higherIsBetter: false });
    assert.equal(down.text, '↓ 70.0%');
    assert.equal(down.status, 'improved');
    assert.match(down.html, /period-change-improved/);

    const up = rt.formatPeriodChangePercent(12, 10, { higherIsBetter: false });
    assert.equal(up.text, '↑ 20.0%');
    assert.equal(up.status, 'worsened');

    const higherBetterUp = rt.formatPeriodChangePercent(12, 10, { higherIsBetter: true });
    assert.equal(higherBetterUp.status, 'improved');
});

test('attachUseSummaryPeriodChanges compares to previous row and leaves oldest as dash', () => {
    const rt = loadRecoveryTrackerApp();
    const rows = rt.attachUseSummaryPeriodChanges([
        {
            monthLabel: 'August 2026',
            totalUsage: 3,
            cost: 40,
            purchaseCount: 2,
            sessions: 4,
            useDays: 3
        },
        {
            monthLabel: 'July 2026',
            totalUsage: 10,
            cost: 100,
            purchaseCount: 5,
            sessions: 8,
            useDays: 8
        }
    ], prev => prev.monthLabel);

    assert.equal(rows[0].periodChanges.usageChangePct.text, '↓ 70.0%');
    assert.equal(rows[0].periodChanges.usageChangePct.title, 'Compared with July 2026');
    assert.equal(rows[0].periodChanges.costChangePct.text, '↓ 60.0%');
    assert.equal(rows[0].periodChanges.purchaseChangePct.text, '↓ 60.0%');
    assert.equal(rows[0].periodChanges.sessionsChangePct.text, '↓ 50.0%');
    assert.equal(rows[0].periodChanges.useDaysChangePct.text, '↓ 62.5%');
    assert.equal(rows[1].periodChanges.usageChangePct.text, '—');
    assert.equal(rows[1].periodChanges.usageChangePct.title, '');
});

test('monthly change summary chips match latest vs prior month', () => {
    const rt = loadRecoveryTrackerApp();
    const rows = rt.attachUseSummaryPeriodChanges([
        {
            monthLabel: 'August 2026',
            totalUsage: 2.95,
            cost: 42.8,
            purchaseCount: 2,
            sessions: 4,
            useDays: 3
        },
        {
            monthLabel: 'July 2026',
            totalUsage: 10,
            cost: 100,
            purchaseCount: 5,
            sessions: 8,
            useDays: 8
        }
    ], prev => prev.monthLabel);
    const html = rt.buildMonthlyUseChangeSummaryHtml(rows);
    assert.match(html, /Use: ↓ 70\.5% vs last month/);
    assert.match(html, /Cost: ↓ 57\.2%/);
    assert.match(html, /Purchases: ↓ 60\.0%/);
    assert.match(html, /Sessions: ↓ 50\.0%/);
    assert.match(html, /Use Days: ↓ 62\.5%/);
    assert.match(html, /Compared with July 2026/);
});

test('weekly period change tooltips use ISO week numbers', () => {
    const rt = loadRecoveryTrackerApp();
    // 2026-07-27 is a Monday in ISO week 31
    assert.equal(rt.getIsoWeekNumber('2026-07-27'), 31);
    const rows = rt.attachUseSummaryPeriodChanges([
        {
            weekStart: '2026-08-03',
            weekEnd: '2026-08-09',
            totalUsage: 2,
            cost: 10,
            purchaseCount: 1,
            sessions: 2,
            useDays: 2
        },
        {
            weekStart: '2026-07-27',
            weekEnd: '2026-08-02',
            totalUsage: 4,
            cost: 20,
            purchaseCount: 2,
            sessions: 4,
            useDays: 4
        }
    ], prev => {
        const weekNum = rt.getIsoWeekNumber(prev.weekStart);
        return `Week ${weekNum}`;
    });
    assert.equal(rows[0].periodChanges.usageChangePct.title, 'Compared with Week 31');
    assert.equal(rows[0].periodChanges.usageChangePct.text, '↓ 50.0%');
});

test('Monthly/Weekly Use Summary columns include period-change ids', () => {
    const rt = loadRecoveryTrackerApp();
    const weekly = rt.getDefaultColumnSettings('statsWeekly').order;
    const monthly = rt.getDefaultColumnSettings('statsMonthly').order;
    [
        'usageChangePct',
        'costChangePct',
        'purchaseChangePct',
        'sessionsChangePct',
        'useDaysChangePct'
    ].forEach(id => {
        assert.ok(weekly.includes(id), `weekly missing ${id}`);
        assert.ok(monthly.includes(id), `monthly missing ${id}`);
    });
    assert.equal(rt.getTableColumnLabelForSubstance('statsMonthly', 'usageChangePct', COKE_ID), 'Use %');
    assert.equal(rt.getTableColumnLabelForSubstance('statsMonthly', 'usePct', COKE_ID), 'Use day %');
});

test('filtered monthly summaries enrich purchaseCount for Purchase %', () => {
    const rt = setup([
        makeUseLog({ id: 'l1', substanceId: COKE_ID, date: '2026-07-10', amount: 2 }),
        makeUseLog({ id: 'l2', substanceId: COKE_ID, date: '2026-07-11', amount: 2 }),
        makeUseLog({ id: 'l3', substanceId: COKE_ID, date: '2026-08-05', amount: 1 })
    ], [
        makePurchase({ id: 'p1', date: '2026-07-03', totalCost: 100, quantityBought: 3.5 }),
        makePurchase({ id: 'p2', date: '2026-07-20', totalCost: 80, quantityBought: 2 }),
        makePurchase({ id: 'p3', date: '2026-08-04', totalCost: 50, quantityBought: 1 })
    ]);
    rt.setStatsDateRangeForTest('custom', '2026-07-01', '2026-08-31');
    const dataset = rt.buildInsightsDataset(COKE_ID);
    const enriched = dataset.monthlySummaries.map(s =>
        rt.enrichMonthlySummaryWithBuyData(s, COKE_ID, dataset.bounds)
    );
    const withChanges = rt.attachUseSummaryPeriodChanges(enriched, prev => prev.monthLabel);
    assert.ok(withChanges.length >= 2);
    const august = withChanges.find(r => r.monthLabel === 'August 2026');
    assert.ok(august);
    assert.equal(august.purchaseCount, 1);
    assert.equal(august.periodChanges.purchaseChangePct.title, 'Compared with July 2026');
});
