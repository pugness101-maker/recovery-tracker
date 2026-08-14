import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-10';
const COKE_ID = 'coke';
const NICOTINE_ID = 'nicotine';

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
        setAttribute(name) { if (name === 'hidden') this.hidden = true; },
        removeAttribute(name) { if (name === 'hidden') this.hidden = false; },
        getAttribute(name) {
            if (name === 'data-gp-view') return this.dataset.gpView || '';
            return null;
        },
        scrollIntoView() {}
    };
    return node;
}

function makePlan(overrides = {}) {
    return {
        id: overrides.id || `plan-${Math.random().toString(36).slice(2, 8)}`,
        name: overrides.name || 'Taper',
        substanceId: overrides.substanceId || COKE_ID,
        status: overrides.status || 'active',
        isPrimary: overrides.isPrimary ?? false,
        isPaused: false,
        startDate: overrides.startDate || '2026-08-01',
        endDate: overrides.endDate || '2026-09-01',
        reductionType: overrides.reductionType || 'reduce-amount',
        weeklyTargets: overrides.weeklyTargets || [
            { weekNum: 1, weekStart: '2026-08-01', weekEnd: '2026-08-07', label: 'Week 1', targetAmount: 1, actualAmount: 0.5 }
        ],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        ...overrides
    };
}

function installDom(rt, substanceId = COKE_ID) {
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
        dataset: { gpView: 'history templates' }
    });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'history templates' : null);
    put('taper-tab', { className: 'taper-page taper-workspace', hidden: true });
    put('taper-setup', { className: 'hidden' });
    put('taper-dashboard', { className: 'hidden' });
    put('taper-no-plan', { className: 'hidden' });
    put('taper-disabled-msg', { className: 'hidden' });
    put('taper-plan-toolbar', { className: 'hidden' });
    put('taper-cancel-edit-btn', { className: 'hidden' });
    put('taper-setup-title', { textContent: 'Create Taper Plan' });
    put('taper-generate-btn', { textContent: 'Save Plan' });
    put('taper-form-status', { hidden: true });
    put('taper-editing-plan-id', { tag: 'input', value: '' });
    put('taper-plan-name', { tag: 'input', value: '' });
    const substanceSelect = put('taper-substance', {
        tag: 'select',
        value: substanceId,
        options: [
            { value: COKE_ID, textContent: 'Coke' },
            { value: NICOTINE_ID, textContent: 'Nicotine' }
        ]
    });
    substanceSelect.options.some = function some(fn) {
        return Array.prototype.some.call(this, fn);
    };
    put('start-date', { tag: 'input', value: '2026-08-01' });
    put('end-date', { tag: 'input', value: '2026-09-01' });
    put('reduction-type', { tag: 'select', value: 'reduce-amount' });
    put('current-avg', { tag: 'input', value: '2' });
    put('goal-avg', { tag: 'input', value: '0.5' });
    put('reduction-amount', { tag: 'input', value: '0.2' });
    put('taper-notes', { tag: 'textarea', value: '' });
    put('taper-priority', { tag: 'select', value: 'normal' });
    put('taper-status', { tag: 'select', value: 'active' });
    put('taper-set-primary', { tag: 'input', checked: true });
    put('do-not-surpass-daily', { tag: 'input', checked: true });
    put('purchase-taper-enabled', { tag: 'input', checked: false });
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
    return { nodes, substanceSelect };
}

