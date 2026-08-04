import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makePlan(overrides = {}) {
    return {
        id: 'taper-coke-1',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        isPrimary: true,
        reductionType: 'reduce-amount',
        startDate: '2026-07-01',
        endDate: '2026-07-28',
        startingDailyAverage: 1,
        goalDailyAverage: 0.5,
        reductionAmount: 0.1,
        reductionPercent: 0,
        weeklyTargets: [
            {
                week: 1,
                weekStart: '2026-07-01',
                weekEnd: '2026-07-07',
                weeklyMax: 7,
                dailyTarget: 1,
                actualUsed: 2.5,
                status: 'over'
            },
            {
                week: 2,
                weekStart: '2026-07-08',
                weekEnd: '2026-07-14',
                weeklyMax: 6,
                dailyTarget: 0.9,
                actualUsed: 1,
                status: 'under'
            }
        ],
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
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
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: plans,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    };
}

function installTaperFormDom(rt, values = {}) {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const el = {
            id,
            value: props.value ?? '',
            checked: !!props.checked,
            classList: {
                add() {},
                remove() {},
                toggle() {},
                contains() { return false; }
            },
            options: props.options || [],
            textContent: '',
            innerHTML: '',
            style: {},
            appendChild(child) {
                this.options.push(child);
                return child;
            },
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
        nodes.set(id, el);
        return el;
    };

    put('taper-substance', { value: COKE_ID, options: [{ value: COKE_ID }] });
    put('taper-editing-plan-id', { value: values.editingPlanId || '' });
    put('taper-plan-name', { value: values.name || 'Coke taper' });
    put('taper-set-primary', { checked: values.setPrimary !== false });
    put('reduction-type', { value: values.reductionType || 'reduce-amount' });
    put('start-date', { value: values.startDate || '2026-07-01' });
    put('end-date', { value: values.endDate || '2026-07-28' });
    put('current-avg', { value: values.currentAvg ?? '1' });
    put('goal-avg', { value: values.goalAvg ?? '0.5' });
    put('reduction-amount', { value: values.reductionAmount ?? '0.1' });
    put('reduction-percent', { value: values.reductionPercent ?? '0' });
    put('weekly-max', { value: '' });
    put('monthly-max', { value: '' });
    put('taper-notes', { value: values.notes || '' });
    put('do-not-surpass-daily', { checked: true });
    put('do-not-surpass-weekly', { checked: false });
    put('purchase-taper-enabled', { checked: false });
    put('taper-generate-btn', {});
    put('taper-form-status', {});
    put('taper-setup-title', {});
    put('taper-cancel-edit-btn', {});
    put('taper-dashboard', {});
    put('taper-setup', {});
    put('taper-no-plan', {});
    put('taper-disabled-msg', {});
    put('taper-plan-toolbar', {});
    put('taper-plan-select', { value: 'taper-coke-1', options: [{ value: 'taper-coke-1' }] });
    put('taper-plan-count', {});
    put('taper-weekly-table', {});
    put('taper-weekly-customize-columns', {});
    put('taper-insights', {});
    put('taper-current-week-summary', {});
    put('taper-legacy-puff-banner', {});

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = () => [];
    rt.document.createElement = () => ({
        value: '',
        textContent: '',
        style: {},
        classList: { add() {}, remove() {} },
        appendChild() {}
    });
    return nodes;
}

test('mergeWeeklyTargetsPreservingProgress keeps actualUsed by week', () => {
    const rt = loadRecoveryTrackerApp();
    const previous = [
        { week: 1, weekStart: '2026-07-01', weeklyMax: 7, actualUsed: 2.5, status: 'over' },
        { week: 2, weekStart: '2026-07-08', weeklyMax: 6, actualUsed: 1, status: 'under' }
    ];
    const next = [
        { week: 1, weekStart: '2026-07-01', weeklyMax: 6.5, actualUsed: 0, status: 'under' },
        { week: 2, weekStart: '2026-07-08', weeklyMax: 5.5, actualUsed: 0, status: 'under' }
    ];
    const merged = rt.mergeWeeklyTargetsPreservingProgress(previous, next);
    assert.equal(merged[0].weeklyMax, 6.5);
    assert.equal(merged[0].actualUsed, 2.5);
    assert.equal(merged[0].status, 'over');
    assert.equal(merged[1].actualUsed, 1);
});

