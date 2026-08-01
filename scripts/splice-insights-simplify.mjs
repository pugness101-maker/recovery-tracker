#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const simplifyMod = fs.readFileSync(path.join(root, 'insights-simplify.module.js'), 'utf8');
const navMod = fs.readFileSync(path.join(root, 'nav-combine.module.js'), 'utf8');

function replaceBetween(src, startMarker, endMarker, replacement, label) {
    const start = src.indexOf(startMarker);
    if (start < 0) throw new Error(`Missing start: ${label}`);
    const end = src.indexOf(endMarker, start + startMarker.length);
    if (end < 0) throw new Error(`Missing end: ${label}`);
    return src.slice(0, start) + replacement + '\n\n' + src.slice(end);
}

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    return src.replace(find, repl);
}

function replaceAll(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip all:', label);
        return src;
    }
    return src.split(find).join(repl);
}

// Refresh nav-combine block in app.js
if (app.includes('// ——— Combined navigation: Goals & Plans + Insights & Calendar ———')) {
    // Find end: next major module after nav-combine is Purchase Analytics
    const start = app.indexOf('// ——— Combined navigation: Goals & Plans + Insights & Calendar ———');
    const endCandidates = ['// ——— Purchase Analytics ———', '// ——— Friends & Contacts ———'];
    let end = -1;
    for (const m of endCandidates) {
        const i = app.indexOf(m, start + 20);
        if (i > start && (end < 0 || i < end)) end = i;
    }
    if (end < 0) throw new Error('Could not find end of nav-combine block');
    app = app.slice(0, start) + navMod + '\n\n' + app.slice(end);
    console.log('Replaced nav-combine module');
}

// Insert or refresh insights-simplify before defaultData (after running totals or insights filters)
if (app.includes('// ——— Insights & Calendar UI simplification ———')) {
    app = replaceBetween(
        app,
        '// ——— Insights & Calendar UI simplification ———',
        'const defaultData = {',
        simplifyMod,
        'insights-simplify refresh'
    );
    console.log('Refreshed insights-simplify module');
} else {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData missing');
    app = app.slice(0, idx) + simplifyMod + '\n\n' + app.slice(idx);
    console.log('Inserted insights-simplify module');
}

// ensureInsightsLayoutPrefs + init in settings
app = tryReplace(app,
    `    ensureInsightsFilters(data);
    loadInsightsFiltersIntoState(data);
    ensureTableColumnSettings(data);`,
    `    ensureInsightsFilters(data);
    loadInsightsFiltersIntoState(data);
    ensureInsightsLayoutPrefs(data);
    applyInsightsSimplifyNavMigration(data);
    ensureTableColumnSettings(data);`,
    'ensure insights layout prefs');

// Hook init after globals / with initializeApp - add near loadInsightsFiltersIntoState post-global
app = tryReplace(app,
    `// Apply persisted shared Insights filters after globals exist
if (typeof loadInsightsFiltersIntoState === 'function') {
    loadInsightsFiltersIntoState(appData);
}`,
    `// Apply persisted shared Insights filters after globals exist
if (typeof loadInsightsFiltersIntoState === 'function') {
    loadInsightsFiltersIntoState(appData);
}
if (typeof initInsightsSimplify === 'function') {
    try { initInsightsSimplify(); } catch (_) { /* DOM may be absent in tests */ }
}`,
    'init insights simplify');

// DEFAULT_COLLAPSED_SECTIONS updates for Insights
app = tryReplace(app,
    `    statsDateRange: false,
    statsComparePeriods: false,
    statsSummaryDashboard: false,
    statsCalendarView: false,
    statsMonthlySummary: false,
    statsWeeklySummary: true,
    statsRunningTotals: false,
    statsBuyAnalytics: true,
    statsBuyPurchaseDetails: true,
    statsBuyStoreBreakdown: true,
    statsBuyAdvanced: true,
    statsGiftAnalytics: true,
    statsFinancialAnalytics: true,
    statsPlanAnalytics: false,
    statsCustomMetrics: false,
    statsPurchaseAnalytics: false,
    purchaseAnalyticsFilters: false,
    statsChartDashboard: false,
    chartFilters: false,
    chartBuilder: true,`,
    `    statsDateRange: false,
    statsComparePeriods: true,
    statsSummaryDashboard: false,
    statsCalendarView: false,
    statsMonthlySummary: true,
    statsWeeklySummary: true,
    statsRunningTotals: true,
    statsBuyAnalytics: true,
    statsBuyPurchaseDetails: true,
    statsBuyStoreBreakdown: true,
    statsBuyAdvanced: true,
    statsGiftAnalytics: true,
    statsFinancialAnalytics: false,
    statsPlanAnalytics: true,
    statsCustomMetrics: true,
    statsPurchaseAnalytics: false,
    purchaseAnalyticsFilters: true,
    statsChartDashboard: false,
    chartFilters: true,
    chartBuilder: true,
    statsMoreMetrics: true,`,
    'collapsed defaults');

