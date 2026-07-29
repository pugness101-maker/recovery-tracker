import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

function makeNicotineData({ purchases = [], logs = [] } = {}) {
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
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: false },
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
        totalCost: 25,
        ...overrides
    };
}

function makeCigarettePurchase(overrides = {}) {
    return {
        id: 'purchase-cig-1',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        date: '2026-07-01',
        totalCigarettes: 20,
        quantityBought: 20,
        quantity: 20,
        unit: 'cigarettes',
        remainingAmount: 20,
        totalCost: 12,
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

function commitNicotineLog(rt, log, data) {
    data.logs = data.logs || [];
    const sharedSplit = rt.isSharedUseLog(log) ? {
        total: log.totalAmount ?? log.amount,
        personal: log.personalAmount,
        other: log.sharedAmount,
        sharedWithName: log.sharedWithName || ''
    } : null;
    rt.finalizeNicotineUseLogForSave(log, { sharedSplit });
    data.logs.push(log);
    if (rt.isVapeUseLog(log) && rt.getLogPurchaseId(log)) {
        rt.recalculateVapePurchaseInventory(rt.getLogPurchaseId(log), data);
    } else if (rt.getLogPurchaseId(log)) {
        rt.recalculatePurchaseRemaining(rt.getLogPurchaseId(log), data);
    } else {
        rt.applyLogInventoryEffect(log, data);
    }
    rt.saveData(data);
}

test('vape shared by puffs deducts total and counts only personal portion', () => {
    const purchase = makeVapePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-shared-vape-1',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-05',
        amount: 100,
        totalAmount: 100,
        personalAmount: 60,
        sharedAmount: 40,
        sharedWithName: 'Juju',
        unit: 'puffs',
        logMode: 'vape_puffs',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);

    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9900);
    assert.equal(rt.formatNicotineUseSummary(log), 'Shared Use · 100 puffs total · Me 60 · Juju 40');
    assert.equal(rt.isPersonalUseLog(log), false);
    assert.equal(rt.isSharedUseLog(log), true);
    assert.equal(rt.getStatsUsageOnDate(NICOTINE_ID, '2026-07-05', data), 60);
});

test('vape shared using percent-left uses estimated total puffs', () => {
    const purchase = makeVapePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-shared-percent-1',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-06',
        amount: 500,
        totalAmount: 500,
        personalAmount: 300,
        sharedAmount: 200,
        sharedWithName: 'Alex',
        unit: 'puffs',
        logMode: 'percent_remaining',
        percentLeftAfter: 95,
        percentRemaining: 95,
        estimatedPuffsUsed: 500,
        isEstimated: true,
        estimatedFromPercent: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9500);
    assert.equal(rt.getLogPersonalAmount(log), 300);
    assert.equal(rt.getLogSharedAmount(log), 200);
});

test('cigarettes shared deducts total and excludes other portion from personal stats', () => {
    const purchase = makeCigarettePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-shared-cig-1',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        date: '2026-07-07',
        amount: 10,
        totalAmount: 10,
        personalAmount: 6,
        sharedAmount: 4,
        sharedWithName: 'Sam',
        unit: 'cigarettes',
        cigarettesUsed: 10,
        logMode: 'nicotine_cigarettes',
        purchaseId: 'purchase-cig-1',
        linkedPurchaseId: 'purchase-cig-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 10);
    assert.equal(rt.getStatsUsageOnDate(NICOTINE_ID, '2026-07-07', data), 6);
    assert.match(rt.formatNicotineUseSummary(log), /Shared Use · 10 cigarettes total · Me 6 · Sam 4/);
});

