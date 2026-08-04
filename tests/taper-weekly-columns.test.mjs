import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NICOTINE_ID = 'nicotine';

function makeSubstance(id, overrides = {}) {
    const defaults = {
        coke: { id: COKE_ID, name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true },
        weed: { id: WEED_ID, name: 'Weed', trackingMode: 'weed', primaryUnit: 'g', defaultUnit: 'g', costTrackingEnabled: true, taperTrackingEnabled: true },
        nicotine: { id: NICOTINE_ID, name: 'Nicotine', trackingMode: 'nicotine', primaryUnit: 'puffs', defaultUnit: 'puffs', costTrackingEnabled: true, taperTrackingEnabled: true }
    };
    return { ...(defaults[id] || defaults.coke), ...overrides };
}

function makeData({ substance, purchases = [], taperPlansV2 = [] }) {
    return {
        substances: [substance],
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    };
}

function makeCokePurchase(overrides = {}) {
    return {
        id: overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-07-01',
        time: '12:00',
        quantity: 7,
        quantityBought: 7,
        unit: 'g',
        totalCost: 255,
        ...overrides
    };
}

function makeVapePurchase(overrides = {}) {
    return {
        id: overrides.id || `purchase-vape-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-01',
        time: '12:00',
        fullPuffCount: 20000,
        quantity: 20000,
        quantityBought: 20000,
        unit: 'puffs',
        totalCost: 22,
        ...overrides
    };
}

function makeCokeTaperPlan(overrides = {}) {
    return {
        id: 'taper-coke-1',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        reductionType: 'reduce-amount',
        startDate: '2026-07-01',
        endDate: '2026-07-28',
        startingDailyAverage: 1,
        goalDailyAverage: 0.5,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', weeklyMax: 7, dailyTarget: 1 },
            { week: 2, weekStart: '2026-07-08', weekEnd: '2026-07-14', weeklyMax: 6, dailyTarget: 0.9 },
            { week: 3, weekStart: '2026-07-15', weekEnd: '2026-07-21', weeklyMax: 5, dailyTarget: 0.8 },
            { week: 4, weekStart: '2026-07-22', weekEnd: '2026-07-28', weeklyMax: 4, dailyTarget: 0.7 }
        ],
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

test('cumulative amount bought across multiple weeks', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, quantity: 7 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-10', quantityBought: 3.5, quantity: 3.5 }),
        makeCokePurchase({ id: 'p3', date: '2026-07-24', quantityBought: 3.3, quantity: 3.3 }),
        makeCokePurchase({ id: 'p4', date: '2026-07-26', quantityBought: 3.7, quantity: 3.7 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[1].cumulativePurchaseTotals.quantity, 10.5);
    assert.equal(data.rows[2].cumulativePurchaseTotals.quantity, 10.5);
    assert.equal(data.rows[3].cumulativePurchaseTotals.quantity, 17.5);
});

test('cumulative spending across multiple weeks', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', totalCost: 255 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-10', totalCost: 125 }),
        makeCokePurchase({ id: 'p3', date: '2026-07-24', totalCost: 155 }),
        makeCokePurchase({ id: 'p4', date: '2026-07-26', totalCost: 155 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].runningAmountSpent, 255);
    assert.equal(data.rows[1].runningAmountSpent, 380);
    assert.equal(data.rows[2].runningAmountSpent, 380);
    assert.equal(data.rows[3].runningAmountSpent, 690);
});

test('week with no purchases keeps cumulative totals', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-24', quantityBought: 3, totalCost: 50 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[1].weeklyPurchaseTotals.quantity, 0);
    assert.equal(data.rows[1].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[1].runningAmountSpent, 100);
});

test('plan start date resets cumulative totals', () => {
    const purchases = [
        makeCokePurchase({ id: 'p0', date: '2026-06-20', quantityBought: 20, totalCost: 500 }),
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 })
    ];
    const plan = makeCokeTaperPlan({ startDate: '2026-07-01' });
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('cross-month week includes purchases through week end', () => {
    const plan = makeCokeTaperPlan({
        weeklyTargets: [{
            week: 1, weekStart: '2026-07-28', weekEnd: '2026-08-03', weeklyMax: 7, dailyTarget: 1
        }]
    });
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-30', quantityBought: 2, totalCost: 40 }),
        makeCokePurchase({ id: 'p2', date: '2026-08-01', quantityBought: 3, totalCost: 60 })
    ];
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].weeklyPurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('substance filtering excludes other substances', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 5, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-03', substanceId: WEED_ID, quantityBought: 10, totalCost: 200 })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({
        substance: makeSubstance('coke'),
        purchases,
        taperPlansV2: [plan]
    }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
    assert.equal(data.rows[0].runningAmountSpent, 100);
});

test('archived purchase exclusion', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 5, totalCost: 100 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-03', quantityBought: 9, totalCost: 180, archivedAt: '2026-07-03T12:00:00.000Z' })
    ];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 5);
});

test('editing a purchase does not double-count', () => {
    const purchases = [makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 7, totalCost: 100 })];
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), purchases, taperPlansV2: [plan] }));
    let data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 7);

    const appData = rt.__getTestAppData();
    appData.purchases[0].quantityBought = 4;
    appData.purchases[0].quantity = 4;
    appData.purchases[0].totalCost = 80;
    data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.quantity, 4);
    assert.equal(data.rows[0].runningAmountSpent, 80);
});

test('hiding and restoring optional columns', () => {
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [makeCokeTaperPlan()] }));
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const variantKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, plan);
    const baseOrder = rt.getEffectiveColumnOrder('taperByWeek', variantKey);

    rt.saveTableColumnConfig('taperByWeek', {
        order: baseOrder,
        visible: {
            week: true,
            dates: true,
            planned: true,
            used: true,
            difference: true,
            status: true,
            runningAmountBought: false,
            runningAmountSpent: false
        },
        widths: {}
    }, variantKey);

    let order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    assert.ok(!order.includes('runningAmountBought'));
    assert.ok(!order.includes('runningAmountSpent'));

    rt.saveTableColumnConfig('taperByWeek', {
        order: baseOrder,
        visible: {
            week: true,
            dates: true,
            planned: true,
            used: true,
            difference: true,
            status: true,
            runningAmountBought: true,
            runningAmountSpent: true
        },
        widths: {}
    }, variantKey);

    order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    assert.ok(order.includes('runningAmountBought'));
    assert.ok(order.includes('runningAmountSpent'));
});

test('column settings persistence per substance', () => {
    const rt = setup(makeData({
        substance: makeSubstance('nicotine'),
        taperPlansV2: []
    }));
    // Add coke so both substances exist for independent prefs.
    rt.__getTestAppData().substances.push(makeSubstance('coke'));

    const vapePlan = {
        substanceId: NICOTINE_ID,
        reductionType: 'nicotine-vape-purchase'
    };
    const cokePlan = { substanceId: COKE_ID, reductionType: 'reduce-amount' };
    const nicotineKey = rt.getTaperByWeekColumnVariantKey(NICOTINE_ID, vapePlan);
    const cokeKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, cokePlan);
    assert.equal(nicotineKey, NICOTINE_ID);
    assert.equal(cokeKey, COKE_ID);

    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status', 'runningAmountBought'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true,
            runningAmountBought: true, buyInterval: true
        },
        widths: { runningAmountBought: 150, week: 180 }
    }, nicotineKey);

    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true,
            runningAmountBought: false
        },
        widths: { week: 72 }
    }, cokeKey);

    const reloaded = rt.loadColumnSettingsStore();
    const nicotineStorage = reloaded[rt.resolveColumnStorageKey('taperByWeek', nicotineKey)];
    const cokeStorage = reloaded[rt.resolveColumnStorageKey('taperByWeek', cokeKey)];
    assert.equal(nicotineStorage.visible.runningAmountBought, true);
    assert.equal(nicotineStorage.widths.runningAmountBought, 150);
    assert.equal(nicotineStorage.widths.week, 180);
    assert.equal(cokeStorage.visible.runningAmountBought, false);
    assert.equal(cokeStorage.widths.week, 72);
    assert.equal(rt.getTableColumnWidthPx('taperByWeek', 'week', nicotineKey), 180);
    assert.equal(rt.getTableColumnWidthPx('taperByWeek', 'week', cokeKey), 72);
});

test('Weekly Table width 72→180 applies to colgroup and migrates family keys', () => {
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [plan] }));
    const substanceKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, plan);
    assert.equal(substanceKey, COKE_ID);

    // Legacy family-scoped prefs should migrate onto the substance key.
    const familyKey = 'cocaine';
    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true
        },
        widths: { week: 72 }
    }, familyKey);

    // Clear substance key if save wrote through resolve — write family key directly.
    const store = rt.loadColumnSettingsStore();
    store['taperByWeek::cocaine'] = store['taperByWeek::cocaine'] || store[`taperByWeek::${familyKey}`];
    delete store[`taperByWeek::${COKE_ID}`];
    rt.localStorage.setItem(rt.COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(store));

    assert.equal(rt.getTableColumnWidthPx('taperByWeek', 'week', substanceKey), 72);
    assert.ok(rt.loadColumnSettingsStore()[`taperByWeek::${COKE_ID}`], 'migrates to substance key');

    const cfg = rt.getTableColumnConfig('taperByWeek', substanceKey);
    rt.saveTableColumnConfig('taperByWeek', {
        ...cfg,
        widths: { ...cfg.widths, week: 180 }
    }, substanceKey);

    assert.equal(rt.getTableColumnWidthPx('taperByWeek', 'week', substanceKey), 180);
    const layout = rt.getCustomizableTableColumnLayout('taperByWeek', ['week'], substanceKey);
    assert.equal(layout[0].widthPx, 180);
    assert.match(rt.buildTableColgroup('taperByWeek', ['week'], substanceKey), /data-col="week"[^>]*width:180px/);

    // Reset defaults only for this substance.
    rt.resetTableColumnConfig('taperByWeek', substanceKey);
    assert.equal(
        rt.getTableColumnWidthPx('taperByWeek', 'week', substanceKey),
        rt.getDefaultTaperByWeekColumnSettings(COKE_ID, plan).widths.week
    );
});

test('cocaine catalog excludes nicotine and alcohol columns', () => {
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [makeCokeTaperPlan()] }));
    const catalog = rt.getTaperByWeekColumnCatalog(COKE_ID, makeCokeTaperPlan());
    assert.ok(catalog.includes('bought'));
    assert.ok(catalog.includes('runningAmountBought'));
    assert.ok(catalog.includes('weeklyBuyCapStatus'));
    assert.ok(catalog.includes('targets'));
    assert.ok(!catalog.includes('vapeLifespans'));
    assert.ok(!catalog.includes('avgPerDay'));
    assert.equal(rt.getTaperByWeekColumnFamilyLabel(COKE_ID), 'Cocaine Taper');
});

test('nicotine catalog excludes cocaine buying columns', () => {
    const rt = setup(makeData({ substance: makeSubstance('nicotine'), taperPlansV2: [] }));
    const plan = { substanceId: NICOTINE_ID, reductionType: 'nicotine-vape-purchase' };
    const catalog = rt.getTaperByWeekColumnCatalog(NICOTINE_ID, plan);
    assert.ok(catalog.includes('vapeLifespans'));
    assert.ok(catalog.includes('buyInterval'));
    assert.ok(catalog.includes('runningAmountSpent'));
    assert.ok(catalog.includes('lifespanGoal'));
    assert.ok(!catalog.includes('sharedPuffs'));
    assert.ok(catalog.includes('giftedPuffs'));
    assert.ok(!catalog.includes('avgPerDay'));
    assert.ok(!catalog.includes('buyPlanned'));
    assert.ok(!catalog.includes('buyDiff'));
    assert.ok(!catalog.includes('monthlyBuyCapStatus'));
    assert.ok(!catalog.includes('targets'));
    assert.equal(rt.getTaperByWeekColumnLabel('buyInterval', plan, NICOTINE_ID), 'Days Between Purchases');
    assert.equal(rt.getTaperByWeekColumnLabel('runningAmountBought', plan, NICOTINE_ID), 'Monthly Running Vapes Bought');
    assert.equal(rt.getTaperByWeekColumnLabel('planned', plan, NICOTINE_ID), 'Puff Target');
    assert.equal(rt.getTaperByWeekColumnLabel('used', plan, NICOTINE_ID), 'Personal Puffs');
});

test('alcohol catalog excludes nicotine and cocaine columns', () => {
    const alcohol = {
        id: 'alcohol',
        name: 'Alcohol',
        trackingMode: 'alcohol',
        primaryUnit: 'drinks',
        defaultUnit: 'drinks',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    };
    const rt = setup(makeData({ substance: alcohol, taperPlansV2: [] }));
    const catalog = rt.getTaperByWeekColumnCatalog('alcohol', { substanceId: 'alcohol' });
    assert.ok(catalog.includes('avgPerDay'));
    assert.ok(catalog.includes('spent'));
    assert.ok(catalog.includes('runningAmountSpent'));
    assert.ok(catalog.includes('sessions'));
    assert.ok(!catalog.includes('vapeLifespans'));
    assert.ok(!catalog.includes('bought'));
    assert.ok(!catalog.includes('buyPlanned'));
    assert.ok(!catalog.includes('monthlyBuyCapStatus'));
    assert.equal(rt.getTaperByWeekColumnFamilyLabel('alcohol'), 'Alcohol Taper');
    assert.equal(
        rt.getTaperByWeekColumnLabel('planned', { substanceId: 'alcohol' }, 'alcohol'),
        'Drinks Planned'
    );
});

test('lsd and xanax catalogs hide purchasing metrics', () => {
    const lsd = {
        id: 'lsd',
        name: 'LSD',
        trackingMode: 'dose',
        primaryUnit: 'ug',
        defaultUnit: 'ug',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    };
    const xanax = {
        id: 'xannax',
        name: 'Xanax',
        trackingMode: 'dose',
        primaryUnit: 'mg',
        defaultUnit: 'mg',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    };
    const rtLsd = setup(makeData({ substance: lsd, taperPlansV2: [] }));
    const lsdCatalog = rtLsd.getTaperByWeekColumnCatalog('lsd', { substanceId: 'lsd' });
    assert.ok(lsdCatalog.includes('planned'));
    assert.ok(lsdCatalog.includes('sessions'));
    assert.ok(!lsdCatalog.includes('bought'));
    assert.ok(!lsdCatalog.includes('vapeLifespans'));
    assert.ok(!lsdCatalog.includes('runningAmountBought'));
    assert.equal(rtLsd.getTaperByWeekColumnLabel('planned', { substanceId: 'lsd' }, 'lsd'), 'Tabs Planned');

    const rtXanax = setup(makeData({ substance: xanax, taperPlansV2: [] }));
    const xanaxCatalog = rtXanax.getTaperByWeekColumnCatalog('xannax', { substanceId: 'xannax' });
    assert.ok(xanaxCatalog.includes('avgPerDay'));
    assert.ok(!xanaxCatalog.includes('bought'));
    assert.ok(!xanaxCatalog.includes('vapeLifespans'));
    assert.equal(
        rtXanax.getTaperByWeekColumnLabel('used', { substanceId: 'xannax' }, 'xannax'),
        'Pills Used'
    );
});

test('cannabis catalog keeps gram and purchase metrics only', () => {
    const rt = setup(makeData({ substance: makeSubstance('weed'), taperPlansV2: [] }));
    const catalog = rt.getTaperByWeekColumnCatalog(WEED_ID, { substanceId: WEED_ID });
    assert.ok(catalog.includes('bought'));
    assert.ok(catalog.includes('runningAmountBought'));
    assert.ok(catalog.includes('spent'));
    assert.ok(catalog.includes('buyInterval'));
    assert.ok(!catalog.includes('vapeLifespans'));
    assert.ok(!catalog.includes('monthlyBuyCapStatus'));
    assert.equal(rt.getTaperByWeekColumnFamily(WEED_ID), 'cannabis');
});

test('effective column order never includes out-of-family columns', () => {
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [makeCokeTaperPlan()] }));
    const variantKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, makeCokeTaperPlan());
    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status', 'vapeLifespans', 'bought'],
        visible: {
            week: true, dates: true, planned: true, used: true, difference: true, status: true,
            vapeLifespans: true, bought: true
        },
        widths: {}
    }, variantKey);
    const order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    assert.ok(order.includes('bought'));
    assert.ok(!order.includes('vapeLifespans'));
});

test('nicotine vape plan counts running vapes bought', () => {
    const purchases = [
        makeVapePurchase({ id: 'v1', date: '2026-07-02' }),
        makeVapePurchase({ id: 'v2', date: '2026-07-10' })
    ];
    const plan = {
        id: 'taper-vape',
        substanceId: NICOTINE_ID,
        reductionType: 'nicotine-vape-purchase',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-07', actualPurchases: 1 },
            { week: 2, weekStart: '2026-07-08', weekEnd: '2026-07-14', actualPurchases: 1 }
        ]
    };
    const rt = setup(makeData({ substance: makeSubstance('nicotine'), purchases, taperPlansV2: [plan] }));
    const data = rt.buildTaperByWeekData(NICOTINE_ID, plan);
    assert.equal(data.rows[0].cumulativePurchaseTotals.vapes, 1);
    assert.equal(data.rows[1].cumulativePurchaseTotals.vapes, 2);
    assert.match(
        rt.formatTaperRunningAmountBought(data.rows[1].cumulativePurchaseTotals, plan, NICOTINE_ID, 'puffs'),
        /2 vapes/
    );
});

test('computeReorderedColumnOrder removes old position before insert (no duplicates)', () => {
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [makeCokeTaperPlan()] }));
    const base = ['week', 'dates', 'status', 'difference', 'bought', 'runningAmountBought', 'spent', 'runningAmountSpent'];

    let next = rt.computeReorderedColumnOrder(base, 'status', 'bought', true);
    assert.deepEqual(next, ['week', 'dates', 'difference', 'bought', 'status', 'runningAmountBought', 'spent', 'runningAmountSpent']);
    assert.equal(next.filter(id => id === 'status').length, 1);

    next = rt.computeReorderedColumnOrder(next, 'difference', 'week', false);
    assert.equal(next[0], 'difference');
    assert.equal(next.filter(id => id === 'difference').length, 1);

    next = rt.computeReorderedColumnOrder(next, 'runningAmountBought', 'spent', false);
    assert.ok(next.indexOf('runningAmountBought') < next.indexOf('spent'));
    assert.equal(next.filter(id => id === 'runningAmountBought').length, 1);
});

test('reordering Status/Difference/Bought/Running/Spending persists and keeps shared layout', () => {
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({ substance: makeSubstance('coke'), taperPlansV2: [plan] }));
    const variantKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, plan);

    const visibleCols = {
        week: true,
        dates: true,
        planned: true,
        used: true,
        difference: true,
        status: true,
        bought: true,
        runningAmountBought: true,
        spent: true,
        runningAmountSpent: true
    };
    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'dates', 'planned', 'used', 'difference', 'status', 'bought', 'runningAmountBought', 'spent', 'runningAmountSpent'],
        visible: visibleCols,
        widths: {
            status: 80,
            difference: 70,
            bought: 70,
            runningAmountBought: 90,
            spent: 70,
            runningAmountSpent: 90
        }
    }, variantKey);

    // Move the columns named in the bug report through several reorder passes.
    rt.reorderTableColumnOrder('taperByWeek', 'status', 'runningAmountSpent', true, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'difference', 'bought', false, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'bought', 'spent', true, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'runningAmountBought', 'status', false, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'spent', 'week', true, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'runningAmountSpent', 'difference', true, variantKey);

    const order = rt.getEffectiveColumnOrder('taperByWeek', variantKey);
    const focus = ['status', 'difference', 'bought', 'runningAmountBought', 'spent', 'runningAmountSpent'];
    focus.forEach(id => assert.ok(order.includes(id), `${id} still visible`));
    assert.equal(new Set(order).size, order.length, 'no duplicate columns after reorder');

    const layout = rt.getCustomizableTableColumnLayout('taperByWeek', order, variantKey);
    assert.deepEqual(layout.map(c => c.id), order);
    layout.forEach(col => {
        const minW = rt.getTableColumnMinWidth('taperByWeek', col.id, variantKey);
        assert.ok(col.minWidthPx >= minW);
        assert.ok(col.widthPx >= col.minWidthPx, `${col.id} width respects min-width`);
    });

    // Saved widths control layout (not label-length estimates).
    const runningBought = layout.find(c => c.id === 'runningAmountBought');
    assert.equal(runningBought.widthPx, 90);
    assert.equal(rt.getTableColumnWidthPx('taperByWeek', 'runningAmountBought', variantKey), 90);

    const colgroup = rt.buildTableColgroup('taperByWeek', order, variantKey);
    order.forEach(id => {
        assert.match(colgroup, new RegExp(`data-col="${id}"[^>]*min-width:`));
        assert.equal((colgroup.match(new RegExp(`data-col="${id}"`, 'g')) || []).length, 1);
    });
    assert.match(colgroup, /data-col="runningAmountBought"[^>]*width:90px/);

    // Persist across reload of the column settings store.
    const stored = rt.loadColumnSettingsStore()[rt.resolveColumnStorageKey('taperByWeek', variantKey)];
    const storedFocus = (stored.order || []).filter(id => focus.includes(id)).join(',');
    const effectiveFocus = order.filter(id => focus.includes(id)).join(',');
    assert.equal(storedFocus, effectiveFocus);
    assert.equal(stored.widths.runningAmountBought, 90);
});

test('Weekly Table render shares header/body column order and widths without duplicates', () => {
    const plan = makeCokeTaperPlan();
    const rt = setup(makeData({
        substance: makeSubstance('coke'),
        purchases: [makeCokePurchase()],
        taperPlansV2: [plan]
    }));
    const variantKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, plan);
    rt.saveTableColumnConfig('taperByWeek', {
        order: ['week', 'status', 'difference', 'bought', 'runningAmountBought', 'spent', 'runningAmountSpent', 'dates', 'planned', 'used'],
        visible: {
            week: true, status: true, difference: true, bought: true, runningAmountBought: true,
            spent: true, runningAmountSpent: true, dates: true, planned: true, used: true
        },
        widths: {
            week: 180,
            status: 88,
            difference: 96,
            bought: 84,
            runningAmountBought: 150,
            spent: 90,
            runningAmountSpent: 150
        }
    }, variantKey);

    const tableHost = { id: 'taper-weekly-table', innerHTML: '' };
    const substanceSelect = { id: 'taper-substance', value: COKE_ID };
    const nodes = new Map([
        ['taper-weekly-table', tableHost],
        ['taper-substance', substanceSelect],
        ['taper-weekly-customize-columns', { classList: { remove() {}, add() {} } }]
    ]);
    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.selectedTaperPlanIdRef.value = plan.id;

    rt.reorderTableColumnOrder('taperByWeek', 'status', 'bought', true, variantKey);
    rt.reorderTableColumnOrder('taperByWeek', 'difference', 'runningAmountSpent', false, variantKey);
    rt.renderTaperWeeklyTable(COKE_ID);

    const html = tableHost.innerHTML;
    assert.match(html, /column-reorderable/);
    assert.match(html, /taper-weekly-table-scroll/);
    assert.match(html, /table-layout:fixed/);
    assert.match(html, /data-col="week"[^>]*width:180px/);

    const thCols = [...html.matchAll(/<th[^>]*data-col="([^"]+)"/g)].map(m => m[1]);
    const tdFirstRow = html.match(/<tbody><tr[^>]*>([\s\S]*?)<\/tr>/);
    assert.ok(tdFirstRow);
    const tdCols = [...tdFirstRow[1].matchAll(/<td[^>]*data-col="([^"]+)"/g)].map(m => m[1]);
    const colCols = [...html.matchAll(/<col data-col="([^"]+)"/g)].map(m => m[1]);

    assert.deepEqual(thCols, colCols, 'header order matches colgroup');
    assert.deepEqual(tdCols, colCols, 'body order matches colgroup');
    assert.equal(new Set(thCols).size, thCols.length, 'no duplicate headers');

    ['status', 'difference', 'bought', 'runningAmountBought', 'spent', 'runningAmountSpent'].forEach(id => {
        assert.ok(thCols.includes(id));
        assert.match(html, new RegExp(`<th[^>]*data-col="${id}"[^>]*draggable="true"`));
        assert.match(html, new RegExp(`<th[^>]*data-col="${id}"[^>]*min-width:\\d+px`));
        assert.match(html, new RegExp(`<td[^>]*data-col="${id}"[^>]*min-width:\\d+px`));
    });
});

test('weekly table CSS prevents cell overlap and keeps sticky headers', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.customizable-table th,\s*\.customizable-table td\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /text-overflow:\s*ellipsis/);
    assert.match(css, /\.taper-by-week-table thead th\s*\{[^}]*position:\s*sticky/s);
    assert.match(css, /column-drop-before/);
    assert.match(css, /column-drop-after/);
    assert.match(css, /#taper-weekly-table\.taper-table-wrap\s*\{[^}]*overflow:\s*visible/s);
    assert.match(css, /#taper-weekly-table \.taper-by-week-table\.customizable-table\s*\{[^}]*table-layout:\s*fixed/s);
});
