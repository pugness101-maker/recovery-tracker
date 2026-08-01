#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const insightsMod = fs.readFileSync(path.join(root, 'insights-filters.module.js'), 'utf8');
const rtMod = fs.readFileSync(path.join(root, 'running-totals.module.js'), 'utf8');
const chartMod = fs.readFileSync(path.join(root, 'chart-system.module.js'), 'utf8');

function replaceBlock(src, startMarker, endMarker, replacement, label) {
    const start = src.indexOf(startMarker);
    if (start < 0) throw new Error(`Missing start: ${label}`);
    const end = src.indexOf(endMarker, start);
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

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing: ${label}`);
    return src.replace(find, repl);
}

// Replace Running Totals block
if (app.includes('// ——— Running Totals (Insights → Use Analytics) ———')) {
    app = replaceBlock(
        app,
        '// ——— Running Totals (Insights → Use Analytics) ———',
        'const defaultData = {',
        rtMod,
        'running totals'
    );
    console.log('Replaced running totals module');
} else {
    throw new Error('Running totals marker missing');
}

// Insert Insights filters before Running Totals (now first after previous splice may have changed)
if (!app.includes('// ——— Shared Insights filter state (source of truth) ———')) {
    const rtStart = app.indexOf('// ——— Running Totals (Insights → Use Analytics) ———');
    if (rtStart < 0) throw new Error('RT start missing after replace');
    app = app.slice(0, rtStart) + insightsMod + '\n\n' + app.slice(rtStart);
    console.log('Inserted insights-filters module');
} else {
    // Replace existing insights filters block
    app = replaceBlock(
        app,
        '// ——— Shared Insights filter state (source of truth) ———',
        '// ——— Running Totals (Insights → Use Analytics) ———',
        insightsMod,
        'insights filters refresh'
    );
    console.log('Refreshed insights-filters module');
}

// Replace chart system block
const chartStart = '// ——— Chart System ———';
const chartEndCandidates = [
    '// ——— Complete Weed Support ———',
    '// ——— Contacts Cross-Tab Integration ———',
    '// ——— Shared Insights filter state',
    '// ——— Running Totals'
];
if (app.includes(chartStart)) {
    let endIdx = -1;
    let endMarker = null;
    const startIdx = app.indexOf(chartStart);
    for (const m of chartEndCandidates) {
        const i = app.indexOf(m, startIdx + 10);
        if (i > startIdx && (endIdx < 0 || i < endIdx)) {
            endIdx = i;
            endMarker = m;
        }
    }
    if (endIdx < 0) throw new Error('Could not find chart system end marker');
    app = app.slice(0, startIdx) + chartMod + '\n\n' + app.slice(endIdx);
    console.log('Replaced chart system module before', endMarker);
} else {
    console.warn('Chart system marker missing — skip chart replace');
}

// ensureInsightsFilters in settings
app = tryReplace(app,
    `    ensureRunningTotalsPrefs(data);
    ensureTableColumnSettings(data);`,
    `    ensureRunningTotalsPrefs(data);
    ensureInsightsFilters(data);
    loadInsightsFiltersIntoState(data);
    ensureTableColumnSettings(data);`,
    'ensure insights filters');

// switchStatsSubstance → shared filters
app = tryReplace(app,
    `function switchStatsSubstance(substanceId) {
    setSelectedDashboardSubstance(substanceId, { persist: true, render: false, syncStats: false });
    const dash = document.getElementById('dashboard-substance');
    if (dash) dash.value = selectedDashboardSubstance;
    const statsSelect = document.getElementById('stats-substance');
    if (statsSelect) statsSelect.value = selectedDashboardSubstance;
    const calSel = document.getElementById('stats-calendar-substance');
    if (calSel && [...calSel.options].some(o => o.value === selectedDashboardSubstance)) {
        calSel.value = selectedDashboardSubstance;
    }
    updateStats();
}`,
    `function switchStatsSubstance(substanceId) {
    clearInsightsSectionOutputs();
    if (typeof setSelectedInsightsSubstance === 'function') {
        setSelectedInsightsSubstance(substanceId, { render: false, save: true });
    } else {
        setSelectedDashboardSubstance(substanceId, { persist: true, render: false, syncStats: false });
    }
    const dash = document.getElementById('dashboard-substance');
    if (dash) dash.value = selectedDashboardSubstance;
    const statsSelect = document.getElementById('stats-substance');
    if (statsSelect) statsSelect.value = selectedDashboardSubstance;
    const calSel = document.getElementById('stats-calendar-substance');
    if (calSel && [...calSel.options].some(o => o.value === selectedDashboardSubstance)) {
        calSel.value = selectedDashboardSubstance;
    }
    syncInsightsFilterUi();
    updateStats();
}`,
    'switchStatsSubstance');

// Date range change
app = tryReplace(app,
    `function onStatsDateRangeChange() {
    const select = document.getElementById('stats-date-range');
    statsDateRangePreset = select?.value || 'last-7';
    document.getElementById('stats-custom-range-wrap')?.classList.toggle('hidden', statsDateRangePreset !== 'custom');
    invalidateInsightsDatasetCache();
    if (statsDateRangePreset !== 'custom') updateStats();
}`,
    `function onStatsDateRangeChange() {
    const select = document.getElementById('stats-date-range');
    const preset = select?.value || 'last-7';
    clearInsightsSectionOutputs();
    if (typeof setSelectedInsightsDateRange === 'function') {
        setSelectedInsightsDateRange(preset, statsCustomStartDate, statsCustomEndDate, { render: false, save: true });
    } else {
        statsDateRangePreset = preset;
        invalidateInsightsDatasetCache();
    }
    document.getElementById('stats-custom-range-wrap')?.classList.toggle('hidden', preset !== 'custom');
    syncInsightsFilterUi();
    if (preset !== 'custom') updateStats();
}`,
    'onStatsDateRangeChange');

app = tryReplace(app,
    `function applyStatsCustomRange() {
    statsCustomStartDate = document.getElementById('stats-custom-start')?.value || '';
    statsCustomEndDate = document.getElementById('stats-custom-end')?.value || '';
    if (!statsCustomStartDate || !statsCustomEndDate) {
        alert('Select both a start and end date.');
        return;
    }
    statsDateRangePreset = 'custom';
    const select = document.getElementById('stats-date-range');
    if (select) select.value = 'custom';
    document.getElementById('stats-custom-range-wrap')?.classList.remove('hidden');
    invalidateInsightsDatasetCache();
    updateStats();
}`,
    `function applyStatsCustomRange() {
    const start = document.getElementById('stats-custom-start')?.value || '';
    const end = document.getElementById('stats-custom-end')?.value || '';
    if (!start || !end) {
        alert('Select both a start and end date.');
        return;
    }
    clearInsightsSectionOutputs();
    if (typeof setSelectedInsightsDateRange === 'function') {
        setSelectedInsightsDateRange('custom', start, end, { render: false, save: true });
    } else {
        statsCustomStartDate = start;
        statsCustomEndDate = end;
        statsDateRangePreset = 'custom';
        invalidateInsightsDatasetCache();
    }
    const select = document.getElementById('stats-date-range');
    if (select) select.value = 'custom';
    document.getElementById('stats-custom-range-wrap')?.classList.remove('hidden');
    syncInsightsFilterUi();
    updateStats();
}`,
    'applyStatsCustomRange');

// setupStatsDateRange — load shared filters
app = tryReplace(app,
    `function setupStatsDateRange() {`,
    `function setupStatsDateRange() {
    if (typeof loadInsightsFiltersIntoState === 'function') loadInsightsFiltersIntoState(appData);
    if (typeof syncInsightsFilterUi === 'function') syncInsightsFilterUi(appData);`,
    'setupStatsDateRange load');

// Rewrite updateStats body for all-substances + shared sync
const oldUpdateStart = 'function updateStats() {\n    try { renderGoalInsightsPanel(); } catch (_) { /* ignore */ }\n    if (isAllSubstancesView()) {';
const newUpdateStats = `function updateStats() {
    if (typeof ensureInsightsFilters === 'function') {
        ensureInsightsFilters(appData);
        loadInsightsFiltersIntoState(appData);
        syncSectionFiltersFromInsights(appData);
    }
    try { renderGoalInsightsPanel(); } catch (_) { /* ignore */ }
    if (isAllSubstancesView()) {
        document.querySelector('.stats-date-range-toolbar')?.classList.remove('hidden');
        renderSubstanceStatsBreakdown();
        document.getElementById('stats-single-view')?.classList.add('hidden');
        document.getElementById('stats-all-view')?.classList.remove('hidden');
        // Still sync/render shared-filter sections for All Substances
        try {
            const insightsAll = buildInsightsDataset(DASHBOARD_ALL);
            renderGiftAnalytics(insightsAll.bounds);
        } catch (_) { /* ignore */ }
        if (typeof renderInsightsFilteredSections === 'function') renderInsightsFilteredSections();
        else {
            try { if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView(); } catch (_) {}
            try { if (typeof renderChartDashboardView === 'function') renderChartDashboardView(); } catch (_) {}
        }
        renderStatsComparePeriods();
        applyCollapsedSections();
        syncInsightsFilterUi();
        return;
    }

    document.querySelector('.stats-date-range-toolbar')?.classList.remove('hidden');
    document.getElementById('stats-single-view')?.classList.remove('hidden');
    document.getElementById('stats-all-view')?.classList.add('hidden');

    const insights = buildInsightsDataset(currentSubstanceId);
    syncStatsCalendarAnchorToRange(insights.bounds, insights.preset);
    const sub = getSubstance(currentSubstanceId);
    const displayUnit = insights.displayUnit;

    const summaryEl = document.getElementById('stats-range-summary');
    if (summaryEl) summaryEl.textContent = getStatsRangeLabel(insights.preset, insights.bounds.startDate, insights.bounds.endDate);

    renderStatsSummaryDashboard(currentSubstanceId, insights.useStats, insights.bounds, displayUnit, insights.cur);
    renderStatsCalendarView(insights.bounds);
    renderStatsMonthlySummary(currentSubstanceId, insights);
    renderStatsWeeklySummary(currentSubstanceId, insights);

    renderBuyInsights(currentSubstanceId, insights);
    if (typeof renderInsightsFilteredSections === 'function') renderInsightsFilteredSections();
    else {
        try {
            if (typeof ensureFinancialAnalyticsPrefs === 'function') {
                const finPrefs = ensureFinancialAnalyticsPrefs(appData);
                finPrefs.filters = finPrefs.filters || {};
                finPrefs.filters.substanceId = currentSubstanceId || 'all';
            }
            if (typeof invalidateFinancialAnalyticsCache === 'function') invalidateFinancialAnalyticsCache();
            if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
        } catch (err) { console.error('Financial analytics render failed', err); }
        try {
            if (typeof ensurePurchaseAnalyticsPrefs === 'function') {
                const paPrefs = ensurePurchaseAnalyticsPrefs(appData);
                paPrefs.filters = paPrefs.filters || {};
                paPrefs.filters.substanceId = currentSubstanceId || 'all';
            }
            if (typeof invalidatePurchaseAnalyticsCache === 'function') invalidatePurchaseAnalyticsCache();
            if (typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();
        } catch (err) { console.error('Purchase analytics render failed', err); }
        try {
            if (typeof ensureChartSystemPrefs === 'function') {
                const chPrefs = ensureChartSystemPrefs(appData);
                chPrefs.filters = chPrefs.filters || {};
                chPrefs.filters.substanceId = currentSubstanceId || 'all';
            }
            if (typeof invalidateChartSystemCache === 'function') invalidateChartSystemCache();
            if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
        } catch (err) { console.error('Chart dashboard render failed', err); }
        try {
            if (typeof renderInsightsContactAnalytics === 'function') renderInsightsContactAnalytics();
        } catch (err) { console.error('Contact insights render failed', err); }
        try {
            if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView();
        } catch (err) { console.error('Running totals render failed', err); }
    }
    renderGiftAnalytics(insights.bounds);
    updateRecoveryStreakDisplay(currentSubstanceId);
    renderStatsComparePeriods();
    applyCollapsedSections();
    syncInsightsFilterUi();
}`;

if (app.includes(oldUpdateStart)) {
    // Find full old updateStats function end by matching braces from start
    const start = app.indexOf('function updateStats() {');
    if (start < 0) throw new Error('updateStats missing');
    let i = start + 'function updateStats() {'.length;
    let depth = 1;
    while (i < app.length && depth > 0) {
        const ch = app[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        i += 1;
    }
    app = app.slice(0, start) + newUpdateStats + app.slice(i);
    console.log('Replaced updateStats');
} else {
    console.warn('updateStats pattern not found for rewrite');
}

// Test exports
app = tryReplace(app,
    `        ensureRunningTotalsPrefs,
        getRunningTotalsPrefs,`,
    `        ensureInsightsFilters,
        getInsightsFilters,
        persistInsightsFilters,
        getSelectedInsightsSubstance,
        getSelectedInsightsProductType,
        getSelectedInsightsDateRange,
        getSelectedInsightsTransactionType,
        setSelectedInsightsSubstance,
        setSelectedInsightsProductType,
        setSelectedInsightsDateRange,
        setSelectedInsightsTransactionType,
        syncSectionFiltersFromInsights,
        loadInsightsFiltersIntoState,
        renderInsightsFilteredSections,
        ensureRunningTotalsPrefs,
        getRunningTotalsPrefs,`,
    'insights filter test exports');

// HTML: product type + transaction type in Date Range section
if (!html.includes('id="stats-product-type"')) {
    html = replaceOnce(html,
        `                <div class="form-group">
                    <label for="stats-substance">Substance</label>
                    <select id="stats-substance" onchange="switchStatsSubstance(this.value)"></select>
                </div>

                <div class="stats-date-range-toolbar">`,
        `                <div class="form-group">
                    <label for="stats-substance">Substance</label>
                    <select id="stats-substance" onchange="switchStatsSubstance(this.value)"></select>
                </div>

                <div class="form-group" id="stats-product-type-wrap" class="hidden">
                    <label for="stats-product-type">Product type</label>
                    <select id="stats-product-type" onchange="onInsightsProductTypeChange()">
                        <option value="">All Weed products</option>
                        <option value="bud">Bud</option>
                        <option value="cart">Cart</option>
                        <option value="edibles">Edibles</option>
                        <option value="pre-rolls">Pre-rolls</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="stats-transaction-type">Transaction type</label>
                    <select id="stats-transaction-type" onchange="onInsightsTransactionTypeChange()">
                        <option value="">Use + Shared Use</option>
                        <option value="use">Personal Use</option>
                        <option value="shared_use">Shared Use</option>
                    </select>
                </div>

                <div class="stats-date-range-toolbar">`,
        'insights product/tx filters html');
    console.log('Added product/transaction filters to Insights HTML');
}

if (!css.includes('.rt-inherits')) {
    css += `
/* Shared Insights filter hints */
.rt-inherits, .ch-toolbar .settings-hint strong { font-weight: 600; }
#stats-product-type-wrap.hidden { display: none; }
`;
    console.log('Appended insights filter CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-insights-filters complete');
