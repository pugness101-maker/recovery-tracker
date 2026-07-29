import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const XANAX_ID = 'xannax';

function makeXanaxData({ purchases = [], logs = [] } = {}) {
    return {
        substances: [{
            id: XANAX_ID,
            name: 'Xannax',
            icon: '💊',
            color: '#5c6bc0',
            trackingMode: 'dose',
            primaryUnit: 'mg',
            units: ['mg', 'pills', 'bars'],
            defaultUnit: 'mg',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

function makeXanaxPurchase(overrides = {}) {
    return {
        id: 'purchase-1',
        substanceId: XANAX_ID,
        date: '2026-07-01',
        pillQuantity: 30,
        strengthPerPill: 0.5,
        strengthUnit: 'mg',
        totalMg: 15,
        quantity: 30,
        quantityBought: 30,
        unit: 'pills',
        remainingAmount: 30,
        totalCost: 30,
        costPerPill: 1,
        costPerMg: 2,
        ...overrides
    };
}

test('computeXanaxTotalMg multiplies pills by strength and converts grams', () => {
    const rt = setup(makeXanaxData());
    assert.equal(rt.computeXanaxTotalMg(30, 0.5, 'mg'), 15);
    assert.equal(rt.strengthPerPillToMg(0.001, 'g'), 1);
    assert.equal(rt.computeXanaxTotalMg(10, 0.001, 'g'), 10);
});

test('applyXanaxFieldsToPayload stores pill, strength, and cost fields', () => {
    const rt = setup(makeXanaxData());
    const payload = {};
    rt.applyXanaxFieldsToPayload(payload, {
        pillQuantity: 30,
        strengthPerPill: 0.5,
        strengthUnit: 'mg',
        totalMg: 15
    }, 30);
    assert.equal(payload.pillQuantity, 30);
    assert.equal(payload.strengthPerPill, 0.5);
    assert.equal(payload.strengthUnit, 'mg');
    assert.equal(payload.totalMg, 15);
    assert.equal(payload.costPerPill, 1);
    assert.equal(payload.costPerMg, 2);
    assert.equal(payload.needsStrengthInfo, false);
});

test('formatXanaxPurchaseDisplayLine shows pill, strength, and total mg', () => {
    const rt = setup(makeXanaxData());
    const line = rt.formatXanaxPurchaseDisplayLine(makeXanaxPurchase());
    assert.match(line, /30 pills/);
    assert.match(line, /0\.5 mg each/);
    assert.match(line, /15 mg total/);
});

test('formatXanaxRemainingDisplay shows pills and mg remaining', () => {
    const rt = setup(makeXanaxData());
    const purchase = makeXanaxPurchase({ remainingAmount: 22.5, remainingPills: 22.5, remainingMg: 11.25 });
    rt.syncXanaxPurchaseRemaining(purchase);
    const line = rt.formatXanaxRemainingDisplay(purchase);
    assert.match(line, /22\.5 pills/);
    assert.match(line, /11\.25 mg remaining/);
});

test('migration marks legacy purchases without strength as needing strength info', () => {
    const data = makeXanaxData({
        purchases: [{
            id: 'legacy-1',
            substanceId: XANAX_ID,
            date: '2026-01-01',
            quantity: 30,
            quantityBought: 30,
            unit: 'pills',
            remainingAmount: 30,
            totalCost: 20
        }]
    });
    const rt = setup(data);
    rt.migrateXanaxInventoryV1(data);
    const purchase = data.purchases[0];
    assert.equal(purchase.pillQuantity, 30);
    assert.equal(purchase.needsStrengthInfo, true);
    assert.equal(rt.xanaxPurchaseNeedsStrengthInfo(purchase), true);
    assert.match(rt.formatXanaxPurchaseDisplayLine(purchase), /Strength needed/);
});

test('use log summary converts between pills and mg', () => {
    const rt = setup(makeXanaxData());
    const logByPills = {
        substanceId: XANAX_ID,
        pillsUsed: 0.5,
        mgUsed: 0.25,
        mgPerPillAtTimeOfUse: 0.5,
        amount: 0.5,
        unit: 'pills'
    };
    assert.equal(rt.formatXanaxUseSummary(logByPills), '0.5 pills · 0.25 mg');
    assert.equal(rt.getXanaxLogMgAmount({ mgUsed: 1.5 }), 1.5);
    assert.equal(rt.getXanaxLogPillsAmount({ mgUsed: 1.5, mgPerPillAtTimeOfUse: 0.5 }), 3);
});

test('inventory deduction tracks remaining pills after use', () => {
    const purchase = makeXanaxPurchase();
    const data = makeXanaxData({
        purchases: [purchase],
        logs: [{
            id: 'use-1',
            substanceId: XANAX_ID,
            date: '2026-07-02',
            amount: 7.5,
            unit: 'pills',
            pillsUsed: 7.5,
            mgUsed: 3.75,
            mgPerPillAtTimeOfUse: 0.5,
            purchaseId: 'purchase-1',
            inventoryId: 'purchase-1',
            inventoryAffects: true,
            transactionType: 'use',
            type: 'quick'
        }]
    });
    const rt = setup(data);
    rt.recalculatePurchaseRemaining('purchase-1', data);
    assert.equal(rt.getXanaxRemainingPills(purchase), 22.5);
    assert.equal(rt.getXanaxRemainingMg(purchase), 11.25);
});
