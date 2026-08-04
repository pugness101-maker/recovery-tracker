import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';

function makeSubstances() {
    return [
        {
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g', 'mg'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        {
            id: WEED_ID,
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            trackingMode: 'weed',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }
    ];
}

function makeData({ logs = [] } = {}) {
    return {
        substances: makeSubstances(),
        logs,
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: 'all'
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function setup(logs = []) {
    const rt = loadRecoveryTrackerApp();
    const data = makeData({ logs });
    rt.__setTestAppData(data);
    rt.setSelectedSubstanceId(COKE_ID);
    rt.setTestReferenceDate('2026-07-28');
    return { rt, data };
}

function cokeSession(overrides = {}) {
    return {
        id: overrides.id ?? Math.floor(Math.random() * 1e9),
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '18:00',
        endTime: '21:00',
        amount: 0.9,
        unit: 'g',
        transactionType: 'use',
        type: 'session',
        ...overrides
    };
}

test('CCR metrics include Duration, g/hr, and Break Between Uses only', () => {
    const { rt } = setup();
    const labels = rt.getCcrMetricsForSubstance('coke').map(m => m.label);
    assert.ok(labels.includes('Duration'));
    assert.ok(labels.includes('g/hr'));
    assert.ok(labels.includes('Break Between Uses'));
    assert.ok(!labels.includes('Use Gap → Current gap'));
    assert.ok(!labels.includes('Use Gap → Previous gap'));
    assert.ok(!labels.includes('Break since previous use'));
    assert.ok(!labels.includes('Time since last use'));
    const ids = rt.getCcrMetricsForSubstance('coke').map(m => m.id);
    assert.ok(ids.includes('sessionDuration'));
    assert.ok(ids.includes('gramsPerHour'));
    assert.ok(ids.includes('useGapPrevious'));
    assert.ok(!ids.includes('useGapCurrent'));
});

test('duration: midnight crossing, missing, and zero', () => {
    const { rt } = setup();
    const overnight = cokeSession({
        startTime: '23:00',
        endTime: '02:00',
        endDate: '2026-07-29',
        amount: 0.9
    });
    assert.equal(rt.getNormalizedSessionDurationMinutes(overnight), 180);
    assert.equal(rt.formatNormalizedSessionDuration(180), '3h');
    assert.equal(rt.formatNormalizedSessionDuration(90), '1h 30m');
    assert.equal(rt.resolveNormalizedLogMetric('sessionDuration', overnight), 180);

    const missing = cokeSession({ type: 'quick', startTime: undefined, endTime: undefined });
    delete missing.startTime;
    delete missing.endTime;
    assert.equal(rt.getNormalizedSessionDurationMinutes(missing), null);
    assert.equal(rt.formatNormalizedSessionDuration(null), '—');

    const zero = cokeSession({
        startTime: '12:00',
        endTime: '12:00',
        durationMs: 0
    });
    assert.equal(rt.getNormalizedSessionDurationMinutes(zero), null);
});

test('g/hr: mg conversion, shared personal amount, gifts/adjustments excluded', () => {
    const { rt } = setup();
    const mg = cokeSession({
        startTime: '10:00',
        endTime: '12:00',
        amount: 600,
        unit: 'mg'
    });
    assert.equal(rt.getNormalizedGramsPerHour(mg), 0.3);

    const shared = cokeSession({
        amount: 1.5,
        totalAmount: 1.5,
        personalAmount: 0.9,
        sharedAmount: 0.6,
        transactionType: 'shared_use'
    });
    assert.equal(rt.getNormalizedGramsPerHour(shared), 0.3);

    for (const transactionType of ['gift_given', 'gift_received', 'inventory_adjustment']) {
        assert.equal(
            rt.getNormalizedGramsPerHour(cokeSession({ transactionType })),
            null,
            transactionType
        );
    }

    const zeroDur = cokeSession({ startTime: '12:00', endTime: '12:00', durationMs: 0 });
    assert.equal(rt.getNormalizedGramsPerHour(zeroDur), null);
});

test('break since previous use: first use, same-day, multi-day, substance-specific', () => {
    const first = cokeSession({
        id: 1,
        date: '2026-07-26',
        startTime: '10:00',
        endTime: '11:00',
        amount: 0.5
    });
    const sameDay = cokeSession({
        id: 2,
        date: '2026-07-26',
        startTime: '19:00',
        endTime: '20:00',
        amount: 0.4
    });
    const nextDay = cokeSession({
        id: 3,
        date: '2026-07-28',
        startTime: '10:00',
        endTime: '11:00',
        amount: 0.3
    });
    const weed = {
        id: 4,
        substanceId: WEED_ID,
        date: '2026-07-27',
        startTime: '12:00',
        endTime: '13:00',
        amount: 1,
        unit: 'g',
        transactionType: 'use',
        type: 'session'
    };
    const { rt, data } = setup([first, sameDay, nextDay, weed]);

    assert.equal(rt.computeBreakSincePreviousUseHours(first, data), null);
    assert.equal(rt.formatBreakSincePreviousUse(null), '—');

    const sameDayBreak = rt.computeBreakSincePreviousUseHours(sameDay, data);
    assert.equal(sameDayBreak, 8);
    assert.equal(rt.formatBreakSincePreviousUse(8), '8h');

    const multiDayBreak = rt.computeBreakSincePreviousUseHours(nextDay, data);
    // previous end 2026-07-26 20:00 → current start 2026-07-28 10:00 = 38h
    assert.equal(multiDayBreak, 38);
    assert.equal(rt.formatBreakSincePreviousUse(38), '1d 14h');
    assert.equal(rt.formatBreakSincePreviousUse(72), '3d');

    // Weed entry should not use coke previous
    assert.equal(rt.computeBreakSincePreviousUseHours(weed, data), null);

    const weedSecond = {
        ...weed,
        id: 5,
        date: '2026-07-28',
        startTime: '12:00',
        endTime: '13:00'
    };
    data.logs.push(weedSecond);
    const weedBreak = rt.computeBreakSincePreviousUseHours(weedSecond, data);
    assert.equal(weedBreak, 23);
});

test('break excludes gifts, adjustments, and distributed children', () => {
    const personal = cokeSession({
        id: 10,
        date: '2026-07-26',
        startTime: '10:00',
        endTime: '11:00'
    });
    const gift = cokeSession({
        id: 11,
        date: '2026-07-26',
        startTime: '14:00',
        endTime: '15:00',
        transactionType: 'gift_given'
    });
    const child = cokeSession({
        id: 12,
        date: '2026-07-26',
        startTime: '16:00',
        endTime: '17:00',
        isDistributedChild: true,
        parentLogId: 99
    });
    const later = cokeSession({
        id: 13,
        date: '2026-07-26',
        startTime: '20:00',
        endTime: '21:00'
    });
    const { rt, data } = setup([personal, gift, child, later]);
    // Should measure from personal end 11:00 → later start 20:00 = 9h (gift/child ignored)
    assert.equal(rt.computeBreakSincePreviousUseHours(later, data), 9);
    assert.equal(rt.isQualifyingBreakUseLog(gift, data), false);
    assert.equal(rt.isQualifyingBreakUseLog(child, data), false);
});

test('shared personal amount qualifies for break; zero personal does not', () => {
    const sharedPersonal = cokeSession({
        id: 20,
        date: '2026-07-26',
        startTime: '10:00',
        endTime: '11:00',
        transactionType: 'shared_use',
        personalAmount: 0.5,
        sharedAmount: 0.5,
        totalAmount: 1
    });
    const next = cokeSession({
        id: 21,
        date: '2026-07-26',
        startTime: '15:00',
        endTime: '16:00'
    });
    const { rt, data } = setup([sharedPersonal, next]);
    assert.equal(rt.isQualifyingBreakUseLog(sharedPersonal, data), true);
    assert.equal(rt.computeBreakSincePreviousUseHours(next, data), 4);

    const sharedZero = cokeSession({
        id: 22,
        date: '2026-07-26',
        startTime: '12:00',
        endTime: '13:00',
        transactionType: 'shared_use',
        personalAmount: 0,
        sharedAmount: 1,
        totalAmount: 1
    });
    assert.equal(rt.isQualifyingBreakUseLog(sharedZero, data), false);
});

test('CCR evaluates duration, g/hr, and break metrics with comparisons', () => {
    const { rt, data } = setup([
        cokeSession({
            id: 30,
            date: '2026-07-26',
            startTime: '10:00',
            endTime: '11:00',
            amount: 0.5
        }),
        cokeSession({
            id: 31,
            date: '2026-07-26',
            startTime: '18:00',
            endTime: '21:00',
            amount: 0.9
        })
    ]);
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'dur',
                name: 'Long session',
                metric: 'sessionDuration',
                operator: 'gt',
                value: 120,
                sectionScope: ['useHistory'],
                colors: { background: '#222', text: '#0f0', border: '#0f0' },
                statusLabel: ''
            }),
            rt.normalizeConditionalColorRule({
                id: 'gph',
                name: 'Fast burn',
                metric: 'gramsPerHour',
                operator: 'between',
                value: 0.2,
                valueTo: 0.4,
                sectionScope: ['useHistory'],
                colors: { background: '#333', text: '#ff0', border: '#ff0' },
                statusLabel: ''
            }),
            rt.normalizeConditionalColorRule({
                id: 'brk',
                name: 'Short break',
                metric: 'breakSincePreviousUse',
                operator: 'lt',
                value: 10,
                sectionScope: ['useHistory'],
                colors: { background: '#444', text: '#f00', border: '#f00' },
                statusLabel: ''
            })
        ]
    });

    const long = data.logs[1];
    const durResult = rt.evaluateConditionalColorRules({
        substanceId: COKE_ID,
        section: 'useHistory',
        metric: 'sessionDuration',
        value: rt.getNormalizedSessionDurationMinutes(long)
    });
    assert.ok(durResult.matched.some(r => r.id === 'dur'));

    const gphResult = rt.evaluateConditionalColorRules({
        substanceId: COKE_ID,
        section: 'useHistory',
        metric: 'gramsPerHour',
        value: rt.getNormalizedGramsPerHour(long)
    });
    assert.ok(gphResult.matched.some(r => r.id === 'gph'));

    const breakHours = rt.computeBreakSincePreviousUseHours(long, data);
    const brkResult = rt.evaluateConditionalColorRules({
        substanceId: COKE_ID,
        section: 'useHistory',
        metric: 'breakSincePreviousUse',
        value: breakHours
    });
    assert.ok(brkResult.matched.some(r => r.id === 'brk'));
    assert.equal(brkResult.labels.length, 0);
});