test('editing a taper plan updates in place and keeps the same active plan id', () => {
    const secondary = makePlan({
        id: 'taper-coke-2',
        name: 'Backup plan',
        isPrimary: false,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', weeklyMax: 5, dailyTarget: 0.7, actualUsed: 0 }
        ]
    });
    const primary = makePlan();
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([primary, secondary]));
    rt.selectedTaperPlanIdRef.value = primary.id;
    rt.taperFormPlanIdRef.value = null; // simulate lost in-memory edit id
    rt.taperEditingPlanRef.value = true;

    const nodes = installTaperFormDom(rt, {
        editingPlanId: primary.id, // durable form field still has the id
        name: 'Coke taper renamed',
        notes: 'updated note',
        setPrimary: true
    });

    rt.taperFormInitializedRef.value = true;
    const beforeCount = rt.__getTestAppData().taperPlansV2.length;
    rt.handleTaperSubmit({ preventDefault() {} });

    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, beforeCount, 'does not create a duplicate plan');
    const updated = data.taperPlansV2.find(p => p.id === primary.id);
    assert.ok(updated);
    assert.equal(updated.name, 'Coke taper renamed');
    assert.equal(updated.notes, 'updated note');
    assert.equal(updated.id, primary.id);
    assert.equal(updated.createdAt, primary.createdAt);
    assert.equal(rt.selectedTaperPlanIdRef.value, primary.id);
    assert.ok(Array.isArray(updated.weeklyTargets) && updated.weeklyTargets.length > 0);
    assert.equal(nodes.get('taper-editing-plan-id').value, '');
    assert.equal(rt.taperEditingPlanRef.value, false);

    const other = data.taperPlansV2.find(p => p.id === secondary.id);
    assert.ok(other);
    assert.equal(other.isPrimary, false);
    assert.equal(other.id, 'taper-coke-2');
});

test('resolveTaperFormEditingPlanId falls back to selected plan while editing', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([makePlan()]));
    installTaperFormDom(rt, { editingPlanId: '' });
    rt.taperFormPlanIdRef.value = null;
    rt.taperEditingPlanRef.value = true;
    rt.selectedTaperPlanIdRef.value = 'taper-coke-1';
    assert.equal(rt.resolveTaperFormEditingPlanId(), 'taper-coke-1');
});