test('nicotine gift given deducts inventory and excludes personal-use totals', () => {
    const purchase = makeCigarettePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-gift-1',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        date: '2026-07-08',
        amount: 5,
        unit: 'cigarettes',
        cigarettesUsed: 5,
        logMode: 'nicotine_cigarettes',
        recipientName: 'Taylor',
        giftPartyName: 'Taylor',
        purchaseId: 'purchase-cig-1',
        linkedPurchaseId: 'purchase-cig-1',
        inventoryAffects: true
    };
    rt.applyLogInventoryEffect(log, data);
    data.logs.push(log);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 15);
    assert.equal(rt.isGiftGivenLog(log), true);
    assert.equal(rt.isPersonalUseLog(log), false);
    assert.equal(rt.getStatsUsageOnDate(NICOTINE_ID, '2026-07-08', data), 0);
    const metrics = rt.getGiftMetricsFromLogs(data.logs);
    assert.equal(metrics.given, 5);
    assert.equal(metrics.recipients.Taylor, 5);
});

test('nicotine gift received adds inventory', () => {
    const purchase = makeCigarettePurchase({ remainingAmount: 10 });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-received-1',
        type: 'quick',
        transactionType: 'gift_received',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        date: '2026-07-09',
        amount: 3,
        unit: 'cigarettes',
        cigarettesUsed: 3,
        logMode: 'nicotine_cigarettes',
        giverName: 'Chris',
        giftPartyName: 'Chris',
        purchaseId: 'purchase-cig-1',
        linkedPurchaseId: 'purchase-cig-1',
        inventoryAffects: true
    };
    rt.applyLogInventoryEffect(log, data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 13);
    assert.equal(rt.getStatsUsageOnDate(NICOTINE_ID, '2026-07-09', data), 0);
});

test('inventory breakdown separates personal use, shared, and gifted amounts', () => {
    const purchase = makeVapePurchase({ remainingAmount: 9700 });
    const data = makeNicotineData({
        purchases: [purchase],
        logs: [
            {
                id: 'l1', transactionType: 'use', substanceId: NICOTINE_ID, nicotineProductType: 'vape',
                date: '2026-07-10', amount: 50, unit: 'puffs', logMode: 'vape_puffs', inventoryAffects: false
            },
            {
                id: 'l2', transactionType: 'shared_use', substanceId: NICOTINE_ID, nicotineProductType: 'vape',
                date: '2026-07-10', amount: 100, totalAmount: 100, personalAmount: 60, sharedAmount: 40,
                sharedWithName: 'Juju', unit: 'puffs', logMode: 'vape_puffs', inventoryAffects: false
            },
            {
                id: 'l3', transactionType: 'gift_given', substanceId: NICOTINE_ID, nicotineProductType: 'vape',
                date: '2026-07-10', amount: 150, unit: 'puffs', logMode: 'vape_puffs', inventoryAffects: false
            }
        ]
    });
    const rt = setup(data);
    const breakdown = rt.getInventoryBreakdown(NICOTINE_ID);
    assert.equal(breakdown.used, 110);
    assert.equal(breakdown.shared, 40);
    assert.equal(breakdown.gifted, 150);
});

