import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-01';

function setup({ taperPlansV2 = [], settings = {} } = {}) {
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
        goals: [],
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
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');

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
    assert.equal(rt.buildAppRouteHash('goals-plans-tab', 'overview'), '#/goals-plans?view=overview');
    assert.equal(rt.buildAppRouteHash('insights-calendar-tab', 'use'), '#/insights-calendar?view=use');
});

test('subview aliases normalize onto the canonical combined views', () => {
    const rt = setup();
    rt.setGoalsPlansView('plans', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');
    rt.setGoalsPlansView('goals', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');
    rt.setGoalsPlansView('active', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');
    rt.setGoalsPlansView('not-a-view', { skipRoute: true });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');

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

test('goal conversion helpers are no-ops after goals removal', () => {
    const rt = setup({ taperPlansV2: [PLAN] });
    assert.equal(rt.goalsLinkedToPlan('plan-1').length, 0);
    assert.equal(rt.linkGoalToPlan('any', 'plan-1'), null);
    assert.equal(rt.createGoalsFromPlanAndOpen('plan-1').length, 0);
    assert.equal(rt.createPlanFromGoal('any'), null);
    assert.equal(rt.getGoalById('any'), null);
    assert.equal(rt.evaluateAllGoals().length, 0);
});

test('tapers overview counts active plans without goals', () => {
    const rt = setup({
        taperPlansV2: [PLAN, { ...PLAN, id: 'plan-2', name: 'Archived taper', archived: true, status: 'archived' }]
    });
    const overview = rt.buildGoalsPlansOverview();
    assert.equal(overview.activeTaperCount, 1);
    assert.equal(overview.activeGoalCount, 0);
    assert.equal(overview.activeTotal, 1);
    assert.ok(overview.activeRecords.some(r => r.id === 'plan-1' && r.type === 'taper'));
});
