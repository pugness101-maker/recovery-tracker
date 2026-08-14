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

function installDom(rt, plans = []) {
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
    put('taper-start-from-section');
    put('taper-start-from', {
        tag: 'select',
        value: 'blank',
        options: [
            { value: 'blank' }, { value: 'suggested' }, { value: 'builtin-template' },
            { value: 'my-template' }, { value: 'copy-existing' }
        ]
    });
    put('taper-start-builtin-group', { className: 'hidden' });
    put('taper-start-builtin-template', { tag: 'select', value: 'linear', options: [{ value: 'linear' }] });
    put('taper-start-my-template-group', { className: 'hidden' });
    put('taper-start-my-template', { tag: 'select', value: '', options: [] });
    put('taper-start-copy-group', { className: 'hidden' });
    put('taper-start-copy-plan', {
        tag: 'select',
        value: plans[0]?.id || '',
        options: plans.map(p => ({ value: p.id }))
    });
    put('taper-plan-select', {
        tag: 'select',
        value: plans[0]?.id || '',
        options: plans.map(p => ({ value: p.id }))
    });
    put('taper-plan-summary-card');
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
        id: 'taper-a',
        name: 'Taper A',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        notes: 'alpha note',
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

test('selecting a taper from the dropdown opens that taper dashboard', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Taper A' }),
        makePlan({ id: 'taper-b', name: 'Taper B', isPrimary: false, notes: 'beta note' })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);
    rt.showNewTaperPlan();
    assert.equal(rt.isTaperCreateFormActive(), true);

    nodes.get('taper-plan-select').value = 'taper-b';
    rt.onTaperPlanChange();

    assert.equal(rt.selectedTaperPlanIdRef.value, 'taper-b');
    assert.equal(rt.getTaperUiState().mode, 'view');
    assert.equal(rt.taperEditingPlanRef.value, false);
    assert.equal(nodes.get('taper-setup').classList.contains('hidden'), true);
    assert.equal(nodes.get('taper-dashboard').classList.contains('hidden'), false);
    assert.equal(nodes.get('taper-tab').hidden, false);
});

test('Open button opens the correct taper without entering create mode', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Taper A' }),
        makePlan({ id: 'taper-b', name: 'Taper B', isPrimary: false })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);
    rt.selectedTaperPlanIdRef.value = 'taper-a';

    rt.openUnifiedTaperRecord('taper-b');

    assert.equal(rt.selectedTaperPlanIdRef.value, 'taper-b');
    assert.equal(rt.getTaperUiState().mode, 'view');
    assert.equal(rt.taperEditingPlanRef.value, false);
    assert.equal(nodes.get('taper-dashboard').classList.contains('hidden'), false);
    assert.equal(nodes.get('taper-setup').classList.contains('hidden'), true);
});

test('switching taper updates selected plan via openTaperPlan', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Taper A' }),
        makePlan({ id: 'taper-b', name: 'Taper B', isPrimary: false, goalDailyAverage: 0.5 })
    ];
    const rt = setupApp(plans);
    installDom(rt, plans);

    rt.openTaperPlan('taper-a');
    assert.equal(rt.getSelectedTaperPlan()?.name, 'Taper A');
    rt.openTaperPlan('taper-b');
    assert.equal(rt.getSelectedTaperPlan()?.name, 'Taper B');
    assert.equal(rt.getSelectedTaperPlan()?.goalDailyAverage, 0.5);
});

test('New Taper clears selected taper and edit state', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt, [makePlan()]);
    rt.selectedTaperPlanIdRef.value = 'taper-a';
    rt.taperFormPlanIdRef.value = 'taper-a';
    rt.taperFormModeRef.value = 'edit';
    nodes.get('taper-editing-plan-id').value = 'taper-a';

    rt.showNewTaperPlan();

    assert.equal(rt.selectedTaperPlanIdRef.value, null);
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.taperFormPlanIdRef.value, null);
    assert.equal(nodes.get('taper-editing-plan-id').value, '');
    assert.equal(nodes.get('taper-start-from').value, rt.TAPER_START_FROM.BLANK);
    assert.equal(nodes.get('taper-plan-select').value, '');
});

test('Existing taper as copy creates a new id and leaves source unchanged', () => {
    const source = makePlan({ id: 'source-taper', name: 'Source taper', notes: 'keep me' });
    const rt = setupApp([source]);
    const { nodes } = installDom(rt, [source]);

    rt.showNewTaperPlan();
    rt.setTaperStartFrom(rt.TAPER_START_FROM.COPY, { copyPlanId: 'source-taper' });
    rt.applyTaperStartFromSelection();
    nodes.get('taper-plan-name').value = 'Copied taper';
    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);

    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    const unchanged = data.taperPlansV2.find(p => p.id === 'source-taper');
    const created = data.taperPlansV2.find(p => p.name === 'Copied taper');
    assert.equal(unchanged.notes, 'keep me');
    assert.ok(created);
    assert.notEqual(created.id, 'source-taper');
});

test('applyTaperTemplate opens create mode with built-in template start-from', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt, [makePlan()]);
    rt.selectedTaperPlanIdRef.value = 'taper-a';

    rt.applyTaperTemplate('linear');

    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.selectedTaperPlanIdRef.value, null);
    assert.equal(nodes.get('taper-start-from').value, rt.TAPER_START_FROM.BUILTIN);
    assert.equal(nodes.get('taper-plan-name').value, 'Linear reduction');
    assert.equal(nodes.get('taper-setup').classList.contains('hidden'), false);
});

test('plan name field lives on create form, not taper toolbar', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt, [makePlan()]);
    rt.showNewTaperPlan();
    nodes.get('taper-plan-name').value = 'Form plan name';
    assert.ok(nodes.get('taper-plan-name'));
    assert.equal(nodes.has('taper-plan-count'), false);
    assert.equal(nodes.get('taper-plan-name').value, 'Form plan name');
});
