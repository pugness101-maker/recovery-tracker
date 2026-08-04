// ——— Combined navigation: Goals & Plans + Insights & Calendar ———

const COMBINED_NAV_ROUTE_REDIRECTS = {
    '/goals': { tab: 'goals-plans-tab', view: 'active-goals' },
    '/plan': { tab: 'goals-plans-tab', view: 'active-plans' },
    '/plans': { tab: 'goals-plans-tab', view: 'active-plans' },
    '/insights': { tab: 'insights-calendar-tab', view: 'overview' },
    '/calendar': { tab: 'insights-calendar-tab', view: 'calendar' },
    '/goals-plans': { tab: 'goals-plans-tab', view: null },
    '/insights-calendar': { tab: 'insights-calendar-tab', view: null },
    '/home': { tab: 'dashboard-tab', view: null },
    '/log': { tab: 'use-log-tab', view: null },
    '/inventory': { tab: 'buy-tracker-tab', view: null },
    '/settings': { tab: 'settings-tab', view: null },
    '/contacts': { tab: 'settings-tab', view: 'contacts' },
    '/friends': { tab: 'settings-tab', view: 'contacts' }
};

const GOALS_PLANS_VIEWS = [
    'overview',
    'active-goals',
    'active-plans',
    'goal-history',
    'plan-history',
    'templates',
    'achievements'
];

const INSIGHTS_CALENDAR_VIEWS = [
    'overview',
    'calendar',
    'use',
    'money',
    'more'
];

const LEGACY_TAB_TO_COMBINED = {
    'goals-tab': { tab: 'goals-plans-tab', view: 'active-goals' },
    goals: { tab: 'goals-plans-tab', view: 'active-goals' },
    'taper-tab': { tab: 'goals-plans-tab', view: 'active-plans' },
    taper: { tab: 'goals-plans-tab', view: 'active-plans' },
    plan: { tab: 'goals-plans-tab', view: 'active-plans' },
    'plan-tab': { tab: 'goals-plans-tab', view: 'active-plans' },
    'stats-tab': { tab: 'insights-calendar-tab', view: 'overview' },
    stats: { tab: 'insights-calendar-tab', view: 'overview' },
    insights: { tab: 'insights-calendar-tab', view: 'overview' },
    'insights-tab': { tab: 'insights-calendar-tab', view: 'overview' },
    'calendar-tab': { tab: 'insights-calendar-tab', view: 'calendar' },
    calendar: { tab: 'insights-calendar-tab', view: 'calendar' },
    'goals-plans': { tab: 'goals-plans-tab', view: null },
    'insights-calendar': { tab: 'insights-calendar-tab', view: null }
};

let combinedNavRouteSyncing = false;

function getDefaultCombinedNavPrefs() {
    return {
        goalsPlansView: 'overview',
        insightsCalendarView: 'overview',
        goalsPlansCollapsed: {
            activeGoals: false,
            activePlans: false,
            upcoming: false,
            completed: true,
            paused: true,
            history: true
        }
    };
}

function ensureCombinedNavPrefs(data = appData) {
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultCombinedNavPrefs();
    if (!data.settings.combinedNav || typeof data.settings.combinedNav !== 'object') {
        data.settings.combinedNav = { ...defaults, goalsPlansCollapsed: { ...defaults.goalsPlansCollapsed } };
    }
    const prefs = data.settings.combinedNav;
    if (!GOALS_PLANS_VIEWS.includes(prefs.goalsPlansView)) prefs.goalsPlansView = defaults.goalsPlansView;
    // Migrate legacy Insights subviews into Overview / Calendar / Use / Money / More
    if (typeof normalizeCombinedView === 'function') {
        prefs.insightsCalendarView = normalizeCombinedView(
            prefs.insightsCalendarView,
            INSIGHTS_CALENDAR_VIEWS,
            defaults.insightsCalendarView
        );
    } else if (!INSIGHTS_CALENDAR_VIEWS.includes(prefs.insightsCalendarView)) {
        prefs.insightsCalendarView = defaults.insightsCalendarView;
    }
    if (!prefs.goalsPlansCollapsed || typeof prefs.goalsPlansCollapsed !== 'object') {
        prefs.goalsPlansCollapsed = { ...defaults.goalsPlansCollapsed };
    }
    Object.keys(defaults.goalsPlansCollapsed).forEach(key => {
        if (prefs.goalsPlansCollapsed[key] === undefined) {
            prefs.goalsPlansCollapsed[key] = defaults.goalsPlansCollapsed[key];
        }
    });
    return prefs;
}

