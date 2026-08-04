import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const NIC_ID = 'nicotine';
const REFERENCE_DATE = '2026-08-14';

function makeLog(overrides = {}) {
    return {
        id: overrides.id || `l-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-08-01',
        time: overrides.time || '12:00',
        amount: overrides.amount ?? 1,
        personalAmount: overrides.personalAmount,
        sharedAmount: overrides.sharedAmount,
        totalAmount: overrides.totalAmount,
        transactionType: overrides.transactionType || 'use',
        type: overrides.type || 'quick',
        unit: overrides.unit || 'g',
        ...overrides
    };
}

function setup(logs = [], settings = {}) {
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
            calendarView: { weekStarts: 'monday' },
            insightsFilters: {
                substanceId: COKE_ID,
                productType: '',
                dateRangePreset: 'custom',
                customStart: '2026-08-01',
                customEnd: '2026-08-14',
                transactionType: ''
            },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureInsightsFilters();
    rt.ensureAverageUseAnalyticsPrefs();
    return rt;
}

function sampleCokeLogs() {
    return [
        makeLog({ id: 'd1', date: '2026-08-01', amount: 2 }),
        makeLog({ id: 'd2', date: '2026-08-03', amount: 2 }),
        makeLog({ id: 'd3', date: '2026-08-05', amount: 2 }),
        makeLog({ id: 'd4', date: '2026-08-07', amount: 2 }),
        makeLog({ id: 'd5', date: '2026-08-09', amount: 2 }),
        makeLog({ id: 'd6', date: '2026-08-11', amount: 2 }),
        makeLog({ id: 'd7', date: '2026-08-13', amount: 2 })
    ];
}

test('active-day, calendar-day, weekly, monthly, total, use days, and sessions averages', () => {
    const rt = setup(sampleCokeLogs(), {
        averageUseAnalytics: { denominatorMode: 'full' }
    });
    const dataset = rt.buildAverageUseAnalyticsDataset();
    const row = dataset.rows[0];

    assert.equal(row.totalUse, 14);
    assert.equal(row.useDays, 7);
    assert.equal(row.calendarDays, 14);
    assert.equal(row.sessions, 7);
    assert.equal(row.avgActiveDay, 2);
    assert.equal(row.avgCalendarDay, 1);
    assert.equal(row.avgWeek, 7);
    assert.ok(Math.abs(row.avgMonth - (14 / (14 / (365.25 / 12)))) < 0.000001);
});

test('custom ranges use inclusive selected dates and fractional week/month denominators', () => {
    const rt = setup([
        ...sampleCokeLogs(),
        makeLog({ id: 'before', date: '2026-07-31', amount: 100 }),
        makeLog({ id: 'after', date: '2026-08-15', amount: 100 })
    ], {
        averageUseAnalytics: { denominatorMode: 'full' }
    });
    const row = rt.buildAverageUseAnalyticsDataset().rows[0];

    assert.equal(row.totalUse, 14);
    assert.equal(row.denominators.week, 2);
    assert.ok(Math.abs(row.denominators.month - (14 / (365.25 / 12))) < 0.000001);
});

test('active-period denominator uses only weeks and months that contain qualifying use', () => {
    const rt = setup([
        makeLog({ id: 'a', date: '2026-08-01', amount: 2 }),
        makeLog({ id: 'b', date: '2026-08-14', amount: 2 })
    ], {
        averageUseAnalytics: { denominatorMode: 'active' }
    });
    const row = rt.buildAverageUseAnalyticsDataset().rows[0];

    assert.equal(row.totalUse, 4);
    assert.equal(row.denominators.activeWeeks, 2);
    assert.equal(row.denominators.week, 2);
    assert.equal(row.denominators.activeMonths, 1);
    assert.equal(row.avgWeek, 2);
    assert.equal(row.avgMonth, 4);
});

test('Shared Use counts personal portion while gifts and adjustments are excluded', () => {
    const rt = setup([
        makeLog({ id: 'use', date: '2026-08-01', amount: 2 }),
        makeLog({
            id: 'shared',
            date: '2026-08-02',
            amount: 10,
            personalAmount: 3,
            sharedAmount: 7,
            totalAmount: 10,
            transactionType: 'shared_use'
        }),
        makeLog({ id: 'gift', date: '2026-08-03', amount: 99, transactionType: 'gift_given' }),
        makeLog({ id: 'received', date: '2026-08-04', amount: 99, transactionType: 'gift_received' }),
        makeLog({ id: 'adjust', date: '2026-08-05', amount: 99, transactionType: 'inventory_adjustment' }),
        makeLog({ id: 'child', date: '2026-08-06', amount: 99, isDistributedChild: true })
    ]);
    const row = rt.buildAverageUseAnalyticsDataset().rows[0];

    assert.equal(row.totalUse, 5);
    assert.equal(row.sessions, 2);
    assert.equal(row.useDays, 2);
    assert.equal(row.avgActiveDay, 2.5);
});

test('All Substances groups rows separately and does not combine units', () => {
    const rt = setup([
        makeLog({ id: 'c1', substanceId: COKE_ID, date: '2026-08-01', amount: 2, unit: 'g' }),
        makeLog({ id: 'n1', substanceId: NIC_ID, date: '2026-08-01', amount: 40, unit: 'puffs' })
    ], {
        insightsFilters: {
            substanceId: 'all',
            productType: '',
            dateRangePreset: 'custom',
            customStart: '2026-08-01',
            customEnd: '2026-08-14',
            transactionType: ''
        }
    });
    const rows = rt.buildAverageUseAnalyticsDataset().rows;

    assert.equal(rows.length, 2);
    assert.deepEqual(Array.from(rows.map(r => r.substanceId).sort()), [COKE_ID, NIC_ID]);
    assert.deepEqual(Array.from(rows.map(r => r.unit).sort()), ['g', 'puffs']);
});

test('zero-use ranges return no rows and CSV still exports headers', () => {
    const rt = setup([
        makeLog({ id: 'outside', date: '2026-07-01', amount: 5 })
    ]);
    const dataset = rt.buildAverageUseAnalyticsDataset();
    const rows = rt.buildAverageUseAnalyticsCsvRows(dataset);
    const csv = rt.exportAverageUseAnalyticsCsv();

    assert.equal(dataset.rows.length, 0);
    assert.deepEqual(Array.from(rows[0]), [
        'Period',
        'Total Use',
        'Use Days',
        'Sessions',
        'Avg/Active Day',
        'Avg/Calendar Day',
        'Avg/Week',
        'Avg/Month'
    ]);
    assert.match(csv, /^Period,Total Use,Use Days,Sessions,Avg\/Active Day,Avg\/Calendar Day,Avg\/Week,Avg\/Month/);
});

test('CSV export includes selected range rows', () => {
    const rt = setup(sampleCokeLogs(), {
        averageUseAnalytics: { denominatorMode: 'full' }
    });
    const csv = rt.exportAverageUseAnalyticsCsv();

    assert.match(csv, /Aug 1, 2026/);
    assert.match(csv, /14/);
    assert.match(csv, /7/);
});
