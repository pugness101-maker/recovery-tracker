#!/usr/bin/env node
/**
 * Reorganize Recovery Tracker navigation:
 * - Combine Goals + Plan → Goals & Plans
 * - Combine Insights + Calendar → Insights & Calendar
 * - Update bottom nav order
 *
 * Idempotent: skips if goals-plans-tab already present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

if (html.includes('id="goals-plans-tab"')) {
    console.log('index.html already has goals-plans-tab; skipping HTML restructure.');
    process.exit(0);
}

function extractSection(source, id) {
    const startToken = `<section id="${id}"`;
    const start = source.indexOf(startToken);
    if (start < 0) throw new Error(`Missing section ${id}`);
    let i = start + startToken.length;
    let depth = 1;
    while (i < source.length && depth > 0) {
        const nextOpen = source.indexOf('<section', i);
        const nextClose = source.indexOf('</section>', i);
        if (nextClose < 0) throw new Error(`Unclosed section ${id}`);
        if (nextOpen >= 0 && nextOpen < nextClose) {
            depth += 1;
            i = nextOpen + 8;
        } else {
            depth -= 1;
            i = nextClose + '</section>'.length;
            if (depth === 0) {
                return { start, end: i, full: source.slice(start, i) };
            }
        }
    }
    throw new Error(`Failed to extract ${id}`);
}

function stripOuterSection(full) {
    const openEnd = full.indexOf('>');
    const closeStart = full.lastIndexOf('</section>');
    return full.slice(openEnd + 1, closeStart).trim();
}

const calendar = extractSection(html, 'calendar-tab');
const goals = extractSection(html, 'goals-tab');
const stats = extractSection(html, 'stats-tab');
const taper = extractSection(html, 'taper-tab');

const calendarInner = stripOuterSection(calendar.full);
const goalsInner = stripOuterSection(goals.full);
const statsInner = stripOuterSection(stats.full);
const taperInner = stripOuterSection(taper.full);

const goalsPlansSection = `<!-- Goals & Plans Tab -->
            <section id="goals-plans-tab" class="tab combined-page goals-plans-page">
                <div class="page-header-row combined-page-header">
                    <div>
                        <h2>Goals &amp; Plans</h2>
                        <p class="settings-hint">Goals define outcomes. Plans define the step-by-step method. Records stay separate and can be linked.</p>
                    </div>
                </div>

                <div class="combined-subnav-wrap">
                    <label class="combined-subnav-mobile-label" for="gp-subnav-select">View</label>
                    <select id="gp-subnav-select" class="combined-subnav-select" aria-label="Goals and Plans view" onchange="setGoalsPlansView(this.value)">
                        <option value="overview">Overview</option>
                        <option value="active-goals">Active Goals</option>
                        <option value="active-plans">Active Plans</option>
                        <option value="goal-history">Goal History</option>
                        <option value="plan-history">Plan History</option>
                        <option value="templates">Templates</option>
                        <option value="achievements">Achievements</option>
                    </select>
                    <nav class="combined-subnav" id="gp-subnav" aria-label="Goals and Plans sections" role="tablist">
                        <button type="button" class="combined-subnav-btn active" data-gp-view="overview" onclick="setGoalsPlansView('overview')">Overview</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="active-goals" onclick="setGoalsPlansView('active-goals')">Active Goals</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="active-plans" onclick="setGoalsPlansView('active-plans')">Active Plans</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="goal-history" onclick="setGoalsPlansView('goal-history')">Goal History</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="plan-history" onclick="setGoalsPlansView('plan-history')">Plan History</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="templates" onclick="setGoalsPlansView('templates')">Templates</button>
                        <button type="button" class="combined-subnav-btn" data-gp-view="achievements" onclick="setGoalsPlansView('achievements')">Achievements</button>
                    </nav>
                </div>

                <div id="gp-overview" class="combined-subview active" data-gp-view="overview" role="tabpanel">
                    <div id="gp-overview-root" class="combined-overview-root" aria-live="polite"></div>
                </div>

                <div id="goals-tab" class="combined-subview goals-page" data-gp-view="active-goals goal-history templates achievements" role="tabpanel" hidden>
                    ${goalsInner}
                </div>

                <div id="taper-tab" class="combined-subview taper-page" data-gp-view="active-plans plan-history" role="tabpanel" hidden>
                    ${taperInner}
                </div>

                <div id="gp-loading" class="rd-state rd-loading hidden">Loading Goals &amp; Plans…</div>
                <div id="gp-error" class="rd-state rd-error hidden">
                    <p id="gp-error-message">Could not load Goals &amp; Plans.</p>
                    <button type="button" class="secondary-btn btn-sm" onclick="renderGoalsPlansCombinedView()">Retry</button>
                </div>
            </section>`;

const insightsCalendarSection = `<!-- Insights & Calendar Tab -->
            <section id="insights-calendar-tab" class="tab combined-page insights-calendar-page">
                <div class="page-header-row combined-page-header">
                    <div>
                        <h2>Insights &amp; Calendar</h2>
                        <p class="settings-hint">Analytics and calendar share the same filters and date context where possible.</p>
                    </div>
                </div>

                <div class="combined-subnav-wrap">
                    <label class="combined-subnav-mobile-label" for="ic-subnav-select">View</label>
                    <select id="ic-subnav-select" class="combined-subnav-select" aria-label="Insights and Calendar view" onchange="setInsightsCalendarView(this.value)">
                        <option value="overview">Overview</option>
                        <option value="calendar">Calendar</option>
                        <option value="trends">Trends</option>
                        <option value="comparisons">Compare</option>
                        <option value="financial">Financial</option>
                        <option value="use">Use Analytics</option>
                        <option value="purchase">Purchase Analytics</option>
                        <option value="goal-analytics">Goal Analytics</option>
                        <option value="plan-analytics">Plan Analytics</option>
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
                        <button type="button" class="combined-subnav-btn" data-ic-view="custom" onclick="setInsightsCalendarView('custom')">Custom</button>
                    </nav>
                </div>

                <div id="ic-overview" class="combined-subview active" data-ic-view="overview" role="tabpanel">
                    <div id="ic-overview-root" class="combined-overview-root" aria-live="polite"></div>
                </div>

                <div id="calendar-tab" class="combined-subview calendar-page" data-ic-view="calendar" role="tabpanel" hidden>
                    ${calendarInner}
                </div>

                <div id="stats-tab" class="combined-subview insights-page" data-ic-view="trends comparisons financial use purchase goal-analytics plan-analytics custom overview" role="tabpanel" hidden>
                    ${statsInner}
                    <div class="collapsible-section" data-section="statsPlanAnalytics" id="plan-analytics-section" data-ic-panels="plan-analytics overview">
                        <button type="button" class="section-toggle" onclick="toggleSection('statsPlanAnalytics')">
                            <span>Plan Analytics</span>
                            <span class="chevron">⌄</span>
                        </button>
                        <div class="section-content">
                            <div id="plan-analytics-panel" class="plan-analytics-panel" aria-live="polite"></div>
                        </div>
                    </div>
                    <div class="collapsible-section" data-section="statsCustomMetrics" id="custom-metrics-section" data-ic-panels="custom">
                        <button type="button" class="section-toggle" onclick="toggleSection('statsCustomMetrics')">
                            <span>Custom Metrics</span>
                            <span class="chevron">⌄</span>
                        </button>
                        <div class="section-content">
                            <div id="custom-metrics-panel" class="custom-metrics-panel">
                                <p class="settings-hint">Build spending-per-use-day, cost-per-sober-day, savings rate, and other formulas in the Custom Metrics Builder when available. Existing Insights totals stay available in Trends and Financial.</p>
                                <div id="custom-metrics-root" class="custom-metrics-root"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="ic-loading" class="rd-state rd-loading hidden">Loading Insights &amp; Calendar…</div>
                <div id="ic-error" class="rd-state rd-error hidden">
                    <p id="ic-error-message">Could not load Insights &amp; Calendar.</p>
                    <button type="button" class="secondary-btn btn-sm" onclick="renderInsightsCalendarCombinedView()">Retry</button>
                </div>
            </section>`;

// Replace from calendar through taper (contiguous block) with the two new sections.
const blockStart = Math.min(calendar.start, goals.start, stats.start, taper.start);
const blockEnd = Math.max(calendar.end, goals.end, stats.end, taper.end);
const before = html.slice(0, blockStart);
const after = html.slice(blockEnd);
html = `${before}${goalsPlansSection}

            ${insightsCalendarSection}
${after}`;

const newNav = `    <nav class="bottom-nav" aria-label="Main navigation">
        <button class="nav-btn active" data-tab="dashboard-tab" onclick="switchTab('dashboard-tab')">
            <span>🏠</span>
            <span>Home</span>
        </button>
        <button class="nav-btn" data-tab="use-log-tab" onclick="switchTab('use-log-tab')">
            <span>📝</span>
            <span>Log</span>
        </button>
        <button class="nav-btn" data-tab="buy-tracker-tab" onclick="switchTab('buy-tracker-tab')">
            <span>📦</span>
            <span>Inventory</span>
        </button>
        <button class="nav-btn" data-tab="goals-plans-tab" onclick="switchTab('goals-plans-tab')">
            <span>🎯</span>
            <span class="nav-btn-label-full">Goals &amp; Plans</span>
            <span class="nav-btn-label-short">Goals</span>
        </button>
        <button class="nav-btn" data-tab="insights-calendar-tab" onclick="switchTab('insights-calendar-tab')">
            <span>📈</span>
            <span class="nav-btn-label-full">Insights &amp; Calendar</span>
            <span class="nav-btn-label-short">Insights</span>
        </button>
        <button class="nav-btn" data-tab="settings-tab" onclick="switchTab('settings-tab')">
            <span>⚙️</span>
            <span>Settings</span>
        </button>
    </nav>`;

const navRe = /<nav class="bottom-nav"[\s\S]*?<\/nav>/;
if (!navRe.test(html)) throw new Error('bottom-nav not found');
html = html.replace(navRe, newNav);

// Tag existing insights sections with data-ic-panels for subview filtering
const panelTags = [
    ['data-section="statsDateRange"', 'data-section="statsDateRange" data-ic-panels="trends comparisons financial use purchase goal-analytics plan-analytics custom overview"'],
    ['data-section="statsGoalAnalytics"', 'data-section="statsGoalAnalytics" data-ic-panels="goal-analytics overview"'],
    ['data-section="statsComparePeriods"', 'data-section="statsComparePeriods" data-ic-panels="comparisons"'],
    ['data-section="statsSummaryDashboard"', 'data-section="statsSummaryDashboard" data-ic-panels="trends use overview"'],
    ['data-section="statsCalendarView"', 'data-section="statsCalendarView" data-ic-panels="trends overview"'],
    ['data-section="statsMonthlySummary"', 'data-section="statsMonthlySummary" data-ic-panels="trends use"'],
    ['data-section="statsWeeklySummary"', 'data-section="statsWeeklySummary" data-ic-panels="trends use"'],
    ['data-section="statsBuyAnalytics"', 'data-section="statsBuyAnalytics" data-ic-panels="purchase overview"'],
    ['data-section="statsFinancialAnalytics"', 'data-section="statsFinancialAnalytics" data-ic-panels="financial overview"'],
    ['data-section="statsGiftAnalytics"', 'data-section="statsGiftAnalytics" data-ic-panels="purchase use"']
];
for (const [from, to] of panelTags) {
    if (html.includes(from) && !html.includes(to)) {
        html = html.replace(from, to);
    }
}

fs.writeFileSync(htmlPath, html);
console.log('Restructured index.html: Goals & Plans + Insights & Calendar combined tabs.');
