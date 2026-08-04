import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-01';

function setup({ goals = [], taperPlansV2 = [], settings = {} } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [{
            id: 'coke',
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [],
        purchases: [],
        cravings: [],
        goals,
        taperPlans: {},
        taperPlansV2,
        settings: { currency: '$', substanceSettings: {}, ...settings },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { goalsFromPlansV1: true }
    });
    rt.ensureGoals();
    return rt;
}

function makeGoal(rt, overrides) {
    return rt.saveGoalRecord(rt.normalizeGoalRecord({
        ...rt.getDefaultGoalRecord(),
        substanceId: 'coke',
        type: 'max_weekly_use',
        targetValue: 2,
        period: 'weekly',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        status: 'active',
        ...overrides
    })).goal;
}

const PLAN = {
    id: 'plan-1',
    name: 'Coke taper',
    substanceId: 'coke',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    monthlySpendTarget: 200,
    weeklyTargets: [{ weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 1.5 }]
};

test('legacy active tabs migrate onto the combined tabs and remember the subview', () => {
    const rt = setup({ settings: { activeTab: 'goals-tab' } });
    rt.migrateCombinedNavActiveTab();
    const data = rt.__getTestAppData();
    assert.equal(data.settings.activeTab, 'goals-plans-tab');
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'active');

    data.settings.activeTab = 'calendar';
    rt.migrateCombinedNavActiveTab();
    assert.equal(data.settings.activeTab, 'insights-calendar-tab');
    assert.equal(rt.ensureCombinedNavPrefs().insightsCalendarView, 'calendar');

    data.settings.activeTab = 'settings-tab';
    rt.migrateCombinedNavActiveTab();
    assert.equal(data.settings.activeTab, 'settings-tab');
});

test('legacy routes resolve to combined tabs from hash or path, and unknown routes are ignored', () => {
    const rt = setup();
    assert.equal(rt.parseAppRouteFromLocation(null), null);
    assert.equal(rt.parseAppRouteFromLocation({ hash: '', pathname: '/' }), null);
    assert.equal(rt.parseAppRouteFromLocation({ hash: '#/unknown' }), null);

    const fromHash = rt.parseAppRouteFromLocation({ hash: '#/plans' });
    assert.equal(fromHash.tab, 'goals-plans-tab');
    assert.equal(fromHash.redirectedFrom, '/plans');

    const withView = rt.parseAppRouteFromLocation({ hash: '#/insights?view=money' });
    assert.equal(withView.tab, 'insights-calendar-tab');
    assert.equal(withView.view, 'money');

    const fromPath = rt.parseAppRouteFromLocation({ hash: '', pathname: '/calendar/', search: '?view=calendar' });
    assert.equal(fromPath.tab, 'insights-calendar-tab');
    assert.equal(fromPath.view, 'calendar');
});

test('route hashes are built per tab and only carry a view for the combined tabs', () => {
    const rt = setup();
    assert.equal(rt.buildAppRouteHash('dashboard-tab'), '#/home');
    assert.equal(rt.buildAppRouteHash('use-log-tab'), '#/log');
    assert.equal(rt.buildAppRouteHash('buy-tracker-tab'), '#/inventory');
    assert.equal(rt.buildAppRouteHash('settings-tab', 'money'), '#/settings');
    assert.equal(rt.buildAppRouteHash('unknown-tab'), '#/home');
    assert.equal(rt.buildAppRouteHash('goals-plans-tab', 'active'), '#/goals-plans?view=active');
    assert.equal(rt.buildAppRouteHash('insights-calendar-tab', 'use'), '#/insights-calendar?view=use');
});

test('subview aliases normalize onto the canonical combined views', () => {
    const rt = setup();
    rt.setGoalsPlansView('plans', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'active');
    rt.setGoalsPlansView('goals', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'active');
    // Unknown views keep the current one rather than resetting the tab.
    rt.setGoalsPlansView('not-a-view', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'active');

    rt.setInsightsCalendarView('finances', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().insightsCalendarView, 'money');
    rt.setInsightsCalendarView('trends', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().insightsCalendarView, 'use');
    rt.setInsightsCalendarView('comparison', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().insightsCalendarView, 'more');
});

test('setGoalsPlansView can skip persisting the preference', () => {
    const rt = setup();
    rt.setGoalsPlansView('overview', { skipRoute: true });
    const saved = rt.__getTestAppData().settings.combinedNav.goalsPlansView;
    rt.setGoalsPlansView('templates', { persist: false, skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'templates');
    assert.equal(saved, 'overview');
});

test('goals link to and unlink from a plan', () => {
    const rt = setup({ taperPlansV2: [PLAN] });
    const goal = makeGoal(rt, { name: 'Weekly cap' });

    assert.equal(rt.goalsLinkedToPlan('').length, 0);
    assert.equal(rt.goalsLinkedToPlan('plan-1').length, 0);

    const linked = rt.linkGoalToPlan(goal.id, 'plan-1');
    assert.equal(linked.linkedPlanId, 'plan-1');
    assert.equal(rt.goalsLinkedToPlan('plan-1').length, 1);
    assert.ok(linked.changeHistory.some(entry => entry.action === 'plan-linked'));
    assert.equal(rt.linkGoalToPlan('missing-goal', 'plan-1'), null);

    const unlinked = rt.unlinkGoalFromPlan(goal.id);
    assert.equal(unlinked.linkedPlanId, '');
    assert.equal(rt.goalsLinkedToPlan('plan-1').length, 0);
});

test('creating goals from a plan activates every suggestion and links them to the plan', () => {
    const rt = setup({ taperPlansV2: [PLAN] });
    assert.equal(rt.createGoalsFromPlanAndOpen('missing-plan').length, 0);
    assert.equal(rt.getGoals().length, 0);

    const created = rt.createGoalsFromPlanAndOpen('plan-1');
    assert.ok(created.length >= 3);
    assert.ok(created.every(g => g.status === 'active' && g.linkedPlanId === 'plan-1'));
    assert.equal(rt.getGoals().length, created.length);
    assert.equal(rt.goalsLinkedToPlan('plan-1').length, created.length);
});

test('createPlanFromGoal returns the goal and needs no plan form to be open', () => {
    const rt = setup({ taperPlansV2: [PLAN] });
    const goal = makeGoal(rt, { name: 'Weekly cap' });
    assert.equal(rt.createPlanFromGoal(goal.id).id, goal.id);
    assert.equal(rt.createPlanFromGoal('missing-goal'), null);
});

test('goals and plans overview counts goals, plans and the closest deadline', () => {
    const rt = setup({
        taperPlansV2: [PLAN, { ...PLAN, id: 'plan-2', name: 'Archived taper', archived: true, status: 'archived' }]
    });
    makeGoal(rt, { name: 'Ends first', endDate: '2026-08-10' });
    makeGoal(rt, { name: 'Ends later', endDate: '2026-08-20' });
    makeGoal(rt, { name: 'Done', status: 'completed', completedAt: '2026-07-20T00:00:00.000Z' });

    const overview = rt.buildGoalsPlansOverview();
    assert.equal(overview.activePlanCount, 1);
    assert.equal(overview.plansOnTrack + overview.plansAboveTarget, 1);
    assert.equal(overview.activeGoalCount, 2);
    assert.equal(overview.closestGoalDeadline.name, 'Ends first');
    assert.equal(overview.recentlyCompletedGoals.length, 1);
    assert.equal(overview.recentlyCompletedPlans.length, 1);
    assert.equal(overview.evaluations.length, 3);
    assert.equal(overview.goalsOnTrack + overview.goalsNearLimit <= overview.evaluations.length, true);
});