function migrateCombinedNavActiveTab(data = appData) {
    if (!data.settings) return;
    const active = data.settings.activeTab;
    const mapped = LEGACY_TAB_TO_COMBINED[active] || LEGACY_TAB_TO_COMBINED[String(active || '').replace(/-tab$/, '')];
    if (mapped) {
        data.settings.activeTab = mapped.tab;
        const prefs = ensureCombinedNavPrefs(data);
        if (mapped.view) {
            if (mapped.tab === 'goals-plans-tab') prefs.goalsPlansView = mapped.view;
            if (mapped.tab === 'insights-calendar-tab') prefs.insightsCalendarView = mapped.view;
        }
    }
}

function persistCombinedNavPrefs(data = appData) {
    ensureCombinedNavPrefs(data);
    if (typeof saveData === 'function') saveData(data);
}

function persistActiveTab(tabId, data = appData) {
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    data.settings.activeTab = tabId;
    if (typeof saveData === 'function') saveData(data);
}

function normalizeCombinedView(view, allowed, fallback) {
    const raw = String(view || '').trim().toLowerCase();
    const aliases = {
        goals: 'active-goals',
        plans: 'active-plans',
        compare: 'more',
        comparison: 'more',
        comparisons: 'more',
        'goal-analytics': 'more',
        'plan-analytics': 'more',
        finances: 'money',
        financial: 'money',
        purchase: 'money',
        'use-analytics': 'use',
        'purchase-analytics': 'money',
        'custom-metrics': 'more',
        custom: 'more',
        charts: 'use',
        trends: 'use'
    };
    const mapped = aliases[raw] || raw;
    return allowed.includes(mapped) ? mapped : fallback;
}

function parseAppRouteFromLocation(loc = (typeof location !== 'undefined' ? location : null)) {
    if (!loc) return null;
    let pathPart = '';
    let query = '';

    const hash = String(loc.hash || '');
    if (hash.startsWith('#/')) {
        const body = hash.slice(1);
        const qIdx = body.indexOf('?');
        pathPart = qIdx >= 0 ? body.slice(0, qIdx) : body;
        query = qIdx >= 0 ? body.slice(qIdx + 1) : '';
    } else {
        pathPart = String(loc.pathname || '');
        query = String(loc.search || '').replace(/^\?/, '');
    }

    if (!pathPart || pathPart === '/') return null;
    if (!pathPart.startsWith('/')) pathPart = `/${pathPart}`;
    pathPart = pathPart.replace(/\/+$/, '') || '/';

    const params = typeof URLSearchParams !== 'undefined'
        ? new URLSearchParams(query)
        : {
            get(key) {
                const match = String(query || '').match(new RegExp(`(?:^|&)${key}=([^&]*)`));
                return match ? decodeURIComponent(match[1]) : null;
            }
        };
    const viewParam = params.get('view');
    const redirect = COMBINED_NAV_ROUTE_REDIRECTS[pathPart];
    if (redirect) {
        return {
            tab: redirect.tab,
            view: viewParam || redirect.view,
            redirectedFrom: pathPart
        };
    }
    return null;
}

function buildAppRouteHash(tabId, view = null) {
    const map = {
        'dashboard-tab': '/home',
        'use-log-tab': '/log',
        'buy-tracker-tab': '/inventory',
        'goals-plans-tab': '/goals-plans',
        'insights-calendar-tab': '/insights-calendar',
        'settings-tab': '/settings'
    };
    const path = map[tabId] || '/home';
    if (view && (tabId === 'goals-plans-tab' || tabId === 'insights-calendar-tab')) {
        return `#${path}?view=${encodeURIComponent(view)}`;
    }
    return `#${path}`;
}