test('nicotine shared and gift logs persist through storage reload', () => {
    const purchase = makeVapePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const sharedLog = {
        id: 'log-persist-shared',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-11',
        amount: 80,
        totalAmount: 80,
        personalAmount: 50,
        sharedAmount: 30,
        sharedWithName: 'Juju',
        unit: 'puffs',
        logMode: 'vape_puffs',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    const giftLog = {
        id: 'log-persist-gift',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-11',
        amount: 20,
        unit: 'puffs',
        logMode: 'vape_puffs',
        recipientName: 'Alex',
        giftPartyName: 'Alex',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    data.logs = [sharedLog, giftLog];
    rt.recalculateVapePurchaseInventory('purchase-vape-1', data);
    rt.saveData(data);
    const reloaded = rt.__reloadTestAppDataFromStorage();
    const savedShared = reloaded.logs.find(l => l.id === 'log-persist-shared');
    const savedGift = reloaded.logs.find(l => l.id === 'log-persist-gift');
    assert.equal(savedShared.personalAmount, 50);
    assert.equal(savedShared.sharedWithName, 'Juju');
    assert.equal(savedGift.recipientName, 'Alex');
    assert.equal(rt.getPurchaseRemainingAmount(reloaded.purchases[0]), 9900);
});

test('json export includes nicotine transaction split fields', () => {
    const rt = setup(makeNicotineData({
        logs: [{
            id: 'log-export-1',
            transactionType: 'shared_use',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-12',
            amount: 100,
            totalAmount: 100,
            personalAmount: 60,
            sharedAmount: 40,
            sharedWithName: 'Juju',
            unit: 'puffs'
        }]
    }));
    const exported = rt.cleanExportData(rt.__getTestAppData()).logs[0];
    assert.equal(exported.transactionType, 'shared_use');
    assert.equal(exported.totalAmount, 100);
    assert.equal(exported.personalAmount, 60);
    assert.equal(exported.sharedAmount, 40);
    assert.equal(exported.sharedWithName, 'Juju');
    assert.equal(exported.nicotineProductType, 'vape');
});

test('shared use validation rejects mismatched personal and other portions', () => {
    const rt = setup(makeNicotineData());
    const err = rt.validateNicotineSharedSplit(10, {
        total: 10,
        personal: 6,
        other: 3,
        sharedWithName: 'Juju'
    });
    assert.match(err, /must equal the total/);
});

test('shared use validation rejects negative amounts', () => {
    const rt = setup(makeNicotineData());
    const err = rt.validateNicotineSharedSplit(10, {
        total: 10,
        personal: -1,
        other: 11,
        sharedWithName: 'Juju'
    });
    assert.match(err, /cannot be negative/);
});

test('inventory is deducted once for shared vape use', () => {
    const purchase = makeVapePurchase({ remainingAmount: 10000, remainingPuffs: 10000 });
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-inv-once',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-13',
        amount: 200,
        totalAmount: 200,
        personalAmount: 120,
        sharedAmount: 80,
        sharedWithName: 'Juju',
        unit: 'puffs',
        logMode: 'vape_puffs',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9800);
    const metrics = rt.getGiftMetricsFromLogs(data.logs);
    assert.equal(metrics.shared, 80);
});

test('edit shared vape entry updates split without duplicating inventory deduction', () => {
    const purchase = makeVapePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-edit-shared',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-14',
        amount: 100,
        totalAmount: 100,
        personalAmount: 60,
        sharedAmount: 40,
        sharedWithName: 'Juju',
        unit: 'puffs',
        logMode: 'vape_puffs',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);
    assert.equal(data.logs.length, 1);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9900);

    const existing = data.logs[0];
    const sharedSplit = { total: 80, personal: 50, other: 30, sharedWithName: 'Sam' };
    const payload = {
        ...existing,
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        date: '2026-07-14',
        inventoryAffects: true,
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1'
    };
    const vapeCalc = {
        purchase,
        purchaseId: purchase.id,
        puffsUsed: 80,
        estimatedPuffsUsed: 80,
        currentRemaining: 9920,
        percentAfter: 99.2,
        previousRemaining: 10000,
        isEstimated: false,
        estimatedFromPercent: false
    };
    const result = rt.applyVapeUseLogEdit(existing, payload, vapeCalc, data, { sharedSplit });
    assert.equal(result.ok, true);
    assert.equal(data.logs.length, 1);
    assert.equal(result.updated.personalAmount, 50);
    assert.equal(result.updated.sharedAmount, 30);
    assert.equal(result.updated.sharedWithName, 'Sam');
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9920);
    assert.equal(rt.getStatsUsageOnDate(NICOTINE_ID, '2026-07-14', data), 50);
});

test('delete shared use entry restores inventory', () => {
    const purchase = makeVapePurchase();
    const data = makeNicotineData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'log-delete-shared',
        type: 'quick',
        transactionType: 'shared_use',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-15',
        amount: 50,
        totalAmount: 50,
        personalAmount: 30,
        sharedAmount: 20,
        sharedWithName: 'Juju',
        unit: 'puffs',
        logMode: 'vape_puffs',
        purchaseId: 'purchase-vape-1',
        linkedPurchaseId: 'purchase-vape-1',
        inventoryAffects: true
    };
    commitNicotineLog(rt, log, data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 9950);
    data.logs = [];
    rt.recalculateVapePurchaseInventory('purchase-vape-1', data);
    assert.equal(rt.getPurchaseRemainingAmount(purchase), 10000);
});
