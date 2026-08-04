import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    rt.persistConditionalColorRulesState({ rules: [] });
    // Use a dedicated isolated set via persist of custom rules only for range tests.
    return rt;
}

function setupClean() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: []
    });
    const state = rt.ensureConditionalColorRules(data);
    state.rules = [];
    rt.persistConditionalColorRulesState({ rules: [] }, data);
    // Force empty without re-seed: write directly
    data.settings.conditionalColorRules = { enabled: true, version: 1, rules: [] };
    return rt;
}

test('quick color presets include rainbow named colors', () => {
    const rt = setup();
    const ids = rt.CCR_QUICK_COLOR_PRESETS.map(p => p.id);
    assert.equal(ids.join('|'), [
        'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan',
        'blue', 'purple', 'pink', 'gray', 'white', 'black'
    ].join('|'));
    assert.match(rt.hslToHexColor(0), /^#[0-9a-f]{6}$/);
    assert.match(rt.hslToHexColor(120), /^#[0-9a-f]{6}$/);
});

test('between inclusive and exclusive boundaries', () => {
    const rt = setup();
    const base = {
        id: 'r',
        name: 't',
        enabled: true,
        substanceScope: 'all',
        sectionScope: ['all'],
        metric: 'useAmount',
        colors: { background: '#111', text: '#eee', border: '#0f0' },
        priority: 10
    };
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', value: 1, valueTo: 2 }, { value: 1 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', value: 1, valueTo: 2 }, { value: 2 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', rangeBoundary: 'inclusiveExclusive', value: 1, valueTo: 2 }, { value: 1 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', rangeBoundary: 'inclusiveExclusive', value: 1, valueTo: 2 }, { value: 2 }), false);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', rangeBoundary: 'exclusiveInclusive', value: 1, valueTo: 2 }, { value: 1 }), false);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'between', rangeBoundary: 'exclusiveInclusive', value: 1, valueTo: 2 }, { value: 2 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'betweenExclusive', value: 1, valueTo: 2 }, { value: 1 }), false);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'betweenExclusive', value: 1, valueTo: 2 }, { value: 1.5 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'betweenExclusive', value: 1, valueTo: 2 }, { value: 2 }), false);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'gte', value: 2 }, { value: 2 }), true);
    assert.equal(rt.compareConditionalColorRule({ ...base, operator: 'gt', value: 2 }, { value: 2 }), false);
});

test('adjacent non-overlapping ranges are not conflicts; overlapping ranges are', () => {
    const rt = setupClean();
    const green = rt.normalizeConditionalColorRule({
        id: 'g',
        name: '0-1 green',
        metric: 'useAmount',
        operator: 'between',
        rangeBoundary: 'inclusiveExclusive',
        value: 0,
        valueTo: 1,
        sectionScope: ['dashboard'],
        substanceScope: 'all',
        colors: { background: '#4caf50', text: '#fff', border: '#4caf50' }
    });
    const yellow = rt.normalizeConditionalColorRule({
        id: 'y',
        name: '1-2 yellow',
        metric: 'useAmount',
        operator: 'betweenExclusive',
        value: 1,
        valueTo: 2,
        sectionScope: ['dashboard'],
        substanceScope: 'all',
        colors: { background: '#ffeb3b', text: '#000', border: '#ffeb3b' }
    });
    const orange = rt.normalizeConditionalColorRule({
        id: 'o',
        name: '2-3 orange',
        metric: 'useAmount',
        operator: 'between',
        rangeBoundary: 'inclusiveExclusive',
        value: 2,
        valueTo: 3,
        sectionScope: ['dashboard'],
        substanceScope: 'all',
        statusLabel: '',
        colors: { background: '#ff9800', text: '#000', border: '#ff9800' }
    });
    const red = rt.normalizeConditionalColorRule({
        id: 'r',
        name: '>3 red',
        metric: 'useAmount',
        operator: 'gt',
        value: 3,
        sectionScope: ['dashboard'],
        substanceScope: 'all',
        colors: { background: '#f44336', text: '#fff', border: '#f44336' }
    });

    let conflicts = rt.detectConditionalColorRuleConflicts([green, yellow, orange, red]);
    assert.equal((conflicts.g || []).length, 0);
    assert.equal((conflicts.y || []).length, 0);
    assert.equal((conflicts.o || []).length, 0);
    assert.equal((conflicts.r || []).length, 0);

    // Inclusive 0-1 and inclusive 1-2 share boundary 1 → conflict
    const yellowInclusive = rt.normalizeConditionalColorRule({
        ...yellow,
        id: 'yi',
        operator: 'between',
        rangeBoundary: 'inclusive',
        value: 1,
        valueTo: 2
    });
    const greenInclusive = rt.normalizeConditionalColorRule({
        ...green,
        id: 'gi',
        rangeBoundary: 'inclusive'
    });
    conflicts = rt.detectConditionalColorRuleConflicts([greenInclusive, yellowInclusive]);
    assert.ok(conflicts.gi.some(r => r.id === 'yi'));
    assert.match(conflicts.gi[0].message, /value 1/);
});

