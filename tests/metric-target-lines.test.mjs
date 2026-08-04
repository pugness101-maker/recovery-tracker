import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.ensureTargetLinePrefs(data);
    return { rt, data };
}

test('target line below target (lower-is-better)', () => {
    const { rt } = setup();
    const tl = rt.buildMetricTargetLine({
        current: 1.6,
        target: 2,
        unit: 'g',
        metricKind: 'use'
    });
    assert.equal(tl.tone, 'favorable');
    assert.equal(tl.direction, 'lowerIsBetter');
    assert.ok(Math.abs(tl.percent - 80) < 0.01);
    assert.equal(tl.differenceDisplay.startsWith('−') || tl.differenceDisplay.startsWith('-'), true);
    assert.match(tl.percentDisplay, /80% of target/);
    assert.match(tl.currentDisplay, /1\.6/);
    assert.match(tl.targetDisplay, /2/);
});

test('target line equal to target', () => {
    const { rt } = setup();
    const tl = rt.buildMetricTargetLine({
        current: 2,
        target: 2,
        unit: 'g',
        metricKind: 'taper'
    });
    assert.equal(tl.tone, 'favorable');
    assert.equal(tl.percent, 100);
    assert.match(tl.percentDisplay, /100% of target/);
});

test('target line above target (lower-is-better) is unfavorable', () => {
    const { rt } = setup();
    const tl = rt.buildMetricTargetLine({
        current: 2.4,
        target: 2,
        unit: 'g',
        metricKind: 'use',
        currentLabel: '2.4 g',
        targetLabel: '2.0 g'
    });
    assert.equal(tl.tone, 'unfavorable');
    assert.equal(tl.percent, 120);
    assert.equal(tl.currentDisplay, '2.4 g');
    assert.equal(tl.targetDisplay, '2.0 g');
    assert.match(tl.differenceDisplay, /^\+/);
    assert.match(tl.differenceDisplay, /0\.4/);
    assert.equal(tl.percentDisplay, '120% of target');

    const html = rt.renderMetricTargetLine(tl, { showBar: false });
    assert.match(html, /Current:/);
    assert.match(html, /Target:/);
    assert.match(html, /Difference:/);
    assert.match(html, /120% of target/);
    assert.doesNotMatch(html, /ccr-status-label/);
});

test('higher-is-better metrics favor values above target', () => {
    const { rt } = setup();
    const under = rt.buildMetricTargetLine({
        current: 3,
        target: 7,
        unit: 'days',
        metricKind: 'streak'
    });
    assert.equal(under.direction, 'higherIsBetter');
    assert.equal(under.tone, 'unfavorable');

    const over = rt.buildMetricTargetLine({
        current: 10,
        target: 7,
        unit: 'days',
        metricKind: 'vapeLifespan'
    });
    assert.equal(over.tone, 'favorable');

    const nic = rt.buildMetricTargetLine({
        current: 12,
        target: 8,
        unit: 'h',
        metricKind: 'nicotineFreeHours'
    });
    assert.equal(nic.tone, 'favorable');
});

test('lower-is-better metrics favor values below target', () => {
    const { rt } = setup();
    const spend = rt.buildMetricTargetLine({
        current: 40,
        target: 50,
        metricKind: 'spend'
    });
    assert.equal(spend.tone, 'favorable');

    const buys = rt.buildMetricTargetLine({
        current: 3,
        target: 2,
        metricKind: 'purchaseCount'
    });
    assert.equal(buys.tone, 'unfavorable');

    const strength = rt.buildMetricTargetLine({
        current: 3,
        target: 6,
        metricKind: 'nicotineStrength'
    });
    assert.equal(strength.tone, 'favorable');
});

test('inventory remaining stays neutral without custom rules', () => {
    const { rt } = setup();
    const tl = rt.buildMetricTargetLine({
        current: 1,
        target: 5,
        metricKind: 'inventory'
    });
    assert.equal(tl.direction, 'neutral');
    assert.equal(tl.tone, 'neutral');
});

test('zero target avoids percentage; still shows current and target', () => {
    const { rt } = setup();
    const tl = rt.buildMetricTargetLine({
        current: 5,
        target: 0,
        unit: 'g',
        metricKind: 'use'
    });
    assert.equal(tl.percent, null);
    assert.equal(tl.percentDisplay, '—');
    assert.notEqual(tl.currentDisplay, '—');
    assert.equal(tl.targetDisplay, '0 g');
});

