import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const REFERENCE_DATE = '2026-08-01';

function setup({ logs = [], purchases = [], goals = [], taperPlansV2 = [] } = {}) {
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
        }, {
            id: WEED_ID,
            name: 'Weed/THC',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }],
        logs,
        purchases,
        cravings: [],
        goals,
        settings: {
            currency: '$',
            substanceSettings: {},
            goalSystem: {
                thresholds: { nearLimit: 0.75, atLimit: 1 },
                scoreContributionEnabled: true,
                showGoalsOnDashboard: true,
                showGoalsOnCalendar: true
            }
        },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true, goalsFromPlansV1: true }
    });
    rt.ensureGoals();
    return rt;
}

function makeGoal(rt, overrides) {
    return rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        substanceId: COKE_ID,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active',
        ...overrides
    });
}

function makePurchase(overrides) {
    return {
        id: 'p1',
        substanceId: COKE_ID,
        date: '2026-07-20',
        quantity: 2,
        quantityBought: 2,
        remainingAmount: 2,
        unit: 'g',
        totalCost: 100,
        acquisitionType: 'purchased',
        ...overrides
    };
}

test('duplicateGoal copies fields as a fresh draft without history', () => {
    const rt = setup();
    const saved = rt.saveGoalRecord(makeGoal(rt, {
        name: 'Weekly cap',
        type: 'max_weekly_use',
        targetValue: 2,
        period: 'weekly'
    }));
    const original = saved.goal;
    original.periodHistory = [{ periodStart: '2026-07-20', periodEnd: '2026-07-26', met: true, finalized: true }];

    const copy = rt.duplicateGoal(original.id);
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.name, 'Weekly cap (copy)');
    assert.equal(copy.status, 'draft');
    assert.equal(copy.periodHistory.length, 0);
    assert.equal(copy.source, `duplicate:${original.id}`);
    assert.equal(rt.getGoals().length, 2);
    assert.equal(rt.duplicateGoal('missing-goal'), null);
});

test('manual completion and archiving keep an auditable status trail', () => {
    const rt = setup();
    const id = rt.saveGoalRecord(makeGoal(rt, {
        name: 'Manual goal',
        type: 'max_weekly_use',
        targetValue: 1,
        period: 'weekly',
        notes: 'start'
    })).goal.id;

    const completed = rt.completeGoalManually(id, 'hit it early');
    assert.equal(completed.status, 'completed');
    assert.ok(completed.completedAt);
    assert.match(completed.notes, /hit it early/);
    assert.ok(completed.changeHistory.some(entry => entry.action === 'completed-manually'));

    const archived = rt.archiveGoal(id);
    assert.equal(archived.status, 'archived');
    assert.ok(archived.archivedAt);
    assert.ok(archived.changeHistory.some(entry => entry.action === 'archived'));
    assert.equal(rt.archiveGoal('missing-goal'), null);
});

test('plan suggestions mirror plan targets and stay drafts until saved', () => {
    const rt = setup({
        taperPlansV2: [{
            id: 'plan-1',
            name: 'Coke taper',
            substanceId: COKE_ID,
            status: 'active',
            startDate: '2026-07-01',
            endDate: '2026-09-30',
            monthlySpendTarget: 250,
            weeklyTargets: [
                { weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 1.4 },
                { weekStart: '2026-08-03', weekEnd: '2026-08-09', targetAmount: 1.2 }
            ]
        }]
    });

    assert.equal(rt.suggestGoalsFromPlan('missing-plan').length, 0);
    const suggestions = rt.suggestGoalsFromPlan('plan-1');
    assert.ok(suggestions.length >= 3);
    assert.ok(suggestions.every(g => g.status === 'draft' && g.linkedPlanId === 'plan-1'));
    assert.equal(rt.getGoals().length, 0);

    const weekly = suggestions.find(g => g.type === 'max_weekly_use');
    assert.equal(weekly.targetValue, 1.4);
    assert.equal(weekly.period, 'weekly');
    const spend = suggestions.find(g => g.type === 'max_monthly_spend');
    assert.equal(spend.targetValue, 250);
    assert.ok(suggestions.some(g => g.type === 'plan_adherence_streak'));
});

