import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeSubstance() {
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

function makeData({ purchases = [], taperPlansV2 = [] } = {}) {
    return {
        substances: [makeSubstance()],
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
        date: '2026-07-02',
        time: '12:00',
        quantity: 7,
        quantityBought: 7,
        unit: 'g',
        totalCost: 300,
        ...overrides
    };
}

function makeWeeklyTargets(weekCount = 4) {
    return Array.from({ length: weekCount }, (_, index) => {
        const week = index + 1;
        const weekStart = `2026-07-${String(1 + index * 7).padStart(2, '0')}`;
        const weekEnd = `2026-07-${String(7 + index * 7).padStart(2, '0')}`;
        return {
            week,
            weekStart,
            weekEnd,
            weeklyMax: 7 - index,
            dailyTarget: 1
        };
    });
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
        weeklyTargets: makeWeeklyTargets(),
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

function combinedSettings(overrides = {}) {
    return {
        reducePurchaseAmount: {
            enabled: false,
            startingAmount: null,
            goalAmount: null,
            reductionPerWeek: null,
            reductionPercentPerWeek: null
        },
        reducePurchaseCost: {
            enabled: false,
            startingSpend: null,
            goalSpend: null,
            reductionPerWeek: null,
            reductionPercentPerWeek: null
        },
        weeklyPurchaseLimit: { enabled: false, amount: null },
        weeklySpendingLimit: { enabled: false, amount: null },
        monthlyPurchaseCap: { enabled: false, amount: null },
        monthlySpendingCap: { enabled: false, amount: null },
        manualWeeklyBuyPlan: { enabled: false, values: [] },
        manualWeeklySpendingPlan: { enabled: false, values: [] },
        ...overrides
    };
}

test('purchase amount and spending reduction together', () => {
    const plan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        buyingReductionSettings: combinedSettings({
            reducePurchaseAmount: {
                enabled: true,
                startingAmount: 7,
                goalAmount: 2,
                reductionPerWeek: 1,
                reductionPercentPerWeek: null
            },
            reducePurchaseCost: {
                enabled: true,
                startingSpend: 300,
                goalSpend: 100,
                reductionPerWeek: 40,
                reductionPercentPerWeek: null
            }
        }),
        _buyingReductionMigrated: true
    });
    const rt = setup(makeData({ taperPlansV2: [plan] }));
    rt.migrateTaperPlan(plan, COKE_ID);
    assert.equal(plan.weeklyTargets[0].purchaseAmountTarget, 7);
    assert.equal(plan.weeklyTargets[0].purchaseSpendTarget, 300);
    assert.equal(plan.weeklyTargets[1].purchaseAmountTarget, 6);
    assert.equal(plan.weeklyTargets[1].purchaseSpendTarget, 260);
});

test('weekly amount limit and monthly spending cap', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 3, totalCost: 120 }),
        makeCokePurchase({ id: 'p2', date: '2026-07-10', quantityBought: 2, totalCost: 90 })
    ];
    const plan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        buyingReductionSettings: combinedSettings({
            weeklyPurchaseLimit: { enabled: true, amount: 5 },
            monthlySpendingCap: { enabled: true, amount: 800 }
        }),
        _buyingReductionMigrated: true
    });
    const rt = setup(makeData({ purchases, taperPlansV2: [plan] }));
    rt.syncPurchaseTaperForPlan(plan);
    assert.equal(plan.weeklyTargets[0].weeklyPurchaseLimitTarget, 5);
    assert.equal(plan.weeklyTargets[0].weeklyBuyCapStatus, 'under');
    assert.equal(plan.weeklyTargets[0].monthlySpendCapStatus, 'under');
});

test('manual buy plan overrides generated spending reduction only', () => {
    const plan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        buyingReductionSettings: combinedSettings({
            reducePurchaseCost: {
                enabled: true,
                startingSpend: 300,
                goalSpend: 100,
                reductionPerWeek: 40,
                reductionPercentPerWeek: null
            },
            manualWeeklyBuyPlan: {
                enabled: true,
                values: [
                    { weekNumber: 1, startDate: '2026-07-01', endDate: '2026-07-07', amount: 4, unit: 'g' },
                    { weekNumber: 2, startDate: '2026-07-08', endDate: '2026-07-14', amount: 3, unit: 'g' }
                ]
            }
        }),
        _buyingReductionMigrated: true
    });
    const rt = setup(makeData({ taperPlansV2: [plan] }));
    rt.applyPurchaseTargetsToWeeklyRows(plan);
    assert.equal(plan.weeklyTargets[0].purchaseAmountTarget, 4);
    assert.equal(plan.weeklyTargets[0].purchaseSpendTarget, 300);
    assert.equal(plan.weeklyTargets[1].purchaseAmountTarget, 3);
    assert.equal(plan.weeklyTargets[1].purchaseSpendTarget, 260);
});

