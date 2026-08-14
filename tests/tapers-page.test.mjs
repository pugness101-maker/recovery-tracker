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
        textContent: props.textContent || '',
        innerHTML: props.innerHTML || '',
        style: {},
        dataset: { ...(props.dataset || {}) },
        className: props.className || '',
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
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setAttribute() {},
        removeAttribute(name) {
            if (name === 'hidden') this.hidden = false;
        },
        getAttribute(name) {
            if (name === 'data-gp-view') return this.dataset.gpView || '';
            return null;
        },
        scrollIntoView() {}
    };
    return node;
}

function installTapersDom(rt) {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const node = el(id, props);
        nodes.set(id, node);
        return node;
    };

    const overview = put('gp-overview', { className: 'combined-subview active', dataset: { gpView: 'overview' } });
    overview.getAttribute = (name) => (name === 'data-gp-view' ? 'overview' : null);
    put('gp-overview-root', { tag: 'div' });
    const records = put('tapers-root', { className: 'combined-subview', hidden: true, dataset: { gpView: 'history templates' } });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'history templates' : null);
    const workspace = put('taper-tab', { className: 'taper-page taper-workspace', hidden: true });
    put('taper-setup', { className: 'taper-editor-panel hidden', tag: 'div' });
    put('taper-dashboard', { className: 'hidden', tag: 'div' });
    put('taper-no-plan', { className: 'hidden', tag: 'div' });
    put('taper-disabled-msg', { className: 'hidden', tag: 'div' });
    put('taper-plan-toolbar', { className: 'hidden', tag: 'div' });
    put('taper-cancel-edit-btn', { className: 'hidden', tag: 'button' });
    put('taper-setup-title', { tag: 'h3', textContent: 'Create Taper Plan' });
    put('taper-generate-btn', { tag: 'button', textContent: 'Save Taper' });
    put('taper-form-status', { tag: 'p', hidden: true });
    put('taper-editing-plan-id', { tag: 'input', value: '' });
    put('taper-plan-name', { tag: 'input', value: '' });
    put('taper-substance', { tag: 'select', value: COKE_ID, options: [{ value: COKE_ID }] });
    put('start-date', { tag: 'input', value: '2026-08-01' });
    put('end-date', { tag: 'input', value: '2026-09-01' });
    put('reduction-type', { tag: 'select', value: 'reduce-amount' });
    put('current-avg', { tag: 'input', value: '2' });
    put('goal-avg', { tag: 'input', value: '0.5' });
    put('reduction-amount', { tag: 'input', value: '0.2' });
    put('reduction-percent', { tag: 'input', value: '' });
    put('weekly-max', { tag: 'input', value: '' });
    put('monthly-max', { tag: 'input', value: '' });
    put('taper-notes', { tag: 'textarea', value: '' });
    put('taper-priority', { tag: 'select', value: 'normal' });
    put('taper-status', { tag: 'select', value: 'active' });
    put('taper-set-primary', { tag: 'input', checked: true });
    put('do-not-surpass-daily', { tag: 'input', checked: true });
    put('do-not-surpass-weekly', { tag: 'input', checked: false });
    put('purchase-taper-enabled', { tag: 'input', checked: false });
    put('gp-subnav', { tag: 'nav' });
    put('gp-subnav-select', { tag: 'select', value: 'overview' });
    put('gp-loading', { className: 'hidden' });
    put('gp-error', { className: 'hidden' });
    put('gp-error-message', { tag: 'p' });

    const tabRoot = el('goals-plans-tab', { tag: 'section' });
    tabRoot.querySelectorAll = (sel) => {
        if (sel === '.combined-subview') return [overview, records];
        return [];
    };
    nodes.set('goals-plans-tab', tabRoot);

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel === '#goals-plans-tab') return tabRoot;
        if (sel?.startsWith?.('#')) return nodes.get(sel.slice(1)) || null;
        return null;
    };
    rt.document.querySelectorAll = () => [];
    return { nodes, workspace, records, overview };
}

