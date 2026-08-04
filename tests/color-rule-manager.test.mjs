import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    rt.setCcrManagerFilters({
        search: '',
        substance: 'all',
        section: 'all',
        metric: 'all',
        enabled: 'all',
        sort: 'priority',
        sortDir: 'desc',
        selectedIds: []
    });
    return { rt, data };
}

function addRule(rt, patch = {}) {
    return rt.saveConditionalColorRule({
        id: patch.id || `rule-${Math.random().toString(36).slice(2, 8)}`,
        name: patch.name || 'Custom',
        enabled: patch.enabled !== false,
        substanceScope: patch.substanceScope || 'all',
        sectionScope: patch.sectionScope || ['dashboard'],
        metric: patch.metric || 'useAmount',
        operator: patch.operator || 'gt',
        value: patch.value ?? 5,
        valueTo: patch.valueTo,
        priority: patch.priority ?? 50,
        colors: patch.colors || {
            background: 'rgba(0,0,0,0.2)',
            text: '#ffffff',
            border: '#000000',
            accent: '#00ff00'
        },
        statusLabel: patch.statusLabel || ''
    });
}

test('search filters rules by name and condition text', () => {
    const { rt } = setup();
    addRule(rt, { name: 'Alpha spend', metric: 'spend', value: 20 });
    addRule(rt, { name: 'Beta use', metric: 'useAmount', value: 3 });
    const all = rt.getConditionalColorRules();
    const filtered = rt.filterAndSortConditionalColorRules(all, { search: 'spend', sort: 'name', sortDir: 'asc' });
    assert.ok(filtered.some(r => /spend/i.test(r.name)));
    assert.ok(filtered.every(r => /spend|Spend|gt 20/i.test([r.name, r.metric, rt.formatCcrConditionSummary(r)].join(' '))));
});

test('filtering by substance, section, metric, and enabled', () => {
    const { rt, data } = setup();
    const sid = data.substances[0].id;
    addRule(rt, {
        name: 'Coke only',
        substanceScope: sid,
        sectionScope: ['inventory'],
        metric: 'inventoryPercent',
        operator: 'lt',
        value: 25,
        enabled: true
    });
    addRule(rt, {
        name: 'Disabled spend',
        metric: 'spend',
        enabled: false,
        sectionScope: ['spending']
    });

    const rules = rt.getConditionalColorRules();
    const bySubstance = rt.filterAndSortConditionalColorRules(rules, {
        substance: sid, section: 'all', metric: 'all', enabled: 'all', sort: 'priority', sortDir: 'desc'
    }, data);
    assert.ok(bySubstance.some(r => r.name === 'Coke only'));

    const bySection = rt.filterAndSortConditionalColorRules(rules, {
        substance: 'all', section: 'inventory', metric: 'all', enabled: 'all', sort: 'priority', sortDir: 'desc'
    });
    assert.ok(bySection.every(r => r.sectionScope.includes('all') || r.sectionScope.includes('inventory')));

    const byMetric = rt.filterAndSortConditionalColorRules(rules, {
        substance: 'all', section: 'all', metric: 'spend', enabled: 'all', sort: 'priority', sortDir: 'desc'
    });
    assert.ok(byMetric.every(r => r.metric === 'spend'));

    const disabled = rt.filterAndSortConditionalColorRules(rules, {
        substance: 'all', section: 'all', metric: 'all', enabled: 'disabled', sort: 'priority', sortDir: 'desc'
    });
    assert.ok(disabled.every(r => !r.enabled));
});

