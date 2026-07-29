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
