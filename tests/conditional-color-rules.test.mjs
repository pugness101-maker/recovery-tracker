import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    return rt;
}

test('seeds editable default presets', () => {
    const rt = setup();
    const presets = rt.getConditionalColorPresetRules('dark');
    const names = presets.map(p => p.name);
    assert.equal(names.join('|'), [
        'On Track',
        'Near Limit',
        'Over Limit',
        'Low Inventory',
        'Depleted',
        'High Spending',
        'Below Taper Plan',
        'Taper Warning',
        'Recovery Streak',
        'Gift Given',
        'Gift Received'
    ].join('|'));
    const state = rt.getConditionalColorRulesState();
    assert.equal(state.enabled, true);
    assert.ok(state.rules.length >= 11);
});

test('comparisons: eq/neq/gt/lt/between/contains/empty/boolean/pct/daysSince', () => {
    const rt = setup();
    const base = {
        id: 'r1',
        name: 't',
        enabled: true,
        substanceScope: 'all',
        sectionScope: ['all'],
        metric: 'useAmount',
        colors: { background: '#111', text: '#eee', border: '#0f0' },
        priority: 10
    };

    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'eq', value: 5 }, { value: 5 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'neq', value: 5 }, { value: 4 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'gt', value: 3 }, { value: 4 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'lt', value: 3 }, { value: 2 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', value: 2, valueTo: 4 }, { value: 3 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', value: 2, valueTo: 4 }, { value: 5 }), false);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'contains', value: 'vape' }, { textValue: 'Vape cart' }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'empty' }, { value: null }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'notEmpty' }, { value: 1 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'true' }, { value: true }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'false' }, { value: false }), true);
    assert.equal(rt.compareConditionalColorRule({
        ...base, operator: 'pctAboveTarget', value: 10, targetValue: 100
    }, { value: 120, target: 100 }), true);
    assert.equal(rt.compareConditionalColorRule({
        ...base, operator: 'pctBelowTarget', value: 25, targetValue: 100
    }, { value: 70, target: 100 }), true);
    assert.equal(rt.compareConditionalColorRule({
        ...base, operator: 'daysSince', value: 3
    }, { value: 5 }), true);
});

test('invalid and missing values are ignored safely', () => {
    const rt = setup();
    const rule = rt.normalizeConditionalColorRule({
        name: 'broken',
        metric: 'not-a-metric',
        operator: 'not-an-op',
        value: 'x'
    });
    assert.equal(rule.metric, 'useAmount');
    assert.equal(rule.operator, 'gt');

    const result = rt.evaluateConditionalColorRules({
        section: 'insights',
        metric: 'useAmount',
        value: undefined
    });
    assert.equal(result.matched.length, 0);

    assert.equal(rt.compareConditionalColorRule({
        id: 'x',
        enabled: true,
        operator: 'gt',
        value: 1,
        metric: 'useAmount',
        colors: { background: '#000', text: '#fff', border: '#000' },
        priority: 1,
        substanceScope: 'all',
        sectionScope: ['all']
    }, { value: 'not-a-number' }), false);
});

test('substance and section scope filter matches', () => {
    const rt = setup();
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'only-coke',
                name: 'Coke only',
                substanceScope: 'coke',
                sectionScope: ['insights'],
                metric: 'useAmount',
                operator: 'gt',
                value: 0,
                priority: 50,
                colors: { background: '#f00', text: '#fff', border: '#f00' },
                statusLabel: 'Coke hit'
            })
        ]
    });

    const missSection = rt.evaluateConditionalColorRules({
        substanceId: 'coke',
        section: 'calendar',
        metric: 'useAmount',
        value: 2
    });
    assert.equal(missSection.matched.length, 0);

    const missSubstance = rt.evaluateConditionalColorRules({
        substanceId: 'weed',
        section: 'insights',
        metric: 'useAmount',
        value: 2
    });
    assert.equal(missSubstance.matched.length, 0);

    const hit = rt.evaluateConditionalColorRules({
        substanceId: 'coke',
        section: 'insights',
        metric: 'useAmount',
        value: 2
    });
    assert.equal(hit.matched.length, 1);
    assert.equal(hit.labels[0], 'Coke hit');
});

test('priority and stop-processing override lower rules', () => {
    const rt = setup();
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'low',
                name: 'Low',
                metric: 'useAmount',
                operator: 'gt',
                value: 0,
                priority: 10,
                stopProcessing: false,
                colors: { background: 'red', text: '#fff', border: 'red' },
                statusLabel: 'Low',
                sectionScope: ['all'],
                substanceScope: 'all'
            }),
            rt.normalizeConditionalColorRule({
                id: 'high',
                name: 'High',
                metric: 'useAmount',
                operator: 'gt',
                value: 0,
                priority: 99,
                stopProcessing: true,
                colors: { background: 'blue', text: '#fff', border: 'blue' },
                statusLabel: 'High',
                sectionScope: ['all'],
                substanceScope: 'all'
            })
        ]
    });
    const result = rt.evaluateConditionalColorRules({
        metric: 'useAmount',
        section: 'dashboard',
        value: 5
    });
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].id, 'high');
    assert.equal(result.style.background, 'blue');
    assert.equal(result.labels[0], 'High');
});

