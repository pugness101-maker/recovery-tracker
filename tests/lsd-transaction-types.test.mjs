import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const LSD_ID = 'lsd';

function makeLsdData({ purchases = [], logs = [] } = {}) {
    return {
        substances: [{
            id: LSD_ID,
            name: 'LSD',
            icon: '🌈',
            color: '#ab47bc',
            trackingMode: 'dose',
            primaryUnit: 'ug',
            units: ['ug', 'tabs'],
            defaultUnit: 'ug',
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

function makeLsdPurchase(overrides = {}) {
    return {
        id: 'lsd-purchase-1',
        substanceId: LSD_ID,
        date: '2026-07-01',
        quantityTabs: 10,
        ugPerTab: 100,
        totalUg: 1000,
        quantity: 1000,
        quantityBought: 1000,
        unit: 'ug',
        remainingAmount: 1000,
        remainingUg: 1000,
        remainingTabs: 10,
        totalCost: 100,
        ...overrides
    };
}

test('formatLsdUseSummary labels gift transactions with tabs and ug', () => {
    const rt = setup(makeLsdData());
    assert.equal(
        rt.formatLsdUseSummary({
            substanceId: LSD_ID,
            transactionType: 'gift_given',
            tabsUsed: 1,
            ugUsed: 100,
            amount: 100,
            unit: 'ug'
        }),
        'Gift Given · 1 tab · 100 ug'
    );
    assert.equal(
        rt.formatLsdUseSummary({
            substanceId: LSD_ID,
            transactionType: 'gift_received',
            tabsUsed: 2,
            ugUsed: 200,
            amount: 200,
            unit: 'ug'
        }),
        'Gift Received · 2 tabs · 200 ug'
    );
});

test('gift transactions are excluded from personal-use totals', () => {
    const rt = setup(makeLsdData({
        logs: [
            {
                id: 'use-1',
                substanceId: LSD_ID,
                date: '2026-07-02',
                amount: 100,
                unit: 'ug',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'gift-1',
                substanceId: LSD_ID,
                date: '2026-07-02',
                amount: 50,
                unit: 'ug',
                transactionType: 'gift_given',
                tabsUsed: 0.5,
                ugUsed: 50,
                type: 'quick'
            }
        ]
    }));
    assert.equal(rt.isPersonalUseLog({ transactionType: 'use' }), true);
    assert.equal(rt.isPersonalUseLog({ transactionType: 'gift_given' }), false);
    assert.equal(rt.isGiftGivenLog({ transactionType: 'gift_given' }), true);
});

test('gift given deducts LSD inventory in ug with tab sync', () => {
    const purchase = makeLsdPurchase();
    const data = makeLsdData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-1',
        substanceId: LSD_ID,
        date: '2026-07-03',
        amount: 100,
        unit: 'ug',
        tabsUsed: 1,
        ugUsed: 100,
        transactionType: 'gift_given',
        purchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true,
        type: 'quick'
    };
    const result = rt.applyLogInventoryEffect(log);
    assert.equal(result.ok, true);
    assert.equal(rt.getLsdRemainingUg(purchase), 900);
    assert.equal(rt.getLsdRemainingTabs(purchase), 9);
});

test('gift received adds LSD inventory in ug with tab sync', () => {
    const purchase = makeLsdPurchase({ remainingAmount: 500, remainingUg: 500, remainingTabs: 5 });
    const data = makeLsdData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-2',
        substanceId: LSD_ID,
        date: '2026-07-04',
        amount: 200,
        unit: 'ug',
        tabsUsed: 2,
        ugUsed: 200,
        transactionType: 'gift_received',
        purchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true,
        type: 'quick'
    };
    const result = rt.applyLogInventoryEffect(log);
    assert.equal(result.ok, true);
    assert.equal(rt.getLsdRemainingUg(purchase), 700);
    assert.equal(rt.getLsdRemainingTabs(purchase), 7);
});

test('LSD gift given submit persists, deducts inventory, and counts in gift analytics', () => {
    const purchase = makeLsdPurchase();
    const data = makeLsdData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-submit-1',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: LSD_ID,
        date: '2026-07-05',
        startTime: '14:30',
        time: '14:30',
        amount: 100,
        unit: 'ug',
        tabsUsed: 1,
        ugUsed: 100,
        ugPerTabAtTimeOfUse: 100,
        logMode: 'lsd_dose',
        purchaseId: 'lsd-purchase-1',
        linkedPurchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true,
        supplyUnlinked: false,
        count: 0,
        giftPartyName: 'Alex'
    };
    const result = rt.persistUseLogEntry(log, data);
    assert.equal(result.ok, true);
    assert.equal(data.logs.length, 1);
    assert.equal(data.logs[0].transactionType, 'gift_given');
    assert.equal(data.logs[0].startTime, '14:30');
    assert.equal(data.logs[0].tabsUsed, 1);
    assert.equal(data.logs[0].ugUsed, 100);
    assert.equal(rt.getLsdRemainingUg(purchase), 900);
    assert.equal(rt.getLsdRemainingTabs(purchase), 9);
    assert.equal(rt.isPersonalUseLog(data.logs[0]), false);
    const gifts = rt.getGiftMetricsFromLogs(data.logs);
    assert.equal(gifts.given, 100);
    assert.match(rt.formatLsdUseSummary(data.logs[0]), /Gift Given · 1 tab · 100 ug/);
});

test('LSD gift given logged by ug converts tabs using ug per tab', () => {
    const purchase = makeLsdPurchase();
    const data = makeLsdData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-submit-ug',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: LSD_ID,
        date: '2026-07-06',
        startTime: '09:15',
        time: '09:15',
        amount: 50,
        unit: 'ug',
        tabsUsed: 0.5,
        ugUsed: 50,
        ugPerTabAtTimeOfUse: 100,
        logMode: 'lsd_dose',
        purchaseId: 'lsd-purchase-1',
        linkedPurchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true,
        supplyUnlinked: false
    };
    const result = rt.persistUseLogEntry(log, data);
    assert.equal(result.ok, true);
    assert.equal(rt.getLsdRemainingUg(purchase), 950);
    assert.equal(data.logs[0].tabsUsed, 0.5);
});