function syncLocationToCombinedRoute(tabId, view = null) {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    if (combinedNavRouteSyncing) return;
    const next = buildAppRouteHash(tabId, view);
    if (location.hash === next) return;
    combinedNavRouteSyncing = true;
    try {
        history.replaceState(null, '', next);
    } catch (_) {
        location.hash = next;
    } finally {
        combinedNavRouteSyncing = false;
    }
}

function applyRouteRedirectIfNeeded() {
    if (typeof location === 'undefined') return null;
    const parsed = parseAppRouteFromLocation(location);
    if (!parsed) return null;
    const canonical = buildAppRouteHash(
        parsed.tab,
        parsed.view || (
            parsed.tab === 'goals-plans-tab'
                ? ensureCombinedNavPrefs().goalsPlansView
                : parsed.tab === 'insights-calendar-tab'
                    ? ensureCombinedNavPrefs().insightsCalendarView
                    : null
        )
    );
    if (parsed.redirectedFrom && COMBINED_NAV_ROUTE_REDIRECTS[parsed.redirectedFrom]
        && ['/goals', '/plan', '/plans', '/insights', '/calendar'].includes(parsed.redirectedFrom)) {
        try {
            history.replaceState(null, '', canonical);
        } catch (_) {
            location.hash = canonical;
        }
    }
    return parsed;
}

function setCombinedSubviewVisibility(containerSelector, attrName, activeView) {
    const root = typeof document !== 'undefined' ? document.querySelector(containerSelector) : null;
    if (!root) return;
    root.querySelectorAll('.combined-subview').forEach(el => {
        const views = String(el.getAttribute(attrName) || '').split(/\s+/).filter(Boolean);
        const match = views.includes(activeView);
        el.classList.toggle('active', match);
        el.hidden = !match;
    });
}

function syncCombinedSubnav(navId, selectId, attrName, activeView) {
    const nav = typeof document !== 'undefined' ? document.getElementById(navId) : null;
    nav?.querySelectorAll('.combined-subnav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute(attrName) === activeView);
        btn.setAttribute('aria-selected', btn.getAttribute(attrName) === activeView ? 'true' : 'false');
    });
    const select = typeof document !== 'undefined' ? document.getElementById(selectId) : null;
    if (select && select.value !== activeView) select.value = activeView;
}

function goalsLinkedToPlan(planId, data = appData) {
    if (!planId) return [];
    return (data.goals || []).filter(g => g && g.linkedPlanId === planId);
}

function createPlanFromGoal(goalId, data = appData) {
    const goal = typeof getGoalById === 'function' ? getGoalById(goalId, data) : (data.goals || []).find(g => g?.id === goalId);
    if (!goal) return null;
    if (typeof showNewTaperPlan === 'function') {
        setGoalsPlansView('active-plans', { persist: true, skipRoute: false });
        showNewTaperPlan();
        const nameEl = typeof document !== 'undefined' ? document.getElementById('taper-plan-name') : null;
        if (nameEl && !nameEl.value) {
            nameEl.value = `Plan for ${goal.name || 'goal'}`;
        }
        const substanceEl = typeof document !== 'undefined' ? document.getElementById('taper-substance') : null;
        if (substanceEl && goal.substanceId && goal.substanceId !== 'all') {
            substanceEl.value = goal.substanceId;
            if (typeof onTaperSubstanceChange === 'function') onTaperSubstanceChange();
        }
    }
    return goal;
}

