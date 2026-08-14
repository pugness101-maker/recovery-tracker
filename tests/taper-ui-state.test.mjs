import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-01';
const COKE_ID = 'coke';
const WEED_ID = 'weed';

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
            },
            contains(name) { return classes.has(name); }
        },
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setAttribute() {},
        removeAttribute(name) { if (name === 'hidden') this.hidden = false; },
        scrollIntoView() {}
    };
    return node;
}

function installDom(rt, plans = [], substanceOptions = [{ value: COKE_ID }]) {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const node = el(id, props);
        nodes.set(id, node);
        return node;
    };

    put('gp-overview-root');
    put('taper-tab', { hidden: true });
    put('taper-setup', { className: 'taper-editor-panel hidden' });
    put('taper-form', { tag: 'form' });
    put('taper-dashboard', { className: 'hidden' });
    put('taper-no-plan', { className: 'hidden' });
    put('taper-disabled-msg', { className: 'hidden' });
    put('taper-plan-toolbar', { className: 'hidden' });
    put('taper-cancel-edit-btn', { className: 'hidden', tag: 'button' });
    put('taper-setup-title', { tag: 'h3' });
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
    put('taper-show-archived', { tag: 'input', checked: false });
    put('taper-plan-summary-card');
    put('taper-substance', {
        tag: 'select',
        value: substanceOptions[0]?.value || COKE_ID,
        options: substanceOptions
    });
    put('start-date', { tag: 'input', value: '2026-08-01' });
    put('end-date', { tag: 'input', value: '2026-09-01' });
    put('reduction-type', { tag: 'select', value: 'reduce-amount' });
    put('current-avg', { tag: 'input', value: '2' });
    put('goal-avg', { tag: 'input', value: '0.5' });
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
    put('goals-plans-tab', { tag: 'section' });

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel?.startsWith?.('#')) return nodes.get(sel.slice(1)) || null;
        return null;
    };
    rt.document.querySelectorAll = () => [];
    return { nodes };
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

function setupApp(plans = [], settings = {}, substances = null) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: substances || [{
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

test('dropdown selection stays in sync with taperUiState.selectedTaperId', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'taper-a' });

    nodes.get('taper-plan-select').value = 'taper-b';
    rt.onTaperPlanChange();

    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-b');
    assert.equal(rt.getSelectedTaperId(), 'taper-b');
    assert.equal(nodes.get('taper-plan-select').value, 'taper-b');
    assert.equal(rt.getSelectedTaperPlan()?.id, 'taper-b');
});

test('Open loads the selected taper in view mode', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false, notes: 'beta notes' })
    ];
    const rt = setupApp(plans);
    installDom(rt, plans);

    assert.equal(rt.openTaperPlan('taper-b'), true);
    const ui = rt.getTaperUiState();
    assert.equal(ui.mode, 'view');
    assert.equal(ui.selectedTaperId, 'taper-b');
    assert.equal(ui.editingTaperId, null);
    assert.equal(rt.getSelectedTaperPlan()?.notes, 'beta notes');
});

test('New Taper clears editingTaperId and does not inherit stale edit state', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt, [makePlan()]);
    rt.setTaperUiState({
        mode: 'edit',
        selectedTaperId: 'taper-a',
        editingTaperId: 'taper-a',
        sourceTaperId: null
    });
    nodes.get('taper-editing-plan-id').value = 'taper-a';

    rt.showNewTaperPlan();

    const ui = rt.getTaperUiState();
    assert.equal(ui.mode, 'create');
    assert.equal(ui.editingTaperId, null);
    assert.equal(ui.sourceTaperId, null);
    assert.equal(ui.selectedTaperId, null);
    assert.equal(nodes.get('taper-editing-plan-id').value, '');
    assert.equal(rt.getTaperFormMode(), 'create');
});

test('Edit targets the intended taper id only', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);

    rt.editTaperPlanById('taper-b');
    assert.equal(rt.getTaperUiState().mode, 'edit');
    assert.equal(rt.getTaperUiState().editingTaperId, 'taper-b');
    assert.equal(rt.resolveTaperFormEditingPlanId(), 'taper-b');
    assert.equal(nodes.get('taper-editing-plan-id').value, 'taper-b');

    nodes.get('taper-plan-name').value = 'Beta edited';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const saved = rt.__getTestAppData().taperPlansV2.find(p => p.id === 'taper-b');
    assert.equal(saved.name, 'Beta edited');
    assert.equal(rt.__getTestAppData().taperPlansV2.find(p => p.id === 'taper-a').name, 'Alpha');
});

