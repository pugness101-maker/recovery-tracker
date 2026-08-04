import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup(referenceDate = '2026-08-04') {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    if (typeof rt.setTestReferenceDate === 'function') {
        rt.setTestReferenceDate(referenceDate);
    }
    rt.ensurePreviousPeriodComparePrefs(data);
    return { rt, data };
}

test('previous day / week / month bounds', () => {
    const { rt } = setup();
    const current = { startDate: '2026-08-04', endDate: '2026-08-04' };

    const day = rt.resolvePreviousPeriodBounds(current, 'previous-day');
    assert.equal(day.startDate, '2026-08-03');
    assert.equal(day.endDate, '2026-08-03');

    const weekRange = { startDate: '2026-08-02', endDate: '2026-08-04' };
    const week = rt.resolvePreviousPeriodBounds(weekRange, 'previous-week');
    assert.equal(week.startDate, '2026-07-26');
    assert.equal(week.endDate, '2026-07-28');

    const month = rt.resolvePreviousPeriodBounds(
        { startDate: '2026-08-01', endDate: '2026-08-04' },
        'previous-month'
    );
    assert.equal(month.startDate, '2026-07-01');
    assert.equal(month.endDate, '2026-07-31');
});

test('previous custom / selected range uses equal-length preceding window', () => {
    const { rt } = setup();
    // Selected range: July 8–14 → previous: July 1–7
    const prev = rt.resolvePreviousPeriodBounds(
        { startDate: '2026-07-08', endDate: '2026-07-14' },
        'previous-selected-range'
    );
    assert.equal(prev.startDate, '2026-07-01');
    assert.equal(prev.endDate, '2026-07-07');
    assert.equal(prev.label, 'Previous selected range');
});

test('same period last month and last year', () => {
    const { rt } = setup();
    const current = { startDate: '2026-07-08', endDate: '2026-07-14' };

    const lastMonth = rt.resolvePreviousPeriodBounds(current, 'same-period-last-month');
    assert.equal(lastMonth.startDate, '2026-06-08');
    assert.equal(lastMonth.endDate, '2026-06-14');

    const lastYear = rt.resolvePreviousPeriodBounds(current, 'same-period-last-year');
    assert.equal(lastYear.startDate, '2025-07-08');
    assert.equal(lastYear.endDate, '2025-07-14');
});

test('lower-is-better metrics mark decreases as favorable', () => {
    const { rt } = setup();
    const cmp = rt.buildMetricPeriodComparison({
        current: 8.2,
        previous: 10.5,
        unit: 'g',
        metricKind: 'use',
        currentPeriodLabel: 'This week',
        previousPeriodLabel: 'Previous week'
    });
    assert.equal(cmp.tone, 'favorable');
    assert.equal(cmp.directionKey, 'decrease');
    assert.match(cmp.changeDisplay, /▼/);
    assert.match(cmp.changeDisplay, /lower/);
    assert.ok(Math.abs(cmp.percent - ((8.2 - 10.5) / 10.5) * 100) < 0.05);

    const spend = rt.buildMetricPeriodComparison({
        current: 60,
        previous: 40,
        metricKind: 'spend'
    });
    assert.equal(spend.tone, 'unfavorable');
});

test('higher-is-better metrics mark increases as favorable', () => {
    const { rt } = setup();
    const streak = rt.buildMetricPeriodComparison({
        current: 10,
        previous: 4,
        unit: 'days',
        metricKind: 'streak'
    });
    assert.equal(streak.tone, 'favorable');
    assert.equal(streak.directionKey, 'increase');

    const lifespan = rt.buildMetricPeriodComparison({
        current: 2,
        previous: 5,
        metricKind: 'vapeLifespan'
    });
    assert.equal(lifespan.tone, 'unfavorable');
});

test('neutral metrics stay neutral', () => {
    const { rt } = setup();
    const inv = rt.buildMetricPeriodComparison({
        current: 3,
        previous: 1,
        metricKind: 'inventory'
    });
    assert.equal(inv.tone, 'neutral');
    assert.equal(inv.direction, 'neutral');

    const gift = rt.buildMetricPeriodComparison({
        current: 1,
        previous: 2,
        metricKind: 'gift'
    });
    assert.equal(gift.tone, 'neutral');
});

test('previous value of zero skips percentage but keeps numeric difference', () => {
    const { rt } = setup();
    const cmp = rt.buildMetricPeriodComparison({
        current: 5,
        previous: 0,
        unit: 'g',
        metricKind: 'use'
    });
    assert.equal(cmp.percent, null);
    assert.equal(cmp.percentDisplay, '—');
    assert.equal(cmp.difference, 5);
    assert.match(cmp.changeDisplay, /▲|▼|►/);
    assert.doesNotMatch(cmp.changeDisplay, /%/);
    assert.doesNotMatch(cmp.changeDisplay, /No previous value/);
});

test('missing previous data shows No previous value', () => {
    const { rt } = setup();
    const cmp = rt.buildMetricPeriodComparison({
        current: 8.2,
        previous: null,
        unit: 'g',
        metricKind: 'use'
    });
    assert.equal(cmp.missingPrevious, true);
    assert.equal(cmp.changeDisplay, 'No previous value');
    assert.equal(cmp.previousDisplay, 'No previous value');
    assert.equal(cmp.tone, 'missing');
});

