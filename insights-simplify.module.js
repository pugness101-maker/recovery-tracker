// ——— Insights & Calendar UI simplification ———
// Reorganizes views into Overview / Calendar / Use / Money / More.
// Adds Simple/Advanced mode and section expand/collapse controls.
// Does not remove features or data — only reorganizes the interface.

const INSIGHTS_SIMPLIFY_PRIMARY_VIEWS = Object.freeze([
    'overview', 'calendar', 'use', 'money', 'more'
]);

const INSIGHTS_LEGACY_VIEW_MAP = Object.freeze({
    trends: 'use',
    comparisons: 'more',
    compare: 'more',
    comparison: 'more',
    financial: 'money',
    finances: 'money',
    purchase: 'money',
    'purchase-analytics': 'money',
    'use-analytics': 'use',
    'goal-analytics': 'more',
    'plan-analytics': 'more',
    charts: 'use',
    custom: 'more',
    'custom-metrics': 'more'
});

const INSIGHTS_SIMPLE_HIDDEN_SECTIONS = Object.freeze([
    'statsMonthlySummary',
    'statsWeeklySummary',
    'statsRunningTotals',
    'statsContactAnalytics',
    'statsCustomMetrics',
    'statsBuyPurchaseDetails',
    'statsBuyStoreBreakdown',
    'statsBuyAdvanced',
    'statsGiftAnalytics',
    'chartBuilder',
    'chartFilters',
    'statsMoreMetrics',
    'statsPlanAnalytics',
    'purchaseAnalyticsFilters'
]);

function getDefaultInsightsLayoutPrefs() {
    return {
        viewMode: 'simple', // simple | advanced
        compactRows: true
    };
}

function ensureInsightsLayoutPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultInsightsLayoutPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultInsightsLayoutPrefs();
    if (!data.settings.insightsLayout || typeof data.settings.insightsLayout !== 'object') {
        data.settings.insightsLayout = { ...defaults };
    }
    const prefs = data.settings.insightsLayout;
    if (prefs.viewMode !== 'simple' && prefs.viewMode !== 'advanced') prefs.viewMode = 'simple';
    if (prefs.compactRows === undefined) prefs.compactRows = true;
    return prefs;
}

function getInsightsLayoutPrefs(data = appData) {
    return ensureInsightsLayoutPrefs(data);
}

function persistInsightsLayoutPrefs(patch = {}, data = appData) {
    const prefs = ensureInsightsLayoutPrefs(data);
    Object.assign(prefs, patch || {});
    if (typeof saveData === 'function') saveData(data);
    applyInsightsLayoutMode();
    return prefs;
}

function normalizeInsightsSimplifyView(view) {
    const raw = String(view || '').trim().toLowerCase();
    const mapped = INSIGHTS_LEGACY_VIEW_MAP[raw] || raw;
    return INSIGHTS_SIMPLIFY_PRIMARY_VIEWS.includes(mapped) ? mapped : 'overview';
}

/** Migrate persisted nav prefs + mutate allowed views list in place. */
function applyInsightsSimplifyNavMigration(data = appData) {
    try {
        if (typeof INSIGHTS_CALENDAR_VIEWS !== 'undefined' && Array.isArray(INSIGHTS_CALENDAR_VIEWS)) {
            const next = INSIGHTS_SIMPLIFY_PRIMARY_VIEWS.slice();
            if (INSIGHTS_CALENDAR_VIEWS.join('|') !== next.join('|')) {
                INSIGHTS_CALENDAR_VIEWS.splice(0, INSIGHTS_CALENDAR_VIEWS.length, ...next);
            }
        }
    } catch (_) { /* ignore */ }

    if (!data?.settings) return;
    const prefs = typeof ensureCombinedNavPrefs === 'function'
        ? ensureCombinedNavPrefs(data)
        : data.settings.combinedNav;
    if (prefs && prefs.insightsCalendarView) {
        prefs.insightsCalendarView = normalizeInsightsSimplifyView(prefs.insightsCalendarView);
    }
    ensureInsightsLayoutPrefs(data);
}

function isInsightsSimpleMode(data = appData) {
    return getInsightsLayoutPrefs(data).viewMode !== 'advanced';
}

