#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'chart-system.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let navMod = fs.readFileSync(path.join(root, 'nav-combine.module.js'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing: ${label}\n${find.slice(0, 200)}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Chart System ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced chart-system module');
} else {
    console.log('Chart system already in app.js');
}

// ensure prefs on load
if (!app.includes('ensureChartSystemPrefs(data);\n    ensureTableColumnSettings')) {
    try {
        app = replaceOnce(app,
            '    ensureContactsMigrated(data);\n    ensureContactsPrefs(data);\n    ensureTableColumnSettings(data);',
            '    ensureContactsMigrated(data);\n    ensureContactsPrefs(data);\n    ensureChartSystemPrefs(data);\n    ensureTableColumnSettings(data);',
            'ensure chart prefs');
        console.log('Hooked ensureChartSystemPrefs');
    } catch (e) {
        console.warn(e.message);
    }
}

if (!app.includes('statsChartDashboard:')) {
    try {
        app = replaceOnce(app,
            '    purchaseAnalyticsFilters: false,\n    taperPlanHeader: false,',
            '    purchaseAnalyticsFilters: false,\n    statsChartDashboard: false,\n    chartFilters: false,\n    chartBuilder: true,\n    taperPlanHeader: false,',
            'collapsed chart sections');
    } catch (e) {
        console.warn(e.message);
    }
}

// Add charts to INSIGHTS views in app.js (spliced nav-combine copy)
if (app.includes("const INSIGHTS_CALENDAR_VIEWS = [") && !app.includes("'charts'")) {
    app = app.replace(
        `const INSIGHTS_CALENDAR_VIEWS = [
    'overview',
    'calendar',
    'trends',
    'comparisons',
    'financial',
    'use',
    'purchase',
    'goal-analytics',
    'plan-analytics',
    'custom'
];`,
        `const INSIGHTS_CALENDAR_VIEWS = [
    'overview',
    'calendar',
    'trends',
    'comparisons',
    'financial',
    'use',
    'purchase',
    'goal-analytics',
    'plan-analytics',
    'charts',
    'custom'
];`
    );
    console.log('Added charts to INSIGHTS_CALENDAR_VIEWS in app.js');
}

if (!app.includes("charts: 'charts'") && app.includes("normalizeCombinedView")) {
    // alias already handled via exact id
}

// setInsightsCalendarView hook
if (!app.includes("next === 'charts' && typeof renderChartDashboardView")) {
    try {
        app = replaceOnce(app,
            "if (next === 'purchase' && typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();",
            "if (next === 'purchase' && typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();\n        if (next === 'charts' && typeof renderChartDashboardView === 'function') renderChartDashboardView();",
            'charts subview render');
    } catch (e) {
        console.warn(e.message);
    }
}

// updateStats soft sync + render
if (!app.includes('Chart dashboard render failed')) {
    try {
        app = replaceOnce(app,
            `    } catch (err) { console.error('Purchase analytics render failed', err); }
    renderGiftAnalytics(insights.bounds);`,
            `    } catch (err) { console.error('Purchase analytics render failed', err); }
    try {
        if (typeof ensureChartSystemPrefs === 'function') {
            const chPrefs = ensureChartSystemPrefs(appData);
            chPrefs.filters = chPrefs.filters || {};
            chPrefs.filters.substanceId = currentSubstanceId || 'all';
            if (insights.bounds?.startDate && insights.bounds?.endDate) {
                chPrefs.filters.customStart = insights.bounds.startDate;
                chPrefs.filters.customEnd = insights.bounds.endDate;
            }
        }
        if (typeof invalidateChartSystemCache === 'function') invalidateChartSystemCache();
        if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
    } catch (err) { console.error('Chart dashboard render failed', err); }
    renderGiftAnalytics(insights.bounds);`,
            'updateStats charts');
        console.log('Hooked updateStats chart render');
    } catch (e) {
        console.warn(e.message);
    }
}