function setupApp(extra = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    const cokePlan = makePlan({
        id: 'coke-active',
        name: 'Coke taper',
        substanceId: COKE_ID,
        endDate: '2026-08-20',
        isPrimary: true,
        weeklyTargets: [
            { weekNum: 2, weekStart: '2026-08-08', weekEnd: '2026-08-14', label: 'Coke Week 2', targetAmount: 1, actualAmount: 0.4 }
        ]
    });
    const nicPlan = makePlan({
        id: 'nic-active',
        name: 'Nicotine taper',
        substanceId: NICOTINE_ID,
        endDate: '2026-08-12',
        isPrimary: true,
        reductionType: 'reduce-puffs',
        weeklyTargets: [
            { weekNum: 3, weekStart: '2026-08-08', weekEnd: '2026-08-14', label: 'Nicotine Week 3', targetAmount: 100, actualAmount: 80 }
        ]
    });
    const cokeDone = makePlan({
        id: 'coke-done',
        name: 'Old Coke taper',
        substanceId: COKE_ID,
        status: 'completed',
        endDate: '2026-07-01'
    });
    const nicArchived = makePlan({
        id: 'nic-archived',
        name: 'Old Nicotine taper',
        substanceId: NICOTINE_ID,
        status: 'archived',
        endDate: '2026-07-15'
    });

    rt.__setTestAppData({
        substances: [
            {
                id: COKE_ID,
                name: 'Coke',
                trackingMode: 'powder',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                taperTrackingEnabled: true,
                active: true,
                isMain: true
            },
            {
                id: NICOTINE_ID,
                name: 'Nicotine',
                trackingMode: 'vape',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                costTrackingEnabled: true,
                taperTrackingEnabled: true,
                active: true,
                isMain: false
            }
        ],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2: extra.taperPlansV2 || [cokePlan, nicPlan, cokeDone, nicArchived],
        settings: {
            currency: '$',
            substanceSettings: {},
            taperSubstanceId: extra.taperSubstanceId || COKE_ID,
            combinedNav: { goalsPlansView: 'overview' }
        },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2();
    rt.ensureCombinedNavPrefs();
    const dom = installDom(rt, extra.selectedSubstance || COKE_ID);
    return { rt, ...dom };
}

test('Coke filter excludes Nicotine tapers', () => {
    const { rt } = setupApp();
    const filtered = rt.getFilteredTapers({ substance: COKE_ID, includeArchived: true });
    assert.ok(filtered.every(p => p.substanceId === COKE_ID));
    assert.equal(filtered.some(p => p.substanceId === NICOTINE_ID), false);
    assert.ok(filtered.some(p => p.id === 'coke-active'));
});

test('Nicotine filter excludes Coke tapers', () => {
    const { rt } = setupApp({ selectedSubstance: NICOTINE_ID });
    const filtered = rt.getFilteredTapers({ substance: NICOTINE_ID, includeArchived: true });
    assert.ok(filtered.every(p => p.substanceId === NICOTINE_ID));
    assert.equal(filtered.some(p => p.substanceId === COKE_ID), false);
    assert.ok(filtered.some(p => p.id === 'nic-active'));
});

test('Overview cards respect substance', () => {
    const { rt, nodes } = setupApp({ selectedSubstance: COKE_ID });
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const html = nodes.get('gp-overview-root').innerHTML;
    const overview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: COKE_ID });
    assert.equal(overview.activeTaperCount, 1);
    assert.equal(overview.plansOnTrack + overview.plansAboveTarget, 1);
    assert.match(html, /Active tapers[\s\S]*?<strong>1<\/strong>/);
    assert.doesNotMatch(html, /Nicotine taper/);
    assert.match(html, /Coke taper/);
});

test('Closest end date respects substance', () => {
    const { rt } = setupApp({ selectedSubstance: COKE_ID });
    const cokeOverview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: COKE_ID });
    assert.equal(cokeOverview.closestGoalDeadline?.name, 'Coke taper');
    assert.equal(cokeOverview.closestGoalDeadline?.endDate, '2026-08-20');

    const nicOverview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: NICOTINE_ID });
    assert.equal(nicOverview.closestGoalDeadline?.name, 'Nicotine taper');
    assert.equal(nicOverview.closestGoalDeadline?.endDate, '2026-08-12');
});