function createGoalsFromPlanAndOpen(planId, data = appData) {
    const suggestions = typeof suggestGoalsFromPlan === 'function' ? suggestGoalsFromPlan(planId, data) : [];
    if (!suggestions.length) {
        if (typeof showToast === 'function') showToast('No goal suggestions for this plan yet.', 'info');
        return [];
    }
    ensureGoals(data);
    suggestions.forEach(g => {
        g.status = 'active';
        data.goals.push(g);
    });
    if (typeof saveData === 'function') saveData(data);
    if (typeof pushChangeHistory === 'function') {
        pushChangeHistory('goals-from-plan', { planId, count: suggestions.length });
    }
    setGoalsPlansView('active-goals', { persist: true });
    if (typeof renderGoalsView === 'function') renderGoalsView();
    if (typeof showToast === 'function') showToast(`Created ${suggestions.length} goal${suggestions.length === 1 ? '' : 's'} from plan.`, 'success');
    return suggestions;
}

function linkGoalToPlan(goalId, planId, data = appData) {
    const goal = typeof getGoalById === 'function' ? getGoalById(goalId, data) : null;
    if (!goal) return null;
    goal.linkedPlanId = planId || '';
    if (typeof pushGoalChange === 'function') pushGoalChange(goal, 'plan-linked', { planId });
    if (typeof goalAfterMutation === 'function') goalAfterMutation(data);
    else if (typeof saveData === 'function') saveData(data);
    return goal;
}

function buildGoalsPlansOverview(data = appData) {
    ensureGoals(data);
    if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
    const evaluations = typeof evaluateAllGoals === 'function' ? evaluateAllGoals({ data }) : [];
    const activeGoals = evaluations.filter(e => e?.goal?.status === 'active' || e?.status === 'active' || e?.bucket === 'active');
    const onTrack = evaluations.filter(e => ['on_track', 'met', 'ahead'].includes(e?.status || e?.progressStatus));
    const nearLimit = evaluations.filter(e => ['at_risk', 'near_limit', 'behind'].includes(e?.status || e?.progressStatus));
    const completedRecent = (data.goals || [])
        .filter(g => g && (g.status === 'completed' || g.status === 'met'))
        .slice()
        .sort((a, b) => String(b.completedAt || b.endDate || b.updatedAt || '').localeCompare(String(a.completedAt || a.endDate || a.updatedAt || '')))
        .slice(0, 5);

    const plans = (data.taperPlansV2 || []).filter(p => p && !p.archived && p.status !== 'archived');
    const archivedPlans = (data.taperPlansV2 || []).filter(p => p && (p.archived || p.status === 'archived'));
    let plansOnTrack = 0;
    let plansAbove = 0;
    let plansWithErrors = 0;
    let currentPlanWeek = '—';
    plans.forEach(plan => {
        try {
            if (typeof getTaperPlanProgressSummary === 'function') {
                const summary = getTaperPlanProgressSummary(plan, data);
                if (summary?.aboveTarget || summary?.status === 'above') plansAbove += 1;
                else plansOnTrack += 1;
                if (summary?.currentWeekLabel && currentPlanWeek === '—') currentPlanWeek = summary.currentWeekLabel;
            } else if (Array.isArray(plan.weeklyTargets) && plan.weeklyTargets.length) {
                const today = typeof getLocalDateString === 'function' ? getLocalDateString() : '';
                const week = plan.weeklyTargets.find(w => (w.weekStart || '') <= today && (w.weekEnd || '9999') >= today);
                if (week) {
                    currentPlanWeek = week.label || week.weekStart || currentPlanWeek;
                    const actual = Number(week.actualAmount ?? week.actual ?? 0);
                    const target = Number(week.targetAmount ?? week.target ?? 0);
                    if (target > 0 && actual > target) plansAbove += 1;
                    else plansOnTrack += 1;
                } else {
                    plansOnTrack += 1;
                }
            } else {
                plansOnTrack += 1;
            }
        } catch (err) {
            // A plan whose progress cannot be evaluated is not evidence of being on track.
            plansWithErrors += 1;
            logSuppressedError('buildGoalsPlansOverview:plan', err);
        }
    });

    const closestDeadline = (data.goals || [])
        .filter(g => g && g.status === 'active' && g.endDate)
        .slice()
        .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))[0];

    return {
        activeGoalCount: activeGoals.length || (data.goals || []).filter(g => g?.status === 'active').length,
        activePlanCount: plans.length,
        goalsOnTrack: onTrack.length,
        goalsNearLimit: nearLimit.length,
        plansOnTrack,
        plansAboveTarget: plansAbove,
        plansWithErrors,
        closestGoalDeadline: closestDeadline ? { id: closestDeadline.id, name: closestDeadline.name, endDate: closestDeadline.endDate } : null,
        currentPlanWeek,
        recentlyCompletedGoals: completedRecent,
        recentlyCompletedPlans: archivedPlans.slice(0, 5),
        evaluations,
        plans
    };
}

