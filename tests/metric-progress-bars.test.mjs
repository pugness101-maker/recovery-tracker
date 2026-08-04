import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    return rt;
}

test('normalizeMetricProgress: below target', () => {
    const rt = setup();
    const p = rt.normalizeMetricProgress({ current: 2.4, target: 3 });
    assert.equal(p.valid, true);
    assert.ok(Math.abs(p.percent - 80) < 0.01);
    assert.equal(p.visualPercent, 80);
    assert.equal(p.exceedsTarget, false);
    assert.equal(p.current, 2.4);
    assert.equal(p.target, 3);
});

test('normalizeMetricProgress: equal to target', () => {
    const rt = setup();
    const p = rt.normalizeMetricProgress({ current: 10, target: 10 });
    assert.equal(p.valid, true);
    assert.equal(p.percent, 100);
    assert.equal(p.visualPercent, 100);
    assert.equal(p.exceedsTarget, false);
});

test('normalizeMetricProgress: above target clamps visual bar at 100%', () => {
    const rt = setup();
    const p = rt.normalizeMetricProgress({ current: 15, target: 10 });
    assert.equal(p.valid, true);
    assert.equal(p.percent, 150);
    assert.equal(p.visualPercent, 100);
    assert.equal(p.exceedsTarget, true);
});

test('normalizeMetricProgress: zero target avoids percentage', () => {
    const rt = setup();
    const zero = rt.normalizeMetricProgress({ current: 5, target: 0 });
    assert.equal(zero.valid, false);
    assert.equal(zero.percent, null);
    assert.equal(zero.visualPercent, 0);
    assert.equal(zero.target, 0);

    const withPct = rt.normalizeMetricProgress({ current: 5, target: 0, percent: 40 });
    assert.equal(withPct.valid, false);
    assert.equal(withPct.percent, null);
});

test('normalizeMetricProgress: missing values', () => {
    const rt = setup();
    assert.equal(rt.normalizeMetricProgress({}).valid, false);
    assert.equal(rt.normalizeMetricProgress({ current: null, target: 10 }).valid, false);
    assert.equal(rt.normalizeMetricProgress({ current: 5, target: null }).valid, false);
    assert.equal(rt.normalizeMetricProgress({ current: '', target: '' }).valid, false);
    assert.equal(rt.normalizeMetricProgress({ percent: Number.NaN }).valid, false);
});

test('formatMetricProgressPair keeps current / target visible', () => {
    const rt = setup();
    assert.equal(rt.formatMetricProgressPair('2.4 g', '3 g'), '2.4 g / 3 g');
    assert.equal(rt.formatMetricProgressPair(null, '3 g'), '— / 3 g');
});

test('renderMetricProgressCell keeps value and clamps bar when over target', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    data.settings.showInCellProgressBars = true;
    rt.setTargetLinesEnabled(false, data);
    rt.__setTestAppData(data);

    const html = rt.renderMetricProgressCell('2.4 g / 3 g', {
        current: 2.4,
        target: 3,
        data
    });
    assert.match(html, /2\.4 g \/ 3 g/);
    assert.match(html, /metric-progress-fill/);
    assert.match(html, /width:80%/);
    assert.match(html, />80%</);
    assert.match(html, /metric-progress-target-marker/);

    const over = rt.renderMetricProgressCell('15 / 10', {
        current: 15,
        target: 10,
        data
    });
    assert.match(over, /15 \/ 10/);
    assert.match(over, /width:100%/);
    assert.match(over, />150%/);
    assert.match(over, /data-exceeds-target="true"/);
    assert.match(over, /metric-progress-target-marker/);
    assert.match(over, /left:66\.7%/);
});

test('progress bars can be turned off', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    data.settings.showInCellProgressBars = false;
    rt.setTargetLinesEnabled(false, data);
    rt.__setTestAppData(data);

    const html = rt.renderMetricProgressCell('2.4 g / 3 g', {
        current: 2.4,
        target: 3,
        data
    });
    assert.equal(html, '2.4 g / 3 g');
    assert.equal(rt.isInCellProgressBarsEnabled(data), false);

    rt.setInCellProgressBarsEnabled(true, data);
    assert.equal(rt.isInCellProgressBarsEnabled(data), true);
    assert.equal(data.settings.showInCellProgressBars, true);
});

test('rule-based colors tint the fill; no invented labels', () => {
    const rt = setup();
    const data = rt.__getTestAppData();
    rt.setTargetLinesEnabled(false, data);
    rt.ensureConditionalColorRules(data);
    const ccr = rt.evaluateInventoryColors(15, { section: 'inventory' });
    assert.ok(ccr.matched.length >= 1);

    const fill = rt.getMetricProgressFillStyle(ccr);
    assert.match(fill, /background:/);

    const html = rt.renderMetricProgressCell('15%', {
        current: 15,
        target: 100,
        percent: 15,
        ccrResult: ccr,
        data
    });
    assert.match(html, /background:/);
    assert.doesNotMatch(html, /ccr-status-label/);
    const neutral = rt.renderMetricProgressBar(rt.normalizeMetricProgress({ current: 50, target: 100 }), {});
    assert.doesNotMatch(neutral, /background:#|background:rgb/);
    assert.match(neutral, /width:50%/);
});

test('light and dark themes style metric progress tracks', () => {
    const css = readFileSync(join(root, 'styles.css'), 'utf8');
    assert.match(css, /\[data-theme="light"\][\s\S]*?\.metric-progress-track\.rd-progress/);
    assert.match(css, /\[data-theme="dark"\][\s\S]*?\.metric-progress-track\.rd-progress/);
    assert.match(css, /:root\[data-theme="light"\][\s\S]*?\.metric-progress-fill\.rd-progress-fill/);
    assert.match(css, /\.metric-progress-fill\.rd-progress-fill\s*\{[^}]*var\(--text-secondary/);

    const rt = setup();
    const data = rt.__getTestAppData();
    rt.setTargetLinesEnabled(false, data);
    const html = rt.renderMetricProgressCell('80%', { current: 80, target: 100, data });
    assert.match(html, /metric-progress-track/);
    assert.match(html, /metric-progress-fill/);
    assert.doesNotMatch(html, /data-theme=/);
});

test('default setting enables in-cell progress bars', () => {
    const rt = setup();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    assert.equal(data.settings.showInCellProgressBars, true);
    assert.equal(rt.isInCellProgressBarsEnabled(data), true);
});
