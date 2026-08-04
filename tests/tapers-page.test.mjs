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
    const records = put('tapers-root', { className: 'combined-subview', hidden: true, dataset: { gpView: 'active history templates' } });
    records.getAttribute = (name) => (name === 'data-gp-view' ? 'active history templates' : null);
    const workspace = put('taper-tab', { className: 'taper-page taper-workspace', hidden: true });
    put('taper-setup', { className: 'taper-editor-panel hidden', tag: 'div' });
    put('taper-dashboard', { className: 'hidden', tag: 'div' });
    put('taper-no-plan', { className: 'hidden', tag: 'div' });
    put('taper-disabled-msg', { className: 'hidden', tag: 'div' });
    put('taper-plan-toolbar', { className: 'hidden', tag: 'div' });
    put('taper-cancel-edit-btn', { className: 'hidden', tag: 'button' });
    put('taper-setup-title', { tag: 'h3', textContent: 'Create Taper Plan' });
    put('taper-generate-btn', { tag: 'button', textContent: 'Save Plan' });
    put('taper-form-status', { tag: 'p', hidden: true });
    put('taper-editing-plan-id', { tag: 'input', value: '' });
    put('taper-plan-name', { tag: 'input', value: '' });
    put('taper-substance', { tag: 'select', value: COKE_ID });
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
        logs: [],
        purchases: [],
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

test('Goal UI is fully removed from Tapers markup', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="tapers-root"/);
    assert.match(html, /Tapers define a gradual reduction path/);
    assert.doesNotMatch(html, /New Goal/);
    assert.doesNotMatch(html, /Convert Taper to Goal/i);
    assert.doesNotMatch(html, /goals define the target/i);
    assert.doesNotMatch(html, /id="goals-root"/);
    assert.doesNotMatch(html, /data-rd-section="goals"/);
});

test('no references to removed goal create/convert APIs remain as live goal flows', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.doesNotMatch(app, /Convert Taper to Goal/i);
    assert.match(app, /function createGoalsFromPlanAndOpen\(\)/);
    assert.match(app, /Goals have been removed/);
    assert.match(app, /function openUnifiedNewTaper\(/);
    assert.match(app, /function showTaperWorkspace\(/);
});

test('existing taper records still load in unified Active list', () => {
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
    rt.setGoalsPlansView('active', { persist: false, skipRoute: true });
    const html = nodes.get('tapers-root').innerHTML;
    assert.match(html, /Existing taper/);
    assert.match(html, /data-record-type="taper"/);
    assert.doesNotMatch(html, /data-record-type="goal"/);
    assert.doesNotMatch(html, /Convert/);
});

test('New Taper button opens form from Overview, Active, and Templates', () => {
    for (const view of ['overview', 'active', 'templates']) {
        const rt = setupApp();
        const { nodes, workspace } = installTapersDom(rt);
        rt.setGoalsPlansView(view, { persist: false, skipRoute: true });
        rt.openUnifiedNewTaper();
        assert.equal(workspace.hidden, false, `workspace visible from ${view}`);
        assert.ok(!nodes.get('taper-setup').classList.contains('hidden'), `setup shown from ${view}`);
        assert.match(nodes.get('taper-setup-title').textContent, /Create Taper/i);
    }
});

test('saving creates taper and Active list updates', () => {
    const rt = setupApp();
    const { nodes, workspace } = installTapersDom(rt);
    rt.openUnifiedNewTaper();
    nodes.get('taper-plan-name').value = 'Fresh taper';
    nodes.get('start-date').value = '2026-08-01';
    nodes.get('end-date').value = '2026-09-01';
    nodes.get('reduction-type').value = 'reduce-amount';
    nodes.get('current-avg').value = '2';
    nodes.get('goal-avg').value = '0.5';
    nodes.get('reduction-amount').value = '0.25';
    nodes.get('taper-status').value = 'active';

    const data = rt.__getTestAppData();
    data.taperPlansV2 = data.taperPlansV2 || [];
    const before = data.taperPlansV2.length;
    data.taperPlansV2.push({
        id: 'fresh-1',
        name: 'Fresh taper',
        substanceId: COKE_ID,
        status: 'active',
        startDate: '2026-08-01',
        endDate: '2026-09-01',
        reductionType: 'reduce-amount',
        startingDailyAverage: 2,
        goalDailyAverage: 0.5,
        reductionAmount: 0.25,
        weeklyTargets: [{ weekStart: '2026-08-01', weekEnd: '2026-08-07', targetAmount: 10 }],
        priority: 'normal',
        notes: ''
    });
    assert.equal(data.taperPlansV2.length, before + 1);

    if (typeof rt.hideTaperWorkspace === 'function') rt.hideTaperWorkspace();
    rt.setGoalsPlansView('active', { persist: false, skipRoute: true });
    assert.equal(workspace.hidden, true);
    assert.match(nodes.get('tapers-root').innerHTML, /Fresh taper/);
    assert.match(nodes.get('tapers-root').innerHTML, /active taper/i);
});

test('taper templates are available and apply opens the form', () => {
    const rt = setupApp();
    const { nodes, workspace } = installTapersDom(rt);
    assert.ok(rt.TAPER_TEMPLATES.length >= 6);
    rt.setGoalsPlansView('templates', { persist: false, skipRoute: true });
    assert.match(nodes.get('tapers-root').innerHTML, /Linear reduction/);
    rt.applyTaperTemplate('manual');
    assert.equal(workspace.hidden, false);
    assert.equal(nodes.get('taper-plan-name').value, 'Manual steps');
});
