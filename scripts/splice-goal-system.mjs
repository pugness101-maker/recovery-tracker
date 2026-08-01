import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'goal-system.module.js'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing patch target: ${label}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Goal System ———')) {
    const marker = 'function ensureCalendarViewPrefs(data = appData)';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('calendar marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced goal module');
} else {
    console.log('Goal module already present');
}

app = replaceOnce(app,
    `    cravings: [],\n    settings: {`,
    `    cravings: [],\n    goals: [],\n    settings: {`,
    'defaultData.goals');

app = replaceOnce(app,
    `    data.cravings = data.cravings || [];\n\n    ensurePurchaseIds(data);`,
    `    data.cravings = data.cravings || [];\n    data.goals = Array.isArray(data.goals) ? data.goals : [];\n\n    ensurePurchaseIds(data);`,
    'normalize goals array');

if (!app.includes('ensureGoals(data);')) {
    app = replaceOnce(app,
        `ensureAppDataSettings(data);`,
        `ensureAppDataSettings(data);\n    ensureGoals(data);`,
        'ensureGoals after settings');
}

app = replaceOnce(app,
    `    ensureCalendarViewPrefs(data);\n    ensureTableColumnSettings(data);`,
    `    ensureCalendarViewPrefs(data);\n    ensureGoalSystemPrefs(data);\n    ensureTableColumnSettings(data);`,
    'ensureGoalSystemPrefs');

app = replaceOnce(app,
    `    calendarFilters: true,\n    calendarDisplaySettings: true\n};`,
    `    calendarFilters: true,\n    calendarDisplaySettings: true,\n    goalsFilters: true,\n    goalsTemplates: false,\n    goalsReminders: false,\n    goalsList: false\n};`,
    'collapsed goals');

app = replaceOnce(app,
    `    } else if (tabId === 'calendar-tab') {\n        renderCalendarView();\n    } else if (tabId === 'taper-tab') {`,
    `    } else if (tabId === 'calendar-tab') {\n        renderCalendarView();\n    } else if (tabId === 'goals-tab') {\n        renderGoalsView();\n    } else if (tabId === 'taper-tab') {`,
    'switchTab goals');

app = replaceOnce(app,
    `        case 'goal':\n            switchTab('taper-tab');\n            showNewTaperPlan();\n            break;`,
    `        case 'goal':\n            switchTab('goals-tab');\n            openGoalCreateForm();\n            break;`,
    'quick action goal');

app = replaceOnce(app,
    `    renderDashboardRecoveryInsights();\n    updateLastSavedDisplay();`,
    `    renderDashboardRecoveryInsights();\n    if (typeof renderGoalsView === 'function' && document.getElementById('goals-root')) {\n        try { renderGoalsView(); } catch (_) { /* ignore */ }\n    }\n    updateLastSavedDisplay();`,
    'refresh goals');

app = replaceOnce(app,
    `        taperPlansV2: (data.taperPlansV2 || []).map(p => ({ ...p })),\n\n        recoveryStreaks: data.recoveryStreaks || {},`,
    `        taperPlansV2: (data.taperPlansV2 || []).map(p => ({ ...p })),\n        goals: (data.goals || []).map(g => ({ ...g })),\n\n        recoveryStreaks: data.recoveryStreaks || {},`,
    'export goals');

app = replaceOnce(app,
    `    if (!Array.isArray(data.taperPlansV2)) data.taperPlansV2 = [];\n    if (!data.recoveryStreaks || typeof data.recoveryStreaks !== 'object' || Array.isArray(data.recoveryStreaks)) {\n        data.recoveryStreaks = {};\n    }`,
    `    if (!Array.isArray(data.taperPlansV2)) data.taperPlansV2 = [];\n    if (!Array.isArray(data.goals)) data.goals = [];\n    if (!data.recoveryStreaks || typeof data.recoveryStreaks !== 'object' || Array.isArray(data.recoveryStreaks)) {\n        data.recoveryStreaks = {};\n    }`,
    'import normalize goals');

