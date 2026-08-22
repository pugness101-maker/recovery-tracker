import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';
const NICOTINE_ID = 'nicotine';
const LSD_ID = 'lsd';
const REFERENCE_DATE = '2026-07-28';

function makeSubstances() {
    return [
        {
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            trackingMode: 'powder',
            primaryUnit: 'g',
            secondaryCountLabel: 'lines',
            units: ['g'],
            defaultUnit: 'g',
            active: true,
            isMain: true,
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        },
        {
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs'],
            defaultUnit: 'puffs',
            active: true,
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        },
        {
            id: LSD_ID,
            name: 'LSD',
            icon: '🌀',
            trackingMode: 'lsd',
            primaryUnit: 'ug',
            units: ['ug', 'tabs'],
            defaultUnit: 'ug',
            active: true,
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }
    ];
}

function cokeLog(id, date, extras = {}) {
    return {
        id,
        substanceId: COKE_ID,
        date,
        startTime: '20:00',
        endTime: extras.type === 'quick' ? '' : '22:00',
        amount: extras.amount ?? 0.5,
        unit: 'g',
        transactionType: extras.transactionType || 'use',
        type: extras.type || 'session',
        lines: extras.lines ?? null,
        count: extras.count ?? extras.lines ?? null,
        estimatedCost: (extras.amount ?? 0.5) * 80,
        ...extras
    };
}

function nicotineLog(id, date, extras = {}) {
    return {
        id,
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date,
        amount: extras.amount ?? 400,
        unit: 'puffs',
        transactionType: extras.transactionType || 'use',
        type: extras.type || 'quick',
        ...extras
    };
}

function lsdLog(id, date) {
    return {
        id,
        substanceId: LSD_ID,
        date,
        amount: 100,
        ugUsed: 100,
        tabsUsed: 1,
        unit: 'ug',
        transactionType: 'use',
        type: 'quick'
    };
}

function makeData({ logs = [], purchases = [], settings = {} } = {}) {
    return {
        substances: makeSubstances(),
        logs,
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: 'all',
            calendarView: { weekStarts: 'sunday' },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true }
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.setUseLogFilter('all');
    rt.clearUseLogFilters();
    return rt;
}

const SAMPLE_LOGS = [
    cokeLog('coke-today', '2026-07-28', { amount: 0.9, lines: 8, type: 'session' }),
    cokeLog('coke-week', '2026-07-26', { amount: 0.4, lines: 3, type: 'quick' }),
    cokeLog('coke-old', '2026-07-01', { amount: 1.2, lines: 10, type: 'session' }),
    cokeLog('coke-gift', '2026-07-28', { amount: 0.3, lines: 99, transactionType: 'gift_given', type: 'quick' }),
    cokeLog('coke-received', '2026-07-28', { amount: 0.2, lines: 20, transactionType: 'gift_received', type: 'quick' }),
    nicotineLog('nic-today', '2026-07-28', { amount: 500 }),
    nicotineLog('nic-old', '2026-07-01', { amount: 1000 }),
    lsdLog('lsd-today', '2026-07-28')
];

test('Log Filters markup includes substance, date range, transaction, entry, and Clear Filters', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="use-log-filter-panel"/);
    assert.match(html, /id="use-log-filter-substance"/);
    assert.match(html, /id="use-log-filter-date-start"/);
    assert.match(html, /id="use-log-filter-date-end"/);
    assert.match(html, /id="use-log-filter-transaction"/);
    assert.match(html, /id="use-log-filter-entry"/);
    assert.match(html, /clearUseLogFilters\(\)/);
    assert.match(html, /onclick="setUseLogFilter\('all'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('today'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('week'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('month'\)"/);
    assert.match(html, /id="sidebar-substance"/);
});

test('Use History table CSS includes row and column separators', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.use-history-table th,\s*\.use-history-table td \{[^}]*border-bottom:\s*1px solid var\(--border\)/s);
    assert.match(css, /\.use-history-table th,\s*\.use-history-table td \{[^}]*border-right:/s);
    assert.match(css, /\.use-history-table thead th \{[^}]*position:\s*sticky/s);
});

test('Active Substance filters Home, Log, Inventory, Tapers, and Insights', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });

    assert.equal(rt.getUseLogViewSubstanceId(), COKE_ID);
    assert.equal(rt.getSelectedDashboardSubstance(), COKE_ID);
    assert.equal(rt.getSelectedInsightsSubstance(), COKE_ID);
    assert.equal(rt.getTaperSubstanceId(), COKE_ID);

    const logs = rt.getFilteredUseLogs();
    assert.ok(logs.length >= 1);
    assert.ok(logs.every(l => l.substanceId === COKE_ID));

    const cards = rt.getLayoutTodayCards();
    assert.equal(cards.length, 1);
    assert.equal(cards[0].substanceId, COKE_ID);
});

test('All substances shows separate Home cards without combining incompatible units', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(rt.DASHBOARD_ALL, { refresh: false });

    const cards = rt.getLayoutTodayCards();
    const ids = cards.map(c => c.substanceId);
    assert.ok(ids.includes(COKE_ID));
    assert.ok(ids.includes(NICOTINE_ID));
    assert.ok(ids.includes(LSD_ID));
    assert.equal(new Set(ids).size, ids.length);

    const totals = rt.getUseLogTotalsForView(null);
    assert.equal(totals.totalGrams, null);
    const label = rt.formatMixedUseTotalsLabel(totals.logs);
    assert.match(label, /Coke:/);
    assert.match(label, /Nicotine:/);
    assert.match(label, /LSD:/);
    assert.doesNotMatch(label, /^\d+(\.\d+)?\s*units$/i);
});

