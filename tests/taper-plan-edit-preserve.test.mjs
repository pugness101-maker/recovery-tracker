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