test('multiple range rules for same metric evaluate by priority', () => {
    const rt = setupClean();
    dataRules(rt, [
        {
            id: 'low',
            name: 'Low',
            metric: 'useAmount',
            operator: 'between',
            value: 0,
            valueTo: 1,
            priority: 10,
            sectionScope: ['all'],
            colors: { background: '#4caf50', text: '#fff', border: '#4caf50' },
            statusLabel: ''
        },
        {
            id: 'high',
            name: 'High',
            metric: 'useAmount',
            operator: 'gt',
            value: 3,
            priority: 40,
            sectionScope: ['all'],
            colors: { background: '#f44336', text: '#fff', border: '#f44336' },
            statusLabel: ''
        }
    ]);
    const low = rt.evaluateConditionalColorRules({ metric: 'useAmount', section: 'dashboard', value: 0.5 });
    assert.equal(low.matched[0].id, 'low');
    assert.equal(low.style.background, '#4caf50');
    assert.equal(low.labels.length, 0);
    const high = rt.evaluateConditionalColorRules({ metric: 'useAmount', section: 'dashboard', value: 4 });
    assert.equal(high.matched[0].id, 'high');
});

function dataRules(rt, rules) {
    const data = rt.__getTestAppData();
    data.settings.conditionalColorRules = {
        enabled: true,
        version: 1,
        rules: rules.map((r, i) => rt.normalizeConditionalColorRule(r, i))
    };
}

test('sort by range lower bound', () => {
    const rt = setupClean();
    const rules = [
        rt.normalizeConditionalColorRule({ id: 'c', name: 'C', metric: 'useAmount', operator: 'gt', value: 3, priority: 1 }),
        rt.normalizeConditionalColorRule({ id: 'a', name: 'A', metric: 'useAmount', operator: 'between', value: 0, valueTo: 1, priority: 9 }),
        rt.normalizeConditionalColorRule({ id: 'b', name: 'B', metric: 'useAmount', operator: 'betweenExclusive', value: 1, valueTo: 2, priority: 5 })
    ];
    const sorted = rt.filterAndSortConditionalColorRules(rules, { sort: 'rangeLower', sortDir: 'asc' });
    assert.equal(sorted.map(r => r.id).join(','), 'a,b,c');
});

test('build next range drafts use recommended inclusive-lower exclusive-upper continuation', () => {
    const rt = setup();
    const src = rt.normalizeConditionalColorRule({
        id: 'src',
        name: 'Use Amount',
        metric: 'useAmount',
        operator: 'between',
        rangeBoundary: 'inclusiveExclusive',
        value: 0,
        valueTo: 1,
        sectionScope: ['dashboard'],
        substanceScope: 'all',
        colors: { background: '#4caf50', text: '#fff', border: '#4caf50' },
        statusLabel: 'should clear'
    });
    const next = rt.buildNextCcrRangeDraft(src);
    assert.equal(next.statusLabel, '');
    assert.equal(next.operator, 'between');
    assert.equal(next.rangeBoundary, 'inclusiveExclusive');
    assert.equal(Number(next.value), 1);
    assert.ok(Number(next.valueTo) > 1);
    assert.equal(next.metric, 'useAmount');
    assert.deepEqual(next.sectionScope, ['dashboard']);
    assert.equal(next.colors.background, '#4caf50');
});

test('range visualizer renders sibling ranges', () => {
    const rt = setupClean();
    dataRules(rt, [
        {
            id: 'a',
            name: 'Green',
            metric: 'useAmount',
            operator: 'between',
            value: 0,
            valueTo: 1,
            sectionScope: ['all'],
            colors: { background: '#4caf50', text: '#fff', border: '#4caf50' }
        },
        {
            id: 'b',
            name: 'Yellow',
            metric: 'useAmount',
            operator: 'betweenExclusive',
            value: 1,
            valueTo: 2,
            sectionScope: ['all'],
            colors: { background: '#ffeb3b', text: '#000', border: '#ffeb3b' }
        }
    ]);
    const siblings = rt.getCcrSiblingRangeRules(rt.getConditionalColorRules()[0]);
    assert.equal(siblings.length, 2);
    const html = rt.renderCcrRangeVisualizer(siblings);
    assert.match(html, /ccr-range-visualizer/);
    assert.match(html, /0────1/);
    assert.match(html, /Green/);
    assert.match(html, /Yellow/);
});
