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

test('markup uses combined nav tabs and keeps taper content ids', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /data-tab="goals-plans-tab"/);
    assert.match(html, /data-tab="insights-calendar-tab"/);
    assert.match(html, /id="goals-plans-tab"/);
    assert.match(html, /id="insights-calendar-tab"/);
    assert.match(html, /id="tapers-root"/);
    assert.match(html, /id="taper-tab"/);
    assert.match(html, /id="stats-tab"/);
    assert.match(html, /id="calendar-tab"/);
    assert.doesNotMatch(html, /data-tab="goals-tab"/);
    assert.doesNotMatch(html, /data-tab="taper-tab"/);
    assert.doesNotMatch(html, /data-tab="stats-tab"/);
    assert.doesNotMatch(html, /data-tab="calendar-tab"/);
    assert.match(html, />Tapers</);
    assert.match(html, /Tapers define a gradual reduction path/);
    assert.doesNotMatch(html, /Goals &amp; Plans|New Goal|Convert Taper to Goal|goals define the target/i);
    assert.match(html, /Insights &amp; Calendar|Insights & Calendar/);
});

test('legacy tab ids resolve to combined tabs with expected views', () => {
    const rt = setup();
    const goals = rt.resolveTabNavigation('goals-tab');
    assert.equal(goals.tabId, 'goals-plans-tab');
    assert.equal(goals.view, 'overview');
    const taper = rt.resolveTabNavigation('taper-tab');
    assert.equal(taper.tabId, 'goals-plans-tab');
    assert.equal(taper.view, 'overview');
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
    assert.equal(goals.view, 'overview');

    const plan = rt.parseAppRouteFromLocation({ hash: '#/plan', pathname: '/', search: '' });
    assert.equal(plan.tab, 'goals-plans-tab');
    assert.equal(plan.view, 'overview');

    const insights = rt.parseAppRouteFromLocation({ hash: '#/insights', pathname: '/', search: '' });
    assert.equal(insights.tab, 'insights-calendar-tab');
    assert.equal(insights.view, 'overview');

    const calendar = rt.parseAppRouteFromLocation({ hash: '#/calendar', pathname: '/', search: '' });
    assert.equal(calendar.tab, 'insights-calendar-tab');
    assert.equal(calendar.view, 'calendar');

    assert.equal(
        rt.buildAppRouteHash('goals-plans-tab', 'overview'),
        '#/goals-plans?view=overview'
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
    assert.equal(data.settings.combinedNav.goalsPlansView, 'overview');

    data.settings.activeTab = 'calendar-tab';
    rt.migrateCombinedNavActiveTab(data);
    assert.equal(data.settings.activeTab, 'insights-calendar-tab');
    assert.equal(data.settings.combinedNav.insightsCalendarView, 'calendar');
});

test('unified records are taper-only and existing tapers still load', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2(data);

    const planId = 'plan-link-1';
    data.taperPlansV2 = data.taperPlansV2 || [];
    data.taperPlansV2.push({
        id: planId,
        name: 'Weekly taper',
        substanceId: 'coke',
        status: 'active',
        weeklyTargets: [{ weekStart: '2026-07-28', weekEnd: '2026-08-03', targetAmount: 1 }],
        archived: false
    });
    data.goals = [{ id: 'legacy-goal', name: 'Ignored', status: 'active' }];

    const unified = rt.getUnifiedGoalsPlansRecords(data);
    assert.equal(unified.length, 1);
    assert.equal(unified[0].type, 'taper');
    assert.equal(unified[0].id, planId);
    assert.equal(rt.goalsLinkedToPlan(planId, data).length, 0);
    assert.equal(rt.createGoalsFromPlanAndOpen(planId).length, 0);
    assert.equal(rt.GOAL_TEMPLATES.length, 0);
});

test('tapers overview includes required summary fields', () => {
    const rt = setup();
    const overview = rt.buildGoalsPlansOverview(rt.__getTestAppData());
    assert.ok('activeTotal' in overview);
    assert.ok('activeGoalCount' in overview);
    assert.ok('activePlanCount' in overview);
    assert.ok('activeTaperCount' in overview);
    assert.ok('plansOnTrack' in overview);
    assert.ok('plansAboveTarget' in overview);
    assert.ok('currentPlanWeek' in overview);
    assert.ok(Array.isArray(overview.activeRecords));
    assert.ok(Array.isArray(overview.recentlyCompletedPlans));
    assert.equal(overview.activeGoalCount, 0);
});