test('LSD gift given submit fails when inventory is insufficient', () => {
    const purchase = makeLsdPurchase({ remainingAmount: 50, remainingUg: 50, remainingTabs: 0.5 });
    const data = makeLsdData({ purchases: [purchase] });
    const rt = setup(data);
    const log = {
        id: 'gift-over',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: LSD_ID,
        date: '2026-07-07',
        amount: 100,
        unit: 'ug',
        tabsUsed: 1,
        ugUsed: 100,
        ugPerTabAtTimeOfUse: 100,
        logMode: 'lsd_dose',
        purchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true
    };
    const result = rt.persistUseLogEntry(log, data);
    assert.equal(result.ok, false);
    assert.equal(data.logs.length, 0);
    assert.match(result.error || '', /Only .* left/i);
});

test('getLsdLogTabsAmount converts ug using ug per tab at time of use', () => {
    const rt = setup(makeLsdData());
    assert.equal(
        rt.getLsdLogTabsAmount({ ugUsed: 100, ugPerTabAtTimeOfUse: 100 }),
        1
    );
    assert.equal(
        rt.getLsdLogTabsAmount({ tabsUsed: 0.5, ugUsed: 50, ugPerTabAtTimeOfUse: 100 }),
        0.5
    );
});

test('LSD gift given persists through storage reload with inventory and history parity', () => {
    const purchase = makeLsdPurchase({
        quantityTabs: 10,
        ugPerTab: 250,
        totalUg: 2500,
        quantity: 2500,
        quantityBought: 2500,
        remainingAmount: 2500,
        remainingUg: 2500,
        remainingTabs: 10,
        costPerUg: 0.04
    });
    const data = makeLsdData({
        purchases: [purchase],
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            lsdInventoryV1: true
        }
    });
    const rt = setup(data);

    const log = {
        id: 'gift-storage-e2e',
        type: 'quick',
        transactionType: 'gift_given',
        substanceId: LSD_ID,
        date: '2026-07-08',
        startTime: '10:00',
        time: '10:00',
        amount: 1000,
        unit: 'ug',
        tabsUsed: 4,
        ugUsed: 1000,
        ugPerTabAtTimeOfUse: 250,
        logMode: 'lsd_dose',
        purchaseId: 'lsd-purchase-1',
        linkedPurchaseId: 'lsd-purchase-1',
        inventoryId: 'lsd-purchase-1',
        inventoryAffects: true,
        supplyUnlinked: false,
        giftPartyName: 'Sam',
        recipientName: 'Sam'
    };

    const lsdCalc = {
        purchaseId: 'lsd-purchase-1',
        tabsUsed: 4,
        ugUsed: 1000,
        ugPerTabAtTimeOfUse: 250
    };

    const result = rt.commitUseLogEntry(log, { lsdCalc, applyInventory: true });
    assert.equal(result.ok, true);
    assert.equal(data.logs.length, 1);
    assert.equal(data.logs[0].transactionType, 'gift_given');
    assert.equal(data.logs[0].tabsUsed, 4);
    assert.equal(data.logs[0].ugUsed, 1000);
    assert.equal(data.logs[0].linkedPurchaseId, 'lsd-purchase-1');
    assert.equal(data.logs[0].startTime, '10:00');
    assert.equal(data.logs[0].recipientName, 'Sam');
    assert.ok(Number.isFinite(data.logs[0].estimatedCost));
    assert.equal(rt.getLsdRemainingTabs(purchase), 6);
    assert.equal(rt.getLsdRemainingUg(purchase), 1500);
    assert.equal(rt.isPersonalUseLog(data.logs[0]), false);
    assert.equal(rt.__getUseHistoryEntryCount(null), 1);
    assert.ok(rt.__getStorageSnapshot());

    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(reloaded.logs.length, 1);
    assert.equal(reloaded.logs[0].transactionType, 'gift_given');
    assert.equal(reloaded.logs[0].tabsUsed, 4);
    assert.equal(reloaded.logs[0].ugUsed, 1000);
    assert.equal(reloaded.logs[0].linkedPurchaseId, 'lsd-purchase-1');
    assert.equal(reloaded.logs[0].giftPartyName, 'Sam');
    assert.equal(rt.getLsdRemainingTabs(reloaded.purchases[0]), 6);
    assert.equal(rt.getLsdRemainingUg(reloaded.purchases[0]), 1500);
    assert.equal(rt.__getUseHistoryEntryCount(null), 1);

    const exported = JSON.parse(rt.__getStorageSnapshot());
    const imported = rt.normalizeAppDataSafe(exported);
    assert.equal(imported.logs.length, 1);
    assert.equal(imported.logs[0].transactionType, 'gift_given');
    assert.equal(imported.logs[0].ugUsed, 1000);
    assert.equal(rt.getGiftMetricsFromLogs(imported.logs).given, 1000);
});
