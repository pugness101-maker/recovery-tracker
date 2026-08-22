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
        querySelectorAll(sel) {
            if (sel === '[data-sm-plan-advanced="true"]') return [];
            if (sel === '.combined-subview') return [];
            return [];
        },
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
    const records = put('tapers-root', { className: 'combined-subview', hidden: true, dataset: { gpView: 'templates' } });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'templates' : null);
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
    put('taper-metric-visibility-panel', { className: 'hidden' });
    put('taper-metric-visibility-body');

    const tabRoot = el('goals-plans-tab', { tag: 'section', className: 'sm-plan-simple' });
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
    rt.document.querySelectorAll = (sel) => {
        if (sel === '[data-sm-plan-advanced="true"]') return [];
        return [];
    };
    return { nodes, workspace, records, overview, tabRoot };
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
        settings: {
            currency: '$',
            substanceSettings: {},
            experienceMode: extra.experienceMode || 'advanced',
            combinedNav: { goalsPlansView: 'overview', ...(extra.combinedNav || {}) },
            ...(extra.settings || {})
        },
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

const samplePlans = () => ([
    {
        id: 'active-1',
        name: 'Active taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        weeklyTargets: [{ weekStart: '2026-07-27', weekEnd: '2026-08-02', targetAmount: 1 }],
        updatedAt: '2026-08-01T12:00:00.000Z'
    },
    {
        id: 'paused-1',
        name: 'Paused taper',
        substanceId: COKE_ID,
        status: 'paused',
        startDate: '2026-06-01',
        endDate: '2026-09-01',
        reductionType: 'reduce-amount',
        weeklyTargets: [],
        updatedAt: '2026-07-15T12:00:00.000Z'
    },
    {
        id: 'completed-1',
        name: 'Completed taper',
        substanceId: COKE_ID,
        status: 'completed',
        startDate: '2026-05-01',
        endDate: '2026-06-30',
        reductionType: 'reduce-amount',
        weeklyTargets: [],
        updatedAt: '2026-06-30T12:00:00.000Z'
    },
    {
        id: 'archived-1',
        name: 'Archived taper',
        substanceId: COKE_ID,
        status: 'archived',
        startDate: '2026-04-01',
        endDate: '2026-05-31',
        reductionType: 'reduce-amount',
        weeklyTargets: [],
        updatedAt: '2026-05-31T12:00:00.000Z'
    }
]);

test('History tab no longer exists; Overview and Templates remain', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /data-gp-view="history"/);
    assert.doesNotMatch(html, /setGoalsPlansView\('history'\)/);
    assert.match(html, /data-gp-view="overview"/);
    assert.match(html, /data-gp-view="templates"/);
    assert.match(html, /Customize metrics/);
    assert.match(html, /New Taper/);
    assert.doesNotMatch(html, /sm-plan-simple-actions/);
    assert.deepEqual([...loadRecoveryTrackerApp().GOALS_PLANS_VIEWS], ['overview', 'templates']);
});

test('Overview contains summary cards plus filtered taper list controls', () => {
    const rt = setupApp({ taperPlansV2: samplePlans() });
    const { nodes } = installTapersDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const html = nodes.get('gp-overview-root').innerHTML;
    assert.match(html, /Active tapers/);
    assert.match(html, /On track/);
    assert.match(html, /Above target/);
    assert.match(html, /Closest end date/);
    assert.match(html, /Current taper step/);
    assert.match(html, /taper-overview-filters/);
    assert.match(html, /setGoalsPlansHistoryFilter/);
    assert.match(html, /setGoalsPlansFilter\('listStatus'/);
    assert.match(html, /setGoalsPlansShowArchivedInList/);
    assert.match(html, /id="taper-list"/);
    assert.match(html, /Active taper/);
    assert.match(html, /Paused taper/);
    assert.match(html, /Completed taper/);
    assert.doesNotMatch(html, /Archived taper/);
});

test('history and status filters work on unified Overview', () => {
    const rt = setupApp({ taperPlansV2: samplePlans() });
    installTapersDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });

    rt.setGoalsPlansHistoryFilter('completed-tapers');
    let records = rt.buildUnifiedOverviewTaperRecords();
    assert.deepEqual(records.map(r => r.id), ['completed-1']);

    rt.setGoalsPlansHistoryFilter('all');
    rt.setGoalsPlansFilter('listStatus', 'paused');
    records = rt.buildUnifiedOverviewTaperRecords();
    assert.deepEqual(records.map(r => r.id), ['paused-1']);

    rt.setGoalsPlansFilter('listStatus', 'all');
    rt.setGoalsPlansShowArchivedInList(true);
    records = rt.buildUnifiedOverviewTaperRecords();
    assert.ok(records.some(r => r.id === 'archived-1'));
});

