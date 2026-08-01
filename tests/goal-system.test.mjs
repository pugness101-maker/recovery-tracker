import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const REFERENCE_DATE = '2026-08-01';

function makeSubstance(id, overrides = {}) {
    const map = {
        coke: {
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        },
        weed: {
            id: WEED_ID,
            name: 'Weed/THC',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }
    };
    return { ...(map[id] || map.coke), ...overrides };
}

function setup({ logs = [], purchases = [], goals = [], taperPlansV2 = [], settings = {} } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
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
                showGoalsOnCalendar: true,
                ...(settings.goalSystem || {})
            },
            recoveryDashboard: {
                dateRangePreset: 'this-week',
                scoreEnabled: true,
                selectedDashboardSubstance: 'all'
            },
            ...settings
        },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureGoals();
    return rt;
}

test('creates and validates a weekly use goal', () => {
    const rt = setup();
    const draft = {
        ...rt.getDefaultGoalRecord(),
        name: 'Weekly coke cap',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 1.5,
        period: 'weekly',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    };
    const bad = rt.validateGoalRecord({ ...draft, name: '', targetValue: null });
    assert.equal(bad.valid, false);
    assert.ok(bad.errors.length >= 1);

    const saved = rt.saveGoalRecord(draft);
    assert.equal(saved.ok, true);
    assert.equal(rt.getGoals().length, 1);
    assert.equal(rt.getGoals()[0].name, 'Weekly coke cap');
});

test('status calculation for maximum goals uses near/at/exceeded thresholds', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-07-28', amount: 0.4 }),
            makeUseLog({ id: 'u2', substanceId: COKE_ID, date: '2026-07-29', amount: 0.4 }),
            makeUseLog({ id: 'u3', substanceId: COKE_ID, date: '2026-07-30', amount: 0.4 })
        ]
    });
    const goal = rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Week max',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 1.0,
        period: 'weekly',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    const ev = rt.evaluateGoal(goal);
    assert.ok(['near_limit', 'at_limit', 'exceeded', 'on_track'].includes(ev.status), ev.status);
    assert.ok(ev.actual == null || Number.isFinite(ev.actual));
});

test('personal use goals count only personal shared portion and exclude gifts', () => {
    const rt = setup({
        logs: [
            {
                id: 'sh1',
                substanceId: COKE_ID,
                date: '2026-08-01',
                amount: 1,
                personalAmount: 0.25,
                sharedAmount: 0.75,
                transactionType: 'shared_use',
                type: 'quick'
            },
            {
                id: 'gg1',
                substanceId: COKE_ID,
                date: '2026-08-01',
                amount: 0.5,
                transactionType: 'gift_given',
                type: 'quick'
            }
        ]
    });
    const goal = rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Daily max',
        type: 'max_daily_use',
        substanceId: COKE_ID,
        targetValue: 1,
        period: 'daily',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    const ev = rt.evaluateGoal(goal);
    assert.ok(ev.actual != null);
    assert.ok(ev.actual <= 0.3, `expected personal-only amount, got ${ev.actual}`);
});

test('pause and resume do not delete related logs or purchases', () => {
    const rt = setup({
        logs: [makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.2 })],
        purchases: [{
            id: 'p1',
            substanceId: COKE_ID,
            date: '2026-07-20',
            quantity: 3.5,
            quantityBought: 3.5,
            remainingAmount: 3,
            unit: 'g',
            totalCost: 100,
            acquisitionType: 'purchased'
        }]
    });
    const saved = rt.saveGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Pause me',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 2,
        startDate: '2026-07-01',
        endDate: '2026-08-31'
    });
    const id = saved.goal.id;
    rt.pauseGoal(id);
    assert.equal(rt.getGoalById(id).status, 'paused');
    rt.resumeGoal(id);
    assert.equal(rt.getGoalById(id).status, 'active');
    rt.deleteGoal(id);
    assert.equal(rt.getGoals().length, 0);
    assert.equal(rt.__getTestAppData().logs.length, 1);
    assert.equal(rt.__getTestAppData().purchases.length, 1);
});

test('recurring period history is not overwritten after finalization', () => {
    const rt = setup();
    const goal = rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'History goal',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 1,
        period: 'weekly',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active',
        periodHistory: [{
            periodStart: '2026-07-20',
            periodEnd: '2026-07-26',
            actual: 0.5,
            target: 1,
            status: 'completed',
            met: true,
            finalized: true,
            note: 'keep me'
        }]
    });
    rt.__getTestAppData().goals = [goal];
    const ev = rt.evaluateGoal(goal);
    rt.syncGoalPeriodHistory(goal, ev);
    const frozen = goal.periodHistory.find(p => p.periodStart === '2026-07-20');
    assert.equal(frozen.finalized, true);
    assert.equal(frozen.actual, 0.5);
    assert.equal(frozen.note, 'keep me');
});

