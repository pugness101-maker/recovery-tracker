import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_DATE = '2026-08-01';
const COKE_ID = 'coke';

function el(id, props = {}) {
    const classes = new Set(String(props.className || '').split(/\s+/).filter(Boolean));
    const node = {
        id,
        tag: props.tag || 'div',
        value: props.value ?? '',
        checked: !!props.checked,
        hidden: !!props.hidden,
        required: !!props.required,
        textContent: props.textContent || '',
        innerHTML: props.innerHTML || '',
        style: {},
        dataset: { ...(props.dataset || {}) },
        className: props.className || '',
        options: props.options || [],
        classList: {
            add(...n) { n.forEach(x => classes.add(x)); node.className = [...classes].join(' '); },
            remove(...n) { n.forEach(x => classes.delete(x)); node.className = [...classes].join(' '); },
            toggle(name, force) {
                if (force === true) classes.add(name);
                else if (force === false) classes.delete(name);
                else if (classes.has(name)) classes.delete(name);
                else classes.add(name);
                node.className = [...classes].join(' ');
                return classes.has(name);
            },
            contains(name) { return classes.has(name); }
        },
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        querySelector() { return props.child || null; },
        querySelectorAll() { return []; },
        setAttribute() {},
        removeAttribute(name) { if (name === 'hidden') this.hidden = false; },
        getAttribute(name) {
            if (name === 'data-gp-view') return this.dataset.gpView || '';
            return null;
        },
        scrollIntoView() {}
    };
    return node;
}

function installDom(rt) {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const node = el(id, props);
        nodes.set(id, node);
        return node;
    };

    const overview = put('gp-overview', { className: 'combined-subview active', dataset: { gpView: 'overview' } });
    overview.getAttribute = (name) => (name === 'data-gp-view' ? 'overview' : null);
    put('gp-overview-root');
    const records = put('tapers-root', { className: 'combined-subview', hidden: true, dataset: { gpView: 'templates' } });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'templates' : null);
    put('gp-subnav', { tag: 'nav' });
    put('gp-subnav-select', { tag: 'select', value: 'overview' });
    put('gp-loading', { className: 'hidden' });
    put('gp-error', { className: 'hidden' });
    put('gp-error-message', { tag: 'p' });

    put('taper-metric-visibility-panel', { className: 'taper-metric-visibility-panel hidden' });
    put('taper-metric-visibility-body');
    put('taper-current-metrics', { className: 'taper-current-metrics hidden' });
    put('taper-current-metrics-body');
    put('taper-current-metrics-title', { tag: 'h4' });
    put('taper-insights');

    put('taper-plan-end-meta', { className: 'taper-plan-meta-item' });
    put('taper-plan-week-meta', { className: 'taper-plan-meta-item' });
    put('taper-plan-badges');
    put('taper-weekly-status-stat', { className: 'taper-mini-stat' });
    put('taper-weekly-avg-day-stat', { className: 'taper-mini-stat' });

    const goalAvg = el('goal-avg', { tag: 'input', value: '0.5', required: true });
    const currentAvg = el('current-avg', { tag: 'input', value: '2' });
    const reductionType = el('reduction-type', { tag: 'select', value: 'reduce-amount' });
    nodes.set('goal-avg', goalAvg);
    nodes.set('current-avg', currentAvg);
    nodes.set('reduction-type', reductionType);
    put('taper-start-avg-group', { className: 'form-group', child: currentAvg });
    put('goal-avg-group', { className: 'form-group', child: goalAvg });
    put('taper-reduction-type-group', { className: 'form-group', child: reductionType });

    const tabRoot = el('goals-plans-tab', { tag: 'section' });
    tabRoot.querySelectorAll = (sel) => (sel === '.combined-subview' ? [overview, records] : []);
    nodes.set('goals-plans-tab', tabRoot);

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel === '#goals-plans-tab') return tabRoot;
        if (sel?.startsWith?.('#')) return nodes.get(sel.slice(1)) || null;
        return null;
    };
    rt.document.querySelectorAll = () => [];
    return { nodes };
}

function makePlan(overrides = {}) {
    return {
        id: 'taper-1',
        name: 'Coke taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        weeklyMax: 14,
        weeklyTargets: [{ week: 1, weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 10, actualUsed: 2 }],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        ...overrides
    };
}