app = replaceOnce(app,
    `    if (Array.isArray(imported.taperPlansV2)) {\n        merged.taperPlansV2 = mergeArrayById(merged.taperPlansV2 || [], imported.taperPlansV2);\n    }\n    merged.recoveryStreaks = { ...(merged.recoveryStreaks || {}), ...(imported.recoveryStreaks || {}) };`,
    `    if (Array.isArray(imported.taperPlansV2)) {\n        merged.taperPlansV2 = mergeArrayById(merged.taperPlansV2 || [], imported.taperPlansV2);\n    }\n    if (Array.isArray(imported.goals)) {\n        merged.goals = mergeArrayById(merged.goals || [], imported.goals);\n    }\n    merged.recoveryStreaks = { ...(merged.recoveryStreaks || {}), ...(imported.recoveryStreaks || {}) };`,
    'merge goals');

app = replaceOnce(app,
    `        plans: (data.taperPlansV2 || []).length,\n        cravings: (data.cravings || []).length\n    });`,
    `        plans: (data.taperPlansV2 || []).length,\n        cravings: (data.cravings || []).length,\n        goals: (data.goals || []).length\n    });`,
    'calendar cache goals');

app = replaceOnce(app,
    `    mapPlanGoalMilestoneEvents(bounds, data).forEach(ev => events.push(ev));\n\n    const filtered = events`,
    `    mapPlanGoalMilestoneEvents(bounds, data).forEach(ev => events.push(ev));\n    if (typeof mapGoalsToCalendarEvents === 'function') {\n        mapGoalsToCalendarEvents(bounds, data).forEach(ev => events.push(ev));\n    }\n\n    const filtered = events`,
    'calendar map goals');

app = replaceOnce(app,
    `    if (event.recordKind === 'log') {\n        editUseEntry(event.recordId);\n    } else if (event.recordKind === 'purchase') {\n        editPurchase(event.recordId);\n    } else if (event.linkedPlanId) {\n        switchTab('taper-tab');\n        openTaperPlanFromManage(event.linkedPlanId);\n    }\n}`,
    `    if (event.recordKind === 'log') {\n        editUseEntry(event.recordId);\n    } else if (event.recordKind === 'purchase') {\n        editPurchase(event.recordId);\n    } else if (event.recordKind === 'goal' || event.linkedGoalId) {\n        switchTab('goals-tab');\n        openGoalDetail(event.linkedGoalId || event.recordId);\n    } else if (event.linkedPlanId) {\n        switchTab('taper-tab');\n        openTaperPlanFromManage(event.linkedPlanId);\n    }\n}`,
    'calendarEditEvent goal');

app = replaceOnce(app,
    `function calendarOpenLinkedGoal(eventId) {\n    calendarOpenLinkedPlan(eventId);\n}`,
    `function calendarOpenLinkedGoal(eventId) {\n    const event = findCalendarEventById(eventId);\n    if (!event) return;\n    closeCalendarEventSheet();\n    if (event.linkedGoalId || event.recordKind === 'goal') {\n        switchTab('goals-tab');\n        openGoalDetail(event.linkedGoalId || event.recordId);\n        return;\n    }\n    calendarOpenLinkedPlan(eventId);\n}`,
    'calendarOpenLinkedGoal');