function applyInsightsLayoutMode(data = appData) {
    const prefs = ensureInsightsLayoutPrefs(data);
    const root = typeof document !== 'undefined'
        ? document.getElementById('insights-calendar-tab')
        : null;
    if (!root) return;
    root.classList.toggle('insights-simple-mode', prefs.viewMode === 'simple');
    root.classList.toggle('insights-advanced-mode', prefs.viewMode === 'advanced');
    root.classList.toggle('insights-compact-rows', !!prefs.compactRows);

    const modeSelect = document.getElementById('ic-view-mode');
    if (modeSelect) modeSelect.value = prefs.viewMode;

    // Hide advanced-only sections in Simple mode (still in DOM / preserved)
    root.querySelectorAll('[data-ic-advanced="true"], .collapsible-section').forEach(section => {
        const key = section.dataset?.section || '';
        const markedAdvanced = section.getAttribute('data-ic-advanced') === 'true'
            || INSIGHTS_SIMPLE_HIDDEN_SECTIONS.includes(key);
        if (!markedAdvanced) return;
        const hide = prefs.viewMode === 'simple';
        section.classList.toggle('ic-simple-hidden', hide);
        if (hide) {
            // Don't permanently set hidden attribute used by panel filter — use class only
        }
    });
}

function onInsightsViewModeChange() {
    const value = typeof document !== 'undefined'
        ? (document.getElementById('ic-view-mode')?.value || 'simple')
        : 'simple';
    persistInsightsLayoutPrefs({ viewMode: value === 'advanced' ? 'advanced' : 'simple' });
    if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
    if (typeof updateStats === 'function') updateStats();
}

function expandAllInsightsSections() {
    ensureCollapsedSections(appData);
    const page = document.getElementById('insights-calendar-tab');
    if (!page) return;
    page.querySelectorAll('.collapsible-section[data-section]').forEach(section => {
        if (section.classList.contains('ic-section-hidden') || section.classList.contains('ic-simple-hidden')) return;
        const key = section.dataset.section;
        if (!key) return;
        appData.settings.collapsedSections[key] = false;
    });
    if (typeof saveData === 'function') saveData(appData);
    applyCollapsedSections();
}

function collapseAllInsightsSections() {
    ensureCollapsedSections(appData);
    const page = document.getElementById('insights-calendar-tab');
    if (!page) return;
    page.querySelectorAll('.collapsible-section[data-section]').forEach(section => {
        if (section.classList.contains('ic-section-hidden')) return;
        const key = section.dataset.section;
        if (!key || key === 'statsDateRange') return; // keep shared filter bar open
        appData.settings.collapsedSections[key] = true;
    });
    if (typeof saveData === 'function') saveData(appData);
    applyCollapsedSections();
}

function resetInsightsLayout() {
    ensureCollapsedSections(appData);
    // Restore defaults for Insights-related section keys only
    const defaults = typeof DEFAULT_COLLAPSED_SECTIONS === 'object' ? DEFAULT_COLLAPSED_SECTIONS : {};
    Object.keys(defaults).forEach(key => {
        if (key.startsWith('stats') || key.startsWith('chart') || key.startsWith('calendar') || key.startsWith('purchase')) {
            appData.settings.collapsedSections[key] = defaults[key];
        }
    });
    persistInsightsLayoutPrefs({ viewMode: 'simple', compactRows: true });
    if (typeof saveData === 'function') saveData(appData);
    applyInsightsLayoutMode();
    applyCollapsedSections();
    if (typeof syncInsightsFilterUi === 'function') syncInsightsFilterUi(appData);
}

function renderInsightsSectionToolbarHtml() {
    const prefs = getInsightsLayoutPrefs();
    return `
        <div class="ic-layout-toolbar" id="ic-layout-toolbar">
            <div class="ic-layout-toolbar-row">
                <label class="ic-view-mode-label">View Mode
                    <select id="ic-view-mode" aria-label="Insights view mode" onchange="onInsightsViewModeChange()">
                        <option value="simple"${prefs.viewMode === 'simple' ? ' selected' : ''}>Simple</option>
                        <option value="advanced"${prefs.viewMode === 'advanced' ? ' selected' : ''}>Advanced</option>
                    </select>
                </label>
                <div class="ic-layout-actions">
                    <button type="button" class="secondary-btn btn-sm" onclick="expandAllInsightsSections()">Expand all</button>
                    <button type="button" class="secondary-btn btn-sm" onclick="collapseAllInsightsSections()">Collapse all</button>
                    <button type="button" class="secondary-btn btn-sm" onclick="resetInsightsLayout()">Reset layout</button>
                </div>
            </div>
            <p class="settings-hint ic-layout-hint">Simple mode shows summary cards, key charts, and alerts. Advanced unlocks Running Totals, detailed tables, custom metrics, and exports.</p>
        </div>`;
}