test('conflicting rules are detected', () => {
    const rt = setup(makeData());
    const warnings = rt.detectBuyingReductionConflicts(combinedSettings({
        reducePurchaseAmount: {
            enabled: true,
            startingAmount: 10,
            goalAmount: 2,
            reductionPerWeek: 1,
            reductionPercentPerWeek: null
        },
        weeklyPurchaseLimit: { enabled: true, amount: 5 }
    }));
    assert.ok(warnings.some(w => w.includes('Starting purchase amount exceeds the weekly purchase limit')));
});

test('migration from legacy single-dropdown format', () => {
    const legacyPlan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        purchaseReductionMode: 'weekly_buy_amount',
        purchaseStartingWeeklyAmount: 7,
        purchaseReductionAmountPerWeek: 1,
        purchaseReductionPercentPerWeek: null
    });
    delete legacyPlan.buyingReductionSettings;
    delete legacyPlan._buyingReductionMigrated;
    const rt = setup(makeData({ taperPlansV2: [legacyPlan] }));
    rt.migrateTaperPlan(legacyPlan, COKE_ID);
    const settings = rt.getBuyingReductionSettings(legacyPlan);
    assert.equal(settings.reducePurchaseAmount.enabled, true);
    assert.equal(settings.reducePurchaseAmount.startingAmount, 7);
    assert.equal(settings.reducePurchaseAmount.reductionPerWeek, 1);
    assert.equal(legacyPlan.purchaseReductionMode, 'weekly_buy_amount');
});

test('independent status calculations with combined overall status', () => {
    const purchases = [
        makeCokePurchase({ id: 'p1', date: '2026-07-02', quantityBought: 3, totalCost: 250 })
    ];
    const plan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        buyingReductionSettings: combinedSettings({
            reducePurchaseAmount: {
                enabled: true,
                startingAmount: 7,
                goalAmount: 2,
                reductionPerWeek: 1,
                reductionPercentPerWeek: null
            },
            reducePurchaseCost: {
                enabled: true,
                startingSpend: 200,
                goalSpend: 100,
                reductionPerWeek: 20,
                reductionPercentPerWeek: null
            }
        }),
        _buyingReductionMigrated: true
    });
    const rt = setup(makeData({ purchases, taperPlansV2: [plan] }));
    rt.syncPurchaseTaperForPlan(plan);
    const row = plan.weeklyTargets[0];
    assert.equal(row.buyAmountStatus, 'under');
    assert.equal(row.spendAmountStatus, 'over');
    assert.equal(row.purchaseOverallStatus, 'close');
    assert.equal(row.purchaseOverallStatusLabel, 'Partially off track');
});

test('persistence after reload', () => {
    const plan = makeCokeTaperPlan({
        purchaseTaperEnabled: true,
        buyingReductionSettings: combinedSettings({
            weeklyPurchaseLimit: { enabled: true, amount: 5 },
            monthlySpendingCap: { enabled: true, amount: 800 }
        }),
        _buyingReductionMigrated: true
    });
    const rt = setup(makeData({ taperPlansV2: [plan] }));
    rt.saveData(rt.__getTestAppData());
    const snapshot = rt.__getStorageSnapshot();
    assert.ok(snapshot.includes('buyingReductionSettings'));
    rt.__setTestAppData(rt.getDefaultAppData());
    rt.__reloadTestAppDataFromStorage();
    const reloaded = rt.__getTestAppData().taperPlansV2[0];
    rt.migrateTaperPlan(reloaded, COKE_ID);
    const settings = rt.getBuyingReductionSettings(reloaded);
    assert.equal(settings.weeklyPurchaseLimit.enabled, true);
    assert.equal(settings.weeklyPurchaseLimit.amount, 5);
    assert.equal(settings.monthlySpendingCap.enabled, true);
    assert.equal(settings.monthlySpendingCap.amount, 800);
});