test('Date shortcuts All, Today, This Week, and This Month use local dates', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });

    rt.setUseLogFilter('today');
    let bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, REFERENCE_DATE);
    assert.equal(bounds.endDate, REFERENCE_DATE);
    let ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-today'));
    assert.ok(!ids.includes('coke-old'));

    rt.setUseLogFilter('week');
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-07-26');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-today'));
    assert.ok(ids.includes('coke-week'));
    assert.ok(!ids.includes('coke-old'));

    rt.setUseLogFilter('month');
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-07-01');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-old'));

    rt.setUseLogFilter('all');
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, null);
    assert.equal(bounds.endDate, null);
});

test('This Week respects calendar week-start Monday', () => {
    const rt = setup(makeData({
        logs: SAMPLE_LOGS,
        settings: { calendarView: { weekStarts: 'monday' }, dashboardSubstanceId: 'all' }
    }));
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.setUseLogFilter('week');
    const bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-07-27');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    assert.equal(rt.getUseLogWeekStartDateStr(REFERENCE_DATE), '2026-07-27');
});

test('Transaction Type and Entry Type filters combine with AND logic', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.setUseLogFilter('all');

    const gifts = rt.getFilteredUseLogs({ transactionType: 'gift_given' });
    assert.equal(gifts.length, 1);
    assert.equal(gifts[0].id, 'coke-gift');

    const sessions = rt.getFilteredUseLogs({ entryType: 'session' });
    assert.ok(sessions.every(l => l.type === 'session'));
    assert.ok(!sessions.some(l => l.transactionType === 'gift_given'));

    const combined = rt.getFilteredUseLogs({
        substanceId: COKE_ID,
        dateFilter: 'today',
        transactionType: 'use',
        entryType: 'session'
    });
    assert.equal(combined.length, 1);
    assert.equal(combined[0].id, 'coke-today');

    const none = rt.getFilteredUseLogs({
        transactionType: 'gift_given',
        entryType: 'session'
    });
    assert.equal(none.length, 0);
});

test('Custom date range and Clear Filters restore the full dataset', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.useLogListFiltersRef.value = {
        datePreset: 'custom',
        dateStart: '2026-07-26',
        dateEnd: '2026-07-28',
        transactionType: 'use',
        entryType: 'quick'
    };
    const custom = rt.getFilteredUseLogs();
    assert.equal(custom.length, 1);
    assert.equal(custom[0].id, 'coke-week');

    rt.clearUseLogFilters();
    assert.equal(rt.getUseLogViewSubstanceId(), null);
    const cleared = rt.getFilteredUseLogs();
    assert.ok(cleared.length >= 6);
    assert.ok(cleared.some(l => l.substanceId === NICOTINE_ID));
});

test('Summary, History, Bulk selection, and CSV share getFilteredUseLogs()', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    rt.setUseLogFilter('today');

    const dataset = rt.getFilteredUseLogs();
    assert.equal(dataset.length, 1);
    assert.equal(dataset[0].id, 'nic-today');
    assert.equal(rt.getFilteredUseLogsForView().length, dataset.length);

    const rows = rt.buildUseHistoryRows();
    assert.equal(rows.length, dataset.length);
    assert.equal(rt.getUseLogTotalsForView().entryCount, dataset.length);
    assert.equal(rt.__getUseHistoryEntryCount(), dataset.length);

    const csv = rt.buildUseHistoryCsvRows();
    assert.equal(csv.body.length, dataset.length);
});

test('Lines persist, display, total personal use only, and are not derived from grams', () => {
    const rt = setup(makeData({
        logs: [
            cokeLog('with-lines', '2026-07-28', { amount: 0.9, lines: 8, type: 'session' }),
            cokeLog('gift', '2026-07-28', { amount: 1, lines: 99, transactionType: 'gift_given', type: 'quick' }),
            cokeLog('no-lines', '2026-07-27', { amount: 2.2, lines: null, count: 0, type: 'session' })
        ]
    }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });

    const withLines = rt.__getTestAppData().logs.find(l => l.id === 'with-lines');
    assert.equal(rt.getUseLogLines(withLines), 8);
    assert.notEqual(rt.getUseLogLines(withLines), withLines.amount);

    const gift = rt.__getTestAppData().logs.find(l => l.id === 'gift');
    assert.equal(rt.logCountsTowardLinesTotal(gift), false);

    const totals = rt.getUseLogTotalsForView(COKE_ID);
    assert.equal(totals.totalLines, 8);

    rt.saveData(rt.__getTestAppData());
    const imported = rt.normalizeAppDataSafe(JSON.parse(rt.__getStorageSnapshot()));
    assert.equal(rt.getUseLogLines(imported.logs.find(l => l.id === 'with-lines')), 8);
    assert.equal(rt.getUseLogLines(imported.logs.find(l => l.id === 'no-lines')), null);
});

test('Saved data still loads after filter changes without resetting IDs', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    const originalIds = rt.__getTestAppData().logs.map(l => l.id).sort();
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.setUseLogFilter('today');
    rt.saveData(rt.__getTestAppData());

    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.deepEqual(reloaded.logs.map(l => l.id).sort(), originalIds);
    assert.equal(reloaded.logs.length, SAMPLE_LOGS.length);
});