test('sorting by priority, name, metric, substance, lastModified', () => {
    const { rt, data } = setup();
    const a = addRule(rt, { name: 'Zulu', metric: 'spend', priority: 10, substanceScope: data.substances[0].id });
    const b = addRule(rt, { name: 'Alpha', metric: 'useAmount', priority: 90, substanceScope: 'all' });
    // Touch lastModified order
    rt.saveConditionalColorRule({ ...a, name: 'Zulu' });
    const rules = rt.getConditionalColorRules();

    const byPriority = rt.filterAndSortConditionalColorRules(rules, { sort: 'priority', sortDir: 'desc' });
    assert.ok((byPriority[0].priority || 0) >= (byPriority[1].priority || 0));
    assert.ok(byPriority.findIndex(r => r.id === b.id) < byPriority.findIndex(r => r.id === a.id));

    const byName = rt.filterAndSortConditionalColorRules(rules, { sort: 'name', sortDir: 'asc' });
    const alphaIdx = byName.findIndex(r => r.id === b.id);
    const zuluIdx = byName.findIndex(r => r.id === a.id);
    assert.ok(alphaIdx >= 0 && zuluIdx >= 0 && alphaIdx < zuluIdx);

    const byMetric = rt.filterAndSortConditionalColorRules(rules, { sort: 'metric', sortDir: 'asc' });
    for (let i = 1; i < byMetric.length; i += 1) {
        assert.ok(String(byMetric[i - 1].metric || '') <= String(byMetric[i].metric || ''));
    }

    const bySubstance = rt.filterAndSortConditionalColorRules(rules, { sort: 'substance', sortDir: 'asc' }, data);
    assert.ok(bySubstance.length >= 2);

    const byModified = rt.filterAndSortConditionalColorRules(rules, { sort: 'lastModified', sortDir: 'desc' });
    assert.ok(byModified.some(r => r.id === a.id));
    assert.ok(b.id);
});

test('bulk enable, disable, and delete', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Bulk 1', enabled: true, priority: 11 });
    const r2 = addRule(rt, { name: 'Bulk 2', enabled: true, priority: 12 });
    rt.bulkSetConditionalColorRulesEnabled([r1.id, r2.id], false);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).enabled, false);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).enabled, false);
    rt.bulkSetConditionalColorRulesEnabled([r1.id], true);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).enabled, true);
    const removed = rt.bulkDeleteConditionalColorRules([r1.id, r2.id]);
    assert.equal(removed.length, 2);
    assert.equal(rt.getConditionalColorRules().some(r => r.id === r1.id || r.id === r2.id), false);
});

test('bulk rename previews replace full name before saving', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Use coke (range)' });
    const r2 = addRule(rt, { name: 'Use coke (copy)' });
    const preview = rt.buildCcrBulkEditPreview([r1.id, r2.id], { nameMode: 'replace', name: 'Coke use' });
    assert.equal(preview.length, 2);
    assert.equal(preview[0].after.name, 'Coke use');
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).name, 'Use coke (range)');
    rt.applyCcrBulkEdit([r1.id, r2.id], { nameMode: 'replace', name: 'Coke use' });
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).name, 'Coke use');
});

test('bulk prefix and suffix only update selected rule names', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Range A' });
    const r2 = addRule(rt, { name: 'Range B' });
    rt.applyCcrBulkEdit([r1.id, r2.id], { nameMode: 'prefix', namePrefix: 'Coke ' });
    rt.applyCcrBulkEdit([r1.id], { nameMode: 'suffix', nameSuffix: ' active' });
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).name, 'Coke Range A active');
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).name, 'Coke Range B');
});

test('bulk find and replace updates matching text', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Use coke low' });
    const r2 = addRule(rt, { name: 'Use coke high' });
    rt.applyCcrBulkEdit([r1.id, r2.id], { nameMode: 'findReplace', findText: 'Use coke', replaceText: 'Coke use' });
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).name, 'Coke use low');
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).name, 'Coke use high');
});

test('bulk auto-numbering supports ranges in the name template', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Use coke (range)', operator: 'between', value: 1, valueTo: 2 });
    const r2 = addRule(rt, { name: 'Use coke (copy)', operator: 'between', value: 2, valueTo: 3 });
    const r3 = addRule(rt, { name: 'Use coke (range)', operator: 'between', value: 3, valueTo: 4 });
    rt.applyCcrBulkEdit([r1.id, r2.id, r3.id], {
        nameMode: 'autoNumber',
        numberTemplate: 'Coke use {range} g',
        numberStart: 1
    });
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).name, 'Coke use 1-2 g');
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).name, 'Coke use 2-3 g');
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r3.id).name, 'Coke use 3-4 g');
});

test('bulk auto-name from condition uses substance, metric, and range', () => {
    const { rt, data } = setup();
    const r1 = addRule(rt, {
        name: 'Untitled',
        substanceScope: data.substances[0].id,
        metric: 'useAmount',
        operator: 'between',
        value: 1,
        valueTo: 2
    });
    const preview = rt.buildCcrBulkEditPreview([r1.id], { autoNameFromCondition: true }, data);
    assert.match(preview[0].after.name, /.+ · Use amount · 1-2/);
});