test('substance and date filtering use normalized range metrics', () => {
    const { rt, data } = setup('2026-08-04');
    const coke = data.substances.find(s => s.id === 'coke') || data.substances[0];
    const other = data.substances.find(s => s.id !== coke.id) || data.substances[1] || coke;

    data.logs = [
        {
            id: 'l1',
            substanceId: coke.id,
            date: '2026-08-04',
            amount: 2,
            unit: coke.defaultUnit || 'g',
            transactionType: 'personal_use'
        },
        {
            id: 'l2',
            substanceId: coke.id,
            date: '2026-07-28',
            amount: 4,
            unit: coke.defaultUnit || 'g',
            transactionType: 'personal_use'
        },
        {
            id: 'l3',
            substanceId: other.id,
            date: '2026-08-04',
            amount: 99,
            unit: other.defaultUnit || 'g',
            transactionType: 'personal_use'
        }
    ];
    rt.__setTestAppData(data);

    const currentBounds = { startDate: '2026-08-02', endDate: '2026-08-04' };
    const prevBounds = rt.resolvePreviousPeriodBounds(currentBounds, 'previous-week');
    const currentVal = rt.getPeriodCompareMetricValue(coke.id, 'use', currentBounds, data);
    const prevVal = rt.getPeriodCompareMetricValue(coke.id, 'use', prevBounds, data);
    assert.equal(currentVal, 2);
    assert.equal(prevVal, 4);

    const otherCurrent = rt.getPeriodCompareMetricValue(other.id, 'use', currentBounds, data);
    assert.equal(otherCurrent, 99);
});

test('conditional rule overrides default tones by color scope', () => {
    const { rt, data } = setup();
    rt.ensureConditionalColorRules(data);
    rt.setPreviousPeriodCompareColorScope('numericChange', data);

    const cmp = rt.buildMetricPeriodComparison({
        current: 12,
        previous: 10,
        metricKind: 'use'
    });
    assert.equal(cmp.tone, 'unfavorable');

    const defaults = rt.resolvePeriodCompareColors(cmp, null, 'numericChange', data);
    assert.ok(defaults.numericChange);
    assert.match(defaults.numericChange.text || defaults.numericChange.fill || '', /#|rgb/);

    const ccr = {
        matched: [{ id: 'custom' }],
        style: { background: '#123456', text: '#fedcba', border: '#abcdef' },
        labels: []
    };
    const overridden = rt.resolvePeriodCompareColors(cmp, ccr, 'numericChange', data);
    assert.equal(overridden.hasCustomRule, true);
    assert.equal(overridden.numericChange.background, '#123456');

    const html = rt.renderMetricPeriodComparison(cmp, {
        ccrResult: ccr,
        colorScope: 'numericChange',
        data
    });
    assert.match(html, /#123456|#fedcba/);
    assert.doesNotMatch(html, /ccr-status-label/);
});

test('export/import persists previous-period comparison prefs', () => {
    const { rt, data } = setup();
    rt.setPreviousPeriodCompareEnabled(false, data);
    rt.setPreviousPeriodCompareMode('same-period-last-year', data);
    rt.setPreviousPeriodCompareColorScope('direction', data);

    assert.equal(data.settings.showPreviousPeriodCompare, false);
    assert.equal(data.settings.previousPeriodCompareMode, 'same-period-last-year');
    assert.equal(data.settings.previousPeriodCompareColorScope, 'direction');

    const exported = rt.cleanExportData(data);
    assert.equal(exported.settings.previousPeriodComparePrefs.enabled, false);
    assert.equal(exported.settings.previousPeriodComparePrefs.mode, 'same-period-last-year');
    assert.equal(exported.settings.previousPeriodComparePrefs.colorScope, 'direction');

    const restored = rt.normalizeAppDataSafe({
        ...makeTestData([]),
        settings: {
            ...makeTestData([]).settings,
            ...exported.settings
        }
    });
    rt.ensurePreviousPeriodComparePrefs(restored);
    assert.equal(rt.isPreviousPeriodCompareEnabled(restored), false);
    assert.equal(rt.getPreviousPeriodCompareMode(restored), 'same-period-last-year');
    assert.equal(rt.getPreviousPeriodCompareColorScope(restored), 'direction');
});

test('render shows current, previous, and change lines', () => {
    const { rt, data } = setup();
    rt.setPreviousPeriodCompareEnabled(true, data);
    const cmp = rt.buildMetricPeriodComparison({
        current: 8.2,
        previous: 10.5,
        unit: 'g',
        metricKind: 'use',
        currentLabel: '8.2 g',
        previousLabel: '10.5 g',
        currentPeriodLabel: 'This week',
        previousPeriodLabel: 'Previous week'
    });
    const html = rt.renderMetricPeriodComparison(cmp, { data });
    assert.match(html, /This week:/);
    assert.match(html, /8\.2 g/);
    assert.match(html, /Previous week:/);
    assert.match(html, /10\.5 g/);
    assert.match(html, /▼/);
    assert.match(html, /lower/);
});
