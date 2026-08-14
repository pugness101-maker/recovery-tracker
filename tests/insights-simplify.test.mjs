import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function setup() {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData({
        substances: [{
            id: 'coke',
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            active: true,
            isMain: true
        }],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    });
    if (typeof rt.initInsightsSimplify === 'function') rt.initInsightsSimplify();
    return rt;
}

test('Insights subnav markup uses five primary views', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /data-ic-view="overview"/);
    assert.match(html, /data-ic-view="calendar"/);
    assert.match(html, /data-ic-view="use"/);
    assert.match(html, /data-ic-view="money"/);
    assert.match(html, /data-ic-view="more"/);
    assert.doesNotMatch(html, /setInsightsCalendarView\('trends'\)/);
    assert.doesNotMatch(html, /setInsightsCalendarView\('financial'\)/);
    assert.match(html, /data-section="statsMoreMetrics"/);
    assert.match(html, /data-ic-advanced="true"/);
});

test('legacy Insights views normalize into Overview/Calendar/Use/Money/More', () => {
    const rt = setup();
    assert.equal(rt.normalizeInsightsSimplifyView('financial'), 'money');
    assert.equal(rt.normalizeInsightsSimplifyView('purchase'), 'money');
    assert.equal(rt.normalizeInsightsSimplifyView('trends'), 'use');
    assert.equal(rt.normalizeInsightsSimplifyView('charts'), 'use');
    assert.equal(rt.normalizeInsightsSimplifyView('comparisons'), 'more');
    assert.equal(rt.normalizeInsightsSimplifyView('goal-analytics'), 'more');
    assert.equal(rt.normalizeInsightsSimplifyView('custom'), 'more');
    assert.deepEqual([...rt.INSIGHTS_SIMPLIFY_PRIMARY_VIEWS], ['overview', 'calendar', 'use', 'money', 'more']);
});

test('simple mode is default and advanced toggles persist', () => {
    const rt = setup();
    const prefs = rt.ensureInsightsLayoutPrefs();
    assert.equal(prefs.viewMode, 'simple');
    assert.equal(rt.isInsightsSimpleMode(), true);
    rt.persistInsightsLayoutPrefs({ viewMode: 'advanced' });
    assert.equal(rt.getInsightsLayoutPrefs().viewMode, 'advanced');
    assert.equal(rt.isInsightsSimpleMode(), false);
});

test('CSS includes mobile dropdown and simple-mode chart limits', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.ic-layout-toolbar/);
    assert.match(css, /\.ic-simple-hidden/);
    assert.match(css, /\.insights-simple-mode/);
    assert.match(css, /@media \(max-width: 720px\)/);
});

test('Running Totals stays under Use and advanced by default', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /data-section="statsRunningTotals"[^>]*data-ic-panels="use"/);
    assert.match(html, /data-section="statsRunningTotals"[^>]*data-ic-advanced="true"/);
    const rt = setup();
    assert.equal(rt.DEFAULT_COLLAPSED_SECTIONS?.statsRunningTotals
        ?? true, true);
});

test('Progress and Insights no longer render or calculate alerts', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const simplified = fs.readFileSync(path.join(root, 'insights-simplify.module.js'), 'utf8');
    const financial = fs.readFileSync(path.join(root, 'financial-analytics.module.js'), 'utf8');
    const purchases = fs.readFileSync(path.join(root, 'purchase-analytics.module.js'), 'utf8');

    [app, simplified, financial, purchases].forEach(source => {
        assert.doesNotMatch(source, /No alerts right now/);
        assert.doesNotMatch(source, /<h3>Alerts<\/h3>/);
        assert.doesNotMatch(source, /Smart Warnings/);
        assert.doesNotMatch(source, /buildFinancialAlerts/);
        assert.doesNotMatch(source, /buildPurchaseAnalyticsWarnings/);
    });

    const rt = setup();
    assert.equal(Object.hasOwn(rt.ensureFinancialAnalyticsPrefs(), 'alertsEnabled'), false);
    assert.equal(Object.hasOwn(rt.ensurePurchaseAnalyticsPrefs(), 'alertsEnabled'), false);
});