// test exports
if (!app.includes('buildChartDashboardDataset,')) {
    try {
        app = replaceOnce(app,
            '        CONTACT_ROLE_LABELS,',
            `        CONTACT_ROLE_LABELS,
        ensureChartSystemPrefs,
        getChartSystemPrefs,
        persistChartSystemPrefs,
        buildChartDashboardDataset,
        buildChartDatasetForMetric,
        buildInventoryFlow,
        buildHeatmapMatrix,
        validateChartMetricCombo,
        chartIncompatibleMix,
        exportChartDashboardCsv,
        applyChartPreset,
        CHART_METRICS,
        CHART_PRESETS,
        CHART_TYPES,
        renderChartDashboardView,`,
            'chart test exports');
    } catch (e) {
        console.warn(e.message);
    }
}

// nav-combine.module.js source sync
if (!navMod.includes("'charts'")) {
    navMod = navMod.replace(
        `const INSIGHTS_CALENDAR_VIEWS = [
    'overview',
    'calendar',
    'trends',
    'comparisons',
    'financial',
    'use',
    'purchase',
    'goal-analytics',
    'plan-analytics',
    'custom'
];`,
        `const INSIGHTS_CALENDAR_VIEWS = [
    'overview',
    'calendar',
    'trends',
    'comparisons',
    'financial',
    'use',
    'purchase',
    'goal-analytics',
    'plan-analytics',
    'charts',
    'custom'
];`
    );
    if (!navMod.includes("charts: 'charts'") && navMod.includes("'custom-metrics': 'custom'")) {
        navMod = navMod.replace("'custom-metrics': 'custom'", "'custom-metrics': 'custom',\n        charts: 'charts'");
    }
    if (!navMod.includes("next === 'charts'")) {
        navMod = navMod.replace(
            "if (next === 'purchase' && typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();",
            "if (next === 'purchase' && typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();\n        if (next === 'charts' && typeof renderChartDashboardView === 'function') renderChartDashboardView();"
        );
    }
    fs.writeFileSync(path.join(root, 'nav-combine.module.js'), navMod);
    console.log('Updated nav-combine.module.js');
}

// HTML
if (!html.includes('id="chart-dashboard-root"')) {
    html = replaceOnce(html,
        `<option value="custom">Custom Metrics</option>
                    </select>
                    <nav class="combined-subnav" id="ic-subnav"`,
        `<option value="charts">Charts</option>
                        <option value="custom">Custom Metrics</option>
                    </select>
                    <nav class="combined-subnav" id="ic-subnav"`,
        'ic select charts option');

    html = replaceOnce(html,
        `<button type="button" class="combined-subnav-btn" data-ic-view="custom" onclick="setInsightsCalendarView('custom')">Custom</button>
                    </nav>`,
        `<button type="button" class="combined-subnav-btn" data-ic-view="charts" onclick="setInsightsCalendarView('charts')">Charts</button>
                        <button type="button" class="combined-subnav-btn" data-ic-view="custom" onclick="setInsightsCalendarView('custom')">Custom</button>
                    </nav>`,
        'ic nav charts button');

    html = replaceOnce(html,
        `data-ic-view="trends comparisons financial use purchase goal-analytics plan-analytics custom"`,
        `data-ic-view="trends comparisons financial use purchase goal-analytics plan-analytics charts custom"`,
        'stats-tab ic views');

    // Add chart section before financial or after purchase analytics
    if (html.includes('id="purchase-analytics-section"')) {
        html = replaceOnce(html,
            `                <div class="collapsible-section" data-section="statsPurchaseAnalytics" data-ic-panels="purchase overview" id="purchase-analytics-section">`,
            `                <div class="collapsible-section" data-section="statsChartDashboard" data-ic-panels="charts overview" id="chart-dashboard-section">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsChartDashboard')">
                        <span>Charts</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <p class="settings-hint">Interactive charts for use, spending, purchases, inventory, goals, and recovery. Incompatible units stay separate.</p>
                        <div id="chart-dashboard-root" class="chart-dashboard-root" aria-live="polite"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsPurchaseAnalytics" data-ic-panels="purchase overview" id="purchase-analytics-section">`,
            'chart dashboard section');
    } else {
        html = replaceOnce(html,
            `                <div class="collapsible-section" data-section="statsFinancialAnalytics"`,
            `                <div class="collapsible-section" data-section="statsChartDashboard" data-ic-panels="charts overview" id="chart-dashboard-section">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsChartDashboard')">
                        <span>Charts</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="chart-dashboard-root" class="chart-dashboard-root" aria-live="polite"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsFinancialAnalytics"`,
            'chart section before financial');
    }

    // date range panels include charts
    if (html.includes('data-ic-panels="trends comparisons financial use purchase') && !html.includes('charts overview"')) {
        // already may have been tagged
    }
    html = html.replace(
        'data-section="statsDateRange" data-ic-panels="trends comparisons financial use purchase goal-analytics plan-analytics custom overview"',
        'data-section="statsDateRange" data-ic-panels="trends comparisons financial use purchase goal-analytics plan-analytics charts custom overview"'
    );
}