function renderGoalsPlansOverviewHtml(overview) {
    const deadline = overview.closestGoalDeadline
        ? `${escapeHtml(overview.closestGoalDeadline.name || 'Goal')} · ${escapeHtml(overview.closestGoalDeadline.endDate)}`
        : 'None set';
    const recentGoals = overview.recentlyCompletedGoals.length
        ? `<ul class="combined-mini-list">${overview.recentlyCompletedGoals.map(g => `<li>${escapeHtml(g.name || 'Goal')}</li>`).join('')}</ul>`
        : '<p class="settings-hint">No recently completed goals.</p>';
    const recentPlans = overview.recentlyCompletedPlans.length
        ? `<ul class="combined-mini-list">${overview.recentlyCompletedPlans.map(p => `<li>${escapeHtml(p.name || 'Plan')}</li>`).join('')}</ul>`
        : '<p class="settings-hint">No recently completed plans.</p>';

    return `
        <div class="combined-overview">
            <div class="combined-overview-grid">
                <article class="combined-stat-card"><span class="combined-stat-label">Active goals</span><strong>${overview.activeGoalCount}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Active plans</span><strong>${overview.activePlanCount}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Goals on track</span><strong>${overview.goalsOnTrack}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Goals near limit</span><strong>${overview.goalsNearLimit}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Plans on track</span><strong>${overview.plansOnTrack}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Plans above target</span><strong>${overview.plansAboveTarget}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Closest goal deadline</span><strong class="combined-stat-text">${deadline}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Current plan week</span><strong class="combined-stat-text">${escapeHtml(String(overview.currentPlanWeek))}</strong></article>
            </div>
            <div class="combined-overview-columns">
                <section class="combined-overview-block">
                    <h3>Recently completed goals</h3>
                    ${recentGoals}
                    <button type="button" class="secondary-btn btn-sm" onclick="setGoalsPlansView('goal-history')">View goal history</button>
                </section>
                <section class="combined-overview-block">
                    <h3>Recently completed plans</h3>
                    ${recentPlans}
                    <button type="button" class="secondary-btn btn-sm" onclick="setGoalsPlansView('plan-history')">View plan history</button>
                </section>
            </div>
            <div class="combined-overview-actions">
                <button type="button" class="btn-primary" onclick="setGoalsPlansView('active-goals'); openGoalCreateForm();">New goal</button>
                <button type="button" class="secondary-btn" onclick="setGoalsPlansView('active-plans'); showNewTaperPlan();">New plan</button>
                <button type="button" class="secondary-btn" onclick="setGoalsPlansView('templates')">Browse templates</button>
            </div>
        </div>`;
}

function renderGoalsPlansCombinedView() {
    const loading = typeof document !== 'undefined' ? document.getElementById('gp-loading') : null;
    const error = typeof document !== 'undefined' ? document.getElementById('gp-error') : null;
    loading?.classList.add('hidden');
    error?.classList.add('hidden');
    try {
        const prefs = ensureCombinedNavPrefs();
        setGoalsPlansView(prefs.goalsPlansView, { persist: false, skipRoute: true, force: true });
    } catch (err) {
        console.error('[goals-plans] render failed', err);
        loading?.classList.add('hidden');
        error?.classList.remove('hidden');
        const msg = document.getElementById('gp-error-message');
        if (msg) msg.textContent = err?.message || 'Could not load Goals & Plans.';
    }
}

