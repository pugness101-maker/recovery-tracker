import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_DATE = '2026-08-04';
const COKE_ID = 'coke';

function makeLog(id, date, amount, extras = {}) {
    return {
        id,
        substanceId: COKE_ID,
        date,
        time: '12:00',
        amount,
        transactionType: 'use',
        type: 'quick',
        ...extras
    };
}

function setup({ logs = [], purchases = [], settings = {} } = {}) {
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
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs,
        purchases,
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            taperSuggestions: { autoSuggestEnabled: true, lookbackDays: 30 },
            ...settings
        },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    rt.ensureTaperSuggestPrefs();
    return rt;
}

function enoughLogs() {
    return [
        makeLog('l1', '2026-07-10', 0.5, { startTime: '12:00', endTime: '14:14' }),
        makeLog('l2', '2026-07-12', 0.6, { startTime: '10:00', endTime: '11:00' }),
        makeLog('l3', '2026-07-20', 0.4, { startTime: '18:00', endTime: '19:30' }),
        makeLog('l4', '2026-07-28', 0.7, { startTime: '09:00', endTime: '10:00' }),
        makeLog('l5', '2026-08-01', 0.5, { startTime: '15:00', endTime: '16:00' })
    ];
}

test('settings markup includes taper suggestion controls', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="taper-current-metrics"/);
    assert.match(html, /id="taper-suggest-banner"/);
    assert.match(html, /id="settings-taper-auto-suggest"/);
    assert.match(html, /Auto-suggest taper values from recent data/);
    assert.match(html, /name="taper-suggest-lookback"/);
});

test('computeTaperCurrentMetrics requires enough sessions', () => {
    const rt = setup({
        logs: [
            makeLog('a', '2026-08-01', 1),
            makeLog('b', '2026-08-02', 1)
        ]
    });
    const metrics = rt.computeTaperCurrentMetrics(COKE_ID);
    assert.equal(metrics.ok, false);
    assert.match(metrics.message, /Not enough recent data/);
});

test('computeTaperCurrentMetrics builds averages from logged data only', () => {
    const rt = setup({
        logs: enoughLogs(),
        purchases: [
            { id: 'p1', substanceId: COKE_ID, date: '2026-07-08', cost: 200, amount: 3.5 },
            { id: 'p2', substanceId: COKE_ID, date: '2026-07-20', cost: 180, amount: 3.5 },
            { id: 'p3', substanceId: COKE_ID, date: '2026-08-01', cost: 190, amount: 3.5 }
        ]
    });
    const metrics = rt.computeTaperCurrentMetrics(COKE_ID);
    assert.equal(metrics.ok, true);
    assert.equal(metrics.sessionCount, 5);
    assert.ok(metrics.avgPerDay > 0);
    assert.ok(metrics.avgPerWeek > metrics.avgPerDay);
    assert.ok(metrics.avgPerMonth > metrics.avgPerWeek);
    assert.ok(metrics.avgSession > 0);
    assert.ok(metrics.sessionsPerDay > 0);
    assert.ok(metrics.avgDurationMinutes > 0);
    assert.ok(metrics.spendPerWeek >= 0);
    assert.equal(metrics.recommendedPercent, 10);
    assert.ok(metrics.estimatedWeeks >= 4);
});

test('percent preview reduces week over week', () => {
    const rt = setup();
    const preview = rt.buildPercentTaperPreview(0.62, 10, 3);
    assert.equal(preview.length, 3);
    assert.ok(preview[0].daily < 0.62);
    assert.ok(preview[1].daily < preview[0].daily);
    assert.ok(preview[2].daily < preview[1].daily);
});

test('auto-suggest never overwrites manually touched fields', () => {
    const rt = setup({ logs: enoughLogs() });
    const nodes = new Map();
    const put = (id, value = '') => {
        nodes.set(id, { id, value, classList: { contains: () => false, add() {}, remove() {} } });
    };
    [
        'taper-setup', 'taper-suggest-banner', 'taper-current-metrics', 'taper-current-metrics-body',
        'taper-current-metrics-title', 'taper-type-suggestions', 'taper-weekly-suggest', 'taper-monthly-suggest',
        'current-avg', 'goal-avg', 'reduction-percent', 'weekly-max', 'monthly-max', 'reduction-type',
        'end-date', 'taper-duration-weeks', 'purchase-interval-days', 'vape-current-buy-days', 'vape-goal-buy-days',
        'nicotine-vape-current-puffs', 'nicotine-vape-goal-puffs'
    ].forEach(id => put(id));
    nodes.get('taper-setup').classList.contains = () => false;
    nodes.get('reduction-type').value = 'reduce-percent';

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelectorAll = () => [];

    rt.resetTaperSuggestTouchState();
    rt.refreshTaperSuggestions({ autoFill: true, forceRender: true });
    assert.ok(Number(nodes.get('current-avg').value) > 0);

    nodes.get('current-avg').value = '9.99';
    rt.markTaperSuggestFieldTouched('current-avg');
    rt.refreshTaperSuggestions({ autoFill: true, forceRender: true });
    assert.equal(nodes.get('current-avg').value, '9.99');

    rt.applyTaperRecommendation({ force: true });
    assert.notEqual(nodes.get('current-avg').value, '9.99');
});

test('lookback setting persists and changes metrics window label', () => {
    const rt = setup({ logs: enoughLogs() });
    assert.equal(rt.getTaperSuggestLookbackDays(), 30);
    rt.setTaperSuggestLookbackDays(7);
    assert.equal(rt.getTaperSuggestLookbackDays(), 7);
    assert.equal(rt.__getTestAppData().settings.taperSuggestions.lookbackDays, 7);
    const metrics = rt.computeTaperCurrentMetrics(COKE_ID);
    assert.equal(metrics.lookbackLabel, 'last 7 days');
});

test('disabling auto-suggest keeps prefs and skips autofill preference', () => {
    const rt = setup({ logs: enoughLogs() });
    assert.equal(rt.isTaperAutoSuggestEnabled(), true);
    rt.setTaperAutoSuggestEnabled(false);
    assert.equal(rt.isTaperAutoSuggestEnabled(), false);
    assert.equal(rt.__getTestAppData().settings.taperSuggestions.autoSuggestEnabled, false);
});