app = replaceOnce(app,
    `    if (event.recordKind === 'plan' && event.linkedPlanId) {\n        const plan = getTaperPlanById(event.linkedPlanId);\n        if (plan) {\n            if (event.id.startsWith('plan-end-') || event.type === 'goal_deadline') {\n                plan.endDate = dateStr;\n                if (event.type === 'goal_deadline') plan.goalDate = dateStr;\n            } else if (event.id.includes('plan-spend-')) {\n                const week = (plan.weeklyTargets || []).find(w => event.id.endsWith(String((plan.weeklyTargets || []).indexOf(w))) || w.weekEnd === event.date);\n                if (week) week.weekEnd = dateStr;\n            }\n            plan.updatedAt = new Date().toISOString();\n            saveData(appData);\n        }\n    }`,
    `    if ((event.recordKind === 'goal' || event.linkedGoalId) && typeof getGoalById === 'function') {\n        const goal = getGoalById(event.linkedGoalId || event.recordId);\n        if (goal) {\n            if (event.id.startsWith('goal-start-')) goal.startDate = dateStr;\n            else goal.endDate = dateStr;\n            goal.updatedAt = new Date().toISOString();\n            if (typeof pushGoalChange === 'function') pushGoalChange(goal, 'Moved on calendar');\n            saveData(appData);\n        }\n    } else if (event.recordKind === 'plan' && event.linkedPlanId) {\n        const plan = getTaperPlanById(event.linkedPlanId);\n        if (plan) {\n            if (event.id.startsWith('plan-end-') || (event.type === 'goal_deadline' && !event.linkedGoalId)) {\n                plan.endDate = dateStr;\n                if (event.type === 'goal_deadline') plan.goalDate = dateStr;\n            } else if (event.id.includes('plan-spend-')) {\n                const week = (plan.weeklyTargets || []).find(w => event.id.endsWith(String((plan.weeklyTargets || []).indexOf(w))) || w.weekEnd === event.date);\n                if (week) week.weekEnd = dateStr;\n            }\n            plan.updatedAt = new Date().toISOString();\n            saveData(appData);\n        }\n    }`,
    'calendar drop goal');

app = replaceOnce(app,
    `        (data.logs || []).length,\n        (data.purchases || []).length,\n        (data.taperPlansV2 || []).length\n    ].join('|');`,
    `        (data.logs || []).length,\n        (data.purchases || []).length,\n        (data.taperPlansV2 || []).length,\n        (data.goals || []).length\n    ].join('|');`,
    'dashboard cache goals');

app = replaceOnce(app,
    `    const goalStatuses = buildRecoveryGoalStatuses(bounds, data, scope);\n    const activePlans = buildRecoveryActivePlans(data, scope);`,
    `    const goalStatuses = buildRecoveryGoalStatuses(bounds, data, scope);\n    const goalsSummary = typeof buildGoalDashboardSummary === 'function'\n        ? (() => {\n            const summary = buildGoalDashboardSummary({ data });\n            const substanceFiltered = evaluateAllGoals({ data, persist: false })\n                .filter(ev => goalMatchesSubstance(ev.goal.substanceId, substanceId, data));\n            const active = substanceFiltered.filter(ev => ev.goal.status === 'active' || ev.status === 'upcoming');\n            return {\n                ...summary,\n                activeCount: active.filter(ev => ev.goal.status === 'active').length,\n                onTrack: active.filter(ev => ev.status === 'on_track').length,\n                nearLimit: active.filter(ev => ev.status === 'near_limit' || ev.status === 'at_limit').length,\n                exceeded: active.filter(ev => ev.status === 'exceeded').length,\n                recentlyCompleted: substanceFiltered\n                    .filter(ev => ev.goal.status === 'completed' || ev.status === 'completed')\n                    .slice(0, 3),\n                evaluations: active\n            };\n        })()\n        : null;\n    const activePlans = buildRecoveryActivePlans(data, scope);`,
    'dashboard goalsSummary');

app = replaceOnce(app,
    `    const dataset = {\n        prefs,\n        bounds,\n        substanceId,\n        substances,\n        isAllSubstances: isRecoveryDashboardAllSubstances(substanceId, data),`,
    `    const dataset = {\n        prefs,\n        bounds,\n        substanceId,\n        substances,\n        goalsSummary,\n        isAllSubstances: isRecoveryDashboardAllSubstances(substanceId, data),`,
    'dataset.goalsSummary');

const summaryOld = `    const upcoming = milestones[0] || null;
    return {
        totalSubstances: statusCards.length,
        substancesWithPlans: activePlans.length,
        goalsOnTrack: goalStatuses.filter(g => g.onTrack && !g.nearLimit).length,
        goalsNearLimit: goalStatuses.filter(g => g.nearLimit).length,`;