function setupApp(options = {}) {
    const rt = loadRecoveryTrackerApp(options.harness || {});
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: options.logs || [],
        purchases: options.purchases || [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: options.taperPlansV2 || [makePlan()],
        settings: {
            currency: '$',
            substanceSettings: {},
            combinedNav: { goalsPlansView: 'overview' },
            ...(options.settings || {})
        },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    rt.ensureCombinedNavPrefs();
    return rt;
}

function metricsFixture() {
    return {
        ok: true,
        unit: 'g',
        lookbackLabel: 'last 30 days',
        avgPerDay: 1.5,
        avgPerWeek: 10.5,
        avgPerMonth: 45,
        avgSession: 0.5,
        sessionsPerDay: 3,
        avgDurationMinutes: 20,
        spendPerWeek: 60,
        spendPerMonth: 240,
        inventory: 4,
        estimatedSupplyDays: 3
    };
}

test('all taper metrics are visible by default', () => {
    const rt = setupApp();
    const prefs = rt.ensureTaperMetricVisibilityPrefs();
    assert.ok(rt.TAPER_METRIC_KEYS.length >= 16);
    rt.TAPER_METRIC_KEYS.forEach(key => {
        assert.equal(prefs[key], true, `${key} visible by default`);
        assert.equal(rt.isTaperMetricVisible(key), true);
    });
    assert.equal(rt.getHiddenTaperMetricKeys().length, 0);
});

test('customize metrics panel lists every metric with a reset action', () => {
    const rt = setupApp();
    const { nodes } = installDom(rt);
    rt.renderTaperMetricVisibilityPanel();
    const html = nodes.get('taper-metric-visibility-body').innerHTML;
    rt.TAPER_METRIC_DEFINITIONS.forEach(metric => {
        assert.match(html, new RegExp(`data-taper-metric="${metric.key}"`), `${metric.key} checkbox`);
    });
    assert.match(html, /Daily average allowed/);
    assert.match(html, /Reset to defaults/);
    assert.equal(rt.toggleTaperMetricVisibilityPanel(true), true);
    assert.equal(nodes.get('taper-metric-visibility-panel').classList.contains('hidden'), false);
    rt.toggleTaperMetricVisibilityPanel(false);
    assert.equal(nodes.get('taper-metric-visibility-panel').classList.contains('hidden'), true);
});

test('hidden usage metrics disappear from the current usage card', () => {
    const rt = setupApp();
    const { nodes } = installDom(rt);
    rt.renderTaperCurrentMetricsCard(metricsFixture());
    const before = nodes.get('taper-current-metrics-body').innerHTML;
    assert.match(before, /Average\/week/);
    assert.match(before, /Current inventory/);

    rt.setTaperMetricVisibility('averagePerWeek', false);
    rt.setTaperMetricVisibility('currentInventory', false);
    rt.renderTaperCurrentMetricsCard(metricsFixture());
    const after = nodes.get('taper-current-metrics-body').innerHTML;
    assert.doesNotMatch(after, /Average\/week/);
    assert.doesNotMatch(after, /Current inventory/);
    assert.match(after, /Average\/day/);
    assert.match(after, /Estimated supply/);
});

test('hiding Daily average allowed hides the plan insight and the form field', () => {
    const rt = setupApp();
    const { nodes } = installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'taper-1';

    rt.renderTaperInsights(COKE_ID);
    assert.match(nodes.get('taper-insights').innerHTML, /Goal average/);

    rt.setTaperMetricVisibility('dailyAverageAllowed', false);
    rt.renderTaperInsights(COKE_ID);
    assert.doesNotMatch(nodes.get('taper-insights').innerHTML, /Goal average/);
    assert.match(nodes.get('taper-insights').innerHTML, /Start average/);

    rt.applyTaperMetricVisibilityToForm();
    assert.equal(nodes.get('goal-avg-group').classList.contains('taper-metric-hidden'), true);
    assert.equal(nodes.get('taper-start-avg-group').classList.contains('taper-metric-hidden'), false);
    // A hidden field must not block saving through HTML validation.
    assert.equal(nodes.get('goal-avg').required, false);

    rt.setTaperMetricVisibility('dailyAverageAllowed', true);
    rt.applyTaperMetricVisibilityToForm();
    assert.equal(nodes.get('goal-avg-group').classList.contains('taper-metric-hidden'), false);
    assert.equal(nodes.get('goal-avg').required, true);
});

test('hidden metrics still calculate and stay on the saved taper', () => {
    const rt = setupApp({
        logs: [
            { id: 'l1', substanceId: COKE_ID, date: '2026-07-28', time: '12:00', amount: 1, unit: 'g', transactionType: 'use' },
            { id: 'l2', substanceId: COKE_ID, date: '2026-07-29', time: '12:00', amount: 2, unit: 'g', transactionType: 'use' },
            { id: 'l3', substanceId: COKE_ID, date: '2026-07-30', time: '12:00', amount: 1.5, unit: 'g', transactionType: 'use' }
        ]
    });
    installDom(rt);
    rt.setTaperMetricVisibility('currentAveragePerDay', false);
    rt.setTaperMetricVisibility('dailyAverageAllowed', false);

    const metrics = rt.computeTaperCurrentMetrics(COKE_ID, { today: REFERENCE_DATE });
    assert.ok(metrics.avgPerDay > 0, 'average per day still computed');

    const plan = rt.getTaperPlanById('taper-1');
    assert.equal(plan.goalDailyAverage, 1, 'plan target untouched by visibility');
    assert.equal(rt.isTaperMetricVisible('currentAveragePerDay'), false);
});

test('hidden metrics drop off Overview taper cards', () => {
    const rt = setupApp();
    const { nodes } = installDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const before = nodes.get('gp-overview-root').innerHTML;
    assert.match(before, /Current step/);
    assert.match(before, /goal-status-pill/);

    rt.setTaperMetricVisibility('currentStep', false);
    rt.setTaperMetricVisibility('status', false);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const after = nodes.get('gp-overview-root').innerHTML;
    assert.doesNotMatch(after, /Current step/);
    assert.doesNotMatch(after, /goal-status-pill/);
    assert.match(after, /Coke taper/, 'taper is still listed');
});

test('dashboard metric wrappers follow visibility prefs', () => {
    const rt = setupApp();
    const { nodes } = installDom(rt);
    rt.setTaperMetricVisibility('endDate', false);
    rt.setTaperMetricVisibility('status', false);
    rt.applyTaperMetricVisibilityToDashboard();
    assert.equal(nodes.get('taper-plan-end-meta').classList.contains('taper-metric-hidden'), true);
    assert.equal(nodes.get('taper-plan-badges').classList.contains('taper-metric-hidden'), true);
    assert.equal(nodes.get('taper-weekly-status-stat').classList.contains('taper-metric-hidden'), true);
    assert.equal(nodes.get('taper-plan-week-meta').classList.contains('taper-metric-hidden'), false);
});

test('visibility prefs persist through storage and reset restores defaults', () => {
    const rt = setupApp();
    installDom(rt);
    rt.setTaperMetricVisibility('averageDuration', false);
    rt.setTaperMetricVisibility('spendingPerMonth', false);

    const raw = rt.localStorage.getItem('recovery-tracker-v2');
    assert.ok(raw);
    const stored = JSON.parse(raw).settings.taperMetricVisibility;
    assert.equal(stored.averageDuration, false);
    assert.equal(stored.spendingPerMonth, false);

    const reloaded = setupApp({
        harness: { localStorage: { 'recovery-tracker-v2': raw } },
        settings: JSON.parse(raw).settings
    });
    installDom(reloaded);
    assert.equal(reloaded.isTaperMetricVisible('averageDuration'), false);
    assert.equal(reloaded.isTaperMetricVisible('spendingPerMonth'), false);
    assert.equal(reloaded.isTaperMetricVisible('currentAveragePerDay'), true);

    reloaded.resetTaperMetricVisibility();
    assert.equal(reloaded.getHiddenTaperMetricKeys().length, 0);
});

test('unknown stored metric keys are dropped and missing keys default to visible', () => {
    const rt = setupApp({ settings: { taperMetricVisibility: { status: false, madeUpMetric: false } } });
    const prefs = rt.ensureTaperMetricVisibilityPrefs();
    assert.equal(prefs.madeUpMetric, undefined);
    assert.equal(prefs.status, false);
    assert.equal(prefs.currentInventory, true);
});

test('Customize metrics control is wired up in the Tapers page markup', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /toggleTaperMetricVisibilityPanel\(\)/);
    assert.match(html, /id="taper-metric-visibility-panel"/);
    assert.match(html, /id="taper-metric-visibility-body"/);
    assert.match(html, /id="taper-plan-end-meta"/);
    assert.match(html, /id="taper-weekly-status-stat"/);
    assert.match(html, /id="taper-reduction-type-group"/);
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.taper-metric-hidden/);
});
