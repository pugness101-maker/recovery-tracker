import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-04';
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
        options: props.options || [],
        className: props.className || '',
        classList: {
            add(...n) {
                n.forEach(x => classes.add(x));
                node.className = [...classes].join(' ');
            },
            remove(...n) {
                n.forEach(x => classes.delete(x));
                node.className = [...classes].join(' ');
            },
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
        setAttribute(name, value) {
            if (name === 'hidden') this.hidden = true;
            if (name === 'data-gp-view') this.dataset.gpView = value;
        },
        removeAttribute(name) {
            if (name === 'hidden') this.hidden = false;
        },
        getAttribute(name) {
            if (name === 'data-gp-view') return this.dataset.gpView || '';
            if (name === 'hidden') return this.hidden ? '' : null;
            return null;
        },
        scrollIntoView() {}
    };
    if (props.hidden) node.hidden = true;
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
    const records = put('tapers-root', {
        className: 'combined-subview',
        hidden: true,
        dataset: { gpView: 'active history templates' }
    });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'active history templates' : null);
    const workspace = put('taper-tab', { className: 'taper-page taper-workspace', hidden: true });
    const setup = put('taper-setup', { className: 'taper-editor-panel hidden' });
    put('taper-dashboard', { className: 'hidden' });
    put('taper-no-plan', { className: 'hidden' });
    put('taper-disabled-msg', { className: 'hidden' });
    put('taper-plan-toolbar', { className: 'hidden' });
    put('taper-cancel-edit-btn', { className: 'hidden', tag: 'button' });
    put('taper-setup-title', { tag: 'h3', textContent: 'Create Taper Plan' });
    put('taper-generate-btn', { tag: 'button', textContent: 'Save Plan' });
    put('taper-form-status', { tag: 'p', hidden: true });
    put('taper-form', { tag: 'form', dataset: {} });
    // ensure event APIs exist for dirty/suggest tracking
    const form = nodes.get('taper-form');
    form.addEventListener = () => {};
    form.removeEventListener = () => {};
    workspace.removeAttribute = (name) => { if (name === 'hidden') workspace.hidden = false; };
    workspace.setAttribute = (name) => { if (name === 'hidden') workspace.hidden = true; };
    put('taper-editing-plan-id', { tag: 'input', value: '' });
    put('taper-plan-name', { tag: 'input', value: '' });
    put('taper-substance', {
        tag: 'select',
        value: COKE_ID,
        options: [{ value: COKE_ID }]
    });
    put('start-date', { tag: 'input', value: '2026-08-01' });
    put('end-date', { tag: 'input', value: '2026-09-01' });
    put('reduction-type', { tag: 'select', value: 'reduce-amount' });
    put('current-avg', { tag: 'input', value: '2' });
    put('goal-avg', { tag: 'input', value: '0.5' });
    put('reduction-amount', { tag: 'input', value: '0.2' });
    put('reduction-percent', { tag: 'input', value: '10' });
    put('weekly-max', { tag: 'input', value: '' });
    put('monthly-max', { tag: 'input', value: '' });
    put('taper-notes', { tag: 'textarea', value: '' });
    put('taper-priority', { tag: 'select', value: 'normal' });
    put('taper-status', { tag: 'select', value: 'active' });
    put('taper-set-primary', { tag: 'input', checked: true });
    put('do-not-surpass-daily', { tag: 'input', checked: true });
    put('do-not-surpass-weekly', { tag: 'input', checked: false });
    put('purchase-taper-enabled', { tag: 'input', checked: false });
    put('plan-type-hint', { tag: 'p' });
    put('taper-suggest-banner', { className: 'hidden' });
    put('taper-current-metrics', { className: 'hidden' });
    put('taper-current-metrics-body');
    put('taper-current-metrics-title');
    put('taper-type-suggestions', { className: 'hidden' });
    put('taper-weekly-suggest', { className: 'hidden' });
    put('taper-monthly-suggest', { className: 'hidden' });
    put('gp-subnav');
    put('gp-subnav-select', { tag: 'select', value: 'overview' });
    put('gp-loading', { className: 'hidden' });
    put('gp-error', { className: 'hidden' });
    put('gp-error-message');

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
    return { nodes, workspace, setup, records, overview };
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
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: extra.taperPlansV2 || [],
        settings: {
            currency: '$',
            substanceSettings: {},
            combinedNav: { goalsPlansView: 'overview' },
            taperSuggestions: { autoSuggestEnabled: false, lookbackDays: 30 }
        },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    rt.ensureCombinedNavPrefs();
    return rt;
}