test('missing target or current shows em dash', () => {
    const { rt } = setup();
    const missingTarget = rt.buildMetricTargetLine({
        current: 2.4,
        target: null,
        unit: 'g'
    });
    assert.equal(missingTarget.targetDisplay, '—');
    assert.equal(missingTarget.percentDisplay, '—');
    assert.equal(missingTarget.differenceDisplay, '—');
    assert.equal(missingTarget.tone, 'missing');

    const missingCurrent = rt.buildMetricTargetLine({
        current: null,
        target: 2,
        unit: 'g'
    });
    assert.equal(missingCurrent.currentDisplay, '—');
    assert.equal(missingCurrent.tone, 'missing');
});

test('target marker placement sits inside the bar range', () => {
    const { rt } = setup();
    const below = rt.normalizeMetricProgress({ current: 2.4, target: 3 });
    assert.equal(below.targetMarkerPercent, 100);
    assert.equal(below.fillPercent, 80);

    const above = rt.normalizeMetricProgress({ current: 15, target: 10 });
    assert.ok(Math.abs(above.targetMarkerPercent - (10 / 15) * 100) < 0.05);
    assert.equal(above.fillPercent, 100);
    assert.equal(above.percent, 150);

    const bar = rt.renderMetricProgressBar(above, { showPercent: true });
    assert.match(bar, /metric-progress-target-marker/);
    assert.match(bar, /left:66\.7%/);
    assert.match(bar, /data-has-target-marker="true"/);
    assert.match(bar, />150%</);
});

test('rule-based color overrides default tones by scope', () => {
    const { rt, data } = setup();
    rt.ensureConditionalColorRules(data);
    rt.setTargetLineColorScope('difference', data);
    const tl = rt.buildMetricTargetLine({
        current: 120,
        target: 100,
        metricKind: 'spend'
    });
    assert.equal(tl.tone, 'unfavorable');

    const defaults = rt.resolveMetricTargetLineColors(tl, null, 'difference', data);
    assert.ok(defaults.difference);
    assert.match(defaults.difference.fill || defaults.difference.text || '', /#|rgb|rgba/);

    const ccr = {
        matched: [{ id: 'custom' }],
        style: { background: '#112233', text: '#abcdef', border: '#445566' },
        labels: []
    };
    const overridden = rt.resolveMetricTargetLineColors(tl, ccr, 'difference', data);
    assert.equal(overridden.hasCustomRule, true);
    assert.equal(overridden.difference.background, '#112233');
    assert.equal(overridden.difference.text, '#abcdef');

    const html = rt.renderMetricTargetLine(tl, {
        ccrResult: ccr,
        colorScope: 'difference',
        data,
        showBar: false
    });
    assert.match(html, /#112233|#abcdef/);
    assert.doesNotMatch(html, /ccr-status-label/);
});

test('export/import persists target-line preferences', () => {
    const { rt, data } = setup();
    rt.setTargetLinesEnabled(false, data);
    rt.setTargetLineColorScope('percentage', data);
    assert.equal(data.settings.showTargetLines, false);
    assert.equal(data.settings.targetLineColorScope, 'percentage');
    assert.equal(data.settings.targetLinePrefs.enabled, false);
    assert.equal(data.settings.targetLinePrefs.colorScope, 'percentage');

    const exported = rt.cleanExportData(data);
    assert.equal(exported.settings.showTargetLines, false);
    assert.equal(exported.settings.targetLineColorScope, 'percentage');
    assert.equal(exported.settings.targetLinePrefs.colorScope, 'percentage');

    const restored = rt.normalizeAppDataSafe({
        ...makeTestData([]),
        settings: {
            ...makeTestData([]).settings,
            ...exported.settings
        }
    });
    rt.ensureTargetLinePrefs(restored);
    assert.equal(restored.settings.targetLinePrefs.enabled, false);
    assert.equal(restored.settings.targetLinePrefs.colorScope, 'percentage');
    assert.equal(rt.isTargetLinesEnabled(restored), false);
    assert.equal(rt.getTargetLineColorScope(restored), 'percentage');
});

test('renderMetricProgressCell uses target lines when enabled', () => {
    const { rt, data } = setup();
    rt.setTargetLinesEnabled(true, data);
    rt.setInCellProgressBarsEnabled(true, data);
    const html = rt.renderMetricProgressCell('pair', {
        current: 2.4,
        target: 2,
        unit: 'g',
        metricKind: 'use',
        currentLabel: '2.4 g',
        targetLabel: '2.0 g',
        data
    });
    assert.match(html, /metric-target-line/);
    assert.match(html, /Current:/);
    assert.match(html, /2\.4 g/);
    assert.match(html, /Target:/);
    assert.match(html, /2\.0 g/);
    assert.match(html, /120% of target/);
    assert.match(html, /metric-progress-target-marker/);
});