app = tryReplace(app,
    `    statsContactAnalytics: true,`,
    `    statsContactAnalytics: true,
    statsGoalAnalytics: true,`,
    'contact/goal collapsed');

// Avoid duplicate statsGoalAnalytics if already at end
// Test exports
app = tryReplace(app,
    `        ensureInsightsFilters,
        getInsightsFilters,`,
    `        ensureInsightsLayoutPrefs,
        getInsightsLayoutPrefs,
        persistInsightsLayoutPrefs,
        normalizeInsightsSimplifyView,
        applyInsightsSimplifyNavMigration,
        initInsightsSimplify,
        expandAllInsightsSections,
        collapseAllInsightsSections,
        resetInsightsLayout,
        isInsightsSimpleMode,
        INSIGHTS_SIMPLIFY_PRIMARY_VIEWS,
        ensureInsightsFilters,
        getInsightsFilters,`,
    'simplify test exports');

// ——— HTML: subnav ———
html = tryReplace(html,
    `                    <select id="ic-subnav-select" class="combined-subnav-select" aria-label="Insights and Calendar view" onchange="setInsightsCalendarView(this.value)">
                        <option value="overview">Overview</option>
                        <option value="calendar">Calendar</option>
                        <option value="trends">Trends</option>
                        <option value="comparisons">Compare</option>
                        <option value="financial">Financial</option>
                        <option value="use">Use Analytics</option>
                        <option value="purchase">Purchase Analytics</option>
                        <option value="goal-analytics">Goal Analytics</option>
                        <option value="plan-analytics">Plan Analytics</option>
                        <option value="charts">Charts</option>
                        <option value="custom">Custom Metrics</option>
                    </select>
                    <nav class="combined-subnav" id="ic-subnav" aria-label="Insights and Calendar sections" role="tablist">
                        <button type="button" class="combined-subnav-btn active" data-ic-view="overview" onclick="setInsightsCalendarView('overview')">Overview</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="calendar" onclick="setInsightsCalendarView('calendar')">Calendar</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="trends" onclick="setInsightsCalendarView('trends')">Trends</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="comparisons" onclick="setInsightsCalendarView('comparisons')">Compare</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="financial" onclick="setInsightsCalendarView('financial')">Financial</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="use" onclick="setInsightsCalendarView('use')">Use</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="purchase" onclick="setInsightsCalendarView('purchase')">Purchases</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="goal-analytics" onclick="setInsightsCalendarView('goal-analytics')">Goals</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="plan-analytics" onclick="setInsightsCalendarView('plan-analytics')">Plans</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="charts" onclick="setInsightsCalendarView('charts')">Charts</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="custom" onclick="setInsightsCalendarView('custom')">Custom</button>
                    </nav>`,
    `                    <select id="ic-subnav-select" class="combined-subnav-select" aria-label="Insights and Calendar view" onchange="setInsightsCalendarView(this.value)">
                        <option value="overview">Overview</option>
                        <option value="calendar">Calendar</option>
                        <option value="use">Use</option>
                        <option value="money">Money</option>
                        <option value="more">More</option>
                    </select>
                    <nav class="combined-subnav" id="ic-subnav" aria-label="Insights and Calendar sections" role="tablist">
                        <button type="button" class="combined-subnav-btn active" data-ic-view="overview" onclick="setInsightsCalendarView('overview')">Overview</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="calendar" onclick="setInsightsCalendarView('calendar')">Calendar</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="use" onclick="setInsightsCalendarView('use')">Use</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="money" onclick="setInsightsCalendarView('money')">Money</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="more" onclick="setInsightsCalendarView('more')">More</button>
                    </nav>`,
    'subnav 5 tabs');

// stats-tab views
html = tryReplace(html,
    `data-ic-view="trends comparisons financial use purchase goal-analytics plan-analytics charts custom"`,
    `data-ic-view="overview use money more"`,
    'stats-tab data-ic-view');

// Remap data-ic-panels on sections
const panelMap = [
    ['data-ic-panels="trends comparisons financial use purchase goal-analytics plan-analytics charts custom overview"', 'data-ic-panels="overview use money more"'],
    ['data-ic-panels="goal-analytics overview"', 'data-ic-panels="overview more"'],
    ['data-ic-panels="comparisons"', 'data-ic-panels="more"'],
    ['data-ic-panels="trends use overview"', 'data-ic-panels="overview use"'],
    ['data-ic-panels="trends overview"', 'data-ic-panels="overview use"'],
    ['data-ic-panels="trends use"', 'data-ic-panels="use"'],
    ['data-ic-panels="use"', 'data-ic-panels="use"'], // running totals stays use
    ['data-ic-panels="overview financial purchase use"', 'data-ic-panels="more money"'],
    ['data-ic-panels="charts overview"', 'data-ic-panels="overview use more"'],
    ['data-ic-panels="purchase overview"', 'data-ic-panels="money overview"'],
    ['data-ic-panels="financial overview"', 'data-ic-panels="money overview"'],
    ['data-ic-panels="purchase use"', 'data-ic-panels="money use"'],
    ['data-ic-panels="plan-analytics overview"', 'data-ic-panels="more overview"'],
    ['data-ic-panels="custom"', 'data-ic-panels="more"']
];
for (const [from, to] of panelMap) {
    html = tryReplace(html, from, to, `panels ${from.slice(0, 40)}`);
}