function setupApp(extra = {}) {
    const rt = loadRecoveryTrackerApp();
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
        logs: extra.logs || [],
        purchases: extra.purchases || [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: extra.taperPlansV2 || [],
        settings: { currency: '$', substanceSettings: {}, combinedNav: { goalsPlansView: 'overview' } },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2();
    rt.ensureCombinedNavPrefs();
    return rt;
}

function fillCreateForm(nodes, name = 'Fresh taper') {
    nodes.get('taper-plan-name').value = name;
    nodes.get('start-date').value = '2026-08-01';
    nodes.get('end-date').value = '2026-09-01';
    nodes.get('reduction-type').value = 'reduce-amount';
    nodes.get('current-avg').value = '2';
    nodes.get('goal-avg').value = '0.5';
    nodes.get('reduction-amount').value = '0.25';
    nodes.get('taper-status').value = 'active';
}

test('Active tab no longer exists; Overview/History/Templates remain', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /data-gp-view="active"/);
    assert.doesNotMatch(html, /setGoalsPlansView\('active'\)/);
    assert.match(html, /data-gp-view="overview"/);
    assert.match(html, /data-gp-view="history"/);
    assert.match(html, /data-gp-view="templates"/);
    assert.match(html, /New Taper/);
    assert.match(html, /Create Taper Plan/);
    assert.doesNotMatch(html, />\+ New Plan</);
    assert.deepEqual([...loadRecoveryTrackerApp().GOALS_PLANS_VIEWS], ['overview', 'history', 'templates']);
});

test('Overview still displays active tapers', () => {
    const rt = setupApp({
        taperPlansV2: [{
            id: 'existing-1',
            name: 'Existing taper',
            substanceId: COKE_ID,
            status: 'active',
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: [{ weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 1 }]
        }]
    });
    const { nodes } = installTapersDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /Existing taper/);
    assert.match(html, /Active .*tapers/i);
    assert.match(html, /data-record-type="taper"/);
    assert.match(html, /Delete/);
});

test('New Taper from Overview, History, and Templates creates a new record', () => {
    for (const view of ['overview', 'history', 'templates']) {
        const rt = setupApp({
            taperPlansV2: [{
                id: 'selected-existing',
                name: 'Already selected',
                substanceId: COKE_ID,
                status: 'active',
                isPrimary: true,
                startDate: '2026-07-01',
                endDate: '2026-08-31',
                reductionType: 'reduce-amount',
                startingDailyAverage: 2,
                goalDailyAverage: 0.5,
                reductionAmount: 0.2,
                weeklyTargets: [{ weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 1 }]
            }]
        });
        const { nodes, workspace } = installTapersDom(rt);
        rt.selectedTaperPlanIdRef.value = 'selected-existing';
        rt.setGoalsPlansView(view, { persist: false, skipRoute: true });
        rt.openUnifiedNewTaper();
        assert.equal(workspace.hidden, false, `workspace visible from ${view}`);
        assert.equal(rt.taperFormModeRef.value, 'create', `create mode from ${view}`);
        assert.equal(nodes.get('taper-editing-plan-id').value, '', `no editing id from ${view}`);
        assert.equal(rt.resolveTaperFormEditingPlanId(), null, `resolve null from ${view}`);
        assert.match(nodes.get('taper-setup-title').textContent, /Create Taper Plan/i);

        fillCreateForm(nodes, `Created from ${view}`);
        const before = rt.__getTestAppData().taperPlansV2.map(p => ({ ...p }));
        const ok = rt.handleTaperSubmit({ preventDefault() {} });
        assert.equal(ok, true, `save ok from ${view}`);
        const data = rt.__getTestAppData();
        const created = data.taperPlansV2.find(p => p.name === `Created from ${view}`);
        assert.ok(created, `created from ${view}`);
        assert.notEqual(created.id, 'selected-existing');
        assert.ok(String(created.id).length > 0);
        const original = data.taperPlansV2.find(p => p.id === 'selected-existing');
        assert.equal(original.name, 'Already selected');
        assert.equal(data.taperPlansV2.length, before.length + 1);
        rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
        assert.match(nodes.get('gp-overview-root').innerHTML, new RegExp(`Created from ${view}`));
    }
});

test('Create mode does not reuse an existing taper ID even when another taper is selected', () => {
    const existing = {
        id: 'keep-me',
        name: 'Keep me',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        weeklyTargets: [{ weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 10 }],
        notes: 'untouched'
    };
    const rt = setupApp({ taperPlansV2: [existing] });
    const { nodes } = installTapersDom(rt);
    rt.selectedTaperPlanIdRef.value = 'keep-me';
    rt.taperEditingPlanRef.value = true;
    rt.openUnifiedNewTaper();
    assert.equal(rt.taperFormModeRef.value, 'create');
    assert.equal(rt.taperFormPlanIdRef.value, null);
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);
    fillCreateForm(nodes, 'Brand new taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    const kept = data.taperPlansV2.find(p => p.id === 'keep-me');
    const created = data.taperPlansV2.find(p => p.name === 'Brand new taper');
    assert.equal(kept.notes, 'untouched');
    assert.equal(kept.name, 'Keep me');
    assert.ok(created);
    assert.notEqual(created.id, 'keep-me');
});