function setGoalsPlansView(view, options = {}) {
    const prefs = ensureCombinedNavPrefs();
    const next = normalizeCombinedView(view, GOALS_PLANS_VIEWS, prefs.goalsPlansView || 'overview');
    prefs.goalsPlansView = next;
    if (options.persist !== false) persistCombinedNavPrefs();

    syncCombinedSubnav('gp-subnav', 'gp-subnav-select', 'data-gp-view', next);
    setCombinedSubviewVisibility('#goals-plans-tab', 'data-gp-view', next);

    if (typeof goalSystemUiState === 'object' && goalSystemUiState) {
        if (next === 'active-goals') goalSystemUiState.bucket = 'active';
        else if (next === 'goal-history') goalSystemUiState.bucket = 'history';
        else if (next === 'achievements') goalSystemUiState.bucket = 'completed';
        else if (next === 'templates') goalSystemUiState.bucket = 'active';
    }

    if (next === 'overview') {
        const root = document.getElementById('gp-overview-root');
        if (root) root.innerHTML = renderGoalsPlansOverviewHtml(buildGoalsPlansOverview());
    } else if (next === 'active-goals' || next === 'goal-history' || next === 'templates' || next === 'achievements') {
        if (typeof renderGoalsView === 'function') renderGoalsView();
    } else if (next === 'active-plans' || next === 'plan-history') {
        const showArchived = document.getElementById('taper-show-archived');
        if (showArchived) {
            showArchived.checked = next === 'plan-history';
            if (typeof onTaperShowArchivedChange === 'function') onTaperShowArchivedChange();
        }
        if (typeof applyMainSubstanceToViewSelectors === 'function') applyMainSubstanceToViewSelectors();
        if (typeof populatePageSubstanceDropdowns === 'function') populatePageSubstanceDropdowns();
        if (typeof syncTaperSubstanceToSelected === 'function') syncTaperSubstanceToSelected();
        if (typeof refreshTaperDashboard === 'function') refreshTaperDashboard();
    }

    if (!options.skipRoute) syncLocationToCombinedRoute('goals-plans-tab', next);
    if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
}

function buildInsightsCalendarOverview(data = appData) {
    const substanceId = (typeof document !== 'undefined' && document.getElementById('stats-substance')?.value)
        || (typeof selectedSubstanceId !== 'undefined' ? selectedSubstanceId : 'all');
    const rangeLabel = (typeof document !== 'undefined' && document.getElementById('stats-date-range')?.selectedOptions?.[0]?.textContent)
        || 'Selected range';

    let useSummary = '—';
    let spendSummary = '—';
    let purchaseSummary = '—';
    let goalPerf = '—';
    let planPerf = '—';
    let warnings = [];

    try {
        if (typeof buildDashboardFinancialSummary === 'function') {
            const fin = buildDashboardFinancialSummary(data, substanceId === 'all' ? 'all' : substanceId);
            spendSummary = fin?.spentThisMonth != null ? `$${Number(fin.spentThisMonth).toFixed(2)} this month` : '—';
            purchaseSummary = fin?.purchaseCount != null ? `${fin.purchaseCount} purchases in range` : '—';
        }
    } catch (_) { /* overview soft-fail */ }

    try {
        if (typeof buildGoalDashboardSummary === 'function') {
            const g = buildGoalDashboardSummary({ data });
            goalPerf = `${g.counts?.active || 0} active · ${g.counts?.atRisk || 0} needing attention`;
        }
    } catch (_) { /* overview soft-fail */ }

    try {
        const gp = buildGoalsPlansOverview(data);
        planPerf = `${gp.plansOnTrack} on track · ${gp.plansAboveTarget} above target`;
        useSummary = `${gp.activeGoalCount} goals linked to recovery focus`;
    } catch (_) { /* overview soft-fail */ }

    try {
        if (typeof buildFinancialDataQualityIssues === 'function') {
            warnings = (buildFinancialDataQualityIssues(data) || []).slice(0, 5);
        }
    } catch (_) { /* overview soft-fail */ }

    return {
        rangeLabel,
        substanceId,
        useSummary,
        spendSummary,
        purchaseSummary,
        goalPerf,
        planPerf,
        warnings,
        importantEvents: []
    };
}

