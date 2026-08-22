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

test('Log Filters markup includes date shortcuts, transaction, entry, range filters, and Clear Filters', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="use-log-filter-panel"/);
    assert.match(html, /id="use-log-filter-transaction"/);
    assert.match(html, /id="use-log-filter-entry"/);
    assert.match(html, /clearUseLogFilters\(\)/);
    assert.match(html, /onclick="setUseLogFilter\('all'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('today'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('week'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('month'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('last-7'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('last-30'\)"/);
    assert.match(html, /onclick="setUseLogFilter\('custom'\)"/);
    assert.match(html, />All Time</);
    assert.match(html, />Last 7 Days</);
    assert.match(html, />Last 30 Days</);
    assert.match(html, />Custom Range</);
    assert.match(html, /id="use-log-filter-date-start"/);
    assert.match(html, /id="use-log-filter-date-end"/);
    assert.match(html, /id="sidebar-substance"/);
    assert.match(html, /Transaction Type/);
    assert.match(html, /Entry Type/);
    assert.match(html, /Clear Filters/);
    assert.match(html, /id="use-log-filter-amount-min"/);
    assert.match(html, /id="use-log-filter-amount-max"/);
    assert.match(html, /id="use-log-filter-duration-min"/);
    assert.match(html, /id="use-log-filter-cost-min"/);
    assert.match(html, /id="use-log-filter-lines-min"/);
    assert.match(html, /id="use-log-filter-rate-min"/);
    assert.match(html, /id="use-log-filter-start-min"/);
    assert.match(html, /id="use-log-filter-end-min"/);
    assert.match(html, /id="use-log-filter-break-min"/);
    assert.match(html, /Amount used/);
    assert.match(html, /Session duration/);
    assert.match(html, /Estimated cost/);
    assert.match(html, /Number of lines/);
    assert.match(html, /Use rate/);
    assert.match(html, /Start time/);
    assert.match(html, /End time/);
    assert.match(html, /Break between uses/);
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

    rt.setUseLogFilter('last-7');
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-07-22');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-today'));
    assert.ok(ids.includes('coke-week'));
    assert.ok(!ids.includes('coke-old'));

    rt.setUseLogFilter('last-30');
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-06-29');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-old'));

    rt.setUseLogFilter('custom');
    rt.useLogListFiltersRef.value = {
        datePreset: 'custom',
        customStart: '2026-07-26',
        customEnd: '2026-07-28'
    };
    bounds = rt.getUseLogFilterBounds();
    assert.equal(bounds.startDate, '2026-07-26');
    assert.equal(bounds.endDate, '2026-07-28');
    ids = rt.getFilteredUseLogs().map(l => l.id);
    assert.ok(ids.includes('coke-today'));
    assert.ok(ids.includes('coke-week'));
    assert.ok(!ids.includes('coke-old'));
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

    rt.setUseLogFilter('last-7');
    const last7Use = rt.getFilteredUseLogs({
        substanceId: COKE_ID,
        dateFilter: 'last-7',
        transactionType: 'use',
        entryType: 'quick'
    });
    assert.equal(last7Use.length, 1);
    assert.equal(last7Use[0].id, 'coke-week');

    const none = rt.getFilteredUseLogs({
        transactionType: 'gift_given',
        entryType: 'session'
    });
    assert.equal(none.length, 0);
});

test('Clear Filters restores the full dataset', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.setUseLogFilter('today');
    rt.useLogListFiltersRef.value = {
        datePreset: 'today',
        transactionType: 'use',
        entryType: 'session'
    };
    const filtered = rt.getFilteredUseLogs();
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'coke-today');

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

