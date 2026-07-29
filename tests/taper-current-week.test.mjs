import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeCokeSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    };
}

function makeManualWeekPlan(overrides = {}) {
    return {
        id: 'taper-coke-manual',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        reductionType: 'manual-weekly',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        manualWeeklyMode: 'amount',
        manualWeeklyTargets: [
            { week: 1, targetAmount: 6 },
            { week: 2, targetAmount: 5 },
            { week: 3, targetAmount: 4 },
            { week: 4, targetAmount: 3 },
            { week: 5, targetAmount: 2 }
        ],
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-04', weeklyMax: 6, targetAmount: 6 },
            { week: 2, weekStart: '2026-07-05', weekEnd: '2026-07-11', weeklyMax: 5, targetAmount: 5 },
            { week: 3, weekStart: '2026-07-12', weekEnd: '2026-07-18', weeklyMax: 4, targetAmount: 4 },
            { week: 4, weekStart: '2026-07-19', weekEnd: '2026-07-25', weeklyMax: 3, targetAmount: 3 },
            { week: 5, weekStart: '2026-07-26', weekEnd: '2026-07-31', weeklyMax: 2, targetAmount: 2 }
        ],
        ...overrides
    };
}

function setup(plan, dateStr = '2026-07-28') {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(dateStr);
    rt.__setTestAppData({
        substances: [makeCokeSubstance()],
        logs: [],
        purchases: [],
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [plan],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    return rt;
}

test('first week matches plan start date range', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-07-01');
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-07-01'), 1);
    assert.equal(rt.getWeekRowForDate(plan, '2026-07-01').weeklyMax, 6);
    assert.equal(rt.getPlannedWeeklyTarget(plan, rt.getWeekRowForDate(plan, '2026-07-01')), 6);
    const summary = rt.getTaperWeeklySummary(plan, COKE_ID);
    assert.equal(summary.weekIndex, 1);
});

test('middle week matches inclusive date range', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-07-15');
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-07-15'), 3);
    assert.equal(rt.getWeekRowForDate(plan, '2026-07-15').weeklyMax, 4);
    assert.equal(rt.getTaperWeeklySummary(plan, COKE_ID).weekIndex, 3);
});

test('final week uses week 5 target for Jul 28', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-07-28');
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-07-28'), 5);
    const row = rt.getWeekRowForDate(plan, '2026-07-28');
    assert.equal(row.week, 5);
    assert.equal(row.weekStart, '2026-07-26');
    assert.equal(row.weekEnd, '2026-07-31');
    assert.equal(rt.getPlannedWeeklyTarget(plan, row), 2);
    assert.equal(rt.getCurrentManualWeekRow(plan, '2026-07-28').week, 5);
    assert.notEqual(rt.getManualWeeklyWeekNumber(plan, '2026-07-28'), 4);
    const summary = rt.getTaperWeeklySummary(plan, COKE_ID);
    assert.equal(summary.weekIndex, 5);
    assert.equal(summary.weeksRemaining, 0);
});

test('inclusive week-end date stays on that week', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-07-25');
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-07-25'), 4);
    assert.equal(rt.getWeekRowForDate(plan, '2026-07-25').weeklyMax, 3);
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-07-26'), 5);
});

test('month boundary week spans July into next month when present', () => {
    const plan = makeManualWeekPlan({
        endDate: '2026-08-01',
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-04', weeklyMax: 6, targetAmount: 6 },
            { week: 2, weekStart: '2026-07-05', weekEnd: '2026-07-11', weeklyMax: 5, targetAmount: 5 },
            { week: 3, weekStart: '2026-07-12', weekEnd: '2026-07-18', weeklyMax: 4, targetAmount: 4 },
            { week: 4, weekStart: '2026-07-19', weekEnd: '2026-07-25', weeklyMax: 3, targetAmount: 3 },
            { week: 5, weekStart: '2026-07-26', weekEnd: '2026-08-01', weeklyMax: 2, targetAmount: 2 }
        ]
    });
    const rt = setup(plan, '2026-08-01');
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-08-01'), 5);
    assert.equal(rt.getWeekRowForDate(plan, '2026-08-01').weeklyMax, 2);
});

test('local timezone around midnight uses local YYYY-MM-DD', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-07-26');
    // Reference date is local calendar day; week starts Jul 26 inclusive.
    assert.equal(rt.getLocalDateString(), '2026-07-26');
    assert.equal(rt.getTaperPlanWeekNumber(plan, rt.getLocalDateString()), 5);

    // Explicit local Date at 00:15 still formats to the local calendar day.
    const localMidnight = new Date(2026, 6, 26, 0, 15, 0, 0);
    assert.equal(rt.getLocalDateString(localMidnight), '2026-07-26');
    assert.equal(rt.getWeekRowForDate(plan, rt.getLocalDateString(localMidnight)).week, 5);
});

test('after plan end date shows complete with final week and zero remaining', () => {
    const plan = makeManualWeekPlan();
    const rt = setup(plan, '2026-08-02');
    assert.equal(rt.isTaperPlanDateComplete(plan, '2026-08-02'), true);
    assert.equal(rt.getTaperPlanWeekNumber(plan, '2026-08-02'), 5);
    const summary = rt.getTaperWeeklySummary(plan, COKE_ID);
    assert.equal(summary.weekIndex, 5);
    assert.equal(summary.weeksRemaining, 0);
    assert.ok(summary.weeksRemaining >= 0);
});