function ensureInsightsSectionToolbarMounted() {
    if (typeof document === 'undefined') return;
    const wrap = document.querySelector('#insights-calendar-tab .combined-subnav-wrap');
    if (!wrap) return;
    let bar = document.getElementById('ic-layout-toolbar');
    if (!bar) {
        wrap.insertAdjacentHTML('afterend', renderInsightsSectionToolbarHtml());
    } else {
        // Refresh selected mode
        const sel = document.getElementById('ic-view-mode');
        if (sel) sel.value = getInsightsLayoutPrefs().viewMode;
    }
}

/**
 * Compact primary summary: Today, This week, This month, Range total, Spending, Use days.
 * Secondary metrics go into #stats-more-metrics-body when present.
 */
function renderCompactInsightsSummaryCards(substanceId, useStats, bounds, unit, cur) {
    const container = document.getElementById('stats-summary-dashboard');
    if (!container) return false;
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : '';
    const weekStart = typeof getWeekStartDateStr === 'function' ? getWeekStartDateStr(today) : today;
    const monthStart = String(today || '').slice(0, 7) + '-01';
    const isVape = typeof isVapeNicotineSubstanceId === 'function' && isVapeNicotineSubstanceId(substanceId);
    const displayUnit = typeof getStatsDisplayUnit === 'function'
        ? getStatsDisplayUnit(substanceId, unit)
        : (unit || '');
    const weekUsed = isVape
        ? (typeof getStatsUsageInRange === 'function' ? getStatsUsageInRange(substanceId, weekStart, today) : 0)
        : (typeof getWeeklyUsed === 'function' ? getWeeklyUsed(substanceId, today) : 0);
    const monthUsed = typeof getStatsUsageInRange === 'function'
        ? getStatsUsageInRange(substanceId, monthStart, today)
        : (useStats?.totalAmount ?? 0);
    const todayUsed = isVape
        ? (typeof getStatsUsageOnDate === 'function' ? getStatsUsageOnDate(substanceId, today) : 0)
        : (typeof getTodayUseStats === 'function' ? getTodayUseStats(substanceId).totalAmount : 0);
    const weekGoal = typeof getWeeklyLimit === 'function' ? getWeeklyLimit(substanceId, weekStart) : null;
    const weeklyBadge = typeof getUsageVsTargetBadge === 'function'
        ? getUsageVsTargetBadge(weekUsed, weekGoal)
        : null;

    let spend = useStats?.totalSpend ?? useStats?.spendTotal ?? useStats?.totalCost ?? null;
    try {
        if (spend == null && typeof buildInsightsDataset === 'function') {
            const ds = buildInsightsDataset(substanceId);
            const purchases = ds?.purchases || [];
            spend = purchases.reduce((s, p) => s + (parseFloat(p.totalCost) || 0), 0);
        }
    } catch (_) { /* optional */ }

    const fmtAmt = (n) => (typeof formatAmount === 'function' ? formatAmount(n) : String(n ?? 0));
    const fmtPuffs = (n) => (typeof formatStatsPuffs === 'function' ? formatStatsPuffs(n) : fmtAmt(n));
    const money = (n) => {
        if (n == null || !Number.isFinite(n)) return '—';
        const sym = cur || (typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$');
        return `${sym}${fmtAmt(n)}`;
    };
    const card = typeof renderSheetMetricCard === 'function'
        ? renderSheetMetricCard
        : (label, value) => `<div class="sheet-metric-card"><span>${label}</span><strong>${value}</strong></div>`;

    const primary = isVape
        ? [
            card('Today', `${fmtPuffs(todayUsed)} puffs`, null),
            card('This week', `${fmtPuffs(weekUsed)} puffs`, weeklyBadge),
            card('This month', `${fmtPuffs(monthUsed)} puffs`, null),
            card('Range total', `${fmtPuffs(useStats?.totalAmount || 0)} puffs`, null),
            card('Spending', money(spend), null),
            card('Use days', String(useStats?.useDays ?? 0), null)
        ]
        : [
            card('Today', `${fmtAmt(todayUsed)} ${displayUnit}`, null),
            card('This week', `${fmtAmt(weekUsed)} ${displayUnit}`, weeklyBadge),
            card('This month', `${fmtAmt(monthUsed)} ${displayUnit}`, null),
            card('Range total', `${fmtAmt(useStats?.totalAmount || 0)} ${displayUnit}`, null),
            card('Spending', money(spend), null),
            card('Use days', String(useStats?.useDays ?? 0), null)
        ];

    container.innerHTML = primary.join('');
    container.classList.add('ic-primary-summary');

    const more = document.getElementById('stats-more-metrics-body');
    if (more) {
        const remaining = typeof getTotalRemainingSupply === 'function'
            ? getTotalRemainingSupply(substanceId)
            : null;
        const entriesLabel = (typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(substanceId))
            ? 'Entries'
            : 'Sessions';
        const secondary = isVape
            ? [
                card('Weekly goal', weekGoal != null ? `${fmtPuffs(weekGoal)} puffs` : '—', weeklyBadge),
                card('Vape count', String(useStats?.vapeCount ?? 0), null),
                card('Avg cost/vape', typeof formatCostPerVape === 'function'
                    ? formatCostPerVape(useStats?.avgCostPerVape, cur)
                    : '—', null),
                card('Remaining puffs', remaining != null ? `${fmtPuffs(remaining)} puffs` : '—', null),
                card('Range', `${bounds?.startDate || '…'} – ${bounds?.endDate || '…'}`, null)
            ]
            : [
                card('Weekly goal', weekGoal != null ? `${fmtAmt(weekGoal)} ${displayUnit}` : '—', weeklyBadge),
                card(entriesLabel, String(useStats?.sessionCount ?? 0), null),
                card('Use day %', `${fmtAmt(useStats?.useDayPct ?? 0, 1)}%`, null),
                card('Remaining supply', remaining != null ? `${fmtAmt(remaining)} ${displayUnit}` : '—', null),
                card('Range', `${bounds?.startDate || '…'} – ${bounds?.endDate || '…'}`, null)
            ];
        more.innerHTML = `<div class="sheet-summary-grid">${secondary.join('')}</div>`;
    }
    return true;
}

function patchInsightsSimplifySummaryDashboard() {
    if (typeof renderStatsSummaryDashboard !== 'function') return;
    if (renderStatsSummaryDashboard.__insightsSimplifyPatched) return;
    const original = renderStatsSummaryDashboard;
    function wrapped(substanceId, useStats, bounds, unit, cur) {
        try {
            if (renderCompactInsightsSummaryCards(substanceId, useStats, bounds, unit, cur)) {
                return;
            }
        } catch (err) {
            console.warn('[insights-simplify] compact cards failed', err);
        }
        return original(substanceId, useStats, bounds, unit, cur);
    }
    wrapped.__insightsSimplifyPatched = true;
    wrapped.__original = original;
    renderStatsSummaryDashboard = wrapped;
}

function patchInsightsSimplifySectionFilter() {
    if (typeof applyInsightsCalendarSectionFilter !== 'function') return;
    if (applyInsightsCalendarSectionFilter.__insightsSimplifyPatched) return;
    const original = applyInsightsCalendarSectionFilter;
    function wrapped(view) {
        const normalized = normalizeInsightsSimplifyView(view);
        const stats = typeof document !== 'undefined' ? document.getElementById('stats-tab') : null;
        if (!stats) return original(view);

        if (normalized === 'calendar') {
            stats.hidden = true;
            applyInsightsLayoutMode();
            return;
        }

        stats.hidden = false;
        stats.classList.add('active');
        stats.querySelectorAll('.collapsible-section[data-ic-panels]').forEach(section => {
            const panels = String(section.getAttribute('data-ic-panels') || '').split(/\s+/).filter(Boolean);
            // Support legacy panel tags by mapping them
            const match = panels.some(p => normalizeInsightsSimplifyView(p) === normalized || p === normalized);
            section.classList.toggle('ic-section-hidden', !match);
            section.hidden = !match;
        });
        applyInsightsLayoutMode();
    }
    wrapped.__insightsSimplifyPatched = true;
    applyInsightsCalendarSectionFilter = wrapped;
}

function patchInsightsSimplifySetView() {
    if (typeof setInsightsCalendarView !== 'function') return;
    if (setInsightsCalendarView.__insightsSimplifyPatched) return;
    const original = setInsightsCalendarView;
    function wrapped(view, options = {}) {
        const normalized = normalizeInsightsSimplifyView(view);
        ensureInsightsSectionToolbarMounted();
        applyInsightsSimplifyNavMigration(appData);

        // Delegate to original with normalized view (allowed list already migrated)
        const result = original.call(this, normalized, options);

        // Extra renders for consolidated views
        if (normalized === 'overview') {
            const root = document.getElementById('ic-overview-root');
            if (root) root.innerHTML = renderSimplifiedInsightsOverviewHtml();
            if (typeof updateStats === 'function') updateStats();
        } else if (normalized === 'money') {
            if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
            if (typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();
        } else if (normalized === 'more') {
            if (typeof renderGoalInsightsPanel === 'function') renderGoalInsightsPanel();
            if (typeof renderPlanAnalyticsPanel === 'function') renderPlanAnalyticsPanel();
            if (typeof renderInsightsContactAnalytics === 'function') renderInsightsContactAnalytics();
            if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
        } else if (normalized === 'use') {
            if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
            if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView();
        }

        applyInsightsLayoutMode();
        if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
        return result;
    }
    wrapped.__insightsSimplifyPatched = true;
    setInsightsCalendarView = wrapped;
}

function renderSimplifiedInsightsOverviewHtml() {
    let overview = null;
    try {
        overview = typeof buildInsightsCalendarOverview === 'function'
            ? buildInsightsCalendarOverview()
            : null;
    } catch (_) { overview = null; }
    const warnings = overview?.warnings?.length
        ? `<ul class="combined-mini-list">${overview.warnings.map(w =>
            `<li>${typeof escapeHtml === 'function' ? escapeHtml(w.message || w.title || 'Data warning') : (w.message || 'Data warning')}</li>`
        ).join('')}</ul>`
        : '<p class="settings-hint">No alerts right now.</p>';
    const range = overview?.rangeLabel || 'Selected range';
    return `
        <div class="combined-overview ic-simplified-overview">
            <p class="settings-hint">Showing Overview for <strong>${typeof escapeHtml === 'function' ? escapeHtml(range) : range}</strong>. Use the shared filters below for substance, product type, and dates.</p>
            <div class="combined-overview-columns">
                <section class="combined-overview-block">
                    <h3>Alerts</h3>
                    ${warnings}
                </section>
                <section class="combined-overview-block">
                    <h3>Quick links</h3>
                    <div class="combined-overview-actions">
                        <button type="button" class="secondary-btn btn-sm" onclick="setInsightsCalendarView('use')">Use</button>
                        <button type="button" class="secondary-btn btn-sm" onclick="setInsightsCalendarView('money')">Money</button>
                        <button type="button" class="secondary-btn btn-sm" onclick="setInsightsCalendarView('calendar')">Calendar</button>
                        <button type="button" class="secondary-btn btn-sm" onclick="setInsightsCalendarView('more')">More</button>
                    </div>
                </section>
            </div>
            <p class="settings-hint">Summary cards, trend charts, and calendar preview appear in the Insights sections below.</p>
        </div>`;
}

function initInsightsSimplify() {
    applyInsightsSimplifyNavMigration(appData);
    patchInsightsSimplifySectionFilter();
    patchInsightsSimplifySetView();
    patchInsightsSimplifySummaryDashboard();
    ensureInsightsSectionToolbarMounted();
    applyInsightsLayoutMode();
}

// Auto-init after DOM if available; also called from ensureAppDataSettings / initializeApp hooks
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try { initInsightsSimplify(); } catch (err) { console.error('[insights-simplify] init failed', err); }
        });
    } else {
        try { initInsightsSimplify(); } catch (_) { /* ignore early */ }
    }
}