test('New Taper opens the form workspace without a blank view', () => {
    const rt = setupApp();
    const { workspace, setup } = installDom(rt);
    rt.openUnifiedNewTaper();
    assert.equal(workspace.hidden, false);
    assert.ok(!setup.classList.contains('hidden'));
    assert.match(rt.document.getElementById('taper-setup-title').textContent, /Create Taper/i);
    assert.equal(rt.taperFormInitializedRef.value, true);
});

test('saving a new taper persists and appears in Active', () => {
    const rt = setupApp();
    const { nodes, workspace, setup } = installDom(rt);
    rt.openUnifiedNewTaper();
    nodes.get('taper-plan-name').value = 'Fresh create taper';
    nodes.get('start-date').value = '2026-08-01';
    nodes.get('end-date').value = '2026-09-01';
    nodes.get('reduction-type').value = 'reduce-amount';
    nodes.get('current-avg').value = '2';
    nodes.get('goal-avg').value = '0.5';
    nodes.get('reduction-amount').value = '0.25';
    nodes.get('taper-priority').value = 'high';
    nodes.get('taper-status').value = 'active';

    const ok = rt.handleTaperSubmit({ preventDefault() {} });
    assert.equal(ok, true);
    const data = rt.__getTestAppData();
    const saved = (data.taperPlansV2 || []).find(p => p.name === 'Fresh create taper');
    assert.ok(saved);
    assert.equal(saved.status, 'active');
    assert.equal(saved.priority, 'high');
    assert.equal(workspace.hidden, true);
    assert.ok(setup.classList.contains('hidden'));
    assert.match(nodes.get('tapers-root').innerHTML, /Fresh create taper/);
});

test('Edit Taper opens filled form and save updates the existing record', () => {
    const existing = {
        id: 'edit-me',
        name: 'Original taper',
        substanceId: COKE_ID,
        status: 'active',
        priority: 'normal',
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 3,
        goalDailyAverage: 1,
        reductionAmount: 0.2,
        weeklyTargets: [{ weekStart: '2026-07-28', weekEnd: '2026-08-03', targetAmount: 10 }],
        notes: 'old note',
        isPrimary: true,
        createdAt: '2026-07-01T00:00:00.000Z'
    };
    const rt = setupApp({ taperPlansV2: [existing] });
    const { nodes, workspace, setup } = installDom(rt);

    const opened = rt.editUnifiedTaperRecord('edit-me');
    assert.notEqual(opened, false);
    assert.equal(workspace.hidden, false);
    assert.ok(!setup.classList.contains('hidden'));
    assert.match(nodes.get('taper-setup-title').textContent, /Edit Taper/i);
    assert.equal(nodes.get('taper-editing-plan-id').value, 'edit-me');
    assert.equal(nodes.get('taper-plan-name').value, 'Original taper');

    nodes.get('taper-plan-name').value = 'Updated taper';
    nodes.get('taper-priority').value = 'high';
    nodes.get('taper-status').value = 'paused';
    nodes.get('taper-notes').value = 'new note';
    nodes.get('goal-avg').value = '0.8';
    nodes.get('end-date').value = '2026-09-15';

    const ok = rt.handleTaperSubmit({ preventDefault() {} });
    assert.equal(ok, true);

    const updated = rt.__getTestAppData().taperPlansV2.find(p => p.id === 'edit-me');
    assert.ok(updated);
    assert.equal(updated.name, 'Updated taper');
    assert.equal(updated.priority, 'high');
    assert.equal(updated.status, 'paused');
    assert.equal(updated.notes, 'new note');
    assert.equal(updated.endDate, '2026-09-15');
    assert.equal((rt.__getTestAppData().taperPlansV2 || []).filter(p => p.id === 'edit-me').length, 1);
    assert.match(nodes.get('tapers-root').innerHTML || nodes.get('gp-overview-root').innerHTML || '', /Updated taper|active taper|Paused|paused/i);
});