test('Save Changes updates custom weekly plan by stable id and persists after reload', () => {
    const plan = makePlan({
        id: 'taper-coke-custom',
        name: 'Custom coke plan',
        reductionType: 'manual-weekly',
        manualWeeklyMode: 'amount',
        manualWeeklyUnit: 'g',
        startingDailyAverage: null,
        goalDailyAverage: 0,
        reductionAmount: 0,
        monthlyMax: 20,
        notes: 'original note',
        purchaseTaperEnabled: true,
        buyingReductionSettings: {
            reducePurchaseAmount: { enabled: false },
            reducePurchaseCost: { enabled: false },
            weeklyPurchaseLimit: { enabled: false, amount: null },
            weeklySpendingLimit: { enabled: true, amount: 40 },
            monthlyPurchaseCap: { enabled: false, amount: null },
            monthlySpendingCap: { enabled: true, amount: 150 },
            manualWeeklyBuyPlan: { enabled: false, values: [] },
            manualWeeklySpendingPlan: { enabled: false, values: [] },
            autoSpendFromCostPerGram: { enabled: false, source: 'manual', manualCostPerGram: null }
        },
        manualWeeklyTargets: [
            { week: 1, targetAmount: 3 },
            { week: 2, targetAmount: 3 },
            { week: 3, targetAmount: 2.7 },
            { week: 4, targetAmount: 2.3 },
            { week: 5, targetAmount: 1.5 },
            { week: 6, targetAmount: 0.5 }
        ],
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', weeklyMax: 3, targetAmount: 3, actualUsed: 1 },
            { week: 2, weekStart: '2026-07-08', weekEnd: '2026-07-14', weeklyMax: 3, targetAmount: 3, actualUsed: 0 },
            { week: 3, weekStart: '2026-07-15', weekEnd: '2026-07-21', weeklyMax: 2.7, targetAmount: 2.7, actualUsed: 0 },
            { week: 4, weekStart: '2026-07-22', weekEnd: '2026-07-28', weeklyMax: 2.3, targetAmount: 2.3, actualUsed: 0 },
            { week: 5, weekStart: '2026-07-29', weekEnd: '2026-08-04', weeklyMax: 1.5, targetAmount: 1.5, actualUsed: 0 },
            { week: 6, weekStart: '2026-08-05', weekEnd: '2026-08-11', weeklyMax: 0.5, targetAmount: 0.5, actualUsed: 0 }
        ]
    });

    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData([plan]));
    const nodes = installTaperFormDom(rt, {
        editingPlanId: plan.id,
        name: 'Custom coke plan',
        reductionType: 'manual-weekly',
        notes: 'kept weeks',
        currentAvg: '',
        goalAvg: '',
        reductionAmount: '',
        endDate: '2026-08-11'
    });
    nodes.get('monthly-max').value = '18';
    nodes.get('purchase-taper-enabled').checked = true;
    // Buying reduction DOM stubs used by collectBuyingReductionSettingsFromForm
    [
        ['br-reduce-amount', false],
        ['br-reduce-spend', false],
        ['br-weekly-buy-limit', false],
        ['br-weekly-spend-limit', true],
        ['br-monthly-buy-cap', false],
        ['br-monthly-spend-cap', true],
        ['br-manual-buy-plan', false],
        ['br-manual-spend-plan', false],
        ['br-auto-spend-cost-per-gram', false]
    ].forEach(([id, checked]) => {
        nodes.set(id, {
            id,
            checked,
            value: '',
            classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
        });
    });
    nodes.set('purchase-weekly-spend', { id: 'purchase-weekly-spend', value: '40' });
    nodes.set('purchase-monthly-spend', { id: 'purchase-monthly-spend', value: '150' });
    nodes.set('manual-weekly-targets-list', { id: 'manual-weekly-targets-list', innerHTML: '' });
    nodes.set('manual-weekly-unit', { id: 'manual-weekly-unit', value: 'g', options: [{ value: 'g' }] });
    nodes.set('manual-weekly-baseline', { id: 'manual-weekly-baseline', value: '' });
    nodes.set('manual-weekly-plan-section', {
        id: 'manual-weekly-plan-section',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        insertBefore() {}
    });
    nodes.set('goal-avg-group', { id: 'goal-avg-group' });
    nodes.set('taper-start-goal-row', {
        id: 'taper-start-goal-row',
        appendChild() {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
    });
    const amountBtn = {
        className: 'manual-mode-btn active',
        dataset: { mode: 'amount' },
        classList: { toggle() {}, add() {}, remove() {}, contains: () => true }
    };
    rt.document.querySelector = (sel) => (sel === '.manual-mode-btn.active' ? amountBtn : null);
    rt.document.querySelectorAll = (sel) => {
        if (sel === '.manual-mode-btn') return [amountBtn];
        if (sel === '.manual-week-target-input') {
            return plan.manualWeeklyTargets.map(t => ({
                value: String(t.targetAmount),
                dataset: { week: String(t.week) }
            }));
        }
        return [];
    };

    rt.selectedTaperPlanIdRef.value = plan.id;
    rt.taperFormPlanIdRef.value = plan.id;
    rt.taperEditingPlanRef.value = true;
    rt.taperFormInitializedRef.value = true;

    const ok = rt.handleTaperSubmit({ preventDefault() {} });
    assert.equal(ok, true);
    assert.equal(nodes.get('taper-form-status').textContent, 'Plan saved');
    assert.match(nodes.get('taper-form-status').className, /is-success/);

    const saved = rt.__getTestAppData().taperPlansV2.find(p => p.id === plan.id);
    assert.ok(saved);
    assert.equal(saved.id, 'taper-coke-custom');
    assert.equal(rt.__getTestAppData().taperPlansV2.length, 1);
    assert.equal(saved.notes, 'kept weeks');
    assert.equal(saved.monthlyMax, 18);
    assert.equal(saved.reductionType, 'manual-weekly');
    assert.equal(saved.manualWeeklyTargets[2].targetAmount, 2.7);
    assert.equal(saved.weeklyTargets.find(w => w.week === 2).targetAmount, 3);
    assert.equal(saved.buyingReductionSettings.weeklySpendingLimit.amount, 40);
    assert.equal(saved.buyingReductionSettings.monthlySpendingCap.amount, 150);
    assert.equal(rt.selectedTaperPlanIdRef.value, plan.id);

    const raw = rt.localStorage.getItem('recovery-tracker-v2');
    assert.ok(raw);
    const reloaded = JSON.parse(raw).taperPlansV2.find(p => p.id === plan.id);
    assert.equal(reloaded.monthlyMax, 18);
    assert.equal(reloaded.notes, 'kept weeks');
    assert.equal(reloaded.manualWeeklyTargets[5].targetAmount, 0.5);
});