function renderInsightsCalendarOverviewHtml(overview) {
    const warnings = overview.warnings?.length
        ? `<ul class="combined-mini-list">${overview.warnings.map(w => `<li>${escapeHtml(w.message || w.title || 'Data warning')}</li>`).join('')}</ul>`
        : '<p class="settings-hint">No data warnings right now.</p>';
    return `
        <div class="combined-overview">
            <p class="settings-hint">Date range: <strong>${escapeHtml(overview.rangeLabel)}</strong></p>
            <div class="combined-overview-grid">
                <article class="combined-stat-card"><span class="combined-stat-label">Use summary</span><strong class="combined-stat-text">${escapeHtml(String(overview.useSummary))}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Spending summary</span><strong class="combined-stat-text">${escapeHtml(String(overview.spendSummary))}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Purchase summary</span><strong class="combined-stat-text">${escapeHtml(String(overview.purchaseSummary))}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Goal performance</span><strong class="combined-stat-text">${escapeHtml(String(overview.goalPerf))}</strong></article>
                <article class="combined-stat-card"><span class="combined-stat-label">Plan performance</span><strong class="combined-stat-text">${escapeHtml(String(overview.planPerf))}</strong></article>
            </div>
            <div class="combined-overview-columns">
                <section class="combined-overview-block">
                    <h3>Calendar preview</h3>
                    <p class="settings-hint">Open the full calendar for month, week, day, and agenda views.</p>
                    <button type="button" class="secondary-btn btn-sm" onclick="setInsightsCalendarView('calendar')">Open calendar</button>
                </section>
                <section class="combined-overview-block">
                    <h3>Data warnings</h3>
                    ${warnings}
                </section>
            </div>
            <div class="combined-overview-actions">
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('use')">Use</button>
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('money')">Money</button>
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('more')">More</button>
            </div>
        </div>`;
}

function applyInsightsCalendarSectionFilter(view) {
    const stats = typeof document !== 'undefined' ? document.getElementById('stats-tab') : null;
    if (!stats) return;
    // Overview now shares the Insights shell (filter bar + summary + charts).
    // Calendar keeps its dedicated full-page view.
    if (view === 'calendar') {
        stats.hidden = true;
        return;
    }
    stats.hidden = false;
    stats.classList.add('active');
    stats.querySelectorAll('.collapsible-section[data-ic-panels]').forEach(section => {
        const panels = String(section.getAttribute('data-ic-panels') || '').split(/\s+/).filter(Boolean);
        const match = panels.includes(view);
        section.classList.toggle('ic-section-hidden', !match);
        section.hidden = !match;
    });
}

