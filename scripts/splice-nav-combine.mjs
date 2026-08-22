#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appPath = path.join(root, 'app.js');
const modPath = path.join(root, 'nav-combine.module.js');
let app = fs.readFileSync(appPath, 'utf8');
const mod = fs.readFileSync(modPath, 'utf8').trim() + '\n\n';

if (app.includes('function setGoalsPlansView(')) {
    console.log('nav-combine already spliced; updating in place via marker replace skipped.');
} else {
    const marker = 'const defaultData =';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker not found');
    app = app.slice(0, idx) + mod + app.slice(idx);
    console.log('Inserted nav-combine.module.js before defaultData');
}

// Update REMOVED_TAB_ALIASES + normalizeTabId + switchTab block
const oldSwitchBlock = `const REMOVED_TAB_ALIASES = {
    'history-tab': 'use-log-tab',
    history: 'use-log-tab'
};

function normalizeTabId(tabId) {
    if (!tabId) return 'dashboard-tab';
    const alias = REMOVED_TAB_ALIASES[tabId] || REMOVED_TAB_ALIASES[String(tabId).replace(/-tab$/, '')];
    if (alias) return alias;
    return document.getElementById(tabId) ? tabId : 'dashboard-tab';
}

let cachedNavButtons = null;

function getNavButtons() {
    if (!cachedNavButtons?.length) {
        cachedNavButtons = [...document.querySelectorAll('.bottom-nav .nav-btn')];
    }
    return cachedNavButtons;
}

function setActiveNavTab(tabId) {
    getNavButtons().forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

function switchTab(tabId) {
    tabId = normalizeTabId(tabId);
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    setActiveNavTab(tabId);
    document.getElementById(tabId)?.classList.add('active');

    if (tabId === 'dashboard-tab') {
        ensureDashboardSubstanceDropdownReady();
        updateDashboard();
    } else if (tabId === 'stats-tab') {
        applyMainSubstanceToViewSelectors();
        updateStats();
    } else if (tabId === 'buy-tracker-tab') {
        syncBuyFormFromSelectedSubstance();
        renderBuyTrackerTab();
    } else if (tabId === 'use-log-tab') {
        syncUseLogFormFromSelectedSubstance();
        renderUseLogTab();
    } else if (tabId === 'calendar-tab') {
        renderCalendarView();
    } else if (tabId === 'goals-tab') {
        renderGoalsView();
    } else if (tabId === 'taper-tab') {
        applyMainSubstanceToViewSelectors();
        populatePageSubstanceDropdowns();
        syncTaperSubstanceToSelected();
        refreshTaperDashboard();
    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        syncRecoveryScoreSettingsToggle();
        syncUseCustomNamesInCsvToggle();
    }
    applyCollapsedSections();
}`;

const newSwitchBlock = `const REMOVED_TAB_ALIASES = {
    'history-tab': 'use-log-tab',
    history: 'use-log-tab',
    'goals-tab': 'goals-plans-tab',
    goals: 'goals-plans-tab',
    'taper-tab': 'goals-plans-tab',
    taper: 'goals-plans-tab',
    plan: 'goals-plans-tab',
    'plan-tab': 'goals-plans-tab',
    'stats-tab': 'insights-calendar-tab',
    stats: 'insights-calendar-tab',
    insights: 'insights-calendar-tab',
    'insights-tab': 'insights-calendar-tab',
    'calendar-tab': 'insights-calendar-tab',
    calendar: 'insights-calendar-tab'
};

function resolveTabNavigation(tabId) {
    if (!tabId) return { tabId: 'dashboard-tab', view: null };
    const raw = String(tabId);
    const legacy = (typeof LEGACY_TAB_TO_COMBINED !== 'undefined' && (LEGACY_TAB_TO_COMBINED[raw] || LEGACY_TAB_TO_COMBINED[raw.replace(/-tab$/, '')])) || null;
    if (legacy) return { tabId: legacy.tab, view: legacy.view || null };
    const alias = REMOVED_TAB_ALIASES[raw] || REMOVED_TAB_ALIASES[raw.replace(/-tab$/, '')];
    const resolved = alias || raw;
    if (typeof document !== 'undefined' && document.getElementById(resolved)?.classList?.contains('tab')) {
        return { tabId: resolved, view: null };
    }
    if (typeof document !== 'undefined' && document.getElementById(resolved)) {
        // Legacy content ids that are now subviews
        if (resolved === 'goals-tab' || resolved === 'taper-tab') return { tabId: 'goals-plans-tab', view: resolved === 'taper-tab' ? 'active-plans' : 'active-goals' };
        if (resolved === 'stats-tab' || resolved === 'calendar-tab') return { tabId: 'insights-calendar-tab', view: resolved === 'calendar-tab' ? 'calendar' : 'overview' };
    }
    return { tabId: document.getElementById(resolved) ? resolved : 'dashboard-tab', view: null };
}

function normalizeTabId(tabId) {
    return resolveTabNavigation(tabId).tabId;
}

let cachedNavButtons = null;

function getNavButtons() {
    if (!cachedNavButtons?.length) {
        cachedNavButtons = [...document.querySelectorAll('.bottom-nav .nav-btn')];
    }
    return cachedNavButtons;
}

function setActiveNavTab(tabId) {
    getNavButtons().forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

function switchTab(tabId) {
    const nav = resolveTabNavigation(tabId);
    tabId = nav.tabId;
    if (nav.view && tabId === 'goals-plans-tab' && typeof ensureCombinedNavPrefs === 'function') {
        ensureCombinedNavPrefs().goalsPlansView = nav.view;
    }
    if (nav.view && tabId === 'insights-calendar-tab' && typeof ensureCombinedNavPrefs === 'function') {
        ensureCombinedNavPrefs().insightsCalendarView = nav.view;
    }

    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    setActiveNavTab(tabId);
    document.getElementById(tabId)?.classList.add('active');
    if (typeof persistActiveTab === 'function') persistActiveTab(tabId);

    if (tabId === 'dashboard-tab') {
        ensureDashboardSubstanceDropdownReady();
        updateDashboard();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    } else if (tabId === 'insights-calendar-tab') {
        if (typeof renderInsightsCalendarCombinedView === 'function') renderInsightsCalendarCombinedView();
        else {
            applyMainSubstanceToViewSelectors();
            updateStats();
        }
    } else if (tabId === 'stats-tab') {
        // Legacy alias path — prefer combined tab
        switchTab('insights-calendar-tab');
        return;
    } else if (tabId === 'buy-tracker-tab') {
        syncBuyFormFromSelectedSubstance();
        renderBuyTrackerTab();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    } else if (tabId === 'use-log-tab') {
        syncUseLogFormFromSelectedSubstance();
        renderUseLogTab();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    } else if (tabId === 'calendar-tab') {
        switchTab('insights-calendar-tab');
        return;
    } else if (tabId === 'goals-plans-tab') {
        if (typeof renderGoalsPlansCombinedView === 'function') renderGoalsPlansCombinedView();
        else if (typeof renderGoalsView === 'function') renderGoalsView();
    } else if (tabId === 'goals-tab') {
        switchTab('goals-plans-tab');
        return;
    } else if (tabId === 'taper-tab') {
        switchTab('goals-plans-tab');
        return;
    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        syncRecoveryScoreSettingsToggle();
        syncUseCustomNamesInCsvToggle();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    }
    applyCollapsedSections();
}`;

