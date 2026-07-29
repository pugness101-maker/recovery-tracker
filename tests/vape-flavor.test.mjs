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
            units: ['puffs'],
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
        remainingAmount: 20000,
        remainingPuffs: 20000,
        nicotineMgPerMl: 50,
        totalCost: 25,
        notes: 'Foger Switch Pro',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('vape flavor trims on save and preserves capitalization', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase({ flavor: 'Sour Gush' })]
    }));
    assert.equal(rt.getVapePurchaseFlavor(makeVapePurchase({ flavor: 'Sour Gush' })), 'Sour Gush');
    assert.equal(rt.formatVapePurchaseTitleLine({ notes: 'Foger Switch Pro', flavor: 'Sour Gush' }), 'Foger Switch Pro · Sour Gush');
    rt.saveData(rt.__getTestAppData());
    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(rt.getVapePurchaseFlavor(reloaded.purchases[0]), 'Sour Gush');
});

test('vape flavor detail line includes puffs and nicotine strength', () => {
    const rt = setup(makeNicotineData());
    const line = rt.formatVapePurchaseDetailLine(makeVapePurchase({ flavor: 'Sour Gush' }));
    assert.match(line, /Sour Gush/);
    assert.match(line, /20000 puffs/);
    assert.match(line, /50 mg\/mL/);
});

test('older vape purchases without flavor stay blank', () => {
    const rt = setup(makeNicotineData({ purchases: [makeVapePurchase()] }));
    assert.equal(rt.getVapePurchaseFlavor(makeVapePurchase()), '');
    assert.equal(rt.formatVapePurchaseTitleLine(makeVapePurchase()), 'Foger Switch Pro');
});

test('flavor is searchable in purchase history', () => {
    const rt = setup(makeNicotineData({
        purchases: [
            makeVapePurchase({ id: 'a', flavor: 'Sour Gush' }),
            makeVapePurchase({ id: 'b', flavor: 'Blue Razz', notes: 'Other Device' })
        ]
    }));
    assert.equal(rt.purchaseMatchesInventorySearch(makeVapePurchase({ flavor: 'Sour Gush' }), 'sour gush'), true);
    assert.equal(rt.purchaseMatchesInventorySearch(makeVapePurchase({ flavor: 'Blue Razz' }), 'sour gush'), false);
});

test('flavor sort orders purchases alphabetically', () => {
    const rt = setup(makeNicotineData());
    const a = makeVapePurchase({ id: 'a', flavor: 'Mango' });
    const b = makeVapePurchase({ id: 'b', flavor: 'Apple' });
    assert.ok(rt.comparePurchaseHistoryByFlavor(a, b, 'asc') > 0);
    assert.ok(rt.comparePurchaseHistoryByFlavor(a, b, 'desc') < 0);
});

test('duplicate purchase copies flavor', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase({ id: 'orig-1', flavor: 'Sour Gush' })]
    }));
    const copy = rt.duplicatePurchaseNow('orig-1');
    assert.equal(copy.flavor, 'Sour Gush');
});

test('json export and import preserve flavor', () => {
    const rt = setup(makeNicotineData({
        purchases: [makeVapePurchase({ flavor: 'Sour Gush' })]
    }));
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(exported.purchases[0].flavor, 'Sour Gush');
});

test('Coke hides flavor column and uses store/notes search placeholder', () => {
    const rt = setup(makeNicotineData());
    assert.equal(rt.substanceShowsPurchaseFlavor('coke'), false);
    assert.equal(rt.getInventorySearchPlaceholder('coke'), 'Search store, notes…');
    assert.equal(rt.getPurchaseHistoryVisibleColumns('coke').includes('flavor'), false);
});

test('Nicotine Vape keeps flavor column and flavor search placeholder', () => {
    const rt = setup(makeNicotineData());
    assert.equal(rt.substanceShowsPurchaseFlavor(NICOTINE_ID), true);
    assert.equal(rt.getInventorySearchPlaceholder(NICOTINE_ID), 'Search store, notes, flavor…');
    assert.equal(rt.getPurchaseHistoryVisibleColumns(NICOTINE_ID).includes('flavor'), true);
    assert.equal(rt.purchaseSupportsFlavor(makeVapePurchase({ flavor: 'Sour Gush' })), true);
});

test('Coke purchases with leftover flavor data stay in storage but are excluded from search', () => {
    const cokePurchase = {
        id: 'coke-1',
        substanceId: 'coke',
        date: '2026-07-01',
        quantityBought: 3.5,
        quantity: 3.5,
        unit: 'g',
        store: 'Main',
        notes: 'Weekend',
        flavor: 'ShouldNotSearch',
        totalCost: 140,
        remainingAmount: 3.5
    };
    const rt = setup({
        substances: [{
            id: 'coke',
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs: [],
        purchases: [cokePurchase],
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    });
    assert.equal(rt.purchaseSupportsFlavor(cokePurchase), false);
    assert.equal(rt.purchaseMatchesInventorySearch(cokePurchase, 'ShouldNotSearch'), false);
    assert.equal(rt.purchaseMatchesInventorySearch(cokePurchase, 'weekend'), true);
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(exported.purchases[0].flavor, 'ShouldNotSearch');
});
