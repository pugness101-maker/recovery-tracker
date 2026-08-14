import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-15';
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
        scrollIntoView() {},
        addEventListener(type, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(handler);
        },
        dispatchEvent(type) {
            (this._listeners?.[type] || []).forEach(fn => fn({ preventDefault() {}, target: this }));
        }
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

    put('gp-overview-root');
    put('taper-tab', { hidden: true });
    put('taper-setup', { className: 'taper-editor-panel hidden' });
    const form = put('taper-form', { tag: 'form' });
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
    put('taper-form-date-summary');
    put('taper-plan-date-summary');
    put('taper-plan-time-progress');
    put('taper-plan-summary-text');
    put('taper-plan-badges');
    put('taper-plan-pct-fill');
    put('taper-plan-pct-label');
    put('taper-start-from-section');
    put('taper-start-from', { tag: 'select', value: 'blank' });
    put('taper-start-builtin-group', { className: 'hidden' });
    put('taper-start-builtin-template', { tag: 'select', value: 'linear' });
    put('taper-start-my-template-group', { className: 'hidden' });
    put('taper-start-my-template', { tag: 'select', value: '' });
    put('taper-start-copy-group', { className: 'hidden' });
    put('taper-start-copy-plan', { tag: 'select', value: plans[0]?.id || '' });
    put('taper-plan-select', { tag: 'select', value: plans[0]?.id || '' });
    put('taper-substance', { tag: 'select', value: COKE_ID, options: [{ value: COKE_ID }] });
    put('start-date', { tag: 'input', value: '2026-08-01' });
    put('end-date', { tag: 'input', value: '2026-08-31' });
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
    return { nodes, form };
}

function makePlan(overrides = {}) {
    return {
        id: 'taper-a',
        name: 'Taper A',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        notes: 'alpha',
        weeklyTargets: [{ week: 1, weekStart: '2026-08-10', weekEnd: '2026-08-16', targetAmount: 3.5 }],
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        ...overrides
    };
}

function setupApp(plans = []) {
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
        settings: { currency: '$', combinedNav: { goalsPlansView: 'overview' } },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2();
    return rt;
}

function fillCreateForm(nodes, name, start = '2026-08-01', end = '2026-08-31') {
    nodes.get('taper-plan-name').value = name;
    nodes.get('start-date').value = start;
    nodes.get('end-date').value = end;
    nodes.get('reduction-type').value = 'reduce-amount';
    nodes.get('current-avg').value = '2';
    nodes.get('goal-avg').value = '0.5';
    nodes.get('reduction-amount').value = '0.25';
    nodes.get('taper-status').value = 'active';
}

test('New Taper creates exactly one record on save', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    rt.showNewTaperPlan();
    fillCreateForm(nodes, 'Brand new taper');
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 2);
});

test('double submit while saving creates only one record', () => {
    const rt = setupApp([]);
    const { nodes } = installDom(rt);
    rt.showNewTaperPlan();
    fillCreateForm(nodes, 'Once only');
    rt.taperUiStateRef.value.isSaving = true;
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), false);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 0);
    rt.setTaperUiState({ isSaving: false });
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);
});

test('Edit save updates one record and creates none', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    rt.editTaperPlanById('taper-a');
    nodes.get('taper-plan-name').value = 'Edited name';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 1);
    assert.equal(data.taperPlansV2[0].name, 'Edited name');
});

test('Duplicate opens form and save creates exactly one new record', () => {
    const rt = setupApp([makePlan()]);
    const { nodes } = installDom(rt);
    assert.equal(rt.duplicateTaperPlanById('taper-a'), true);
    assert.equal(rt.getTaperUiState().mode, 'duplicate');
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);
    nodes.get('taper-plan-name').value = 'Taper A copy saved';
    assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true);
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 2);
    assert.equal(data.taperPlansV2.find(p => p.id === 'taper-a').notes, 'alpha');
});

test('template application stays create mode until save', () => {
    const rt = setupApp([makePlan()]);
    installDom(rt);
    rt.selectedTaperPlanIdRef.value = 'taper-a';
    rt.applyTaperTemplate('linear');
    assert.equal(rt.getTaperUiState().mode, 'create');
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);
});

test('selecting taper loads correct record in view mode', () => {
    const plans = [
        makePlan({ id: 'taper-a', name: 'Alpha' }),
        makePlan({ id: 'taper-b', name: 'Beta', isPrimary: false, notes: 'beta' })
    ];
    const rt = setupApp(plans);
    const { nodes } = installDom(rt, plans);
    nodes.get('taper-plan-select').value = 'taper-b';
    rt.onTaperPlanChange();
    assert.equal(rt.getTaperUiState().mode, 'view');
    assert.equal(rt.getSelectedTaperPlan()?.id, 'taper-b');
    assert.equal(rt.getSelectedTaperPlan()?.notes, 'beta');
});

test('bindTaperFormSubmitHandlers does not stack listeners', () => {
    const rt = setupApp([]);
    const { form } = installDom(rt);
    rt.bindTaperFormSubmitHandlers();
    rt.bindTaperFormSubmitHandlers();
    rt.bindTaperFormSubmitHandlers();
    assert.equal(form.dataset.submitBound, '1');
    assert.equal((form._listeners?.submit || []).length, 1);
});

test('calendar day duration calculations', () => {
    const rt = setupApp([]);
    installDom(rt);
    rt.setTestReferenceDate('2026-08-15');
    const sameDay = rt.computeTaperCalendarDayMetrics('2026-08-01', '2026-08-01', '2026-08-01');
    assert.equal(sameDay.valid, true);
    assert.equal(sameDay.totalDays, 1);
    assert.equal(sameDay.sameDay, true);

    const month = rt.computeTaperCalendarDayMetrics('2026-08-01', '2026-08-31', '2026-08-15');
    assert.equal(month.totalDays, 31);
    assert.equal(month.elapsedDays, 15);
    assert.equal(month.remainingDays, 16);

    const twoWeeks = rt.formatTaperDurationLabel(14);
    assert.equal(twoWeeks, '2 weeks');

    const invalid = rt.validateTaperPlanDates('2026-09-01', '2026-08-01');
    assert.equal(invalid.ok, false);
});

test('archived taper still displays correct date summary', () => {
    const rt = setupApp([makePlan({ status: 'archived', endDate: '2026-08-31' })]);
    installDom(rt);
    const summary = rt.formatTaperDateSummary('2026-08-01', '2026-08-31');
    assert.match(summary, /Aug 1/);
    assert.match(summary, /31 days/);
    const progress = rt.formatTaperTimeProgressSummary('2026-08-01', '2026-08-31', { status: 'archived' });
    assert.match(progress, /31 days total/);
});

test('detectSuspiciousDuplicateTapers groups similar records', () => {
    const rt = setupApp([
        makePlan({ id: 'a', name: 'A' }),
        makePlan({ id: 'b', name: 'B copy' })
    ]);
    const dupes = rt.detectSuspiciousDuplicateTapers();
    assert.equal(dupes.length, 1);
    assert.equal(dupes[0].count, 2);
    assert.equal(dupes[0].plans.length, 2);
});
