import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeRichPlan(overrides = {}) {
    return {
        id: 'taper-coke-rich',
        substanceId: COKE_ID,
        name: 'Rich coke taper',
        status: 'active',
        isPrimary: true,
        reductionType: 'reduce-amount',
        startDate: '2026-06-01',
        endDate: '2026-08-31',
        startingDailyAverage: 2.5,
        goalDailyAverage: 0.75,
        reductionAmount: 0.25,
        reductionPercent: 0,
        weeklyMax: 12.5,
        monthlyMax: 40,
        notes: 'Keep weekends lighter',
        doNotSurpassDaily: false,
        doNotSurpassWeekly: true,
        purchaseTaperEnabled: true,
        buyingReductionSettings: {
            reducePurchaseAmount: {
                enabled: true,
                startingAmount: 7,
                goalAmount: 3.5,
                reductionPerWeek: 0.5,
                reductionPercentPerWeek: null
            },
            reducePurchaseCost: {
                enabled: false,
                startingSpend: null,
                goalSpend: null,
                reductionPerWeek: null,
                reductionPercentPerWeek: null
            },
            weeklyPurchaseLimit: { enabled: true, amount: 7 },
            weeklySpendingLimit: { enabled: false, amount: null },
            monthlyPurchaseCap: { enabled: true, amount: 28 },
            monthlySpendingCap: { enabled: false, amount: null },
            manualWeeklyBuyPlan: { enabled: false, values: [] },
            manualWeeklySpendingPlan: { enabled: false, values: [] },
            autoSpendFromCostPerGram: {
                enabled: true,
                source: 'manual',
                manualCostPerGram: 36.5,
                baselineRange: 'last-30',
                customStart: '',
                customEnd: ''
            }
        },
        weeklyTargets: [
            {
                week: 1,
                weekStart: '2026-06-01',
                weekEnd: '2026-06-07',
                weeklyMax: 12.5,
                dailyTarget: 2.5,
                actualUsed: 3,
                status: 'over'
            }
        ],
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
        ...overrides
    };
}

function makeData(plans) {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            units: ['g']
        }],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [{ id: 'goal-1', name: 'Stay under plan', linkedPlanId: 'taper-coke-rich', status: 'active' }],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: plans,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    };
}