test('partial bulk edits do not overwrite unspecified fields', () => {
    const { rt } = setup();
    const r1 = addRule(rt, {
        name: 'Keep details',
        metric: 'useAmount',
        operator: 'between',
        value: 1,
        valueTo: 2,
        priority: 12,
        colors: { background: '#111111', text: '#eeeeee', border: '#222222' }
    });
    rt.applyCcrBulkEdit([r1.id], { enabled: false, backgroundColor: '#333333' });
    const saved = rt.getConditionalColorRules().find(r => r.id === r1.id);
    assert.equal(saved.enabled, false);
    assert.equal(saved.name, 'Keep details');
    assert.equal(saved.metric, 'useAmount');
    assert.equal(saved.value, 1);
    assert.equal(saved.valueTo, 2);
    assert.equal(saved.priority, 12);
    assert.equal(saved.colors.background, '#333333');
    assert.equal(saved.colors.text, '#eeeeee');
});

test('custom group creation, rename, enable-disable, and export', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Grouped 1', enabled: true });
    const r2 = addRule(rt, { name: 'Grouped 2', enabled: true });
    const group = rt.createCcrCustomGroup('Coke Use Ranges');
    rt.moveCcrRulesToCustomGroup([r1.id, r2.id], group.id);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r1.id).customGroupId, group.id);
    rt.renameCcrCustomGroup(group.id, 'Duration Rules');
    assert.equal(rt.getCcrCustomGroups().find(g => g.id === group.id).name, 'Duration Rules');
    rt.setCcrCustomGroupEnabled(group.id, false);
    assert.equal(rt.getConditionalColorRules().find(r => r.id === r2.id).enabled, false);
    const json = JSON.parse(rt.exportCcrCustomGroupJson(group.id));
    assert.equal(json.group.name, 'Duration Rules');
    assert.equal(json.rules.length, 2);
});

test('deleting custom groups keeps their rules', () => {
    const { rt } = setup();
    const r1 = addRule(rt, { name: 'Keep after group delete' });
    const group = rt.createCcrCustomGroup('Temporary');
    rt.moveCcrRulesToCustomGroup([r1.id], group.id);
    rt.deleteCcrCustomGroup(group.id);
    const saved = rt.getConditionalColorRules().find(r => r.id === r1.id);
    assert.ok(saved);
    assert.equal(saved.customGroupId, '');
});

test('group building, expand-collapse persistence, select all, and moving rules', () => {
    const { rt, data } = setup();
    const r1 = addRule(rt, { name: 'Metric A', metric: 'useAmount', enabled: true });
    const r2 = addRule(rt, { name: 'Metric B', metric: 'useAmount', enabled: false });
    const groups = rt.buildCcrRuleGroups([r1, r2], { groupBy: 'metric', data });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].count, 2);
    assert.equal(groups[0].enabledCount, 1);
    rt.setCcrRuleGroupCollapsed(groups[0].id, true, data);
    assert.equal(rt.getCcrGroupCollapseMap(data)[groups[0].id], true);
    rt.setCcrManagerFilters({ selectedIds: [], groupBy: 'metric' });
    const selected = rt.selectCcrRuleGroup(groups[0].id, true, [r1, r2], data);
    assert.equal(selected.sort().join(','), [r1.id, r2.id].sort().join(','));
    assert.equal(rt.getCcrManagerUiState().selectedIds.length, 2);
    const custom = rt.createCcrCustomGroup('Inventory Warnings', data);
    rt.moveCcrRulesToCustomGroup([r1.id], custom.id, data);
    assert.equal(rt.getConditionalColorRules(data).find(r => r.id === r1.id).customGroupId, custom.id);
});