test('goal insights analytics aggregate finalized periods by category, type and month', () => {
    const rt = setup();
    const goal = makeGoal(rt, {
        name: 'Weekly cap',
        type: 'max_weekly_use',
        targetValue: 1,
        period: 'weekly',
        recurring: true,
        periodHistory: [
            { periodStart: '2026-07-06', periodEnd: '2026-07-12', actual: 0.5, target: 1, status: 'completed', met: true, finalized: true },
            { periodStart: '2026-07-13', periodEnd: '2026-07-19', actual: 1.5, target: 1, status: 'missed', met: false, finalized: true }
        ]
    });
    rt.__getTestAppData().goals = [goal];

    const analytics = rt.buildGoalInsightsAnalytics();
    assert.equal(analytics.totalGoals, 1);
    const category = analytics.categories.find(c => c.category === 'use');
    assert.equal(category.goals, 1);
    assert.ok(category.periods >= 2);
    assert.equal(category.successRate, Math.round((category.met / category.periods) * 1000) / 10);
    const type = analytics.types.find(t => t.type === 'max_weekly_use');
    assert.equal(type.periods, category.periods);
    const july = analytics.trend.find(m => m.month === '2026-07');
    assert.ok(july.periods >= 2);
    assert.ok(july.met >= 1);
    assert.equal(analytics.bestGoals[0].goalId, goal.id);
    assert.equal(analytics.streaks[0].goalId, goal.id);
});

test('spend goals sum only purchases that count toward spend', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'p1', date: '2026-08-01', totalCost: 120 }),
            makePurchase({ id: 'p2', date: '2026-08-01', totalCost: 40, acquisitionType: 'gift_received' }),
            makePurchase({ id: 'p3', date: '2026-06-30', totalCost: 500 })
        ]
    });
    const ev = rt.evaluateGoal(makeGoal(rt, {
        name: 'Monthly spend cap',
        type: 'max_monthly_spend',
        targetValue: 200,
        period: 'monthly'
    }));
    assert.equal(ev.actual, 120);
    assert.equal(ev.unitKind, 'currency');
    assert.equal(ev.status, 'on_track');
    assert.equal(ev.detail.purchases, 1);
});

test('purchase count and minimum purchase gap read the same purchase window', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'p1', date: '2026-08-03' }),
            makePurchase({ id: 'p2', date: '2026-08-09' }),
            makePurchase({ id: 'p3', date: '2026-08-25' })
        ]
    });
    const count = rt.evaluateGoal(makeGoal(rt, {
        name: 'Monthly purchases',
        type: 'max_purchase_count',
        targetValue: 2,
        period: 'monthly'
    }));
    assert.equal(count.actual, 3);
    assert.equal(count.status, 'exceeded');
    assert.equal(count.detail.purchaseDays, 3);

    const gap = rt.evaluateGoal(makeGoal(rt, {
        name: 'Space out buys',
        type: 'min_days_between_purchases',
        targetValue: 10,
        period: 'monthly'
    }));
    assert.equal(gap.direction, 'min');
    assert.equal(gap.actual, 6);
    assert.equal(gap.detail.gaps.length, 2);
});

test('minimum purchase gap falls back to the no-purchase streak with no purchases in range', () => {
    const rt = setup();
    const gap = rt.evaluateGoal(makeGoal(rt, {
        name: 'Space out buys',
        type: 'min_days_between_purchases',
        targetValue: 10,
        period: 'monthly'
    }));
    assert.equal(gap.hasData, true);
    assert.ok(Number.isFinite(gap.actual));
    assert.equal(gap.detail.gaps.length, 0);
});

test('logging streak counts consecutive days ending today across logs and purchases', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.2 }),
            makeUseLog({ id: 'u2', substanceId: COKE_ID, date: '2026-07-31', amount: 0.2 }),
            makeUseLog({ id: 'u3', substanceId: COKE_ID, date: '2026-07-29', amount: 0.2 })
        ],
        purchases: [makePurchase({ id: 'p1', date: '2026-07-30' })]
    });
    const ev = rt.evaluateGoal(makeGoal(rt, {
        name: 'Log every day',
        type: 'logging_streak',
        targetValue: 7,
        period: 'entire'
    }));
    assert.equal(ev.actual, 4);
    assert.equal(ev.direction, 'min');
    assert.equal(ev.unitKind, 'days');
});

