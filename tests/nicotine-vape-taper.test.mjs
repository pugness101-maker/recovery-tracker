import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';
const DAY_MS = 86400000;

function localDateTimeMs(y, m, d, h = 12, min = 0) {
    return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function localIso(y, m, d, h = 12, min = 0) {
    return new Date(localDateTimeMs(y, m, d, h, min)).toISOString();
}

function makeNicotineData({ purchases = [], logs = [], taperPlansV2 = [] } = {}) {
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
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            vapeInventoryLinkV2: true,
            taperPlansV2: true
        }
    };
}

function makeVapePurchase(overrides = {}) {
    const id = overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id,
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
        totalCost: 22,
        ...overrides
    };
}

function makeNicotineVapePlan(overrides = {}) {
    return {
        id: 'taper-vape-1',
        substanceId: NICOTINE_ID,
        name: 'Nicotine vape taper',
        status: 'active',
        isPrimary: true,
        reductionType: 'nicotine-vape-purchase',
        nicotineVapeStrategy: 'combined',
        nicotineVapeTaperSpeed: 'moderate',
        nicotineVapeBaselineWindow: 60,
        startDate: '2026-07-01',
        endDate: '2026-08-26',
        currentVapesPerMonth: 5,
        goalVapesPerMonth: 3,
        currentDaysBetweenPurchases: 6,
        goalDaysBetweenPurchases: 12,
        currentLifespanDays: 6,
        goalLifespanDays: 10,
        currentMonthlySpend: 110,
        goalMonthlySpend: 80,
        monthlyMax: 4,
        weeklySpendCap: 30,
        weeklyTargets: [],
        createdAt: localIso(2026, 7, 1),
        updatedAt: localIso(2026, 7, 1),
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

function withMockNow(ms, fn) {
    const realNow = Date.now;
    Date.now = () => ms;
    try {
        return fn();
    } finally {
        Date.now = realNow;
    }
}

test('monthly vape purchase count', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-07-01' }),
        makeVapePurchase({ id: 'p2', date: '2026-07-10' }),
        makeVapePurchase({ id: 'p3', date: '2026-07-20' }),
        makeVapePurchase({ id: 'p4', date: '2026-06-28' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-07'), 3);
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-06'), 1);
});

test('average days between purchases from baseline', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-06-01' }),
        makeVapePurchase({ id: 'p2', date: '2026-06-07' }),
        makeVapePurchase({ id: 'p3', date: '2026-06-13' }),
        makeVapePurchase({ id: 'p4', date: '2026-06-19' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const baseline = rt.computeNicotineVapeBaseline(NICOTINE_ID, {
        windowDays: 30,
        asOfDate: '2026-06-30'
    });
    assert.equal(baseline.vapesPurchased, 4);
    assert.equal(baseline.avgDaysBetweenPurchases, 6);
    assert.ok(baseline.vapesPerMonth >= 3.9 && baseline.vapesPerMonth <= 4.1);
});

test('average vape lifespan from depleted purchases', () => {
    const purchases = [
        makeVapePurchase({
            id: 'p1',
            date: '2026-06-01',
            isDepleted: true,
            remainingAmount: 0,
            remainingPuffs: 0,
            depletedAt: localIso(2026, 6, 7, 12, 0)
        }),
        makeVapePurchase({
            id: 'p2',
            date: '2026-06-10',
            isDepleted: true,
            remainingAmount: 0,
            remainingPuffs: 0,
            depletedAt: localIso(2026, 6, 19, 12, 0)
        })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const baseline = rt.computeNicotineVapeBaseline(NICOTINE_ID, {
        windowDays: 30,
        asOfDate: '2026-06-30'
    });
    assert.equal(baseline.avgLifespanDays, 7.5);
});

test('purchase made earlier than planned', () => {
    const plan = makeNicotineVapePlan({
        goalDaysBetweenPurchases: 7,
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            targetBuyFrequencyDays: 7
        }]
    });
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-07-01' }),
        makeVapePurchase({ id: 'p2', date: '2026-07-05' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const timing = rt.evaluateVapePurchaseTiming(purchases[1], plan);
    assert.equal(timing.status, 'early');
    assert.match(timing.label, /early/);
});

test('purchase made later than planned', () => {
    const plan = makeNicotineVapePlan({
        goalDaysBetweenPurchases: 7,
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-14',
            targetBuyFrequencyDays: 7
        }]
    });
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-07-01' }),
        makeVapePurchase({ id: 'p2', date: '2026-07-11' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const timing = rt.evaluateVapePurchaseTiming(purchases[1], plan);
    assert.equal(timing.status, 'late');
    assert.match(timing.label, /late/);
});

test('multiple active overlapping vapes', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-07-01', remainingAmount: 5000 }),
        makeVapePurchase({ id: 'p2', date: '2026-07-05', remainingAmount: 8000 }),
        makeVapePurchase({
            id: 'p3',
            date: '2026-06-20',
            isDepleted: true,
            remainingAmount: 0,
            remainingPuffs: 0,
            depletedAt: localIso(2026, 6, 25, 12, 0)
        })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const baseline = rt.computeNicotineVapeBaseline(NICOTINE_ID, {
        windowDays: 30,
        asOfDate: '2026-07-10'
    });
    assert.equal(baseline.overlappingActiveVapes, 2);
});

test('monthly cap resets by calendar month', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-06-28' }),
        makeVapePurchase({ id: 'p2', date: '2026-06-29' }),
        makeVapePurchase({ id: 'p3', date: '2026-07-02' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-06'), 2);
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-07'), 1);
});

test('spending cap marks week over budget', () => {
    const plan = makeNicotineVapePlan({
        weeklySpendCap: 25,
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            weeklySpendCap: 25,
            targetBuyFrequencyDays: 7,
            targetMonthlyVapeCap: 4
        }]
    });
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-07-02', totalCost: 15 }),
        makeVapePurchase({ id: 'p2', date: '2026-07-04', totalCost: 14 })
    ];
    const data = makeNicotineData({ purchases, taperPlansV2: [plan] });
    const rt = setup(data);
    rt.syncNicotineVapePurchasePlanData(plan, data);
    assert.equal(plan.weeklyTargets[0].actualSpend, 29);
    assert.equal(plan.weeklyTargets[0].status, 'over');
});

test('no-buy streak tracks days since last purchase', () => {
    const purchases = [makeVapePurchase({ id: 'p1', date: '2026-07-20' })];
    const rt = setup(makeNicotineData({ purchases }));
    withMockNow(localDateTimeMs(2026, 7, 29, 12, 0), () => {
        assert.equal(rt.getCurrentNoBuyStreakDays(NICOTINE_ID), 9);
    });
});

test('depleted vape lifespan recorded in weekly sync', () => {
    const plan = makeNicotineVapePlan({
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            targetLifespanDays: 5,
            targetBuyFrequencyDays: 7,
            targetMonthlyVapeCap: 4
        }]
    });
    const purchases = [
        makeVapePurchase({
            id: 'p1',
            date: '2026-07-01',
            isDepleted: true,
            remainingAmount: 0,
            remainingPuffs: 0,
            depletedAt: localIso(2026, 7, 6, 12, 0)
        })
    ];
    const data = makeNicotineData({ purchases, taperPlansV2: [plan] });
    const rt = setup(data);
    rt.syncNicotineVapePurchasePlanData(plan, data);
    assert.equal(plan.weeklyTargets[0].completedVapeLifespans?.length, 1);
    assert.equal(plan.weeklyTargets[0].completedVapeLifespans[0], 5);
});

