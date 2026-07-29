import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeCokeSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    };
}

function makePurchase(overrides = {}) {
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-07-10',
        time: '12:00',
        quantity: overrides.quantityBought ?? overrides.quantity ?? 7,
        quantityBought: overrides.quantityBought ?? overrides.quantity ?? 7,
        unit: 'g',
        totalCost: overrides.totalCost ?? 301,
        ...overrides
    };
}

function makeAutoSpendSettings(overrides = {}) {
    return {
        enabled: true,
        source: 'manual',
        manualCostPerGram: 43,
        baselineRange: 'last-30',
        customStart: null,
        customEnd: null,
        ...overrides
    };
}

function makePlan(rt, overrides = {}) {
    const defaults = rt.getDefaultBuyingReductionSettings();
    const autoOverride = overrides.buyingReductionSettings?.autoSpendFromCostPerGram;
    const settings = {
        ...defaults,
        ...(overrides.buyingReductionSettings || {}),
        autoSpendFromCostPerGram: makeAutoSpendSettings(autoOverride)
    };
    const { buyingReductionSettings: _ignored, ...rest } = overrides;
    return {
        id: 'taper-coke-spend',
        substanceId: COKE_ID,
        name: 'Coke taper spend',
        status: 'active',
        reductionType: 'manual-weekly',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        purchaseTaperEnabled: true,
        buyingReductionSettings: settings,
        _buyingReductionMigrated: true,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-04', weeklyMax: 6, targetAmount: 6 },
            { week: 2, weekStart: '2026-07-05', weekEnd: '2026-07-11', weeklyMax: 5, targetAmount: 5 },
            { week: 3, weekStart: '2026-07-12', weekEnd: '2026-07-18', weeklyMax: 4, targetAmount: 4 },
            { week: 4, weekStart: '2026-07-19', weekEnd: '2026-07-25', weeklyMax: 3, targetAmount: 3 },
            { week: 5, weekStart: '2026-07-26', weekEnd: '2026-07-31', weeklyMax: 2, targetAmount: 2 }
        ],
        ...rest
    };
}

function setup({ planOverrides = {}, purchases = [] } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate('2026-07-28');
    const plan = makePlan(rt, planOverrides);
    const data = {
        substances: [makeCokeSubstance()],
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [plan],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    };
    rt.__setTestAppData(data);
    return rt;
}

test('$43/g weekly spending calculations', () => {
    const rt = setup();
    const plan = rt.__getTestAppData().taperPlansV2[0];
    rt.applyPurchaseTargetsToWeeklyRows(plan);
    const expected = [258, 215, 172, 129, 86];
    plan.weeklyTargets.forEach((row, i) => {
        assert.equal(row.purchaseSpendTarget, expected[i]);
    });
});

test('weighted average cost uses total cost ÷ total grams', () => {
    const purchases = [
        makePurchase({ id: 'a', date: '2026-07-05', quantityBought: 7, totalCost: 280 }),
        makePurchase({ id: 'b', date: '2026-07-12', quantityBought: 3, totalCost: 150 })
    ];
    // (280+150)/(7+3) = 43
    const rt = setup({
        purchases,
        planOverrides: {
            buyingReductionSettings: {
                autoSpendFromCostPerGram: {
                    enabled: true,
                    source: 'auto',
                    manualCostPerGram: null,
                    baselineRange: 'last-30',
                    customStart: null,
                    customEnd: null
                }
            }
        }
    });
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const avg = rt.computeWeightedAverageCostPerGram(COKE_ID, {
        startDate: '2026-06-29',
        endDate: '2026-07-28'
    }, rt.__getTestAppData());
    assert.equal(avg, 43);
    assert.equal(rt.resolvePlanCostPerGram(plan, rt.__getTestAppData()), 43);
    // Individual $/g averages would be 40 and 50 → mean 45; must NOT use that.
    assert.notEqual(avg, 45);
});

test('manual override uses configured cost per gram', () => {
    const rt = setup({
        purchases: [makePurchase({ quantityBought: 10, totalCost: 100 })]
    });
    const plan = rt.__getTestAppData().taperPlansV2[0];
    assert.equal(rt.resolvePlanCostPerGram(plan, rt.__getTestAppData()), 43);
    rt.applyAutoSpendGoalsFromCostPerGram(plan, rt.__getTestAppData());
    assert.equal(plan.weeklyTargets[0].purchaseSpendTarget, 258);
});

test('weekly target edit recalculates spend goals', () => {
    const rt = setup();
    const plan = rt.__getTestAppData().taperPlansV2[0];
    rt.applyAutoSpendGoalsFromCostPerGram(plan, rt.__getTestAppData());
    assert.equal(plan.weeklyTargets[4].purchaseSpendTarget, 86);
    plan.weeklyTargets[4].weeklyMax = 1;
    plan.weeklyTargets[4].targetAmount = 1;
    rt.applyAutoSpendGoalsFromCostPerGram(plan, rt.__getTestAppData());
    assert.equal(plan.weeklyTargets[4].purchaseSpendTarget, 43);
});

