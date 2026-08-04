import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function setup() {
    const rt = loadRecoveryTrackerApp();
    rt.ensureCombinedNavPrefs(rt.__getTestAppData());
    return rt;
}

test('markup uses combined nav tabs and keeps legacy content ids', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /data-tab="goals-plans-tab"/);
    assert.match(html, /data-tab="insights-calendar-tab"/);
    assert.match(html, /id="goals-plans-tab"/);
    assert.match(html, /id="insights-calendar-tab"/);
    assert.match(html, /id="goals-tab"/);
    assert.match(html, /id="taper-tab"/);
    assert.match(html, /id="stats-tab"/);
    assert.match(html, /id="calendar-tab"/);
    assert.doesNotMatch(html, /data-tab="goals-tab"/);
    assert.doesNotMatch(html, /data-tab="taper-tab"/);
    assert.doesNotMatch(html, /data-tab="stats-tab"/);
    assert.doesNotMatch(html, /data-tab="calendar-tab"/);
    assert.match(html, /Goals &amp; Plans|Goals & Plans/);
    assert.match(html, /Insights &amp; Calendar|Insights & Calendar/);
});

test('legacy tab ids resolve to combined tabs with expected views', () => {
    const rt = setup();
    const goals = rt.resolveTabNavigation('goals-tab');
    assert.equal(goals.tabId, 'goals-plans-tab');
    assert.equal(goals.view, 'active');
    const taper = rt.resolveTabNavigation('taper-tab');
    assert.equal(taper.tabId, 'goals-plans-tab');
    assert.equal(taper.view, 'active');
    const stats = rt.resolveTabNavigation('stats-tab');
    assert.equal(stats.tabId, 'insights-calendar-tab');
    assert.equal(stats.view, 'overview');
    const calendar = rt.resolveTabNavigation('calendar-tab');
    assert.equal(calendar.tabId, 'insights-calendar-tab');
    assert.equal(calendar.view, 'calendar');
    assert.equal(rt.normalizeTabId('plan'), 'goals-plans-tab');
    assert.equal(rt.normalizeTabId('insights'), 'insights-calendar-tab');
    assert.equal(rt.normalizeTabId('goals-plans-tab'), 'goals-plans-tab');
    assert.equal(rt.normalizeTabId('insights-calendar-tab'), 'insights-calendar-tab');
});

test('old routes redirect to combined routes with view params', () => {
    const rt = setup();
    const goals = rt.parseAppRouteFromLocation({ hash: '#/goals', pathname: '/', search: '' });
    assert.equal(goals.tab, 'goals-plans-tab');
    assert.equal(goals.view, 'active');

    const plan = rt.parseAppRouteFromLocation({ hash: '#/plan', pathname: '/', search: '' });
    assert.equal(plan.tab, 'goals-plans-tab');
    assert.equal(plan.view, 'active');

    const insights = rt.parseAppRouteFromLocation({ hash: '#/insights', pathname: '/', search: '' });
    assert.equal(insights.tab, 'insights-calendar-tab');
    assert.equal(insights.view, 'overview');

    const calendar = rt.parseAppRouteFromLocation({ hash: '#/calendar', pathname: '/', search: '' });
    assert.equal(calendar.tab, 'insights-calendar-tab');
    assert.equal(calendar.view, 'calendar');

    assert.equal(
        rt.buildAppRouteHash('goals-plans-tab', 'active'),
        '#/goals-plans?view=active'
    );
    assert.equal(
        rt.buildAppRouteHash('insights-calendar-tab', 'calendar'),
        '#/insights-calendar?view=calendar'
    );
});

test('saved combined nav view state persists in settings', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    const prefs = rt.ensureCombinedNavPrefs(data);
    prefs.goalsPlansView = 'templates';
    prefs.insightsCalendarView = 'money';
    assert.equal(data.settings.combinedNav.goalsPlansView, 'templates');
    assert.equal(data.settings.combinedNav.insightsCalendarView, 'money');
    // Legacy Insights views migrate into the simplified 5-tab set
    prefs.insightsCalendarView = 'financial';
    rt.ensureCombinedNavPrefs(data);
    assert.equal(data.settings.combinedNav.insightsCalendarView, 'money');
});

test('migrate activeTab from legacy goals/plan/insights/calendar', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    data.settings.activeTab = 'goals-tab';
    rt.migrateCombinedNavActiveTab(data);
    assert.equal(data.settings.activeTab, 'goals-plans-tab');
    assert.equal(data.settings.combinedNav.goalsPlansView, 'active');

    data.settings.activeTab = 'calendar-tab';
    rt.migrateCombinedNavActiveTab(data);
    assert.equal(data.settings.activeTab, 'insights-calendar-tab');
    assert.equal(data.settings.combinedNav.insightsCalendarView, 'calendar');
});

test('goals and plans remain separate record types with multi-goal plan links', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    rt.ensureGoals(data);
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2(data);

    const planId = 'plan-link-1';
    data.taperPlansV2 = data.taperPlansV2 || [];
    data.taperPlansV2.push({
        id: planId,
        name: 'Weekly taper',
        substanceId: 'coke',
        weeklyTargets: [{ weekStart: '2026-07-28', weekEnd: '2026-08-03', targetAmount: 1 }],
        archived: false
    });

    const g1 = rt.normalizeGoalRecord({
        id: 'g1',
        name: 'Weekly max',
        type: 'max_weekly_use',
        substanceId: 'coke',
        targetValue: 1,
        period: 'weekly',
        status: 'active',
        linkedPlanId: planId
    });
    const g2 = rt.normalizeGoalRecord({
        id: 'g2',
        name: 'No buy 14d',
        type: 'no_purchase_streak',
        substanceId: 'coke',
        targetValue: 14,
        period: 'entire',
        status: 'active',
        linkedPlanId: planId
    });
    data.goals.push(g1, g2);

    const linked = rt.goalsLinkedToPlan(planId, data);
    assert.equal(linked.length, 2);
    assert.ok(Array.isArray(data.goals));
    assert.ok(Array.isArray(data.taperPlansV2));
    assert.notEqual(data.goals[0].id, data.taperPlansV2[0].id);
    const unified = rt.getUnifiedGoalsPlansRecords(data);
    assert.ok(unified.some(record => record.id === 'g1' && record.type === 'goal'));
    assert.ok(unified.some(record => record.id === planId && record.type === 'taper'));

    rt.unlinkGoalFromPlan('g1', data);
    assert.equal(rt.getGoalById('g1', data).linkedPlanId, '');
    assert.equal(rt.goalsLinkedToPlan(planId, data).length, 1);
});

test('goals-plans overview includes required summary fields', () => {
    const rt = setup();
    const overview = rt.buildGoalsPlansOverview(rt.__getTestAppData());
    assert.ok('activeTotal' in overview);
    assert.ok('activeGoalCount' in overview);
    assert.ok('activePlanCount' in overview);
    assert.ok('activeTaperCount' in overview);
    assert.ok('goalsOnTrack' in overview);
    assert.ok('goalsNearLimit' in overview);
    assert.ok('plansOnTrack' in overview);
    assert.ok('plansAboveTarget' in overview);
    assert.ok('closestGoalDeadline' in overview);
    assert.ok('currentPlanWeek' in overview);
    assert.ok(Array.isArray(overview.activeRecords));
    assert.ok(Array.isArray(overview.recentlyCompletedGoals));
    assert.ok(Array.isArray(overview.recentlyCompletedPlans));
});