test('usage vs target presets keep visible labels', () => {
    const rt = setup();
    const over = rt.getUsageVsTargetBadge(12, 10);
    assert.equal(over.level, 'risk');
    assert.match(over.label, /Over/i);
    assert.ok(over.ccrResult?.matched?.length >= 1);

    const near = rt.getUsageVsTargetBadge(8, 10);
    assert.ok(['caution', 'high'].includes(near.level));
    assert.match(near.label, /Near/i);

    const good = rt.getUsageVsTargetBadge(2, 10);
    assert.equal(good.level, 'good');
    assert.match(good.label, /On track/i);
});

test('inventory and taper helpers evaluate without mutating data', () => {
    const rt = setup();
    const before = JSON.stringify(rt.__getTestAppData().logs);
    const low = rt.evaluateInventoryColors(20, { section: 'inventory' });
    assert.ok(low.matched.some(r => /Low inventory|Depleted/i.test(r.statusLabel || r.name)));
    const depleted = rt.evaluateInventoryColors(0, { section: 'inventory' });
    assert.ok(depleted.labels.some(l => /Depleted/i.test(l)));
    const taper = rt.evaluateTaperColors(10, 12, 'over', { section: 'taper' });
    assert.ok(taper.matched.length >= 1);
    assert.equal(JSON.stringify(rt.__getTestAppData().logs), before);
});

test('persistence, export/import, and CRUD', () => {
    const rt = setup();
    const saved = rt.saveConditionalColorRule({
        name: 'Custom spend',
        metric: 'spend',
        operator: 'gt',
        value: 50,
        priority: 70,
        statusLabel: 'Watch spend',
        colors: { background: '#300', text: '#f99', border: '#f00' },
        sectionScope: ['spending'],
        substanceScope: 'all'
    });
    assert.ok(saved.id);

    rt.setConditionalColorRuleEnabled(saved.id, false);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === saved.id).enabled, false);

    const dup = rt.duplicateConditionalColorRule(saved.id);
    assert.ok(dup.id !== saved.id);
    assert.match(dup.name, /copy/i);

    const json = rt.exportConditionalColorRulesJson();
    assert.match(json, /recovery-tracker-conditional-color-rules/);

    rt.deleteConditionalColorRule(saved.id);
    assert.equal(rt.getConditionalColorRules().some(r => r.id === saved.id), false);

    rt.importConditionalColorRulesJson(json, rt.__getTestAppData(), { replace: true });
    assert.ok(rt.getConditionalColorRules().some(r => r.name === 'Custom spend'));

    rt.saveData(rt.__getTestAppData());
    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.ok(reloaded.settings.conditionalColorRules);
    assert.ok(Array.isArray(reloaded.settings.conditionalColorRules.rules));
    assert.ok(reloaded.settings.conditionalColorRules.rules.length >= 1);
});

test('contrast warning and theme text overrides', () => {
    const rt = setup();
    const bad = rt.getContrastWarning('#ffff00', '#ffffff');
    assert.equal(bad.ok, false);
    const good = rt.getContrastWarning('#000000', '#ffffff');
    assert.equal(good.ok, true);

    const dark = rt.getConditionalColorPresetRules('dark');
    const light = rt.getConditionalColorPresetRules('light');
    assert.notEqual(dark[0].colors.text, light[0].colors.text);
});

test('optional status labels: empty label colors without injecting rule names', () => {
    const rt = setup();
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'color-only',
                name: 'Untitled rule',
                statusLabel: '',
                metric: 'useAmount',
                operator: 'gt',
                value: 0,
                priority: 50,
                sectionScope: ['all'],
                substanceScope: 'all',
                colors: { background: '#222', text: '#0f0', border: '#0f0' }
            })
        ]
    });
    const result = rt.evaluateConditionalColorRules({
        metric: 'useAmount',
        section: 'useHistory',
        value: 3
    });
    assert.equal(result.matched.length, 1);
    assert.equal(result.labels.length, 0);
    assert.ok(result.style);
    assert.equal(result.style.text, '#00ff00');
    const html = rt.wrapWithConditionalColor('12.5 g', result, { keepLabel: true });
    assert.match(html, /12\.5 g/);
    assert.doesNotMatch(html, /Untitled rule/);
    assert.doesNotMatch(html, /ccr-status-label/);

    const saved = rt.saveConditionalColorRule({
        name: 'No label rule',
        statusLabel: '',
        metric: 'spend',
        operator: 'gt',
        value: 1,
        priority: 40,
        sectionScope: ['spending'],
        substanceScope: 'all',
        colors: { background: '#111', text: '#fff', border: '#fff' }
    });
    assert.equal(saved.statusLabel, '');
    assert.equal(rt.renderConditionalColorLabels(result), '');
});

test('disabled engine returns no styles', () => {
    const rt = setup();
    rt.setConditionalColorRulesEnabled(false);
    const result = rt.evaluateConditionalColorRules({
        metric: 'useVsTarget',
        section: 'status',
        value: 1.5,
        target: 1
    });
    assert.equal(result.matched.length, 0);
    assert.equal(result.style, null);
});
