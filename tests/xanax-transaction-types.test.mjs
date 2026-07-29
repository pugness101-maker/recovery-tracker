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
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            xanaxInventoryV1: true
        }
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
        remainingPills: 30,
        remainingMg: 15,
        totalCost: 30,
        costPerPill: 1,
        costPerMg: 2,
        ...overrides
    };
}

function makeXanaxGiftLog(overrides = {}) {
    return {
        id: 'gift-1',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: XANAX_ID,
        date: '2026-07-05',
        startTime: '14:30',
        time: '14:30',
        amount: 2,
        unit: 'pills',
        pillsUsed: 2,
        mgUsed: 1,
        mgPerPillAtTimeOfUse: 0.5,
        strengthPerPillAtTimeOfUse: 0.5,
        strengthUnitAtTimeOfUse: 'mg',
        logMode: 'xanax_dose',
        purchaseId: 'purchase-1',
        linkedPurchaseId: 'purchase-1',
        inventoryId: 'purchase-1',
        inventoryAffects: true,
        supplyUnlinked: false,
        giftPartyName: 'Alex',
        recipientName: 'Alex',
        ...overrides
    };
}

test('formatXanaxUseSummary labels gift transactions with pills and mg', () => {
    const rt = setup(makeXanaxData());
    assert.equal(
        rt.formatXanaxUseSummary({
            substanceId: XANAX_ID,
            transactionType: 'gift_given',
            pillsUsed: 2,
            mgUsed: 1,
            amount: 2,
            unit: 'pills'
        }),
        'Gift Given · 2 pills · 1 mg'
    );
    assert.equal(
        rt.formatXanaxUseSummary({
            substanceId: XANAX_ID,
            transactionType: 'gift_received',
            pillsUsed: 3,
            mgUsed: 1.5,
            amount: 3,
            unit: 'pills'
        }),
        'Gift Received · 3 pills · 1.5 mg'
    );
    assert.equal(
        rt.formatXanaxUseSummary({
            substanceId: XANAX_ID,
            transactionType: 'inventory_adjustment',
            adjustmentDirection: 'remove',
            pillsUsed: 1,
            mgUsed: 0.5,
            amount: 1,
            unit: 'pills'
        }),
        'Adjustment · −1 pill · 0.5 mg'
    );
});

test('gift given by pills deducts inventory and excludes personal-use totals', () => {
    const purchase = makeXanaxPurchase();
    const data = makeXanaxData({ purchases: [purchase] });
    const rt = setup(data);
    const log = makeXanaxGiftLog();
    const result = rt.applyLogInventoryEffect(log);
    assert.equal(result.ok, true);
    assert.equal(rt.getXanaxRemainingPills(purchase), 28);
    assert.equal(rt.getXanaxRemainingMg(purchase), 14);
    assert.equal(rt.isPersonalUseLog(log), false);
    assert.equal(rt.isGiftGivenLog(log), true);
});

test('gift given by mg converts pills using strength per pill', () => {
    const purchase = makeXanaxPurchase();
    const data = makeXanaxData({ purchases: [purchase] });
    const rt = setup(data);
    const log = makeXanaxGiftLog({
        id: 'gift-mg',
        amount: 1.5,
        pillsUsed: 1.5,
        mgUsed: 0.75
    });
    const result = rt.applyLogInventoryEffect(log);
    assert.equal(result.ok, true);
    assert.equal(rt.getXanaxRemainingPills(purchase), 28.5);
    assert.equal(rt.getXanaxRemainingMg(purchase), 14.25);
});

test('gift received adds inventory in pills with mg sync', () => {
    const purchase = makeXanaxPurchase({ remainingAmount: 20, remainingPills: 20, remainingMg: 10 });
    const data = makeXanaxData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-in',
        substanceId: XANAX_ID,
        date: '2026-07-06',
        amount: 4,
        unit: 'pills',
        pillsUsed: 4,
        mgUsed: 2,
        mgPerPillAtTimeOfUse: 0.5,
        transactionType: 'gift_received',
        purchaseId: 'purchase-1',
        inventoryId: 'purchase-1',
        inventoryAffects: true,
        type: 'quick'
    };
    const result = rt.applyLogInventoryEffect(log);
    assert.equal(result.ok, true);
    assert.equal(rt.getXanaxRemainingPills(purchase), 24);
    assert.equal(rt.getXanaxRemainingMg(purchase), 12);
    assert.equal(rt.isPersonalUseLog(log), false);
});