test('compact and expanded rule card layouts expose the right actions', () => {
    const { rt, data } = setup();
    const rule = addRule(rt, { name: 'Compact rule' });
    const conflicts = rt.detectConditionalColorRuleConflicts([rule], data);
    const matchCounts = { [rule.id]: 3 };
    const compact = rt.renderCcrRuleManagerCard(rule, { conflicts, matchCounts, selected: new Set() });
    assert.match(compact, /ccr-rule-compact-line/);
    assert.doesNotMatch(compact, />Delete</);
    rt.setCcrRuleCardExpanded(rule.id, true, data);
    const expanded = rt.renderCcrRuleManagerCard(rule, { conflicts, matchCounts, selected: new Set() });
    assert.match(expanded, /ccr-rule-expanded-details/);
    assert.match(expanded, />Delete</);
    assert.equal(rt.isCcrRuleCardExpanded(rule.id, data), true);
});

test('drag-and-drop priority order updates priorities', () => {
    const { rt } = setup();
    const low = addRule(rt, { id: 'ord-low', name: 'Low', priority: 10 });
    const mid = addRule(rt, { id: 'ord-mid', name: 'Mid', priority: 20 });
    const high = addRule(rt, { id: 'ord-high', name: 'High', priority: 30 });
    rt.setConditionalColorRulePriorityOrder([low.id, mid.id, high.id]);
    const ordered = rt.getConditionalColorRules()
        .filter(r => ['ord-low', 'ord-mid', 'ord-high'].includes(r.id))
        .sort((a, b) => b.priority - a.priority);
    assert.equal(ordered[0].id, low.id);
    assert.ok(ordered[0].priority > ordered[1].priority);
    assert.ok(ordered[1].priority > ordered[2].priority);
});

test('conflict detection for overlapping metric/substance/section/conditions', () => {
    const { rt } = setup();
    const a = rt.normalizeConditionalColorRule({
        id: 'c1',
        name: 'Use over 5',
        metric: 'useAmount',
        operator: 'gt',
        value: 5,
        sectionScope: ['dashboard', 'insights'],
        substanceScope: 'all'
    });
    const b = rt.normalizeConditionalColorRule({
        id: 'c2',
        name: 'Use over 8',
        metric: 'useAmount',
        operator: 'gt',
        value: 8,
        sectionScope: ['dashboard'],
        substanceScope: 'all'
    });
    const c = rt.normalizeConditionalColorRule({
        id: 'c3',
        name: 'Spend over 50',
        metric: 'spend',
        operator: 'gt',
        value: 50,
        sectionScope: ['spending']
    });
    const conflicts = rt.detectConditionalColorRuleConflicts([a, b, c]);
    assert.ok(conflicts[a.id].some(r => r.id === b.id));
    assert.ok(conflicts[b.id].some(r => r.id === a.id));
    assert.equal((conflicts[c.id] || []).length, 0);
});

test('match counts reuse shared comparison and cache', () => {
    const { rt, data } = setup();
    data.logs = [
        { id: '1', substanceId: data.substances[0].id, date: '2026-08-01', amount: 12, transactionType: 'personal_use' },
        { id: '2', substanceId: data.substances[0].id, date: '2026-08-02', amount: 1, transactionType: 'personal_use' }
    ];
    rt.__setTestAppData(data);
    rt.invalidateConditionalColorRuleMatchCache();
    rt.persistConditionalColorRulesState({ rules: [] });
    const rule = addRule(rt, {
        name: 'High use',
        metric: 'useAmount',
        operator: 'gt',
        value: 5,
        sectionScope: ['useHistory']
    });
    const counts1 = rt.computeConditionalColorRuleMatchCounts(data, { force: true });
    assert.ok(counts1[rule.id] >= 1);
    const counts2 = rt.computeConditionalColorRuleMatchCounts(data);
    assert.equal(counts2[rule.id], counts1[rule.id]);
    assert.equal(rt.getConditionalColorRuleMatchCount(rule.id, data), counts1[rule.id]);
});

test('import/export and selected export', () => {
    const { rt } = setup();
    const rule = addRule(rt, { name: 'Export me', priority: 77 });
    const json = rt.exportConditionalColorRulesJson();
    assert.match(json, /recovery-tracker-conditional-color-rules/);
    assert.match(json, /Export me/);

    const selected = rt.exportConditionalColorRulesSelectionJson([rule.id]);
    const parsed = JSON.parse(selected);
    assert.equal(parsed.rules.length, 1);
    assert.equal(parsed.rules[0].id, rule.id);

    rt.persistConditionalColorRulesState({ rules: [] });
    rt.importConditionalColorRulesJson(json, rt.__getTestAppData(), { replace: true });
    assert.ok(rt.getConditionalColorRules().some(r => r.name === 'Export me'));
});

