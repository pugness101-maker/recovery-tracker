import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

function makeNicotineData({ purchases = [] } = {}) {
    return {
        substances: [{
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            color: '#78909c',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs', 'cigarettes', 'pouches', 'pieces', 'patches'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
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
        fullPuffCount: 20000,
        quantity: 20000,
        quantityBought: 20000,
        unit: 'puffs',
        percentBoughtAt: 100,
        startingPuffsLeft: 20000,
        remainingAmount: 12000,
        remainingPuffs: 12000,
        totalCost: 21.5,
        costPerUnit: 21.5 / 20000,
        notes: 'Foger Switch Pro',
        flavor: 'Sour Gush',
        nicotineMgPerMl: 50,
        eLiquidCapacityMl: 12,
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('vape purchase history quantity is compact one-line summary', () => {
    const rt = setup(makeNicotineData({ purchases: [makeVapePurchase()] }));
    const purchase = makeVapePurchase();
    assert.equal(rt.formatVapePurchaseQuantitySummary(purchase), '1 vape · 20,000 puffs');
    assert.match(rt.formatVapePurchaseTitleLine(purchase), /Foger Switch Pro/);
    assert.match(rt.formatVapePurchaseTitleLine(purchase), /Sour Gush/);
});

test('vape quantity falls back to puffs when device count unavailable', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'other',
        unit: 'puffs',
        fullPuffCount: 20000,
        quantityBought: 20000
    };
    assert.equal(rt.formatVapePurchaseQuantitySummary(purchase), '20,000 puffs');
});

test('nicotine cigarettes quantity is compact', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        totalCigarettes: 20,
        quantityBought: 20,
        unit: 'cigarettes'
    };
    assert.equal(rt.formatNicotinePurchaseQuantitySummary(purchase), '20 cigarettes');
});

test('nicotine pouches quantity is compact', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'pouches',
        totalPouches: 15,
        quantityBought: 15,
        unit: 'pouches'
    };
    assert.equal(rt.formatNicotinePurchaseQuantitySummary(purchase), '15 pouches');
});

test('nicotine gum quantity is compact', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'gum',
        pieceCount: 30,
        quantityBought: 30,
        unit: 'pieces'
    };
    assert.equal(rt.formatNicotinePurchaseQuantitySummary(purchase), '30 pieces');
});

test('nicotine patches quantity is compact', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'patches',
        patchCount: 14,
        quantityBought: 14,
        unit: 'patches'
    };
    assert.equal(rt.formatNicotinePurchaseQuantitySummary(purchase), '14 patches');
});

test('nicotine other uses quantity and saved unit', () => {
    const rt = setup(makeNicotineData());
    const purchase = {
        substanceId: NICOTINE_ID,
        nicotineProductType: 'other',
        quantityBought: 5,
        unit: 'lozenges'
    };
    assert.equal(rt.formatNicotinePurchaseQuantitySummary(purchase), '5 lozenges');
});

test('vape cost per unit displays as cost per vape not per puff', () => {
    const rt = setup(makeNicotineData({ purchases: [makeVapePurchase()] }));
    const purchase = makeVapePurchase();
    const total = 21.5;
    const cpu = rt.getPurchaseHistoryCostPerUnit(purchase, total);
    assert.equal(cpu, 21.5);
    assert.equal(rt.getPurchaseHistoryCostPerUnitSuffix(purchase), 'vape');
});

test('vape purchase history row metrics match expected remaining and used', () => {
    const rt = setup(makeNicotineData({ purchases: [makeVapePurchase()] }));
    const purchase = makeVapePurchase();
    assert.equal(rt.formatPurchaseRemainingDisplay(purchase), '12,000 puffs / 60%');
    assert.equal(rt.getPurchasePercentUsed(purchase), 40);
});

test('legacy vape costPerUnit stored per puff still displays cost per vape', () => {
    const rt = setup(makeNicotineData({ purchases: [makeVapePurchase()] }));
    const purchase = makeVapePurchase({ costPerUnit: 21.5 / 20000 });
    assert.equal(rt.getPurchaseHistoryCostPerUnit(purchase, 21.5), 21.5);
    assert.equal(rt.getPurchaseHistoryCostPerUnitSuffix(purchase), 'vape');
});
