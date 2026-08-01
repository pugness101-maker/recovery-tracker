#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'running-totals.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn(`Skip: ${label}`);
        return src;
    }
    return src.replace(find, repl);
}

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing: ${label}\n${find.slice(0, 160)}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Running Totals (Insights → Use Analytics) ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced running-totals module');
} else {
    console.log('Running totals already in app.js');
}

app = tryReplace(app,
    `    ensureWeedCompletePrefs(data);
    ensureTableColumnSettings(data);`,
    `    ensureWeedCompletePrefs(data);
    ensureRunningTotalsPrefs(data);
    ensureTableColumnSettings(data);`,
    'ensure running totals prefs');

app = tryReplace(app,
    `    statsWeeklySummary: false,`,
    `    statsWeeklySummary: false,
    statsRunningTotals: false,`,
    'collapsed running totals');

app = tryReplace(app,
    `    renderGiftAnalytics(insights.bounds);
    updateRecoveryStreakDisplay(currentSubstanceId);
    renderStatsComparePeriods();
    applyCollapsedSections();
}`,
    `    try {
        if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView();
    } catch (err) { console.error('Running totals render failed', err); }
    renderGiftAnalytics(insights.bounds);
    updateRecoveryStreakDisplay(currentSubstanceId);
    renderStatsComparePeriods();
    applyCollapsedSections();
}`,
    'updateStats running totals');

app = tryReplace(app,
    `        ensureWeedCompletePrefs,
        ensureWeedCompleteMigrated,`,
    `        ensureWeedCompletePrefs,
        ensureWeedCompleteMigrated,
        ensureRunningTotalsPrefs,
        getRunningTotalsPrefs,
        persistRunningTotalsPrefs,
        buildRunningTotalsDataset,
        buildRunningTotalsRows,
        getRunningTotalsSessionMeasure,
        isRunningTotalsEligibleLog,
        getRunningTotalsResetKey,
        exportRunningTotalsCsv,
        renderRunningTotalsView,
        RUNNING_TOTALS_RESET_MODES,`,
    'running totals test exports');

if (!html.includes('id="running-totals-root"')) {
    html = replaceOnce(html,
        `                <div class="collapsible-section" data-section="statsWeeklySummary" data-ic-panels="trends use">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsWeeklySummary')">
                        <span>Weekly Use Summary</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div class="sheet-table-toolbar">
                            <button type="button" class="secondary-btn table-columns-btn" id="stats-weekly-customize-columns">Customize Columns</button>
                            <button type="button" class="secondary-btn" id="stats-weekly-export-btn">Export CSV</button>
                        </div>
                        <div id="stats-weekly-summary" class="sheet-table-wrap"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsContactAnalytics"`,
        `                <div class="collapsible-section" data-section="statsWeeklySummary" data-ic-panels="trends use">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsWeeklySummary')">
                        <span>Weekly Use Summary</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div class="sheet-table-toolbar">
                            <button type="button" class="secondary-btn table-columns-btn" id="stats-weekly-customize-columns">Customize Columns</button>
                            <button type="button" class="secondary-btn" id="stats-weekly-export-btn">Export CSV</button>
                        </div>
                        <div id="stats-weekly-summary" class="sheet-table-wrap"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsRunningTotals" data-ic-panels="use" id="running-totals-section">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsRunningTotals')">
                        <span>Running Totals</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <p class="settings-hint">Cumulative personal-use by session. Gift and adjustment entries are excluded. Shared Use counts only your portion.</p>
                        <div id="running-totals-root" class="running-totals-root" aria-live="polite"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsContactAnalytics"`,
        'running totals html section');
    console.log('Added Running Totals HTML section');
}

if (!css.includes('.running-totals-root')) {
    css += `

/* Running Totals */
.running-totals-root { margin-top: 4px; }
.rt-dashboard { display: flex; flex-direction: column; gap: 12px; }
.rt-filters {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;
}
.rt-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
.rt-filters select, .rt-filters input[type="date"] {
    min-height: 40px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--bg, #fff); color: var(--text);
}
.rt-check { flex-direction: row !important; align-items: center; gap: 8px !important; }
.rt-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rt-svg { width: 100%; height: auto; max-height: 260px; display: block; }
.rt-bar { fill: var(--accent); opacity: 0.85; }
.rt-line { stroke: #2e7d32; stroke-width: 2.5; }
.rt-target { stroke: #ef6c00; stroke-width: 1.5; stroke-dasharray: 6 4; }
.rt-axis { stroke: var(--border); stroke-width: 1; }
.rt-axis-label { fill: var(--text-secondary); font-size: 10px; }
.rt-table-wrap { margin-top: 8px; }
.rt-empty, .rt-loading, .rt-error { color: var(--text-secondary); font-size: 0.9rem; }
.rt-chart-block, .rt-table-block { margin-bottom: 14px; }
.rt-chart-block h4, .rt-table-block h4 { margin: 0 0 6px; }
@media (max-width: 720px) {
    .rt-filters { grid-template-columns: 1fr 1fr; }
    .rt-svg { max-height: 200px; }
}
`;
    console.log('Appended running totals CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-running-totals complete');