function renderPlanAnalyticsPanel(data = appData) {
    const panel = typeof document !== 'undefined' ? document.getElementById('plan-analytics-panel') : null;
    if (!panel) return;
    try {
        if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
        const plans = (data.taperPlansV2 || []).filter(Boolean);
        if (!plans.length) {
            panel.innerHTML = '<p class="settings-hint">No plans yet. Create a plan from Goals &amp; Plans.</p>';
            return;
        }
        const rows = plans.slice(0, 20).map(plan => {
            const linked = goalsLinkedToPlan(plan.id, data);
            const status = plan.archived ? 'Archived' : 'Active';
            return `<tr>
                <td>${escapeHtml(plan.name || 'Plan')}</td>
                <td>${escapeHtml(status)}</td>
                <td>${linked.length}</td>
                <td><button type="button" class="btn-small" onclick="setInsightsCalendarView('calendar')">Calendar</button>
                    <button type="button" class="btn-small" onclick="switchTab('goals-plans-tab'); setGoalsPlansView('active-plans'); openTaperPlanFromManage('${escapeHtml(plan.id)}');">Open</button></td>
            </tr>`;
        }).join('');
        panel.innerHTML = `
            <div class="table-scroll">
                <table class="sheet-table">
                    <thead><tr><th>Plan</th><th>Status</th><th>Linked goals</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } catch (err) {
        panel.innerHTML = `<p class="rd-error">Could not render plan analytics: ${escapeHtml(err?.message || String(err))}</p>`;
    }
}

function renderInsightsCalendarCombinedView() {
    const loading = document.getElementById('ic-loading');
    const error = document.getElementById('ic-error');
    loading?.classList.add('hidden');
    error?.classList.add('hidden');
    try {
        const prefs = ensureCombinedNavPrefs();
        setInsightsCalendarView(prefs.insightsCalendarView, { persist: false, skipRoute: true, force: true });
    } catch (err) {
        console.error('[insights-calendar] render failed', err);
        error?.classList.remove('hidden');
        const msg = document.getElementById('ic-error-message');
        if (msg) msg.textContent = err?.message || 'Could not load Insights & Calendar.';
    }
}

function setInsightsCalendarView(view, options = {}) {
    const prefs = ensureCombinedNavPrefs();
    const next = normalizeCombinedView(view, INSIGHTS_CALENDAR_VIEWS, prefs.insightsCalendarView || 'overview');
    prefs.insightsCalendarView = next;
    if (options.persist !== false) persistCombinedNavPrefs();

    syncCombinedSubnav('ic-subnav', 'ic-subnav-select', 'data-ic-view', next);
    setCombinedSubviewVisibility('#insights-calendar-tab', 'data-ic-view', next);
    applyInsightsCalendarSectionFilter(next);

    if (next === 'overview') {
        const root = document.getElementById('ic-overview-root');
        if (root) root.innerHTML = renderInsightsCalendarOverviewHtml(buildInsightsCalendarOverview());
        if (typeof applyMainSubstanceToViewSelectors === 'function') applyMainSubstanceToViewSelectors();
        if (typeof updateStats === 'function') updateStats();
    } else if (next === 'calendar') {
        if (typeof renderCalendarView === 'function') renderCalendarView();
    } else {
        if (typeof applyMainSubstanceToViewSelectors === 'function') applyMainSubstanceToViewSelectors();
        if (typeof updateStats === 'function') updateStats();
        if (next === 'money') {
            if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
            if (typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();
        }
        if (next === 'use') {
            if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
            if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView();
        }
        if (next === 'more') {
            if (typeof renderPlanAnalyticsPanel === 'function') renderPlanAnalyticsPanel();
            if (typeof renderGoalInsightsPanel === 'function') renderGoalInsightsPanel();
            if (typeof renderInsightsContactAnalytics === 'function') renderInsightsContactAnalytics();
            if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
            const customRoot = document.getElementById('custom-metrics-root');
            if (customRoot && !customRoot.dataset.ready) {
                customRoot.innerHTML = '<p class="settings-hint">Custom metric formulas will appear here when the builder is enabled. Use Money and Use for built-in metrics today.</p>';
                customRoot.dataset.ready = '1';
            }
        }
    }

    if (!options.skipRoute) syncLocationToCombinedRoute('insights-calendar-tab', next);
    if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
}

function handleCombinedNavHashChange() {
    if (combinedNavRouteSyncing) return;
    const parsed = applyRouteRedirectIfNeeded() || parseAppRouteFromLocation();
    if (!parsed?.tab) return;
    combinedNavRouteSyncing = true;
    try {
        if (parsed.tab === 'goals-plans-tab' && parsed.view) {
            ensureCombinedNavPrefs().goalsPlansView = normalizeCombinedView(parsed.view, GOALS_PLANS_VIEWS, 'overview');
        }
        if (parsed.tab === 'insights-calendar-tab' && parsed.view) {
            ensureCombinedNavPrefs().insightsCalendarView = normalizeCombinedView(parsed.view, INSIGHTS_CALENDAR_VIEWS, 'overview');
        }
        switchTab(parsed.tab);
    } finally {
        combinedNavRouteSyncing = false;
    }
}

function initCombinedNavigation() {
    ensureCombinedNavPrefs();
    migrateCombinedNavActiveTab();
    if (typeof window !== 'undefined') {
        window.addEventListener('hashchange', handleCombinedNavHashChange);
    }
    applyRouteRedirectIfNeeded();
}
