import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

function makeNicotineData({ purchases = [], logs = [], settings = {} } = {}) {
    return {
        substances: [{
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            color: '#78909c',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs,
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            spreadPercentLeftUsage: true,
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function makeVapePurchase(overrides = {}) {
    return {
        id: 'purchase-vape-1',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-01',
        time: '12:00',
        fullPuffCount: 10000,
        quantity: 10000,
        quantityBought: 10000,
        unit: 'puffs',
        percentBoughtAt: 100,
        startingPuffsLeft: 10000,
        remainingAmount: 10000,
        remainingPuffs: 10000,
        nicotineMgPerMl: 50,
        notes: 'Foger Switch Pro',
        flavor: 'Sour Gush',
        totalCost: 25,
        ...overrides
    };
}

function makePuffLog(overrides = {}) {
    return {
        id: 'log-puff-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-05',
        amount: 500,
        unit: 'puffs',
        logMode: 'vape_puffs',
        isEstimated: false,
        estimatedFromPercent: false,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true,
        ...overrides
    };
}

function makePercentCheckpointLog(overrides = {}) {
    return {
        id: 'log-pct-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-10',
        amount: 2000,
        estimatedPuffsUsed: 2000,
        unit: 'puffs',
        logMode: 'vape_puffs',
        isEstimated: true,
        estimatedFromPercent: true,
        percentLeftAfter: 80,
        percentRemaining: 80,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true,
        isPercentLeftCheckpoint: true,
        excludeFromStats: true,
        distributedStartDate: '2026-07-05',
        distributedEndDate: '2026-07-10',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('resolveVapeLogEditInputMode detects puff-based vs percent-left logs', () => {
    const rt = setup(makeNicotineData());
    assert.equal(rt.resolveVapeLogEditInputMode(makePuffLog()), 'puffs');
    assert.equal(rt.resolveVapeLogEditInputMode(makePercentCheckpointLog()), 'percent');
});

test('buildVapePurchaseSelectList includes depleted linked purchase for edit', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase({ remainingAmount: 0, remainingPuffs: 0, isDepleted: true })]
    }));
    const list = rt.buildVapePurchaseSelectList(NICOTINE_ID, 'purchase-vape-1');
    assert.equal(list.length, 1);
    assert.equal(String(list[0].id), 'purchase-vape-1');
});

test('getVapeEditPurchaseWarning reports missing and depleted purchases', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase({ remainingAmount: 0, remainingPuffs: 0, isDepleted: true })]
    }));
    assert.match(rt.getVapeEditPurchaseWarning('missing-id'), /not found/i);
    assert.match(rt.getVapeEditPurchaseWarning('purchase-vape-1'), /depleted/i);
});

test('applyVapeUseLogEdit updates puff log in place without duplicating', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase()],
        logs: [makePuffLog()]
    }));
    const existing = rt.getUseEntries()[0];
    const payload = {
        substanceId: NICOTINE_ID,
        date: '2026-07-05',
        amount: 700,
        unit: 'puffs',
        logMode: 'vape_puffs',
        inventoryAffects: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        transactionType: 'use',
        type: 'quick',
        notes: 'Edited puff log'
    };
    const vapeCalc = {
        purchaseId: 'purchase-vape-1',
        puffsUsed: 700,
        estimatedPuffsUsed: 700,
        percentAfter: 93,
        currentRemaining: 9300,
        previousRemaining: 10000,
        isEstimated: false,
        estimatedFromPercent: false
    };
    const result = rt.applyVapeUseLogEdit(existing, payload, vapeCalc, rt.__getTestAppData());
    assert.equal(result.ok, true);
    assert.equal(rt.getUseEntries().length, 1);
    assert.equal(rt.getUseEntries()[0].id, 'log-puff-1');
    assert.equal(rt.getUseEntries()[0].amount, 700);
    assert.equal(rt.getUseEntries()[0].notes, 'Edited puff log');
    assert.equal(rt.getPurchaseRemainingAmount(rt.__getTestAppData().purchases[0]), 9300);
});