function el(id, props = {}) {
    const classes = new Set(String(props.className || '').split(/\s+/).filter(Boolean));
    const node = {
        id,
        tag: props.tag || 'input',
        type: props.type || 'text',
        value: props.value ?? '',
        checked: !!props.checked,
        required: !!props.required,
        disabled: !!props.disabled,
        dataset: { ...(props.dataset || {}) },
        options: props.options || [],
        textContent: props.textContent || '',
        innerHTML: '',
        style: {},
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
        appendChild(child) {
            this.children.push(child);
            if (child && this.options) this.options.push(child);
            return child;
        },
        insertBefore(child) {
            this.children.unshift(child);
            return child;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {}
    };
    return node;
}

function installEditFormDom(rt) {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const node = el(id, props);
        nodes.set(id, node);
        return node;
    };

    const form = put('taper-form', { tag: 'form' });
    const fieldIds = [
        ['taper-editing-plan-id', {}],
        ['taper-plan-name', {}],
        ['taper-set-primary', { type: 'checkbox' }],
        ['reduction-type', { tag: 'select', options: [] }],
        ['start-date', { type: 'date' }],
        ['end-date', { type: 'date' }],
        ['current-avg', { type: 'number' }],
        ['goal-avg', { type: 'number' }],
        ['reduction-amount', { type: 'number' }],
        ['reduction-percent', { type: 'number' }],
        ['puff-reduction-mode', { tag: 'select' }],
        ['taper-duration-weeks', { type: 'number' }],
        ['purchase-interval-days', { type: 'number' }],
        ['weekly-max', { type: 'number' }],
        ['monthly-max', { type: 'number' }],
        ['taper-notes', { tag: 'textarea' }],
        ['do-not-surpass-daily', { type: 'checkbox', checked: true }],
        ['do-not-surpass-weekly', { type: 'checkbox' }],
        ['purchase-taper-enabled', { type: 'checkbox' }],
        ['vape-current-buy-days', { type: 'number' }],
        ['vape-goal-buy-days', { type: 'number' }],
        ['vape-weekly-spend-cap', { type: 'number' }],
        ['vape-start-nicotine', { type: 'number' }],
        ['vape-goal-nicotine', { type: 'number' }],
        ['vape-nicotine-step', { type: 'number' }],
        ['vape-nicotine-interval', { tag: 'select' }],
        ['nicotine-vape-strategy', { tag: 'select' }],
        ['nicotine-vape-taper-speed', { tag: 'select' }],
        ['nicotine-vape-baseline-window', {}],
        ['nicotine-vape-baseline-start', {}],
        ['nicotine-vape-baseline-end', {}],
        ['nicotine-vape-current-vpm', { type: 'number' }],
        ['nicotine-vape-goal-vpm', { type: 'number' }],
        ['nicotine-vape-current-gap', { type: 'number' }],
        ['nicotine-vape-goal-gap', { type: 'number' }],
        ['nicotine-vape-current-lifespan', { type: 'number' }],
        ['nicotine-vape-goal-lifespan', { type: 'number' }],
        ['nicotine-vape-current-puffs', { type: 'number' }],
        ['nicotine-vape-goal-puffs', { type: 'number' }],
        ['nicotine-vape-current-strength', { type: 'number' }],
        ['nicotine-vape-goal-strength', { type: 'number' }],
        ['nicotine-vape-current-spend', { type: 'number' }],
        ['nicotine-vape-goal-spend', { type: 'number' }],
        ['nicotine-vape-monthly-spend-cap', { type: 'number' }],
        ['nicotine-vape-weekly-spend-cap', { type: 'number' }],
        ['nicotine-vape-no-buy-days', { type: 'number' }],
        ['nicotine-vape-free-days', { type: 'number' }],
        ['nicotine-vape-delay-first-use', { type: 'number' }],
        ['nicotine-vape-min-break', { type: 'number' }],
        ['nicotine-vape-bedtime-cutoff', {}],
        ['nicotine-vape-no-use-blocks', {}],
        ['nicotine-vape-strength-steps', {}],
        ['manual-weekly-baseline', { type: 'number' }],
        ['manual-weekly-unit', { tag: 'select' }],
        ['br-reduce-amount', { type: 'checkbox' }],
        ['br-reduce-spend', { type: 'checkbox' }],
        ['br-weekly-buy-limit', { type: 'checkbox' }],
        ['br-weekly-spend-limit', { type: 'checkbox' }],
        ['br-monthly-buy-cap', { type: 'checkbox' }],
        ['br-monthly-spend-cap', { type: 'checkbox' }],
        ['br-manual-buy-plan', { type: 'checkbox' }],
        ['br-manual-spend-plan', { type: 'checkbox' }],
        ['br-auto-spend-cost-per-gram', { type: 'checkbox' }],
        ['purchase-start-amount', { type: 'number' }],
        ['purchase-goal-amount', { type: 'number' }],
        ['purchase-reduction-amount', { type: 'number' }],
        ['purchase-reduction-percent', { type: 'number' }],
        ['purchase-start-spend', { type: 'number' }],
        ['purchase-goal-spend', { type: 'number' }],
        ['purchase-spend-reduction-amount', { type: 'number' }],
        ['purchase-spend-reduction-percent', { type: 'number' }],
        ['purchase-weekly-amount', { type: 'number' }],
        ['purchase-weekly-spend', { type: 'number' }],
        ['purchase-monthly-amount', { type: 'number' }],
        ['purchase-monthly-spend', { type: 'number' }],
        ['auto-spend-cost-source', { tag: 'select' }],
        ['auto-spend-manual-cost', { type: 'number' }],
        ['auto-spend-baseline-range', { tag: 'select' }],
        ['auto-spend-custom-start', {}],
        ['auto-spend-custom-end', {}]
    ];
    fieldIds.forEach(([id, props]) => put(id, props));

    [
        'taper-substance', 'taper-plan-select', 'taper-plan-count', 'taper-plan-toolbar',
        'taper-dashboard', 'taper-setup', 'taper-no-plan', 'taper-disabled-msg',
        'taper-generate-btn', 'taper-setup-title', 'taper-cancel-edit-btn',
        'plan-type-hint', 'reduction-amount-group', 'reduction-percent-group',
        'taper-reduction-fields-row', 'manual-weekly-plan-section', 'taper-start-avg-group',
        'taper-end-weekly-row', 'weekly-max-group', 'monthly-max-group', 'taper-warn-toggles',
        'goal-avg-group', 'goal-avg-label', 'taper-start-goal-row', 'end-date-label',
        'taper-vape-puffs-extra', 'taper-vape-buying-section', 'taper-vape-nicotine-section',
        'taper-nicotine-vape-section', 'purchase-taper-section', 'purchase-taper-fields',
        'taper-duration-weeks-group', 'purchase-interval-days-group',
        'manual-weekly-targets-list', 'nicotine-vape-baseline-metrics',
        'taper-weekly-table', 'taper-weekly-customize-columns', 'taper-insights',
        'taper-current-week-summary', 'taper-legacy-puff-banner'
    ].forEach(id => {
        if (!nodes.has(id)) put(id, { tag: 'div' });
    });
    put('taper-substance', { tag: 'select', value: COKE_ID, options: [{ value: COKE_ID }] });

    form.querySelectorAll = (sel) => {
        if (sel === 'input, select, textarea') {
            return [...nodes.values()].filter(n => ['input', 'select', 'textarea'].includes(n.tag) || n.type);
        }
        return [];
    };

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel?.startsWith?.('#')) return nodes.get(sel.slice(1)) || null;
        return null;
    };
    rt.document.querySelectorAll = () => [];
    rt.document.createElement = (tag) => el(null, { tag });
    return nodes;
}

