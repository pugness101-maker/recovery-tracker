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

test('parseCssColor accepts hex, rgb, and rgba forms', () => {
    const rt = setup();
    const short = rt.parseCssColor('#0f0');
    assert.equal(short.r, 0);
    assert.equal(short.g, 255);
    assert.equal(short.b, 0);
    assert.equal(short.a, 1);

    const hex = rt.parseCssColor('#4caf50');
    assert.equal(hex.r, 76);
    assert.equal(hex.g, 175);
    assert.equal(hex.b, 80);
    assert.equal(hex.a, 1);

    assert.equal(Math.round(rt.parseCssColor('#4caf5038').a * 100), 22);

    const rgb = rt.parseCssColor('rgb(10, 20, 30)');
    assert.equal(rgb.r, 10);
    assert.equal(rgb.g, 20);
    assert.equal(rgb.b, 30);
    assert.equal(rgb.a, 1);

    const rgba = rt.parseCssColor('rgba(76, 175, 80, 0.22)');
    assert.equal(rgba.r, 76);
    assert.equal(rgba.g, 175);
    assert.equal(rgba.b, 80);
    assert.equal(rgba.a, 0.22);

    assert.equal(rt.parseCssColor('rgba(76, 175, 80, 50%)').a, 0.5);
    assert.equal(rt.parseCssColor('not-a-color'), null);
    assert.equal(rt.parseCssColor(''), null);
});

test('picker compose preserves opacity and formats hex at 100%', () => {
    const rt = setup();
    assert.equal(rt.composeCcrBackgroundFromPicker('#4caf50', 100), '#4caf50');
    assert.equal(rt.composeCcrBackgroundFromPicker('#4caf50', 22), 'rgba(76, 175, 80, 0.22)');
    assert.equal(rt.composeCcrBackgroundFromPicker('#ff0000', 0), 'rgba(255, 0, 0, 0)');
    const parts = rt.parseCssColor('#abc');
    assert.equal(rt.formatCssColorFromParts({ ...parts, a: 1 }), '#aabbcc');
});

test('validateCcrBackgroundColor allows empty and rejects invalid', () => {
    const rt = setup();
    assert.equal(rt.validateCcrBackgroundColor('').ok, true);
    assert.equal(rt.validateCcrBackgroundColor('').value, '');
    assert.equal(rt.validateCcrBackgroundColor('#4caf50').ok, true);
    assert.equal(rt.validateCcrBackgroundColor('rgba(1,2,3,0.5)').ok, true);
    assert.equal(rt.validateCcrBackgroundColor('nope').ok, false);
    assert.match(rt.validateCcrBackgroundColor('nope').message, /Invalid background color/);
});

test('empty background is preserved and does not apply override', () => {
    const rt = setup();
    const rule = rt.normalizeConditionalColorRule({
        id: 'bg-empty',
        name: 'Text only',
        metric: 'useAmount',
        operator: 'gt',
        value: 0,
        colors: { background: '', text: '#ffffff', border: '#ff0000' }
    });
    assert.equal(rule.colors.background, '');
    assert.notEqual(rule.colors.background, 'rgba(76, 175, 80, 0.22)');

    rt.persistConditionalColorRulesState({ enabled: true, rules: [rule] });
    const result = rt.evaluateConditionalColorRules({
        metric: 'useAmount',
        section: 'dashboard',
        value: 5
    });
    assert.equal(result.matched.length, 1);
    assert.equal(result.style.background, '');
    assert.equal(result.style.text, '#ffffff');
    assert.equal(result.style.border, '#ff0000');
    const css = rt.buildConditionalColorInlineStyle(result);
    assert.doesNotMatch(css, /background:/);
    assert.match(css, /color:#ffffff/);
    assert.match(css, /border:1px solid #ff0000/);
});

test('saved rgba background applies to matched evaluations', () => {
    const rt = setup();
    const saved = rt.saveConditionalColorRule({
        id: 'bg-rgba',
        name: 'Soft green',
        metric: 'spend',
        operator: 'gt',
        value: 10,
        sectionScope: ['spending'],
        colors: {
            background: 'rgba(76, 175, 80, 0.22)',
            text: '#81c784',
            border: '#4caf50'
        }
    });
    assert.equal(saved.colors.background, 'rgba(76, 175, 80, 0.22)');
    const result = rt.evaluateConditionalColorRules({
        metric: 'spend',
        section: 'spending',
        value: 50
    });
    assert.ok(result.matched.some(r => r.id === saved.id));
    assert.equal(result.style.background, 'rgba(76, 175, 80, 0.22)');
    assert.match(rt.buildConditionalColorInlineStyle(result), /background:rgba\(76, 175, 80, 0\.22\)/);
});

test('missing and explicit empty background keys do not create fallback colors', () => {
    const rt = setup();
    const legacy = rt.normalizeConditionalColorRule({
        name: 'Legacy',
        metric: 'useAmount',
        operator: 'gt',
        value: 1,
        colors: { text: '#fff', border: '#000' }
    });
    assert.equal(legacy.colors.background, '');
    const empty = rt.normalizeConditionalColorRule({
        name: 'Empty',
        metric: 'useAmount',
        operator: 'gt',
        value: 1,
        colors: { background: '', text: '#fff', border: '#000' }
    });
    assert.equal(empty.colors.background, '');
});

test('dark and light presets keep usable background colors', () => {
    const rt = setup();
    const dark = rt.getConditionalColorPresetRules('dark');
    const light = rt.getConditionalColorPresetRules('light');
    assert.ok(dark.every(r => rt.validateCcrBackgroundColor(r.colors.background).ok));
    assert.ok(light.every(r => rt.validateCcrBackgroundColor(r.colors.background).ok));
    assert.ok(dark[0].colors.background);
    assert.ok(light[0].colors.background);
    // Theme text can differ; backgrounds should still parse in both themes.
    assert.ok(rt.parseCssColor(dark[0].colors.background));
    assert.ok(rt.parseCssColor(light[0].colors.background));
});