const summaryNew = `    const upcoming = milestones[0] || null;
    let goalsOnTrack = goalStatuses.filter(g => g.onTrack && !g.nearLimit).length;
    let goalsNearLimit = goalStatuses.filter(g => g.nearLimit).length;
    let activeGoalCount = null;
    let goalsExceeded = null;
    let closestGoalDeadline = null;
    let highestRiskGoal = null;
    if (typeof buildGoalDashboardSummary === 'function' && typeof evaluateAllGoals === 'function') {
        const selectedId = options.substanceId == null ? getSelectedDashboardSubstance(data) : options.substanceId;
        const evals = evaluateAllGoals({ data, persist: false })
            .filter(ev => goalMatchesSubstance(ev.goal.substanceId, selectedId, data))
            .filter(ev => ev.goal.status === 'active');
        if (evals.length) {
            activeGoalCount = evals.length;
            goalsOnTrack = evals.filter(ev => ev.status === 'on_track').length;
            goalsNearLimit = evals.filter(ev => ev.status === 'near_limit' || ev.status === 'at_limit').length;
            goalsExceeded = evals.filter(ev => ev.status === 'exceeded').length;
            const closest = evals.filter(ev => ev.goal.endDate).sort((a, b) => String(a.goal.endDate).localeCompare(String(b.goal.endDate)))[0];
            closestGoalDeadline = closest ? (closest.goal.name + ' (' + closest.goal.endDate + ')') : null;
            const risk = evals.slice().sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
            highestRiskGoal = risk ? (risk.goal.name + ' · ' + risk.statusLabel) : null;
        }
    }
    return {
        totalSubstances: statusCards.length,
        substancesWithPlans: activePlans.length,
        activeGoalCount,
        goalsOnTrack,
        goalsNearLimit,
        goalsExceeded,
        closestGoalDeadline,
        highestRiskGoal,`;

app = replaceOnce(app, summaryOld, summaryNew, 'summary goal fields');

app = replaceOnce(app,
    `    const tiles = [
        ['Substances tracked', summary.totalSubstances],
        ['Active plans', summary.substancesWithPlans],
        ['Goals on track', summary.goalsOnTrack],
        ['Goals near limit', summary.goalsNearLimit],
        ['Longest no-use streak', summary.longestNoUseLabel],
        ['Longest no-purchase streak', summary.longestNoPurchaseLabel],
        ['Upcoming milestone', summary.upcomingMilestone],
        ['Monthly spending', summary.monthlySpendCompare]
    ];`,
    `    const tiles = [
        ['Substances tracked', summary.totalSubstances],
        ['Active plans', summary.substancesWithPlans],
        ['Active goals', summary.activeGoalCount ?? '—'],
        ['Goals on track', summary.goalsOnTrack],
        ['Goals near limit', summary.goalsNearLimit],
        ['Goals exceeded', summary.goalsExceeded ?? '—'],
        ['Closest goal deadline', summary.closestGoalDeadline || '—'],
        ['Highest-risk goal', summary.highestRiskGoal || '—'],
        ['Longest no-use streak', summary.longestNoUseLabel],
        ['Longest no-purchase streak', summary.longestNoPurchaseLabel],
        ['Upcoming milestone', summary.upcomingMilestone],
        ['Monthly spending', summary.monthlySpendCompare]
    ];`,
    'summary tiles');

app = replaceOnce(app,
    `    const factors = {};
    // Goal adherence
    if (goalStatuses.length) {
        const good = goalStatuses.filter(g => g.onTrack && !g.nearLimit).length;
        const near = goalStatuses.filter(g => g.nearLimit).length;
        factors.goalAdherence = Math.round(((good + near * 0.4) / goalStatuses.length) * 100);
    } else {
        factors.goalAdherence = null;
    }`,
    `    const factors = {};
    // Goal adherence (Goal System first; plan-derived limits as fallback)
    const goalPrefs = typeof getGoalSystemPrefs === 'function' ? getGoalSystemPrefs(data) : { scoreContributionEnabled: true };
    if (goalPrefs.scoreContributionEnabled === false) {
        factors.goalAdherence = null;
    } else {
        const scoredGoals = typeof evaluateAllGoals === 'function'
            ? evaluateAllGoals({ data, persist: false })
                .filter(ev => ev.goal.status === 'active')
                .filter(ev => !['insufficient_data', 'upcoming', 'paused', 'cancelled', 'draft'].includes(ev.status))
                .filter(ev => goalMatchesSubstance(ev.goal.substanceId, dataset.substanceId, data))
            : [];
        if (scoredGoals.length) {
            const good = scoredGoals.filter(g => g.status === 'on_track' || g.status === 'completed').length;
            const near = scoredGoals.filter(g => g.status === 'near_limit' || g.status === 'at_limit').length;
            factors.goalAdherence = Math.round(((good + near * 0.4) / scoredGoals.length) * 100);
        } else if (goalStatuses.length) {
            const good = goalStatuses.filter(g => g.onTrack && !g.nearLimit).length;
            const near = goalStatuses.filter(g => g.nearLimit).length;
            factors.goalAdherence = Math.round(((good + near * 0.4) / goalStatuses.length) * 100);
        } else {
            factors.goalAdherence = null;
        }
    }`,
    'score goal adherence');

