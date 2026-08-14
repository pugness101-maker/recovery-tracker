import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

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
        querySelector() { return null; },
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
    const workspace = put('taper-tab', { hidden: true });
    put('taper-setup', { className: 'taper-editor-panel hidden' });
    put('taper-form', { tag: 'form' });
    put('taper-dashboard', { className: 'hidden' });
    put('taper-no-plan', { className: 'hidden' });
    put('taper-disabled-msg', { className: 'hidden' });
    put('taper-plan-toolbar', { className: 'hidden' });
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
    put('goal-avg', { tag: 'input', value: '0.5', required: true });
    put('reduction-amount', { tag: 'input', value: '0.25' });
    put('reduction-percent', { tag: 'input', value: '' });
    put('weekly-max', { tag: 'input', value: '' });
    put('monthly-max', { tag: 'input', value: '' });
    put('taper-notes', { tag: 'textarea', value: '' });
    put('taper-priority', { tag: 'select', value: 'normal' });
    put('taper-status', { tag: 'select', value: 'active' });
    put('taper-set-primary', { tag: 'input', checked: false });
    put('do-not-surpass-daily', { tag: 'input', checked: true });
    put('do-not-surpass-weekly', { tag: 'input', checked: false });
    put('purchase-taper-enabled', { tag: 'input', checked: false });
    put('simple-plan-wizard', { className: 'simple-plan-wizard hidden' });
    put('gp-subnav', { tag: 'nav' });
    put('gp-subnav-select', { tag: 'select', value: 'overview' });
    put('gp-loading', { className: 'hidden' });
    put('gp-error', { className: 'hidden' });
    put('gp-error-message', { tag: 'p' });

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
    return { nodes, workspace };
}

function makePlan(overrides = {}) {
    return {
        id: 'existing-taper',
        name: 'Existing taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        notes: 'original note',
        weeklyTargets: [{ week: 1, weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 10, actualUsed: 2 }],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        ...overrides
    };
}

function setupApp(plans = [], settings = {}) {
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
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: plans,
        settings: {
            currency: '$',
            substanceSettings: {},
            combinedNav: { goalsPlansView: 'overview' },
            ...settings
        },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2();
    rt.ensureCombinedNavPrefs();
    return rt;
}

function fillCreateForm(nodes, name) {
    nodes.get('taper-plan-name').value = name;
    nodes.get('start-date').value = '2026-08-01';
    nodes.get('end-date').value = '2026-09-01';
    nodes.get('reduction-type').value = 'reduce-amount';
    nodes.get('current-avg').value = '2';
    nodes.get('goal-avg').value = '0.5';
    nodes.get('reduction-amount').value = '0.25';
    nodes.get('taper-status').value = 'active';
}

test('New Taper while a taper is selected appends a second record and leaves the first untouched', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'existing-taper';

    assert.equal(rt.openUnifiedNewTaper(), true);
    assert.equal(rt.getTaperFormMode(), 'create');
    fillCreateForm(nodes, 'Second taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);

    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    const original = data.taperPlansV2.find(p => p.id === 'existing-taper');
    const created = data.taperPlansV2.find(p => p.name === 'Second taper');
    assert.equal(original.name, 'Existing taper');
    assert.equal(original.notes, 'original note');
    assert.equal(original.goalDailyAverage, 1);
    assert.ok(created);
    assert.notEqual(created.id, original.id);
    assert.match(nodes.get('gp-overview-root').innerHTML, /Second taper/);
});

test('New Taper still creates after using Edit', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);

    rt.editUnifiedTaperRecord('existing-taper');
    assert.equal(rt.getTaperFormMode(), 'edit');

    assert.equal(rt.openUnifiedNewTaper(), true);
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.taperFormPlanIdRef.value, null);
    assert.equal(nodes.get('taper-editing-plan-id').value, '');

    fillCreateForm(nodes, 'After edit taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.equal(data.taperPlansV2.find(p => p.id === 'existing-taper').name, 'Existing taper');
    assert.ok(data.taperPlansV2.find(p => p.name === 'After edit taper'));
});

test('New Taper still creates after using Duplicate, and Duplicate save mints its own id', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);

    assert.equal(rt.duplicateTaperPlanById('existing-taper'), true);
    assert.equal(rt.getTaperUiState().mode, 'duplicate');
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);

    fillCreateForm(nodes, 'Duplicated taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const afterDuplicate = rt.__getTestAppData().taperPlansV2;
    assert.equal(afterDuplicate.length, 2);
    const copy = afterDuplicate.find(p => p.id !== 'existing-taper');
    assert.notEqual(copy.id, 'existing-taper');

    assert.equal(rt.openUnifiedNewTaper(), true);
    assert.equal(rt.getTaperFormMode(), 'create');
    fillCreateForm(nodes, 'After duplicate taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);

    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 3);
    const created = data.taperPlansV2.find(p => p.name === 'After duplicate taper');
    assert.ok(created);
    assert.notEqual(created.id, copy.id);
    assert.notEqual(created.id, 'existing-taper');
    assert.equal(new Set(data.taperPlansV2.map(p => p.id)).size, 3);
});

test('create mode never falls back to edit, even with stale edit state', () => {
    const rt = setupApp([makePlan()]);
    installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'existing-taper';

    // Stale "editing" flag with no plan id must resolve as create, not edit.
    rt.taperFormModeRef.value = 'edit';
    rt.taperFormPlanIdRef.value = null;
    rt.taperEditingPlanRef.value = true;
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);

    rt.showNewTaperPlan();
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);
});

test('create saves even when the form lifecycle was reset before submit', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'existing-taper';
    rt.showNewTaperPlan();
    fillCreateForm(nodes, 'Reset lifecycle taper');
    // Any re-render (substance sync, suggestions refresh) can clear the initialized flag.
    rt.resetTaperFormLifecycleState();
    assert.equal(rt.taperFormInitializedRef.value, false);

    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.ok(data.taperPlansV2.find(p => p.name === 'Reset lifecycle taper'));
    assert.equal(data.taperPlansV2.find(p => p.id === 'existing-taper').name, 'Existing taper');
});

test('edit mode keeps the stable id and does not append', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    rt.editUnifiedTaperRecord('existing-taper');
    nodes.get('taper-plan-name').value = 'Edited taper';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 1);
    assert.equal(data.taperPlansV2[0].id, 'existing-taper');
    assert.equal(data.taperPlansV2[0].name, 'Edited taper');
});

test('Simple mode New Taper opens the same create form as Advanced', () => {
    const rt = setupApp([makePlan()], { experienceMode: 'simple' });
    const { nodes } = installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'existing-taper';
    assert.equal(rt.isSimpleExperienceMode(), true);

    assert.equal(rt.showNewTaperPlan(), true);
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);

    fillCreateForm(nodes, 'Simple mode taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.ok(data.taperPlansV2.find(p => p.name === 'Simple mode taper'));
    assert.equal(data.taperPlansV2.find(p => p.id === 'existing-taper').notes, 'original note');
});

test('New Taper after Edit in Simple mode still creates instead of updating', () => {
    const rt = setupApp([makePlan()], { experienceMode: 'simple' });
    const { nodes } = installDom(rt);
    rt.editUnifiedTaperRecord('existing-taper');
    assert.equal(rt.openUnifiedNewTaper(), true);
    assert.equal(rt.getTaperFormMode(), 'create');
    fillCreateForm(nodes, 'After edit simple');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 2);
});