test('normalizePlanRecordForEditForm maps legacy aliases without inventing zeros', () => {
    const rt = loadRecoveryTrackerApp();
    const normalized = rt.normalizePlanRecordForEditForm({
        substanceId: COKE_ID,
        reductionType: 'reduce-amount',
        currentAvg: 3,
        goalAvg: 1,
        taperNotes: 'legacy note',
        warnBeforeSurpass: false,
        startDate: '2026-06-01',
        endDate: '2026-06-28',
        weeklyTargets: [{ week: 1, weekStart: '2026-06-01', weekEnd: '2026-06-07', weeklyMax: 14 }]
    });
    assert.equal(normalized.startingDailyAverage, 3);
    assert.equal(normalized.goalDailyAverage, 1);
    assert.equal(normalized.notes, 'legacy note');
    assert.equal(normalized.doNotSurpassDaily, false);
    assert.equal(normalized.weeklyMax, 14);
    assert.equal(rt.formatTaperFormNumber(0), '0');
    assert.equal(rt.formatTaperFormNumber(null), '');
});

test('Edit form loads every saved field from the selected plan', () => {
    const plan = makeRichPlan();
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([plan]));
    const nodes = installEditFormDom(rt);
    rt.selectedTaperPlanIdRef.value = plan.id;
    rt.taperFormPlanIdRef.value = plan.id;
    rt.taperEditingPlanRef.value = true;

    rt.fillTaperFormFromPlan(plan);

    assert.equal(nodes.get('taper-plan-name').value, 'Rich coke taper');
    assert.equal(nodes.get('taper-set-primary').checked, true);
    assert.equal(nodes.get('reduction-type').value, 'reduce-amount');
    assert.equal(nodes.get('start-date').value, '2026-06-01');
    assert.equal(nodes.get('end-date').value, '2026-08-31');
    assert.equal(nodes.get('current-avg').value, '2.5');
    assert.equal(nodes.get('goal-avg').value, '0.75');
    assert.equal(nodes.get('reduction-amount').value, '0.25');
    assert.equal(nodes.get('weekly-max').value, '12.5');
    assert.equal(nodes.get('monthly-max').value, '40');
    assert.equal(nodes.get('taper-notes').value, 'Keep weekends lighter');
    assert.equal(nodes.get('do-not-surpass-daily').checked, false);
    assert.equal(nodes.get('do-not-surpass-weekly').checked, true);
    assert.equal(nodes.get('purchase-taper-enabled').checked, true);
    assert.equal(nodes.get('br-reduce-amount').checked, true);
    assert.equal(nodes.get('purchase-start-amount').value, '7');
    assert.equal(nodes.get('purchase-goal-amount').value, '3.5');
    assert.equal(nodes.get('purchase-reduction-amount').value, '0.5');
    assert.equal(nodes.get('br-weekly-buy-limit').checked, true);
    assert.equal(nodes.get('purchase-weekly-amount').value, '7');
    assert.equal(nodes.get('br-monthly-buy-cap').checked, true);
    assert.equal(nodes.get('purchase-monthly-amount').value, '28');
    assert.equal(nodes.get('br-auto-spend-cost-per-gram').checked, true);
    assert.equal(nodes.get('auto-spend-manual-cost').value, '36.5');
    assert.equal(rt.taperFormInitializedRef.value, true);
    assert.equal(nodes.get('taper-generate-btn').disabled, false);
});