if (!app.includes('function resolveTabNavigation(')) {
    if (!app.includes(oldSwitchBlock)) {
        throw new Error('Could not find switchTab block to replace');
    }
    app = app.replace(oldSwitchBlock, newSwitchBlock);
    console.log('Replaced switchTab / normalizeTabId block');
} else {
    console.log('resolveTabNavigation already present');
}

// ensureAppDataSettings hooks
const ensureNeedle = `    ensureGoalSystemPrefs(data);
    ensureFinancialAnalyticsPrefs(data);`;
const ensureRepl = `    ensureGoalSystemPrefs(data);
    ensureCombinedNavPrefs(data);
    migrateCombinedNavActiveTab(data);
    ensureFinancialAnalyticsPrefs(data);`;
if (app.includes(ensureNeedle) && !app.includes('ensureCombinedNavPrefs(data)')) {
    app = app.replace(ensureNeedle, ensureRepl);
    console.log('Hooked ensureCombinedNavPrefs into ensureAppDataSettings');
}

// collapsed sections defaults
if (!app.includes('statsPlanAnalytics:')) {
    app = app.replace(
        'statsFinancialAnalytics: false,',
        'statsFinancialAnalytics: false,\n    statsPlanAnalytics: false,\n    statsCustomMetrics: false,'
    );
}

// init on load — after persistLoadedAppDataIfNeeded / before activeTab switch
const initNeedle = `    if (appData.settings?.activeTab) {
        switchTab(appData.settings.activeTab);
    }
}`;
const initRepl = `    if (typeof initCombinedNavigation === 'function') initCombinedNavigation();
    const route = typeof applyRouteRedirectIfNeeded === 'function' ? applyRouteRedirectIfNeeded() : null;
    if (route?.tab) {
        switchTab(route.tab);
    } else if (appData.settings?.activeTab) {
        switchTab(appData.settings.activeTab);
    }
}`;
if (app.includes(initNeedle) && !app.includes('initCombinedNavigation')) {
    app = app.replace(initNeedle, initRepl);
    console.log('Hooked initCombinedNavigation on load');
}

// Test exports
const exportNeedle = `        mapGoalsToCalendarEvents,`;
const exportRepl = `        mapGoalsToCalendarEvents,
        ensureCombinedNavPrefs,
        migrateCombinedNavActiveTab,
        resolveTabNavigation,
        normalizeTabId,
        parseAppRouteFromLocation,
        buildAppRouteHash,
        setGoalsPlansView,
        setInsightsCalendarView,
        buildGoalsPlansOverview,
        goalsLinkedToPlan,
        linkGoalToPlan,
        createPlanFromGoal,
        createGoalsFromPlanAndOpen,
        GOALS_PLANS_VIEWS,
        INSIGHTS_CALENDAR_VIEWS,
        COMBINED_NAV_ROUTE_REDIRECTS,`;
if (app.includes(exportNeedle) && !app.includes('ensureCombinedNavPrefs,')) {
    app = app.replace(exportNeedle, exportRepl);
    console.log('Added combined nav test exports');
}

fs.writeFileSync(appPath, app);
console.log('splice-nav-combine complete');