test('applyVapeUseLogEdit regenerates percent-left distribution without double deduct', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase()],
        logs: [
            makePuffLog({ id: 'log-start', date: '2026-07-05', amount: 0, percentLeftAfter: 100, estimatedFromPercent: true, isEstimated: true }),
            makePercentCheckpointLog(),
            { id: 'child-1', parentPercentLogId: 'log-pct-1', isEstimatedFromPercentLeft: true, date: '2026-07-06', amount: 400, substanceId: NICOTINE_ID, unit: 'puffs', inventoryAffects: false },
            { id: 'child-2', parentPercentLogId: 'log-pct-1', isEstimatedFromPercentLeft: true, date: '2026-07-07', amount: 400, substanceId: NICOTINE_ID, unit: 'puffs', inventoryAffects: false }
        ]
    }));
    const existing = rt.getUseEntries().find(l => l.id === 'log-pct-1');
    const payload = {
        substanceId: NICOTINE_ID,
        date: '2026-07-10',
        amount: 3000,
        unit: 'puffs',
        logMode: 'vape_puffs',
        inventoryAffects: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        transactionType: 'use',
        type: 'quick'
    };
    const vapeCalc = {
        purchaseId: 'purchase-vape-1',
        puffsUsed: 3000,
        estimatedPuffsUsed: 3000,
        percentAfter: 70,
        currentRemaining: 7000,
        previousRemaining: 10000,
        isEstimated: true,
        estimatedFromPercent: true
    };
    const beforeCount = rt.getUseEntries().length;
    const result = rt.applyVapeUseLogEdit(existing, payload, vapeCalc, rt.__getTestAppData());
    assert.equal(result.ok, true);
    const afterLogs = rt.getUseEntries();
    assert.ok(afterLogs.length > beforeCount - 2, 'expected regenerated daily distribution entries');
    assert.equal(afterLogs.filter(l => l.id === 'log-pct-1').length, 1);
    const children = rt.getDistributedChildrenForPercentLog('log-pct-1');
    assert.ok(children.length >= 1);
    assert.equal(rt.getPurchaseRemainingAmount(rt.__getTestAppData().purchases[0]), 7000);
});

test('applyVapeUseLogEdit changing linked purchase recalculates both purchases', () => {
    const rt = setup(makeNicotineData({
        purchases: [
            makeVapePurchase({ id: 'purchase-a', remainingAmount: 9500, remainingPuffs: 9500 }),
            makeVapePurchase({ id: 'purchase-b', date: '2026-07-08', remainingAmount: 10000, remainingPuffs: 10000, notes: 'Second', flavor: 'Blue Razz' })
        ],
        logs: [makePuffLog({ purchaseId: 'purchase-a', linkedPurchaseId: 'purchase-a' })]
    }));
    const existing = rt.getUseEntries()[0];
    const payload = {
        substanceId: NICOTINE_ID,
        date: '2026-07-05',
        amount: 500,
        unit: 'puffs',
        logMode: 'vape_puffs',
        inventoryAffects: true,
        purchaseId: 'purchase-b',
        linkedPurchaseId: 'purchase-b',
        transactionType: 'use',
        type: 'quick'
    };
    const vapeCalc = {
        purchaseId: 'purchase-b',
        puffsUsed: 500,
        estimatedPuffsUsed: 500,
        percentAfter: 95,
        currentRemaining: 9500,
        previousRemaining: 10000,
        isEstimated: false,
        estimatedFromPercent: false
    };
    rt.applyVapeUseLogEdit(existing, payload, vapeCalc, rt.__getTestAppData());
    const data = rt.__getTestAppData();
    const purchaseA = data.purchases.find(p => p.id === 'purchase-a');
    const purchaseB = data.purchases.find(p => p.id === 'purchase-b');
    assert.equal(rt.getPurchaseRemainingAmount(purchaseA), 10000);
    assert.equal(rt.getPurchaseRemainingAmount(purchaseB), 9500);
    assert.equal(rt.getLogPurchaseId(rt.getUseEntries()[0]), 'purchase-b');
});

test('vape use edit persists through storage reload', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase()],
        logs: [makePuffLog()]
    }));
    const existing = rt.getUseEntries()[0];
    rt.applyVapeUseLogEdit(existing, {
        substanceId: NICOTINE_ID,
        date: '2026-07-05',
        amount: 600,
        unit: 'puffs',
        logMode: 'vape_puffs',
        inventoryAffects: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        transactionType: 'use',
        type: 'quick',
        notes: 'Persist me'
    }, {
        purchaseId: 'purchase-vape-1',
        puffsUsed: 600,
        estimatedPuffsUsed: 600,
        percentAfter: 94,
        currentRemaining: 9400,
        previousRemaining: 10000,
        isEstimated: false,
        estimatedFromPercent: false
    }, rt.__getTestAppData());
    rt.saveData(rt.__getTestAppData());
    const reloaded = rt.__reloadTestAppDataFromStorage();
    const log = reloaded.logs.find(l => l.id === 'log-puff-1');
    assert.equal(log.notes, 'Persist me');
    assert.equal(log.amount, 600);
    assert.equal(rt.getLogPurchaseId(log), 'purchase-vape-1');
    assert.equal(reloaded.purchases[0].flavor, 'Sour Gush');
    assert.equal(rt.getPurchaseRemainingAmount(reloaded.purchases[0]), 9400);
});