test('legacy plans with missing optional fields stay blank instead of inventing defaults', () => {
    const legacy = {
        id: 'taper-legacy',
        substanceId: COKE_ID,
        name: 'Legacy',
        status: 'active',
        isPrimary: true,
        reductionType: 'reduce-amount',
        startDate: '2026-07-01',
        endDate: '2026-07-28',
        currentAvg: 1.2,
        goalAvg: 0.4,
        taperNotes: 'from legacy',
        warnBeforeSurpass: false,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', weeklyMax: 8.4, dailyTarget: 1.2 }
        ],
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z'
    };
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([legacy]));
    const nodes = installEditFormDom(rt);
    rt.fillTaperFormFromPlan(legacy);
    assert.equal(nodes.get('current-avg').value, '1.2');
    assert.equal(nodes.get('goal-avg').value, '0.4');
    assert.equal(nodes.get('taper-notes').value, 'from legacy');
    assert.equal(nodes.get('do-not-surpass-daily').checked, false);
    assert.equal(nodes.get('weekly-max').value, '8.4');
    assert.equal(nodes.get('monthly-max').value, '');
    assert.equal(nodes.get('purchase-taper-enabled').checked, false);
});

test('changing one field on save preserves unchanged plan fields and linked goals', () => {
    const plan = makeRichPlan();
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([plan]));
    const nodes = installEditFormDom(rt);
    rt.selectedTaperPlanIdRef.value = plan.id;
    rt.taperFormPlanIdRef.value = plan.id;
    rt.taperEditingPlanRef.value = true;
    nodes.get('taper-editing-plan-id').value = plan.id;

    rt.fillTaperFormFromPlan(plan);
    nodes.get('taper-notes').value = 'Updated note only';
    rt.taperFormDirtyRef.value = true;
    rt.taperFormInitializedRef.value = true;

    rt.handleTaperSubmit({ preventDefault() {} });

    const saved = rt.__getTestAppData().taperPlansV2.find(p => p.id === plan.id);
    assert.ok(saved);
    assert.equal(saved.id, 'taper-coke-rich');
    assert.equal(saved.notes, 'Updated note only');
    assert.equal(saved.goalDailyAverage, 0.75);
    assert.equal(saved.reductionAmount, 0.25);
    assert.equal(saved.weeklyMax, 12.5);
    assert.equal(saved.monthlyMax, 40);
    assert.equal(saved.doNotSurpassDaily, false);
    assert.equal(saved.doNotSurpassWeekly, true);
    assert.equal(saved.purchaseTaperEnabled, true);
    assert.equal(saved.buyingReductionSettings.reducePurchaseAmount.startingAmount, 7);
    assert.equal(rt.selectedTaperPlanIdRef.value, plan.id);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);
    assert.equal(rt.__getTestAppData().goals[0].linkedPlanId, plan.id);
});

test('edit values persist across storage reload', () => {
    const plan = makeRichPlan();
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([plan]));
    const nodes = installEditFormDom(rt);
    rt.selectedTaperPlanIdRef.value = plan.id;
    rt.taperFormPlanIdRef.value = plan.id;
    rt.taperEditingPlanRef.value = true;
    nodes.get('taper-editing-plan-id').value = plan.id;
    rt.fillTaperFormFromPlan(plan);
    nodes.get('goal-avg').value = '0.5';
    rt.taperFormInitializedRef.value = true;
    rt.handleTaperSubmit({ preventDefault() {} });

    const raw = rt.localStorage.getItem('recovery-tracker-v2');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    const reloaded = parsed.taperPlansV2.find(p => p.id === plan.id);
    assert.equal(reloaded.goalDailyAverage, 0.5);
    assert.equal(reloaded.reductionAmount, 0.25);
    assert.equal(reloaded.name, 'Rich coke taper');
    assert.equal(reloaded.notes, 'Keep weekends lighter');
});