test('Amount, duration, cost, lines, and use-rate filters combine and honor units', () => {
    const overnight = cokeLog('coke-overnight', '2026-07-27', {
        amount: 0.8,
        lines: 4,
        type: 'session',
        startTime: '23:00',
        endTime: '01:00',
        endDate: '2026-07-28',
        estimatedCost: 64
    });
    const zeroCost = cokeLog('coke-zero', '2026-07-28', {
        amount: 0,
        lines: 0,
        type: 'session',
        startTime: '10:00',
        endTime: '10:30',
        estimatedCost: 0
    });
    const rt = setup(makeData({
        logs: [
            ...SAMPLE_LOGS,
            overnight,
            zeroCost
        ]
    }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.setUseLogFilter('all');

    const byAmount = rt.getFilteredUseLogs({ amountMin: 0.8, amountMax: 1.0 });
    assert.ok(byAmount.some(l => l.id === 'coke-today'));
    assert.ok(byAmount.some(l => l.id === 'coke-overnight'));
    assert.ok(!byAmount.some(l => l.id === 'coke-week'));

    const zeroAmount = rt.getFilteredUseLogs({ amountMin: 0, amountMax: 0 });
    assert.equal(zeroAmount.length, 1);
    assert.equal(zeroAmount[0].id, 'coke-zero');

    const duration = rt.getFilteredUseLogs({ durationMin: 1.5, durationMax: 2.5 });
    assert.ok(duration.some(l => l.id === 'coke-today'));
    assert.ok(duration.some(l => l.id === 'coke-overnight'));
    assert.ok(!duration.some(l => l.id === 'coke-zero'));

    const cost = rt.getFilteredUseLogs({ costMin: 0, costMax: 0 });
    assert.equal(cost.length, 1);
    assert.equal(cost[0].id, 'coke-zero');

    const lines = rt.getFilteredUseLogs({ linesMin: 8, linesMax: 10 });
    assert.ok(lines.some(l => l.id === 'coke-today'));
    assert.ok(lines.some(l => l.id === 'coke-old'));
    assert.ok(!lines.some(l => l.id === 'coke-week'));

    const rate = rt.getFilteredUseLogs({ rateMin: 0.4, rateMax: 0.5 });
    assert.ok(rate.some(l => l.id === 'coke-today'));
    assert.ok(!rate.some(l => l.id === 'coke-zero'));

    const combined = rt.getFilteredUseLogs({
        substanceId: COKE_ID,
        dateFilter: 'all',
        transactionType: 'use',
        entryType: 'session',
        amountMin: 0.8,
        durationMin: 1.5
    });
    assert.ok(combined.every(l => l.type === 'session'));
    assert.ok(combined.some(l => l.id === 'coke-today'));
    assert.ok(combined.some(l => l.id === 'coke-overnight'));

    rt.useLogListFiltersRef.value = { amountMin: '0.8', durationMin: '1.5', transactionType: 'use' };
    const totals = rt.getUseLogTotalsForView(COKE_ID);
    assert.equal(totals.entryCount, rt.getFilteredUseLogs().length);

    rt.clearUseLogFilters();
    const mgLog = cokeLog('coke-mg', '2026-07-28', { amount: 800, unit: 'mg', lines: 2, type: 'quick' });
    rt.__setTestAppData(makeData({ logs: [cokeLog('coke-g', '2026-07-28', { amount: 0.8 }), mgLog] }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    const converted = rt.getFilteredUseLogs({ amountMin: 0.7, amountMax: 0.9 });
    assert.equal(converted.length, 2);
    assert.equal(rt.getUseLogFilterableAmount(mgLog), 0.8);
});

test('Start time, end time, and break filters handle midnight-crossing sessions', () => {
    const first = cokeLog('coke-first', '2026-07-26', {
        amount: 0.4,
        type: 'session',
        startTime: '18:00',
        endTime: '19:00'
    });
    const overnight = cokeLog('coke-overnight', '2026-07-27', {
        amount: 0.6,
        type: 'session',
        startTime: '23:30',
        endTime: '01:15',
        endDate: '2026-07-28'
    });
    const morning = cokeLog('coke-morning', '2026-07-28', {
        amount: 0.3,
        type: 'session',
        startTime: '09:00',
        endTime: '10:00'
    });
    const rt = setup(makeData({ logs: [first, overnight, morning] }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });

    const startLate = rt.getFilteredUseLogs({ startMin: '22:00', startMax: '23:59' });
    assert.equal(startLate.map(l => l.id).join(','), 'coke-overnight');

    const endAfterMidnight = rt.getFilteredUseLogs({ endMin: '01:00', endMax: '02:00' });
    assert.equal(endAfterMidnight.map(l => l.id).join(','), 'coke-overnight');

    const wrapStart = rt.getFilteredUseLogs({ startMin: '22:00', startMax: '10:00' });
    assert.ok(wrapStart.some(l => l.id === 'coke-overnight'));
    assert.ok(wrapStart.some(l => l.id === 'coke-morning'));
    assert.ok(!wrapStart.some(l => l.id === 'coke-first'));

    const overnightHours = rt.getUseLogFilterDurationHours(overnight);
    assert.ok(overnightHours > 1.5 && overnightHours < 2);

    const breakHours = rt.getUseLogFilterableBreakHours(morning);
    assert.ok(breakHours != null && breakHours >= 7);
    const byBreak = rt.getFilteredUseLogs({ breakMin: 6, breakMax: 12 });
    assert.ok(byBreak.some(l => l.id === 'coke-morning'));
    assert.ok(!byBreak.some(l => l.id === 'coke-first'));
});

test('Clear Filters resets numeric and time filters and restores the full dataset', () => {
    const rt = setup(makeData({ logs: SAMPLE_LOGS }));
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.useLogListFiltersRef.value = {
        datePreset: 'today',
        transactionType: 'use',
        entryType: 'session',
        amountMin: '0.5',
        amountMax: '1',
        durationMin: '1',
        costMin: '0',
        linesMin: '1',
        rateMin: '0.1',
        startMin: '20:00',
        endMax: '23:00',
        breakMin: '1'
    };
    assert.ok(rt.getFilteredUseLogs().length < SAMPLE_LOGS.length);
    rt.clearUseLogFilters();
    assert.equal(rt.useLogListFiltersRef.value.amountMin, '');
    assert.equal(rt.useLogListFiltersRef.value.startMin, '');
    assert.equal(rt.useLogListFiltersRef.value.breakMin, '');
    assert.ok(rt.getFilteredUseLogs().length >= 6);
});