app = replaceOnce(app,
    `            'Score blends goal adherence, plan adherence, sobriety streak progress, reduction vs the prior period, spending improvement, and logging consistency.',
            'This is an optional progress indicator for your own tracking — not a medical assessment or diagnosis.'`,
    `            'Score blends goal adherence (from your Goals, excluding paused/cancelled/insufficient-data), plan adherence, sobriety streak progress, reduction vs the prior period, spending improvement, and logging consistency.',
            'Goal contribution can be disabled in Goal settings. This is an optional progress indicator — not a medical assessment or diagnosis.'`,
    'score explanation');

if (!app.includes('function renderRecoveryGoalsSection')) {
    const goalsSectionFn = [
        'function renderRecoveryGoalsSection(dataset) {',
        "    const el = document.getElementById('rd-goals-overview');",
        '    if (!el) return;',
        '    const summary = dataset.goalsSummary;',
        "    if (!summary || (typeof getGoalSystemPrefs === 'function' && !getGoalSystemPrefs().showGoalsOnDashboard)) {",
        "        el.innerHTML = '<p class=\"empty-hint\">No goal overview available.</p>';",
        '        return;',
        '    }',
        '    const recent = (summary.recentlyCompleted || [])',
        "        .map(ev => escapeHtml(ev.goal?.name || ev.name || ''))",
        '        .filter(Boolean)',
        '        .slice(0, 3);',
        '    const chips = (summary.evaluations || summary.highlights || []).slice(0, 4).map(ev => {',
        "        const id = escapeHtml(ev.goal.id);",
        "        return '<button type=\"button\" class=\"rd-goal-chip\" onclick=\"switchTab(\\x27goals-tab\\x27); openGoalDetail(\\x27' + id + '\\x27)\">' +",
        "            '<strong>' + escapeHtml(ev.goal.name) + '</strong>' +",
        "            '<span>' + escapeHtml(ev.statusLabel || ev.status) + '</span></button>';",
        '    }).join(\'\');',
        '    el.innerHTML =',
        "        '<div class=\"rd-goals-grid\">' +",
        "        '<div class=\"rd-summary-tile\"><span>Active goals</span><strong>' + (summary.activeCount ?? summary.counts?.active ?? 0) + '</strong></div>' +",
        "        '<div class=\"rd-summary-tile\"><span>On track</span><strong>' + (summary.onTrack ?? 0) + '</strong></div>' +",
        "        '<div class=\"rd-summary-tile\"><span>Near / at limit</span><strong>' + (summary.nearLimit ?? 0) + '</strong></div>' +",
        "        '<div class=\"rd-summary-tile\"><span>Exceeded</span><strong>' + (summary.exceeded ?? 0) + '</strong></div>' +",
        "        '</div><div class=\"rd-goals-list\">' +",
        "        (chips || '<p class=\"empty-hint\">No active goals for this substance filter. <button type=\"button\" class=\"secondary-btn btn-sm\" onclick=\"switchTab(\\x27goals-tab\\x27); openGoalCreateForm()\">Create goal</button></p>') +",
        "        '</div>' +",
        "        (recent.length ? '<p class=\"rd-section-hint\">Recently completed: ' + recent.join(', ') + '</p>' : '');",
        '}',
        '',
        'function renderRecoveryDashboard() {'
    ].join('\n');
    app = replaceOnce(app, 'function renderRecoveryDashboard() {', goalsSectionFn, 'renderRecoveryGoalsSection');
}