test('running planned spending accumulates week by week', () => {
    const rt = setup();
    const plan = rt.__getTestAppData().taperPlansV2[0];
    rt.syncPurchaseTaperForPlan(plan, rt.__getTestAppData());
    const data = rt.buildTaperByWeekData(COKE_ID, plan);
    assert.equal(data.rows[0].spendPlanned, 258);
    assert.equal(data.rows[0].runningPlannedSpend, 258);
    assert.equal(data.rows[1].runningPlannedSpend, 258 + 215);
    assert.equal(data.rows[4].runningPlannedSpend, 860);
});

test('actual vs planned spending status thresholds', () => {
    const rt = setup();
    assert.equal(rt.getTaperSpendLimitStatus(80, 100).status, 'under'); // on track
    assert.equal(rt.getTaperSpendLimitStatus(95, 100).status, 'close'); // near limit (within 10%)
    assert.equal(rt.getTaperSpendLimitStatus(100, 100).status, 'close');
    assert.equal(rt.getTaperSpendLimitStatus(101, 100).status, 'over'); // above plan

    const plan = rt.__getTestAppData().taperPlansV2[0];
    const purchases = [
        makePurchase({ id: 'w1', date: '2026-07-02', quantityBought: 6, totalCost: 200 })
    ];
    rt.__getTestAppData().purchases = purchases;
    rt.syncPurchaseTaperForPlan(plan, rt.__getTestAppData());
    assert.equal(plan.weeklyTargets[0].purchaseSpendTarget, 258);
    assert.equal(plan.weeklyTargets[0].actualPurchaseSpend, 200);
    assert.equal(plan.weeklyTargets[0].spendAmountStatus, 'under');
});

test('total planned spending equals $860', () => {
    const rt = setup();
    const plan = rt.__getTestAppData().taperPlansV2[0];
    rt.applyAutoSpendGoalsFromCostPerGram(plan, rt.__getTestAppData());
    assert.equal(plan.totalPlannedSpendFromCostPerGram, 860);
    const sum = plan.weeklyTargets.reduce((s, r) => s + r.purchaseSpendTarget, 0);
    assert.equal(sum, 860);
});

test('auto spend settings persist after reload', () => {
    const rt = setup();
    const plan = rt.__getTestAppData().taperPlansV2[0];
    rt.syncPurchaseTaperForPlan(plan, rt.__getTestAppData());
    rt.saveData(rt.__getTestAppData());

    const loaded = rt.__reloadTestAppDataFromStorage();
    const reloaded = loaded.taperPlansV2[0];
    assert.equal(reloaded.buyingReductionSettings.autoSpendFromCostPerGram.enabled, true);
    assert.equal(reloaded.buyingReductionSettings.autoSpendFromCostPerGram.source, 'manual');
    assert.equal(reloaded.buyingReductionSettings.autoSpendFromCostPerGram.manualCostPerGram, 43);
    rt.syncPurchaseTaperForPlan(reloaded, loaded);
    assert.equal(reloaded.weeklyTargets[0].purchaseSpendTarget, 258);
    assert.equal(reloaded.weeklyTargets[4].purchaseSpendTarget, 86);
});

test('excludes archived hidden zero-cost and gift-received purchases from average', () => {
    const purchases = [
        makePurchase({ id: 'ok', date: '2026-07-05', quantityBought: 10, totalCost: 430 }),
        makePurchase({ id: 'arch', date: '2026-07-06', quantityBought: 10, totalCost: 10, archivedAt: '2026-07-06T00:00:00.000Z' }),
        makePurchase({ id: 'hid', date: '2026-07-07', quantityBought: 10, totalCost: 10, inventoryHidden: true }),
        makePurchase({ id: 'zero', date: '2026-07-08', quantityBought: 10, totalCost: 0 }),
        makePurchase({ id: 'gift', date: '2026-07-09', quantityBought: 10, totalCost: 50, isGiftReceived: true })
    ];
    const rt = setup({ purchases });
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchases[0], COKE_ID, rt.__getTestAppData()), true);
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchases[1], COKE_ID, rt.__getTestAppData()), false);
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchases[2], COKE_ID, rt.__getTestAppData()), false);
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchases[3], COKE_ID, rt.__getTestAppData()), false);
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchases[4], COKE_ID, rt.__getTestAppData()), false);
    const avg = rt.computeWeightedAverageCostPerGram(COKE_ID, {
        startDate: '2026-06-01',
        endDate: '2026-07-28'
    }, rt.__getTestAppData());
    assert.equal(avg, 43);
});