test('archived, completed, and active tapers can all be shown through filters', () => {
    const rt = setupApp({ taperPlansV2: samplePlans() });
    installTapersDom(rt);
    rt.setGoalsPlansShowArchivedInList(true);
    rt.setGoalsPlansFilter('listStatus', 'all');
    rt.setGoalsPlansHistoryFilter('all');
    rt.refreshGoalsPlansOverview();
    const ids = rt.buildUnifiedOverviewTaperRecords().map(r => r.id);
    assert.deepEqual(ids.sort(), ['active-1', 'archived-1', 'completed-1', 'paused-1'].sort());
});

test('old History routes and prefs redirect to Overview', () => {
    const rt = setupApp({ combinedNav: { goalsPlansView: 'history' } });
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');
    assert.equal(rt.normalizeCombinedView('history', rt.GOALS_PLANS_VIEWS, 'overview'), 'overview');
    assert.equal(rt.normalizeCombinedView('plan-history', rt.GOALS_PLANS_VIEWS, 'overview'), 'overview');
    assert.equal(rt.normalizeCombinedView('goal-history', rt.GOALS_PLANS_VIEWS, 'overview'), 'overview');
});

test('Simple and Advanced Tapers render the same controls on Overview', () => {
    const plans = samplePlans();
    const simple = setupApp({ taperPlansV2: plans, experienceMode: 'simple' });
    const advanced = setupApp({ taperPlansV2: plans, experienceMode: 'advanced' });
    const simpleDom = installTapersDom(simple);
    const advancedDom = installTapersDom(advanced);

    simple.applySimplePlanFormLayout();
    advanced.applySimplePlanFormLayout();
    assert.equal(simpleDom.tabRoot.classList.contains('sm-plan-simple'), false);

    simple.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    advanced.setGoalsPlansView('overview', { persist: false, skipRoute: true });

    const simpleHtml = simpleDom.nodes.get('gp-overview-root').innerHTML;
    const advancedHtml = advancedDom.nodes.get('gp-overview-root').innerHTML;
    for (const needle of [
        'taper-overview-filters',
        'setGoalsPlansHistoryFilter',
        'setGoalsPlansShowArchivedInList',
        'New Taper',
        'Browse templates',
        'Active tapers',
        'Delete'
    ]) {
        assert.match(simpleHtml, new RegExp(needle));
        assert.match(advancedHtml, new RegExp(needle));
    }
});

test('switching Experience Mode does not alter taper data or available actions', () => {
    const rt = setupApp({ taperPlansV2: samplePlans(), experienceMode: 'simple' });
    installTapersDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    const before = rt.__getTestAppData().taperPlansV2.length;
    const htmlSimple = rt.document.getElementById('gp-overview-root').innerHTML;

    rt.persistExperienceMode('advanced');
    rt.applySimplePlanFormLayout();
    rt.refreshGoalsPlansOverview();
    const htmlAdvanced = rt.document.getElementById('gp-overview-root').innerHTML;

    assert.equal(rt.__getTestAppData().taperPlansV2.length, before);
    assert.match(htmlSimple, /Duplicate/);
    assert.match(htmlAdvanced, /Duplicate/);
    assert.match(htmlSimple, /Archive/);
    assert.match(htmlAdvanced, /Archive/);
});

test('New Taper from Overview and Templates creates a new record', () => {
    for (const view of ['overview', 'templates']) {
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
        assert.equal(rt.getTaperFormMode(), 'create', `create mode from ${view}`);
        fillCreateForm(nodes, `Created from ${view}`);
        assert.equal(rt.handleTaperSubmit({ preventDefault() {} }), true, `save ok from ${view}`);
        const data = rt.__getTestAppData();
        assert.ok(data.taperPlansV2.find(p => p.name === `Created from ${view}`));
        assert.equal(data.taperPlansV2.find(p => p.id === 'selected-existing').name, 'Already selected');
    }
});

test('Archive and Delete still work from unified Overview cards', () => {
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
            id: 'delete-me',
            name: 'Delete me',
            substanceId: COKE_ID,
            status: 'active',
            isPrimary: false,
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            weeklyTargets: []
        }]
    });
    installTapersDom(rt);
    rt.setGoalsPlansView('overview', { persist: false, skipRoute: true });
    rt.archiveUnifiedTaperRecord('archive-me');
    assert.equal(rt.__getTestAppData().taperPlansV2.find(p => p.id === 'archive-me').status, 'archived');
    assert.equal(rt.ensureCombinedNavPrefs().goalsPlansView, 'overview');

    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
        rt.deleteUnifiedTaperRecord('delete-me');
    } finally {
        globalThis.confirm = originalConfirm;
    }
    assert.equal(rt.__getTestAppData().taperPlansV2.find(p => p.id === 'delete-me'), undefined);
});

test('taper templates remain available', () => {
    const rt = setupApp();
    const { nodes, workspace } = installTapersDom(rt);
    assert.ok(rt.TAPER_TEMPLATES.length >= 6);
    rt.setGoalsPlansView('templates', { persist: false, skipRoute: true });
    assert.match(nodes.get('tapers-root').innerHTML, /Linear reduction/);
    rt.applyTaperTemplate('manual');
    assert.equal(workspace.hidden, false);
    assert.equal(rt.getTaperFormMode(), 'create');
});