app = replaceOnce(app,
    `        renderRecoveryActivePlans(dataset.activePlans);\n        renderRecoveryInventoryOverview(dataset.inventoryGroups);`,
    `        renderRecoveryActivePlans(dataset.activePlans);\n        if (typeof renderRecoveryGoalsSection === 'function') renderRecoveryGoalsSection(dataset);\n        renderRecoveryInventoryOverview(dataset.inventoryGroups);`,
    'call renderRecoveryGoalsSection');

app = replaceOnce(app,
    `const RECOVERY_DASHBOARD_SECTION_DEFAULTS = Object.freeze({
    score: true,
    summary: true,
    today: false,
    actions: false,
    status: false,
    plans: false,
    inventory: true,
    milestones: true,
    alerts: false
});`,
    `const RECOVERY_DASHBOARD_SECTION_DEFAULTS = Object.freeze({
    score: true,
    summary: true,
    today: false,
    actions: false,
    status: false,
    plans: false,
    goals: false,
    inventory: true,
    milestones: true,
    alerts: false
});`,
    'rd section goals');

if (!app.includes('function renderGoalInsightsPanel')) {
    app = replaceOnce(app,
        `function updateStats() {`,
        `function renderGoalInsightsPanel() {
    const el = document.getElementById('goal-insights-panel');
    if (!el || typeof buildGoalInsightsAnalytics !== 'function') return;
    const analytics = buildGoalInsightsAnalytics({ data: appData });
    const best = analytics.streaks[0];
    const topCat = analytics.categories[0];
    const hardest = analytics.worstGoals[0];
    el.innerHTML =
        '<div class="goal-insights-grid">' +
        '<div><span>Goals tracked</span><strong>' + analytics.totalGoals + '</strong></div>' +
        '<div><span>Best streak</span><strong>' + (best ? best.current + ' · ' + escapeHtml(best.name) : '—') + '</strong></div>' +
        '<div><span>Top category</span><strong>' + (topCat ? escapeHtml(topCat.category) + (topCat.successRate != null ? ' · ' + topCat.successRate + '%' : '') : '—') + '</strong></div>' +
        '<div><span>Hardest goal</span><strong>' + (hardest ? escapeHtml(hardest.name) : '—') + '</strong></div>' +
        '</div>' +
        '<p class="settings-hint">Goal analytics use the same progress engine as the Goals tab. Paused and cancelled goals are excluded from Recovery Score contribution.</p>';
}

function updateStats() {
    try { renderGoalInsightsPanel(); } catch (_) { /* ignore */ }`,
        'insights panel');
}

app = replaceOnce(app,
    `        ensureCalendarViewPrefs,
        getCalendarViewPrefs,
        persistCalendarViewPrefs,
        buildCalendarEvents,`,
    `        ensureCalendarViewPrefs,
        getCalendarViewPrefs,
        persistCalendarViewPrefs,
        ensureGoals,
        ensureGoalSystemPrefs,
        getGoalSystemPrefs,
        persistGoalSystemPrefs,
        getDefaultGoalRecord,
        normalizeGoalRecord,
        validateGoalRecord,
        saveGoalRecord,
        createGoalFromTemplate,
        duplicateGoal,
        pauseGoal,
        resumeGoal,
        completeGoalManually,
        archiveGoal,
        deleteGoal,
        evaluateGoal,
        evaluateAllGoals,
        computeGoalStatusFromProgress,
        computeGoalActual,
        resolveGoalPeriodBounds,
        syncGoalPeriodHistory,
        filterAndSortGoalEvaluations,
        buildGoalDashboardSummary,
        buildGoalInsightsAnalytics,
        buildGoalReminders,
        mapGoalsToCalendarEvents,
        suggestGoalsFromPlan,
        GOAL_TYPE_META,
        GOAL_TEMPLATES,
        GOAL_LIFECYCLE,
        migrateLegacyGoals,
        buildCalendarEvents,`,
    'test exports');

fs.writeFileSync(path.join(root, 'app.js'), app);
console.log('Patched app.js lines:', app.split('\n').length);