if (!css.includes('.chart-dashboard-root')) {
    css += `

/* Chart System */
.chart-dashboard-root { margin-top: 4px; }
.ch-dashboard { display: flex; flex-direction: column; gap: 14px; }
.ch-toolbar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; }
.ch-toolbar-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ch-filters-grid, .ch-builder-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;
}
.ch-filters-grid label, .ch-builder-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
.ch-filters-grid select, .ch-filters-grid input, .ch-builder-grid select, .ch-builder-grid input, .ch-widget-actions select {
    min-height: 40px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--bg, #fff); color: var(--text);
}
.ch-check { flex-direction: row !important; align-items: center; gap: 8px !important; }
.ch-widget-grid { display: flex; flex-direction: column; gap: 14px; }
.ch-widget {
    border: 1px solid var(--border); border-radius: 12px; padding: 12px;
    background: var(--panel, var(--bg-card, #fff));
}
.ch-widget-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.ch-widget-head h4 { margin: 0; }
.ch-widget-actions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.ch-svg { width: 100%; height: auto; max-height: 280px; display: block; }
.ch-axis { stroke: var(--border); stroke-width: 1; }
.ch-grid { stroke: rgba(127,127,127,0.15); stroke-width: 1; }
.ch-axis-label { fill: var(--text-secondary); font-size: 10px; }
.ch-bar { fill: var(--accent); }
.ch-point { fill: var(--accent); stroke: #fff; stroke-width: 1; cursor: pointer; }
.ch-point:focus { outline: 2px solid var(--accent); }
.ch-donut-wrap { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.ch-legend { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; }
.ch-legend-item { display: flex; gap: 6px; align-items: center; }
.ch-swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.ch-progress-track { height: 12px; border-radius: 999px; background: rgba(127,127,127,0.15); overflow: hidden; }
.ch-progress-fill { display: block; height: 100%; background: var(--accent); }
.ch-progress-meta { margin-top: 6px; font-size: 0.9rem; }
.ch-flow-card { border: 1px solid var(--border); border-radius: 10px; padding: 10px; margin-bottom: 8px; }
.ch-flow-card h5 { margin: 0 0 8px; }
.ch-flow-stage { display: grid; grid-template-columns: 120px 1fr 64px; gap: 8px; align-items: center; font-size: 0.8rem; margin-bottom: 4px; }
.ch-flow-track { height: 8px; border-radius: 999px; background: rgba(127,127,127,0.12); overflow: hidden; }
.ch-flow-track span { display: block; height: 100%; background: var(--accent); }
.ch-needs-review { color: #ef6c00; font-size: 0.8rem; }
.ch-warning { color: #ef6c00; font-size: 0.85rem; }
.ch-empty, .ch-loading, .ch-error { color: var(--text-secondary); font-size: 0.9rem; }
.ch-widget.ch-fullscreen {
    position: fixed; inset: 8px; z-index: 12000; overflow: auto;
    background: var(--bg, #fff); box-shadow: 0 8px 40px rgba(0,0,0,0.25);
}
.ch-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.ch-table th, .ch-table td { border-bottom: 1px solid var(--border); padding: 6px 4px; text-align: left; }
.ch-sr-summary { margin: 4px 0 0; }
@media (max-width: 720px) {
    .ch-widget-actions { width: 100%; }
    .ch-flow-stage { grid-template-columns: 88px 1fr 48px; }
    .ch-svg { max-height: 220px; }
}
@media print {
    .ch-widget-actions, .ch-toolbar-actions, .bottom-nav { display: none !important; }
    .ch-widget { break-inside: avoid; }
}
`;
    console.log('Appended chart CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-chart-system complete');