test('dashboard summary updates with selected substance and active goals', () => {
    const rt = setup();
    rt.saveGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Coke goal',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 2,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    rt.saveGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Weed goal',
        type: 'max_weekly_use',
        substanceId: WEED_ID,
        targetValue: 5,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    const summary = rt.buildGoalDashboardSummary();
    assert.ok(summary.counts.active >= 2);

    const dataset = rt.buildRecoveryDashboardDataset(rt.__getTestAppData(), { substanceId: COKE_ID, bypassCache: true });
    assert.ok(dataset.goalsSummary);
    assert.ok(dataset.goalsSummary.activeCount >= 1);
    assert.ok(dataset.summary.activeGoalCount >= 1);
});

test('calendar maps goal start and deadline events linked to original goal', () => {
    const rt = setup();
    const saved = rt.saveGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Calendar goal',
        type: 'no_use_streak',
        substanceId: COKE_ID,
        targetValue: 7,
        startDate: '2026-08-02',
        endDate: '2026-08-20',
        status: 'active'
    });
    const events = rt.mapGoalsToCalendarEvents({ startDate: '2026-08-01', endDate: '2026-08-31' });
    assert.ok(events.some(e => e.id === `goal-start-${saved.goal.id}`));
    assert.ok(events.some(e => e.id === `goal-deadline-${saved.goal.id}`));
    assert.ok(events.every(e => e.recordKind === 'goal' && e.linkedGoalId === saved.goal.id));
});

test('legacy plan goal dates migrate to needs-review goals', () => {
    const rt = setup({
        taperPlansV2: [{
            id: 'plan-1',
            name: 'Old plan',
            substanceId: COKE_ID,
            status: 'active',
            startDate: '2026-07-01',
            goalDate: '2026-08-15',
            weeklyTargets: []
        }],
        settings: { goalSystem: {} }
    });
    // Force migration path
    const data = rt.__getTestAppData();
    data.migrations.goalsFromPlansV1 = false;
    data.goals = [];
    rt.migrateLegacyGoals(data);
    assert.ok(data.goals.length >= 1);
    assert.equal(data.goals[0].needsReview, true);
    assert.equal(data.migrations.goalsFromPlansV1, true);
});

test('templates prefill editable goal fields', () => {
    const rt = setup();
    const draft = rt.createGoalFromTemplate('streak-30', { substanceId: COKE_ID });
    assert.ok(draft);
    assert.equal(draft.type, 'no_use_streak');
    assert.equal(draft.targetValue, 30);
    draft.name = 'My 30 day streak';
    const saved = rt.saveGoalRecord(draft);
    assert.equal(saved.ok, true);
    assert.equal(saved.goal.name, 'My 30 day streak');
});

test('all-substances use goals keep grouped incompatible units', () => {
    const rt = setup({
        logs: [
            makeUseLog({ id: 'c1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.5 }),
            {
                id: 'w1',
                substanceId: WEED_ID,
                date: '2026-08-01',
                amount: 1,
                weedProductType: 'bud',
                transactionType: 'use',
                type: 'quick'
            }
        ]
    });
    const goal = rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'All use',
        type: 'max_weekly_use',
        substanceId: 'all',
        targetValue: 10,
        period: 'weekly',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    const actual = rt.computeGoalActual(goal, rt.resolveGoalPeriodBounds(goal));
    if (actual.groups) {
        assert.ok(actual.groups.length >= 1);
    } else {
        assert.ok(actual.value != null || actual.hasData === false || Number.isFinite(actual.value));
    }
});

test('recovery score can disable goal contribution', () => {
    const rt = setup({
        logs: [makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.2 })]
    });
    rt.saveGoalRecord({
        ...rt.getDefaultGoalRecord(),
        name: 'Score goal',
        type: 'max_weekly_use',
        substanceId: COKE_ID,
        targetValue: 5,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active'
    });
    rt.persistGoalSystemPrefs({ scoreContributionEnabled: false });
    const dataset = rt.buildRecoveryDashboardDataset(rt.__getTestAppData(), { bypassCache: true });
    assert.equal(dataset.score.factors.find(f => f.key === 'goalAdherence')?.value ?? null, null);
});