test('Edit mode preserves the existing taper ID', () => {
    const existing = {
        id: 'edit-me',
        name: 'Original taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        weeklyTargets: [{ weekStart: '2026-07-28', weekEnd: '2026-08-03', targetAmount: 10 }],
        notes: 'old note'
    };
    const rt = setupApp({ taperPlansV2: [existing] });
    const { nodes } = installTapersDom(rt);
    rt.editUnifiedTaperRecord('edit-me');
    assert.equal(rt.taperFormModeRef.value, 'edit');
    assert.equal(rt.resolveTaperFormEditingPlanId(), 'edit-me');
    nodes.get('taper-plan-name').value = 'Renamed taper';
    nodes.get('goal-avg').value = '0.25';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 1);
    assert.equal(data.taperPlansV2[0].id, 'edit-me');
    assert.equal(data.taperPlansV2[0].name, 'Renamed taper');
});

test('Delete removes only the selected taper and clears invalid primary', () => {
    const rt = setupApp({
        logs: [{ id: 'log-1', substanceId: COKE_ID, date: '2026-08-01', amount: 0.2, unit: 'g', transactionType: 'use' }],
        purchases: [{ id: 'buy-1', substanceId: COKE_ID, date: '2026-08-01', amount: 1, totalCost: 40 }],
        taperPlansV2: [{
            id: 'primary-taper',
            name: 'Primary',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: true,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }, {
            id: 'secondary-taper',
            name: 'Secondary',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: false,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }]
    });
    const { nodes } = installTapersDom(rt);
    const before = rt.__getTestAppData();
    const logsBefore = before.logs.length;
    const purchasesBefore = before.purchases.length;
    const substancesBefore = before.substances.length;
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        assert.equal(rt.deleteTaperPlanById('primary-taper'), true);
    } finally {
        globalThis.confirm = originalConfirm;
    }
    const data = rt.__getTestAppData();
    assert.deepEqual(data.taperPlansV2.map(p => p.id), ['secondary-taper']);
    assert.equal(data.taperPlansV2[0].isPrimary, true);
    assert.equal(data.logs.length, logsBefore);
    assert.equal(data.purchases.length, purchasesBefore);
    assert.equal(data.substances.length, substancesBefore);
    assert.ok(data.logs.some(l => l.id === 'log-1'));
    assert.ok(data.purchases.some(p => p.id === 'buy-1'));
    assert.notEqual(rt.selectedTaperPlanIdRef.value, 'primary-taper');
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    assert.doesNotMatch(nodes.get('gp-overview-root').innerHTML, /Primary/);
    assert.match(nodes.get('gp-overview-root').innerHTML, /Secondary/);
});

test('Deleting the only primary taper leaves no invalid primary ID', () => {
    const rt = setupApp({
        taperPlansV2: [{
            id: 'only-one',
            name: 'Only',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: true,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }]
    });
    installTapersDom(rt);
    rt.selectedTaperPlanIdRef.value = 'only-one';
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        rt.deleteTaperPlanById('only-one');
    } finally {
        globalThis.confirm = originalConfirm;
    }
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 0);
    assert.equal(rt.selectedTaperPlanIdRef.value, null);
    assert.equal(rt.getPrimaryTaperPlan(COKE_ID), null);
});

test('Archive still works independently from Delete', () => {
    const rt = setupApp({
        taperPlansV2: [{
            id: 'archive-me',
            name: 'Archive me',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: true,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }, {
            id: 'keep-active',
            name: 'Keep active',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: false,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }]
    });
    const { nodes } = installTapersDom(rt);
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        rt.archiveTaperPlanById('archive-me');
    } finally {
        globalThis.confirm = originalConfirm;
    }
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.equal(data.taperPlansV2.find(p => p.id === 'archive-me').status, 'archived');
    assert.ok(data.taperPlansV2.find(p => p.id === 'keep-active'));
    rt.setGoalsPlansView('history', { persist: false, skipRoute: true });
    assert.match(nodes.get('tapers-root').innerHTML, /Archive me/);
    assert.match(nodes.get('tapers-root').innerHTML, /Delete/);
});

test('taper templates are available and apply opens the form', () => {
    const rt = setupApp();
    const { nodes, workspace } = installTapersDom(rt);
    assert.ok(rt.TAPER_TEMPLATES.length >= 6);
    rt.setGoalsPlansView('templates', { persist: false, skipRoute: true });
    assert.match(nodes.get('tapers-root').innerHTML, /Linear reduction/);
    rt.applyTaperTemplate('manual');
    assert.equal(workspace.hidden, false);
    assert.equal(rt.taperFormModeRef.value, 'create');
    assert.equal(nodes.get('taper-plan-name').value, 'Manual steps');
});
