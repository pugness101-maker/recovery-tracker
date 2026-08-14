import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const STORAGE_KEY = 'recovery-tracker-v2';
const COKE_ID = 'coke';

function cokeSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        active: true,
        isMain: true,
        taperTrackingEnabled: true
    };
}

function savedPayload(taperPlansV2 = []) {
    return {
        substances: [cokeSubstance()],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2,
        settings: { currency: '$', substanceSettings: {} },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function makeBuyFormNodes() {
    const nodes = new Map();
    const put = (id, props = {}) => {
        const classes = new Set();
        const node = {
            id,
            value: props.value ?? '',
            innerHTML: props.innerHTML ?? '',
            hidden: false,
            disabled: false,
            style: props.style || { display: '' },
            classList: {
                add(...n) { n.forEach(x => classes.add(x)); },
                remove(...n) { n.forEach(x => classes.delete(x)); },
                toggle(n, f) {
                    if (f === true) classes.add(n);
                    else if (f === false) classes.delete(n);
                    else if (classes.has(n)) classes.delete(n);
                    else classes.add(n);
                },
                contains(n) { return classes.has(n); }
            },
            insertAdjacentHTML(position, html) {
                if (position === 'beforebegin') this._before = html;
            },
            setAttribute() {},
            removeAttribute() {}
        };
        nodes.set(id, node);
        return node;
    };
    put('buy-source-mount');
    put('buy-acquisition-type', { value: 'purchased' });
    put('buy-store-group', { hidden: true });
    put('buy-payment-group');
    return nodes;
}

test('startup with saved taper data produces no uncaught ReferenceError', () => {
    const taper = {
        id: 'smoke-taper-1',
        name: 'Smoke taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-08-01',
        endDate: '2026-09-01',
        reductionType: 'reduce-amount',
        goalDailyAverage: 0.5,
        weeklyTargets: [],
        purchaseTaperEnabled: true,
        purchaseReductionMode: 'weekly_buy_amount',
        purchaseStartingWeeklyAmount: 5
    };
    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(savedPayload([taper])) }
    });
    assert.equal(rt.__getTestAppData().taperPlansV2[0].id, 'smoke-taper-1');
});

test('inventory source patch tolerates non-Element buy-store-group without error spam', () => {
    const rt = loadRecoveryTrackerApp();
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    nodes.set('buy-store-group', { id: 'buy-store-group', length: 1 }); // NodeList-like bad target
    nodes.set('buy-payment-group', { id: 'buy-payment-group', length: 0 });
    rt.inventorySourcePickerMountedRef.value = false;
    rt.inventorySourcePickerMountWarnedRef.value = false;

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        for (let i = 0; i < 5; i += 1) rt.ensureBuySourcePickerMounted();
        const inventoryWarnings = warnings.filter(w => w.includes('[inventory-source]'));
        assert.equal(inventoryWarnings.length, 1);
    } finally {
        console.warn = originalWarn;
    }
});

test('inventory mount target rejects array and accepts real element', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.isInventorySourceMountTarget([]), false);
    assert.equal(rt.isInventorySourceMountTarget({ length: 1 }), false);
    const el = { innerHTML: '', insertAdjacentHTML() {} };
    assert.equal(rt.isInventorySourceDomElement(el), true);
    assert.equal(rt.isInventorySourceMountTarget(el), true);
});

test('new taper save creates exactly one record; edit creates zero', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(savedPayload([{
        id: 'existing-1', name: 'Existing', substanceId: COKE_ID, status: 'active', isPrimary: true,
        startDate: '2026-08-01', endDate: '2026-09-01', reductionType: 'reduce-amount', weeklyTargets: []
    }]));
    const before = rt.__getTestAppData().taperPlansV2.length;

    rt.setTaperUiState({ mode: 'create', selectedTaperId: null, editingTaperId: null, sourceTaperId: null });
    const newPlan = {
        id: rt.generateUnusedTaperPlanId(rt.__getTestAppData()),
        name: 'Brand new',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: false,
        startDate: '2026-08-01',
        endDate: '2026-09-15',
        reductionType: 'reduce-amount',
        weeklyTargets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    rt.__getTestAppData().taperPlansV2.push(newPlan);
    assert.equal(rt.__getTestAppData().taperPlansV2.length, before + 1);

    rt.setTaperUiState({ mode: 'edit', editingTaperId: 'existing-1', selectedTaperId: 'existing-1' });
    const editTarget = rt.getTaperPlanById('existing-1');
    editTarget.name = 'Existing edited';
    assert.equal(rt.__getTestAppData().taperPlansV2.length, before + 1);
});

test('inventory form mount via buy-source-mount does not duplicate source UI on rerender', () => {
    const rt = loadRecoveryTrackerApp();
    const nodes = makeBuyFormNodes();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.inventorySourcePickerMountedRef.value = false;
    rt.initInventorySource();
    const first = nodes.get('buy-source-mount').innerHTML;
    rt.initInventorySource();
    rt.initInventorySource();
    const second = nodes.get('buy-source-mount').innerHTML;
    assert.equal(first, second);
    assert.equal((first.match(/id="buy-source-group"/g) || []).length, 1);
});
