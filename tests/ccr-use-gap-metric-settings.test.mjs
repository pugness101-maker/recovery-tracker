import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

const COKE = 'coke';
const NICOTINE = 'nicotine';

function setup(logs = []) {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData(logs, [
        {
            id: COKE,
            name: 'Coke',
            icon: '',
            color: '#90caf9',
            trackingMode: 'coke',
            primaryUnit: 'grams',
            units: ['grams'],
            defaultUnit: 'grams'
        },
        {
            id: NICOTINE,
            name: 'Nicotine',
            icon: '',
            color: '#80cbc4',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs'],
            defaultUnit: 'puffs'
        }
    ]));
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    return { rt, data };
}

function log(patch = {}) {
    return {
        id: patch.id || Math.random().toString(36).slice(2),
        substanceId: patch.substanceId || COKE,
        date: patch.date || '2026-08-01',
        startTime: patch.startTime || '10:00',
        endTime: patch.endTime || '11:00',
        amount: patch.amount ?? 1,
        unit: 'grams',
        type: 'session',
        transactionType: patch.transactionType || 'use',
        ...patch
    };
}

test('Use Gap current gap calculates hours since latest qualifying personal use', () => {
    const { rt, data } = setup([
        log({ id: 'old', date: '2026-08-01', startTime: '10:00', endTime: '11:00' }),
        log({ id: 'latest', date: '2026-08-02', startTime: '09:00', endTime: '10:00' })
    ]);
    assert.equal(rt.computeCurrentUseGapHours(COKE, data, '2026-08-03T10:00:00'), 24);
});

test('Use Gap previous gap uses the gap before this use and returns null for first use', () => {
    const first = log({ id: 'first', date: '2026-08-01', startTime: '10:00', endTime: '11:00' });
    const second = log({ id: 'second', date: '2026-08-01', startTime: '14:30', endTime: '15:00' });
    const { rt, data } = setup([first, second]);
    assert.equal(rt.resolveNormalizedLogMetric('useGapPrevious', first, data), null);
    assert.equal(rt.resolveNormalizedLogMetric('useGapPrevious', second, data), 3.5);
});

test('Use Gap thresholds use hour conversion and decimal hours', () => {
    const { rt } = setup();
    const halfHour = rt.normalizeConditionalColorRule({
        id: 'gap-half',
        name: 'Half hour',
        metric: 'useGapPrevious',
        operator: 'gte',
        value: 0.5,
        valueUnit: 'hours'
    });
    assert.equal(rt.compareConditionalColorRule(halfHour, { metric: 'useGapPrevious', value: 0.75 }), true);
    const minutes = rt.normalizeConditionalColorRule({
        id: 'gap-minutes',
        name: 'Thirty minutes',
        metric: 'useGapPrevious',
        operator: 'eq',
        value: 30,
        valueUnit: 'minutes'
    });
    assert.equal(minutes.value, 0.5);
    assert.equal(rt.ccrTimeGapUnitToHours(26, 'hours'), 26);
    assert.equal(rt.formatCcrUseGapThresholdLabel(0.75), '45m');
    assert.equal(rt.formatCcrUseGapThresholdLabel(3.5), '3h 30m');
    assert.equal(rt.formatCcrUseGapThresholdLabel(30), '1d 6h');
});

test('Use Gap excludes gifts, adjustments, distributed children, and shared use without personal amount', () => {
    const personal = log({ id: 'personal', date: '2026-08-01', startTime: '10:00', endTime: '11:00' });
    const gift = log({ id: 'gift', date: '2026-08-01', startTime: '12:00', endTime: '13:00', transactionType: 'gift_given' });
    const adjustment = log({ id: 'adj', date: '2026-08-01', startTime: '13:00', endTime: '14:00', transactionType: 'inventory_adjustment' });
    const child = log({ id: 'child', date: '2026-08-01', startTime: '14:00', endTime: '15:00', isDistributedChild: true });
    const sharedZero = log({ id: 'shared-zero', date: '2026-08-01', startTime: '15:00', endTime: '16:00', transactionType: 'shared_use', personalAmount: 0, sharedAmount: 1 });
    const later = log({ id: 'later', date: '2026-08-01', startTime: '20:00', endTime: '21:00' });
    const { rt, data } = setup([personal, gift, adjustment, child, sharedZero, later]);
    assert.equal(rt.resolveNormalizedLogMetric('useGapPrevious', later, data), 9);
    assert.equal(rt.computeCurrentUseGapHours(COKE, data, '2026-08-01T22:00:00'), 1);
});

test('Use Gap calculations stay separate by substance and shared personal use qualifies', () => {
    const cokeShared = log({ id: 'coke-shared', date: '2026-08-01', startTime: '10:00', endTime: '11:00', transactionType: 'shared_use', personalAmount: 0.25, sharedAmount: 0.75 });
    const nicotineUse = log({ id: 'nic', substanceId: NICOTINE, date: '2026-08-01', startTime: '15:00', endTime: '16:00' });
    const { rt, data } = setup([cokeShared, nicotineUse]);
    assert.equal(rt.computeCurrentUseGapHours(COKE, data, '2026-08-01T13:00:00'), 2);
    assert.equal(rt.computeCurrentUseGapHours(NICOTINE, data, '2026-08-01T18:00:00'), 2);
});

test('legacy gap rules migrate to Use Gap variants without changing meaning', () => {
    const { rt } = setup();
    const current = rt.normalizeConditionalColorRule({
        id: 'legacy-current',
        name: 'Old current',
        metric: 'daysSinceUse',
        operator: 'gte',
        value: 2
    });
    assert.equal(current.metric, 'useGapCurrent');
    assert.equal(current.value, 48);
    const previous = rt.normalizeConditionalColorRule({
        id: 'legacy-previous',
        name: 'Old previous',
        metric: 'breakSincePreviousUse',
        operator: 'lt',
        value: 2
    });
    assert.equal(previous.metric, 'useGapPrevious');
    assert.equal(previous.value, 2);
});

test('metric customization persists, affects labels, and resets to defaults', () => {
    const { rt, data } = setup();
    const saved = rt.saveCcrMetricSettings('useGapPrevious', {
        displayName: 'Use Gap → Previous gap',
        groupName: 'Use Gap',
        inputUnit: 'hours',
        displayUnit: 'automatic',
        decimalPrecision: 1,
        favorableDirection: 'higher',
        defaultOperator: 'gt',
        helpText: 'Custom help'
    }, data);
    assert.equal(saved.favorableDirection, 'higher');
    assert.equal(rt.getCcrMetricUiDef('useGapPrevious', data).label, 'Use Gap → Previous gap');
    const json = rt.exportConditionalColorRulesJson(data);
    assert.match(json, /metricSettings/);
    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(reloaded.settings.conditionalColorRules.metricSettings.useGapPrevious.helpText, 'Custom help');
    const reset = rt.resetCcrMetricSettings('useGapPrevious', data);
    assert.equal(reset.displayName, 'Use Gap → Previous gap');
    assert.equal(rt.getCcrMetricSettings('useGapPrevious', data).helpText, 'Enter duration in hours. Decimals are allowed.');
});

test('manager summaries include substance, Use Gap variant, and readable threshold', () => {
    const { rt, data } = setup();
    const rule = rt.normalizeConditionalColorRule({
        id: 'summary',
        name: 'Short break',
        substanceScope: COKE,
        metric: 'useGapPrevious',
        operator: 'lt',
        value: 2
    });
    assert.equal(rt.formatCcrRuleManagerSummary(rule, data), 'Coke · Use Gap: Previous gap · Less than 2h');
});