test('preset loading without overwrite unless replace', () => {
    const { rt } = setup();
    rt.persistConditionalColorRulesState({ rules: [] });
    addRule(rt, { name: 'Keep me', priority: 1 });
    rt.loadRecoveryColorRulePresets(rt.__getTestAppData(), { replace: false });
    const afterMerge = rt.getConditionalColorRules();
    assert.ok(afterMerge.some(r => r.name === 'Keep me'));
    assert.ok(afterMerge.some(r => r.name === 'On Track'));
    assert.ok(afterMerge.some(r => r.name === 'Recovery Streak'));
    assert.ok(afterMerge.some(r => r.name === 'Taper Warning'));

    rt.loadRecoveryColorRulePresets(rt.__getTestAppData(), { replace: true });
    const afterReplace = rt.getConditionalColorRules();
    assert.equal(afterReplace.some(r => r.name === 'Keep me'), false);
    assert.ok(afterReplace.some(r => r.name === 'On Track'));
});

test('persistence stamps lastModified and survives normalize', () => {
    const { rt, data } = setup();
    const saved = addRule(rt, { name: 'Persist me' });
    assert.ok(saved.lastModified);
    data.settings.conditionalColorRules.rules.find(r => r.id === saved.id).name = 'Persist me';
    rt.saveData(data);
    const reloaded = rt.__reloadTestAppDataFromStorage();
    const rule = reloaded.settings.conditionalColorRules.rules.find(r => r.id === saved.id);
    assert.ok(rule);
    assert.equal(rule.name, 'Persist me');
    assert.ok(rule.colors.accent || rule.colors.border);
});

test('rule editing updates fields and optional labels stay empty by default', () => {
    const { rt } = setup();
    const rule = addRule(rt, { name: 'Edit me', statusLabel: '' });
    const updated = rt.saveConditionalColorRule({
        ...rule,
        name: 'Edited',
        value: 42,
        statusLabel: ''
    });
    assert.equal(updated.name, 'Edited');
    assert.equal(updated.value, 42);
    assert.equal(updated.statusLabel, '');
    const preview = rt.renderCcrColorPreview(updated);
    assert.match(preview, /ccr-color-preview/);
    assert.match(preview, /aria-label=/);
});

test('performance: hundreds of rules filter/sort and conflict scan stay bounded', () => {
    const { rt } = setup();
    rt.persistConditionalColorRulesState({ rules: [] });
    const many = [];
    for (let i = 0; i < 300; i++) {
        many.push(rt.normalizeConditionalColorRule({
            id: `perf-${i}`,
            name: `Rule ${i}`,
            metric: i % 2 ? 'spend' : 'useAmount',
            operator: 'gt',
            value: i,
            priority: i,
            sectionScope: i % 3 === 0 ? ['dashboard'] : ['insights'],
            substanceScope: 'all'
        }, i));
    }
    rt.persistConditionalColorRulesState({ rules: many });
    const start = Date.now();
    const filtered = rt.filterAndSortConditionalColorRules(rt.getConditionalColorRules(), {
        search: 'Rule 12',
        sort: 'priority',
        sortDir: 'desc'
    });
    const conflicts = rt.detectConditionalColorRuleConflicts();
    const counts = rt.computeConditionalColorRuleMatchCounts(rt.__getTestAppData(), { force: true, maxSamples: 50 });
    const elapsed = Date.now() - start;
    assert.ok(filtered.length >= 1);
    assert.ok(Object.keys(conflicts).length >= 300);
    assert.ok(Object.keys(counts).length >= 300);
    assert.ok(elapsed < 2000, `manager ops too slow: ${elapsed}ms`);
});

test('usage chips reflect section scope', () => {
    const { rt } = setup();
    const rule = addRule(rt, {
        sectionScope: ['dashboard', 'taper', 'spending']
    });
    const usage = rt.getConditionalColorRuleUsage(rule);
    assert.ok(usage.find(u => u.id === 'dashboard').used);
    assert.ok(usage.find(u => u.id === 'taper').used);
    assert.ok(usage.find(u => u.id === 'spending').used);
    assert.equal(usage.find(u => u.id === 'calendar').used, false);
});