// Mark advanced sections
html = tryReplace(html,
    `data-section="statsRunningTotals" data-ic-panels="use"`,
    `data-section="statsRunningTotals" data-ic-panels="use" data-ic-advanced="true"`,
    'running totals advanced');
html = tryReplace(html,
    `data-section="statsMonthlySummary" data-ic-panels="use"`,
    `data-section="statsMonthlySummary" data-ic-panels="use" data-ic-advanced="true"`,
    'monthly advanced');
html = tryReplace(html,
    `data-section="statsWeeklySummary" data-ic-panels="use"`,
    `data-section="statsWeeklySummary" data-ic-panels="use" data-ic-advanced="true"`,
    'weekly advanced');
html = tryReplace(html,
    `data-section="statsCustomMetrics" data-ic-panels="more"`,
    `data-section="statsCustomMetrics" data-ic-panels="more" data-ic-advanced="true"`,
    'custom advanced');
html = tryReplace(html,
    `data-section="statsContactAnalytics"`,
    `data-section="statsContactAnalytics" data-ic-advanced="true"`,
    'contacts advanced attr');

// Insert More metrics section after summary dashboard
if (!html.includes('data-section="statsMoreMetrics"')) {
    html = tryReplace(html,
        `                <div class="collapsible-section" data-section="statsSummaryDashboard" data-ic-panels="overview use">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsSummaryDashboard')">
                        <span>Summary Dashboard</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="stats-summary-dashboard" class="sheet-summary-grid"></div>
                    </div>
                </div>`,
        `                <div class="collapsible-section" data-section="statsSummaryDashboard" data-ic-panels="overview use">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsSummaryDashboard')">
                        <span>Summary</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="stats-summary-dashboard" class="sheet-summary-grid ic-primary-summary"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsMoreMetrics" data-ic-panels="overview use" data-ic-advanced="true">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsMoreMetrics')">
                        <span>More metrics</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="stats-more-metrics-body" class="stats-more-metrics-body"></div>
                    </div>
                </div>`,
        'more metrics section');
}

// Rename Running Totals label hint for Advanced details
html = tryReplace(html,
    `<span>Running Totals</span>`,
    `<span>Running Totals <em class="ic-advanced-tag">(Advanced)</em></span>`,
    'running totals label');

// Rename chart dashboard for Use vs More context - keep Charts title but add hint
html = tryReplace(html,
    `                    <button type="button" class="section-toggle" onclick="toggleSection('statsChartDashboard')">
                        <span>Charts</span>`,
    `                    <button type="button" class="section-toggle" onclick="toggleSection('statsChartDashboard')">
                        <span>Charts &amp; Trends</span>`,
    'charts title');

if (!css.includes('.ic-layout-toolbar')) {
    css += `

/* Insights simplification */
.ic-layout-toolbar {
    margin: 8px 0 14px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--bg, #fff) 92%, var(--accent, #4a7c59) 8%);
}
.ic-layout-toolbar-row {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
}
.ic-view-mode-label {
    display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; min-width: 140px;
}
.ic-view-mode-label select {
    min-height: 40px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--bg, #fff); color: var(--text);
}
.ic-layout-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ic-layout-hint { margin: 8px 0 0; }
.ic-advanced-tag { font-style: normal; font-size: 0.78em; color: var(--text-secondary); font-weight: 500; }
.ic-simple-hidden { display: none !important; }
.ic-primary-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
}
.insights-compact-rows .sheet-table td,
.insights-compact-rows .sheet-table th {
    padding-top: 6px; padding-bottom: 6px; font-size: 0.9rem;
}
.insights-calendar-page .sheet-table-wrap,
.insights-calendar-page .table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
.insights-calendar-page .sheet-table thead th {
    position: sticky; top: 0; z-index: 1;
    background: var(--bg, #fff);
}
.insights-simple-mode .ch-widget-grid > :nth-child(n+3) { display: none; }
.ic-simplified-overview .combined-overview-actions { display: flex; flex-wrap: wrap; gap: 8px; }

@media (max-width: 720px) {
    .ic-layout-toolbar-row { flex-direction: column; align-items: stretch; }
    .ic-primary-summary { grid-template-columns: 1fr; }
    .insights-simple-mode .ch-widget-grid > :nth-child(n+2) { display: none; }
    .combined-overview-grid { grid-template-columns: 1fr; }
    .ic-layout-actions { width: 100%; }
    .ic-layout-actions .secondary-btn { flex: 1; }
}
`;
    console.log('Appended insights simplify CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-insights-simplify complete');