test('Current taper step respects substance', () => {
    const { rt } = setupApp({ selectedSubstance: COKE_ID });
    const cokeOverview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: COKE_ID });
    assert.match(String(cokeOverview.currentPlanWeek), /Coke Week 2|Week 2|2/);
    assert.doesNotMatch(String(cokeOverview.currentPlanWeek), /Nicotine/);

    const nicOverview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: NICOTINE_ID });
    assert.match(String(nicOverview.currentPlanWeek), /Nicotine Week 3|Week 3|3/);
    assert.doesNotMatch(String(nicOverview.currentPlanWeek), /Coke/);
});

test('Overview and History respect substance', () => {
    const { rt, nodes, substanceSelect } = setupApp({ selectedSubstance: COKE_ID });

    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    let html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /Coke taper/);
    assert.doesNotMatch(html, /Nicotine taper/);
    assert.match(html, /Active Coke tapers/i);

    substanceSelect.value = NICOTINE_ID;
    rt.onTaperSubstanceChange();
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /Nicotine taper/);
    assert.doesNotMatch(html, /Coke taper/);
    assert.match(html, /Active Nicotine tapers/i);

    rt.setGoalsPlansView('history', { persist: false, skipRoute: true });
    html = nodes.get('tapers-root').innerHTML;
    assert.match(html, /Old Nicotine taper/);
    assert.doesNotMatch(html, /Old Coke taper/);
});

test('Selection persists after refresh', () => {
    const { rt, substanceSelect } = setupApp({ selectedSubstance: COKE_ID });
    substanceSelect.value = NICOTINE_ID;
    rt.onTaperSubstanceChange();
    assert.equal(rt.__getTestAppData().settings.taperSubstanceId, NICOTINE_ID);

    // Simulate reload: clear DOM value and read from persisted settings.
    substanceSelect.value = '';
    const restored = rt.getTaperSubstanceId(rt.__getTestAppData());
    assert.equal(restored, NICOTINE_ID);
});

test('New Taper inherits selected substance', () => {
    const { rt, substanceSelect, nodes } = setupApp({ selectedSubstance: NICOTINE_ID });
    substanceSelect.value = NICOTINE_ID;
    rt.persistTaperSubstanceId(NICOTINE_ID);
    assert.equal(rt.getTaperSubstanceId(), NICOTINE_ID);
    const opened = rt.showNewTaperPlan();
    assert.equal(opened, true);
    assert.equal(rt.getTaperSubstanceId(), NICOTINE_ID);
    assert.match(nodes.get('taper-plan-name').value, /Nicotine/i);
});

test('empty state does not fall back to another substance', () => {
    const { rt, nodes } = setupApp({
        selectedSubstance: COKE_ID,
        taperPlansV2: [
            makePlan({ id: 'nic-only', name: 'Nicotine only', substanceId: NICOTINE_ID, endDate: '2026-08-15' })
        ]
    });
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /No active Coke tapers/);
    assert.doesNotMatch(html, /Nicotine only/);
    const overview = rt.buildGoalsPlansOverview(rt.__getTestAppData(), { substance: COKE_ID });
    assert.equal(overview.activeTaperCount, 0);
    assert.equal(overview.closestGoalDeadline, null);
});

test('Open Edit Duplicate Pause Complete Archive Delete and New Taper still work under filter', () => {
    const { rt, nodes, substanceSelect } = setupApp({ selectedSubstance: COKE_ID });
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    let html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /onclick="openUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="editUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="duplicateUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="pauseUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="completeUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="archiveUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="deleteUnifiedTaperRecord\('coke-active'\)"/);
    assert.match(html, /onclick="openUnifiedNewTaper\(\);?"/);

    substanceSelect.value = NICOTINE_ID;
    rt.onTaperSubstanceChange();
    assert.equal(rt.getTaperSubstanceId(), NICOTINE_ID);
    const opened = rt.openUnifiedNewTaper();
    assert.equal(opened, undefined);
    assert.equal(rt.getTaperSubstanceId(), NICOTINE_ID);
});