test('suggested gentle moderate faster plans differ in goal intensity', () => {
    const rt = setup(makeNicotineData());
    const base = {
        substanceId: NICOTINE_ID,
        startDate: '2026-07-01',
        endDate: '2026-08-26',
        currentVapesPerMonth: 5,
        currentDaysBetweenPurchases: 6,
        currentLifespanDays: 6,
        currentMonthlySpend: 110,
        nicotineVapeBaseline: {
            vapesPerMonth: 5,
            avgDaysBetweenPurchases: 6,
            avgLifespanDays: 6,
            monthlySpending: 110
        }
    };
    const gentle = { ...base, nicotineVapeTaperSpeed: 'gentle' };
    const moderate = { ...base, nicotineVapeTaperSpeed: 'moderate' };
    const faster = { ...base, nicotineVapeTaperSpeed: 'faster' };

    rt.generateSuggestedNicotineVapePlanSteps(gentle);
    rt.generateSuggestedNicotineVapePlanSteps(moderate);
    rt.generateSuggestedNicotineVapePlanSteps(faster);

    assert.ok(gentle.goalVapesPerMonth >= moderate.goalVapesPerMonth);
    assert.ok(moderate.goalVapesPerMonth >= faster.goalVapesPerMonth);
    assert.ok(gentle.goalDaysBetweenPurchases <= moderate.goalDaysBetweenPurchases);
    assert.ok(moderate.goalDaysBetweenPurchases <= faster.goalDaysBetweenPurchases);
    assert.ok(gentle.goalMonthlySpend >= moderate.goalMonthlySpend);
    assert.ok(moderate.goalMonthlySpend >= faster.goalMonthlySpend);
});

test('persistence after reload keeps nicotine vape taper plan', () => {
    const plan = makeNicotineVapePlan({ weeklyTargets: [] });
    const data = makeNicotineData({ taperPlansV2: [plan] });
    const rt = setup(data);
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID, data);
    rt.migrateTaperPlan(plan, NICOTINE_ID, data);
    rt.saveData(data);

    const reloaded = rt.__reloadTestAppDataFromStorage();
    const stored = reloaded.taperPlansV2.find(p => p.id === plan.id);
    assert.ok(stored);
    assert.equal(stored.reductionType, 'nicotine-vape-purchase');
    assert.equal(stored.goalVapesPerMonth, plan.goalVapesPerMonth);
    assert.ok(Array.isArray(stored.weeklyTargets) && stored.weeklyTargets.length > 0);
    assert.ok(rt.isNicotineVapePurchasePlan(stored));
});

test('use break is separate from buying break', () => {
    const purchases = [makeVapePurchase({ id: 'p1', date: '2026-07-20' })];
    const logs = [{
        id: 'log-1',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-15',
        time: '10:00',
        amount: 50,
        unit: 'puffs',
        transactionType: 'personal_use'
    }];
    const rt = setup(makeNicotineData({ purchases, logs }));
    withMockNow(localDateTimeMs(2026, 7, 29, 12, 0), () => {
        assert.equal(rt.getCurrentNoBuyStreakDays(NICOTINE_ID), 9);
        assert.ok(rt.getDaysSinceLastNicotineUse(NICOTINE_ID) > 13);
    });
});