test('plan adherence streak needs a linked plan and breaks when usage passes the daily target', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.1 }),
            makeUseLog({ id: 'u2', substanceId: COKE_ID, date: '2026-07-30', amount: 5 })
        ],
        taperPlansV2: [{
            id: 'plan-1',
            name: 'Coke taper',
            substanceId: COKE_ID,
            status: 'active',
            startDate: '2026-07-01',
            weeklyTargets: [
                { weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 7 },
                { weekStart: '2026-07-20', weekEnd: '2026-07-26', targetAmount: 7 }
            ]
        }]
    });

    const unlinked = rt.evaluateGoal(makeGoal(rt, {
        name: 'Adherence',
        type: 'plan_adherence_streak',
        targetValue: 14,
        period: 'entire'
    }));
    assert.equal(unlinked.hasData, false);
    assert.equal(unlinked.detail.reason, 'no-plan');

    const linked = rt.evaluateGoal(makeGoal(rt, {
        name: 'Adherence',
        type: 'plan_adherence_streak',
        targetValue: 14,
        period: 'entire',
        linkedPlanId: 'plan-1'
    }));
    assert.equal(linked.hasData, true);
    assert.equal(linked.actual, 2);
});

test('active inventory goals total remaining amounts of active purchases', () => {
    const rt = setup({
        purchases: [
            makePurchase({ id: 'p1', date: '2026-07-10', remainingAmount: 1.5 }),
            makePurchase({ id: 'p2', date: '2026-07-11', remainingAmount: 0.5 }),
            makePurchase({ id: 'p3', date: '2026-07-12', remainingAmount: 0 })
        ]
    });
    const ev = rt.evaluateGoal(makeGoal(rt, {
        name: 'Keep stock low',
        type: 'max_active_inventory',
        targetValue: 3,
        period: 'entire'
    }));
    assert.equal(ev.actual, 2);
    assert.equal(ev.unit, 'g');
    assert.equal(ev.status, 'on_track');
});

test('weekend-only and weekday-free goals count use days by weekday', () => {
    const rt = setup({
        logs: [
            // 2026-08-01 is a Saturday.
            makeUseLog({ id: 'sat', substanceId: COKE_ID, date: '2026-08-01', amount: 0.3 }),
            makeUseLog({ id: 'thu', substanceId: COKE_ID, date: '2026-07-30', amount: 0.3 }),
            makeUseLog({ id: 'fri', substanceId: COKE_ID, date: '2026-07-31', amount: 0.3 })
        ]
    });
    const weekendOnly = rt.evaluateGoal(makeGoal(rt, {
        name: 'Weekend only',
        type: 'weekend_only_use',
        targetValue: 0,
        period: 'weekly'
    }));
    assert.equal(weekendOnly.actual, 2);
    assert.deepEqual([...weekendOnly.detail.dates], ['2026-07-30', '2026-07-31']);
    assert.equal(weekendOnly.status, 'exceeded');

    const weekdayFree = rt.evaluateGoal(makeGoal(rt, {
        name: 'Weekday only',
        type: 'weekday_free_use',
        targetValue: 2,
        period: 'weekly'
    }));
    assert.deepEqual([...weekdayFree.detail.dates], ['2026-08-01']);
    assert.equal(weekdayFree.actual, 1);
});

test('cost per use day divides qualifying spend by distinct use days', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.3 }),
            makeUseLog({ id: 'u2', substanceId: COKE_ID, date: '2026-07-31', amount: 0.3 })
        ],
        purchases: [makePurchase({ id: 'p1', date: '2026-08-01', totalCost: 90 })]
    });
    const ev = rt.evaluateGoal(makeGoal(rt, {
        name: 'Cost per use day',
        type: 'cost_per_use_day',
        targetValue: 50,
        period: 'monthly'
    }));
    assert.equal(ev.detail.useDays, 1);
    assert.equal(ev.actual, 90);
    assert.equal(ev.status, 'exceeded');
});

test('auto baseline uses the lookback window before the goal start date', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'b1', substanceId: COKE_ID, date: '2026-07-20', amount: 3.5 }),
            makeUseLog({ id: 'c1', substanceId: COKE_ID, date: '2026-07-28', amount: 1 })
        ]
    });
    const goal = makeGoal(rt, {
        name: 'Cut back 20%',
        type: 'reduction_pct',
        targetValue: 20,
        period: 'weekly',
        startDate: '2026-07-27',
        baselineMode: 'auto',
        baselineLookbackDays: 7
    });
    const baseline = rt.evaluateGoal(goal).detail.baseline;
    assert.equal(baseline.mode, 'auto');
    assert.equal(baseline.startDate, '2026-07-20');
    assert.equal(baseline.endDate, '2026-07-26');
    assert.equal(baseline.perDay, 0.5);
    // Six days of the current week remain after the goal start date.
    assert.equal(baseline.value, 3);

    const ev = rt.evaluateGoal(goal);
    assert.equal(ev.unitKind, 'percent');
    assert.ok(ev.actual > 0, `expected a positive reduction, got ${ev.actual}`);
});