test('inventory adjustment remove deducts and add restores pills/mg', () => {
    const purchase = makeXanaxPurchase();
    const data = makeXanaxData({ purchases: [purchase] });
    const rt = setup(data);
    const removeLog = {
        id: 'adj-remove',
        substanceId: XANAX_ID,
        date: '2026-07-07',
        amount: 2,
        unit: 'pills',
        pillsUsed: 2,
        mgUsed: 1,
        mgPerPillAtTimeOfUse: 0.5,
        transactionType: 'inventory_adjustment',
        adjustmentDirection: 'remove',
        purchaseId: 'purchase-1',
        inventoryId: 'purchase-1',
        inventoryAffects: true,
        type: 'quick'
    };
    assert.equal(rt.applyLogInventoryEffect(removeLog).ok, true);
    assert.equal(rt.getXanaxRemainingPills(purchase), 28);

    const addLog = {
        id: 'adj-add',
        substanceId: XANAX_ID,
        date: '2026-07-08',
        amount: 1,
        unit: 'pills',
        pillsUsed: 1,
        mgUsed: 0.5,
        mgPerPillAtTimeOfUse: 0.5,
        transactionType: 'inventory_adjustment',
        adjustmentDirection: 'add',
        purchaseId: 'purchase-1',
        inventoryId: 'purchase-1',
        inventoryAffects: true,
        type: 'quick'
    };
    assert.equal(rt.applyLogInventoryEffect(addLog).ok, true);
    assert.equal(rt.getXanaxRemainingPills(purchase), 29);
    assert.equal(rt.isPersonalUseLog(removeLog), false);
});

test('xanax gift given persists through storage reload with history parity', () => {
    const purchase = makeXanaxPurchase();
    const data = makeXanaxData({ purchases: [purchase] });
    const rt = setup(data);
    const log = makeXanaxGiftLog();
    const xanaxCalc = {
        purchaseId: 'purchase-1',
        pillsUsed: 2,
        mgUsed: 1,
        amount: 2,
        strengthPerPillAtTimeOfUse: 0.5,
        strengthUnitAtTimeOfUse: 'mg',
        mgPerPillAtTimeOfUse: 0.5
    };

    const result = rt.commitUseLogEntry(log, { xanaxCalc, applyInventory: true });
    assert.equal(result.ok, true);
    assert.equal(data.logs.length, 1);
    assert.equal(data.logs[0].transactionType, 'gift_given');
    assert.equal(data.logs[0].pillsUsed, 2);
    assert.equal(data.logs[0].mgUsed, 1);
    assert.equal(data.logs[0].linkedPurchaseId, 'purchase-1');
    assert.equal(data.logs[0].startTime, '14:30');
    assert.equal(data.logs[0].recipientName, 'Alex');
    assert.ok(Number.isFinite(data.logs[0].estimatedCost));
    assert.equal(rt.getXanaxRemainingPills(purchase), 28);
    assert.equal(rt.getGiftMetricsFromLogs(data.logs).given, 2);
    assert.equal(rt.__getUseHistoryEntryCount(null), 1);

    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(reloaded.logs.length, 1);
    assert.equal(reloaded.logs[0].transactionType, 'gift_given');
    assert.equal(reloaded.logs[0].pillsUsed, 2);
    assert.equal(reloaded.logs[0].mgUsed, 1);
    assert.equal(rt.getXanaxRemainingPills(reloaded.purchases[0]), 28);
    assert.match(rt.formatXanaxUseSummary(reloaded.logs[0]), /Gift Given · 2 pills · 1 mg/);

    const exported = JSON.parse(rt.__getStorageSnapshot());
    const imported = rt.normalizeAppDataSafe(exported);
    assert.equal(imported.logs[0].transactionType, 'gift_given');
    assert.equal(imported.logs[0].mgPerPillAtTimeOfUse, 0.5);
});