test('Duplicate never mutates the source taper record', () => {
    const source = makePlan({ id: 'source-taper', name: 'Source', notes: 'unchanged' });
    const rt = setupApp([source]);
    const { nodes } = installDom(rt, [source]);

    rt.duplicateTaperPlanById('source-taper');
    assert.equal(rt.getTaperUiState().mode, 'duplicate');
    assert.equal(rt.getTaperUiState().sourceTaperId, 'source-taper');
    assert.equal(rt.getTaperUiState().editingTaperId, null);

    nodes.get('taper-plan-name').value = 'Source copy';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.equal(data.taperPlansV2.find(p => p.id === 'source-taper').notes, 'unchanged');
    assert.notEqual(data.taperPlansV2.find(p => p.name === 'Source copy').id, 'source-taper');
});

test('archiveSelectedTaperPlan updates selected taper to next default only', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha', isPrimary: true }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    installDom(rt, plans);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'taper-a' });

    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        rt.archiveTaperPlanById('taper-a');
    } finally {
        globalThis.confirm = originalConfirm;
    }

    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-b');
    assert.equal(rt.getSelectedTaperPlan()?.id, 'taper-b');
    assert.equal(rt.__getTestAppData().taperPlansV2.find(p => p.id === 'taper-a').status, 'archived');
});

test('deleteSelectedTaperPlan removes selected taper and reselects default', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha', isPrimary: true }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    installDom(rt, plans);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'taper-a' });

    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        rt.deleteSelectedTaperPlan();
    } finally {
        globalThis.confirm = originalConfirm;
    }

    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.some(p => p.id === 'taper-a'), false);
    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-b');
});

test('substance change clears stale selected taper id for new substance', () => {
    const substances = [
        { id: COKE_ID, name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true, active: true, isMain: true },
        { id: WEED_ID, name: 'Weed', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true, active: true, isMain: false }
    ];
    const plans = [
        makePlan({ id: 'coke-taper', name: 'Coke taper', substanceId: COKE_ID, isPrimary: true }),
        makePlan({ id: 'weed-taper', name: 'Weed taper', substanceId: WEED_ID, isPrimary: true })
    ];
    const rt = setupApp(plans, {}, substances);
    const { nodes } = installDom(rt, [plans[0]], [{ value: COKE_ID }, { value: WEED_ID }]);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'coke-taper' });

    nodes.get('taper-substance').value = WEED_ID;
    rt.onTaperSubstanceChange();

    assert.equal(rt.getTaperUiState().selectedTaperId, 'weed-taper');
    assert.equal(rt.getSelectedTaperPlan()?.substanceId, WEED_ID);
});

test('switching Simple/Advanced experience mode does not desync taper state', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    installDom(rt, plans);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'taper-b', editingTaperId: null });

    rt.persistExperienceMode('advanced');
    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-b');
    assert.equal(rt.getTaperUiState().mode, 'view');

    rt.persistExperienceMode('simple');
    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-b');
    assert.equal(rt.getTaperUiState().mode, 'view');
});

test('stale hidden form id cannot override taperUiState on save', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);

    rt.setTaperUiState({ mode: 'create', selectedTaperId: null, editingTaperId: null, sourceTaperId: null });
    nodes.get('taper-editing-plan-id').value = 'taper-b';
    fillCreateForm(nodes, 'Should be new');

    assert.equal(rt.getTaperFormMode(), 'create');
    assert.equal(rt.resolveTaperFormEditingPlanId(), null);
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);

    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 3);
    assert.equal(data.taperPlansV2.find(p => p.name === 'Should be new')?.id !== 'taper-b', true);
    assert.equal(data.taperPlansV2.find(p => p.id === 'taper-b').name, 'Beta');
});

test('populateTaperPlanDropdown reconciles invalid selectedTaperId through setTaperUiState', () => {
    const plans = [makePlan({ id: 'taper-a' })];
    const rt = setupApp(plans);
    installDom(rt, plans);
    rt.setTaperUiState({ mode: 'view', selectedTaperId: 'missing-id' });

    rt.populateTaperPlanDropdown();

    assert.equal(rt.getTaperUiState().selectedTaperId, 'taper-a');
    assert.equal(rt.getSelectedTaperId(), 'taper-a');
});
