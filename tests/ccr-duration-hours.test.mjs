import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeData(logs = []) {
    return {
        substances: [
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
            }
        ],
        logs,
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID
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
    const data = makeData(logs);
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

test('duration helpers convert whole and decimal hours to minutes', () => {
    const { rt } = setup();
    assert.equal(rt.ccrDurationHoursToMinutes(2), 120);
    assert.equal(rt.ccrDurationHoursToMinutes(0.5), 30);
    assert.equal(rt.ccrDurationHoursToMinutes(1.25), 75);
    assert.equal(rt.ccrDurationHoursToMinutes(2.5), 150);
    assert.equal(rt.ccrDurationMinutesToHours(120), 2);
    assert.equal(rt.ccrDurationMinutesToHours(90), 1.5);
    assert.equal(rt.formatCcrDurationThresholdLabel(120), '2h');
    assert.equal(rt.formatCcrDurationThresholdLabel(90), '1h 30m');
    assert.equal(rt.formatCcrDurationThresholdLabel(30), '30m');
});

test('new Duration rules store hours and evaluate against minutes', () => {
    const overnight = cokeSession({
        id: 1,
        date: '2026-07-26',
        startTime: '23:00',
        endTime: '02:00',
        endDate: '2026-07-27',
        amount: 0.5
    });
    const { rt, data } = setup([overnight]);
    assert.equal(rt.getNormalizedSessionDurationMinutes(overnight), 180);

    const rule = rt.normalizeConditionalColorRule({
        id: 'dur-hours',
        name: 'Over 2h',
        metric: 'sessionDuration',
        operator: 'gt',
        value: 2,
        valueUnit: 'hours',
        durationValueVersion: 2,
        sectionScope: ['useHistory'],
        colors: { background: '#222', text: '#0f0', border: '#0f0' }
    });
    assert.equal(rule.valueUnit, 'hours');
    assert.equal(rule.durationValueVersion, 2);
    assert.equal(rt.getCcrRuleCompareMinutes(rule, 'value'), 120);
    assert.equal(rt.getCcrDurationEditorValues(rule).value, '2');

    const matched = rt.compareConditionalColorRule(rule, {
        value: rt.getNormalizedSessionDurationMinutes(overnight)
    });
    assert.equal(matched, true);

    const shortRule = rt.normalizeConditionalColorRule({
        ...rule,
        id: 'dur-short',
        operator: 'lt',
        value: 2
    });
    assert.equal(rt.compareConditionalColorRule(shortRule, {
        value: rt.getNormalizedSessionDurationMinutes(overnight)
    }), false);
});

test('decimal hour Duration rules and between ranges', () => {
    const session = cokeSession({
        id: 2,
        startTime: '10:00',
        endTime: '11:15',
        amount: 0.4
    });
    const { rt } = setup([session]);
    assert.equal(rt.getNormalizedSessionDurationMinutes(session), 75);

    const half = rt.normalizeConditionalColorRule({
        metric: 'sessionDuration',
        operator: 'gte',
        value: 0.5,
        valueUnit: 'hours'
    });
    assert.equal(rt.getCcrRuleCompareMinutes(half), 30);
    assert.equal(rt.compareConditionalColorRule(half, { value: 75 }), true);

    const quarter = rt.normalizeConditionalColorRule({
        metric: 'sessionDuration',
        operator: 'eq',
        value: 1.25,
        valueUnit: 'hours'
    });
    assert.equal(rt.getCcrRuleCompareMinutes(quarter), 75);
    assert.equal(rt.compareConditionalColorRule(quarter, { value: 75 }), true);

    const between = rt.normalizeConditionalColorRule({
        metric: 'sessionDuration',
        operator: 'between',
        value: 1,
        valueTo: 2,
        valueUnit: 'hours'
    });
    assert.equal(rt.getCcrRuleCompareMinutes(between, 'value'), 60);
    assert.equal(rt.getCcrRuleCompareMinutes(between, 'valueTo'), 120);
    assert.equal(rt.compareConditionalColorRule(between, { value: 75 }), true);
    assert.equal(rt.compareConditionalColorRule(between, { value: 180 }), false);
    assert.equal(
        rt.formatCcrConditionSummary(between),
        'Duration between 1h and 2h'
    );
});

test('legacy minute-based Duration rules keep meaning after normalize', () => {
    const { rt } = setup();
    const legacy = rt.normalizeConditionalColorRule({
        id: 'legacy-dur',
        name: 'Old minutes rule',
        metric: 'sessionDuration',
        operator: 'gt',
        value: 120
        // no valueUnit → minutes
    });
    assert.equal(legacy.valueUnit, 'minutes');
    assert.equal(legacy.durationValueVersion, 1);
    assert.equal(rt.getCcrDurationValueUnit(legacy), 'minutes');
    assert.equal(rt.getCcrRuleCompareMinutes(legacy), 120);
    assert.equal(rt.getCcrDurationEditorValues(legacy).value, '2');
    assert.equal(rt.compareConditionalColorRule(legacy, { value: 180 }), true);
    assert.equal(rt.compareConditionalColorRule(legacy, { value: 90 }), false);
    assert.equal(rt.formatCcrConditionSummary(legacy), 'Duration greater than 2h');
});

test('Duration rule summaries use readable hour labels', () => {
    const { rt } = setup();
    assert.equal(
        rt.formatCcrConditionSummary(rt.normalizeConditionalColorRule({
            metric: 'sessionDuration',
            operator: 'lt',
            value: 2,
            valueUnit: 'hours'
        })),
        'Duration less than 2h'
    );
    assert.equal(
        rt.formatCcrConditionSummary(rt.normalizeConditionalColorRule({
            metric: 'sessionDuration',
            operator: 'between',
            value: 1.5,
            valueTo: 3,
            valueUnit: 'hours'
        })),
        'Duration between 1h 30m and 3h'
    );
    assert.equal(
        rt.formatCcrConditionSummary(rt.normalizeConditionalColorRule({
            metric: 'sessionDuration',
            operator: 'between',
            value: 90,
            valueTo: 180
            // legacy minutes
        })),
        'Duration between 1h 30m and 3h'
    );
});

test('midnight-crossing session Duration CCR matches hour thresholds', () => {
    const overnight = cokeSession({
        id: 10,
        date: '2026-07-26',
        startTime: '22:30',
        endTime: '01:00',
        endDate: '2026-07-27',
        amount: 0.6
    });
    const { rt, data } = setup([overnight]);
    const minutes = rt.getNormalizedSessionDurationMinutes(overnight);
    assert.equal(minutes, 150); // 2.5h

    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'overnight',
                name: 'Long overnight',
                metric: 'sessionDuration',
                operator: 'gte',
                value: 2.5,
                valueUnit: 'hours',
                sectionScope: ['useHistory'],
                colors: { background: '#111', text: '#eee', border: '#0f0' }
            })
        ]
    });

    const result = rt.evaluateConditionalColorRules({
        substanceId: COKE_ID,
        section: 'useHistory',
        metric: 'sessionDuration',
        value: minutes
    }, data);
    assert.ok(result.matched.some(r => r.id === 'overnight'));
});
