import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

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
        nicotineMgPerMl: 50,
        totalCost: 22,
        flavor: 'Mint',
        ...overrides
    };
}

function makeCombinedPlan(overrides = {}) {
    return {
        id: 'taper-vape-behavior-1',
        substanceId: NICOTINE_ID,
        name: 'Combined vape taper',
        status: 'active',
        isPrimary: true,
        reductionType: 'nicotine-vape-purchase',
        nicotineVapeStrategy: 'combined',
        nicotineVapeGoals: ['combined', 'reduce-vapes-purchased', 'extend-vape-lifespan', 'increase-buy-interval', 'reduce-personal-puffs', 'reduce-nicotine-strength', 'reduce-spending', 'nicotine-free-blocks'],
        nicotineVapeTaperSpeed: 'moderate',
        nicotineVapeBaselineWindow: 60,
        startDate: '2026-07-01',
        endDate: '2026-08-26',
        currentVapesPerMonth: 4,
        goalVapesPerMonth: 3,
        currentDaysBetweenPurchases: 6,
        goalDaysBetweenPurchases: 12,
        currentLifespanDays: 6,
        goalLifespanDays: 12,
        currentPuffsPerDay: 1000,
        goalPuffsPerDay: 600,
        currentNicotineMgPerMl: 50,
        goalNicotineMgPerMl: 20,
        nicotineStrengthSteps: [50, 35, 20, 10, 5, 0],
        currentMonthlySpend: 88,
        goalMonthlySpend: 66,
        monthlyMax: 3,
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

test('1. purchase-based taper sets buy spacing and monthly caps', () => {
    const plan = makeCombinedPlan({
        nicotineVapeGoals: ['reduce-vapes-purchased', 'increase-buy-interval']
    });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID);
    assert.ok(plan.weeklyTargets.length > 0);
    assert.ok(plan.weeklyTargets.some(w => w.targetMonthlyVapeCap > 0));
    assert.ok(plan.weeklyTargets.some(w => w.targetBuyFrequencyDays > 0));
    assert.ok(plan.weeklyTargets.every(w => w.dailyTarget == null || w.dailyTarget === 0 || !w.puffTarget));
});

test('2. puff-based taper sets personal puff targets', () => {
    const plan = makeCombinedPlan({
        nicotineVapeGoals: ['reduce-personal-puffs'],
        nicotineVapeTaperSpeed: 'custom'
    });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID);
    assert.ok(plan.weeklyTargets[0].dailyTarget > 0);
    assert.ok(plan.weeklyTargets[0].weeklyMax > 0);
    assert.equal(plan.weeklyTargets[0].targetMonthlyVapeCap, null);
});

test('3. combined plan applies purchase, lifespan, puff, and strength goals', () => {
    const plan = makeCombinedPlan();
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID);
    const week1 = plan.weeklyTargets[0];
    const week8 = plan.weeklyTargets.find(w => w.week === 8) || plan.weeklyTargets[plan.weeklyTargets.length - 1];
    assert.ok(week1.targetMonthlyVapeCap > 0);
    assert.ok(week1.targetLifespanDays >= 7);
    assert.ok(week1.dailyTarget > 0);
    assert.ok(week1.targetNicotineMgPerMl != null);
    assert.ok(week8.targetLifespanDays >= week1.targetLifespanDays);
    assert.ok(week8.dailyTarget <= week1.dailyTarget);
});

test('4. personal versus shared puffs — only personal use counts toward taper', () => {
    const plan = makeCombinedPlan({
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            weeklyMax: 500,
            puffTarget: 500,
            dailyTarget: 71,
            targetMonthlyVapeCap: 4
        }]
    });
    const logs = [
        {
            id: 'log-personal',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-02',
            time: '10:00',
            amount: 100,
            unit: 'puffs',
            transactionType: 'use'
        },
        {
            id: 'log-shared',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-03',
            time: '11:00',
            amount: 80,
            unit: 'puffs',
            transactionType: 'shared_use',
            personalAmount: 30,
            sharedAmount: 50,
            sharedWithName: 'Alex'
        }
    ];
    const data = makeNicotineData({
        purchases: [makeVapePurchase()],
        logs,
        taperPlansV2: [plan]
    });
    const rt = setup(data);
    rt.syncNicotineVapePurchasePlanData(plan, data);
    assert.ok(plan.weeklyTargets[0].personalPuffs >= 100);
    assert.equal(plan.weeklyTargets[0].personalPuffs, 100, 'shared_use personal portion excluded from taper');
    assert.equal(plan.weeklyTargets[0].sharedPuffs, undefined, 'sharedPuffs column removed');
});

test('5. Gift Given excluded from personal puff totals', () => {
    const plan = makeCombinedPlan({
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            weeklyMax: 500,
            puffTarget: 500
        }]
    });
    const logs = [
        {
            id: 'log-gift',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-02',
            time: '12:00',
            amount: 200,
            unit: 'puffs',
            transactionType: 'gift_given'
        },
        {
            id: 'log-me',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-02',
            time: '13:00',
            amount: 40,
            unit: 'puffs',
            transactionType: 'personal_use'
        }
    ];
    const data = makeNicotineData({
        purchases: [makeVapePurchase({ remainingAmount: 19760 })],
        logs,
        taperPlansV2: [plan]
    });
    const rt = setup(data);
    rt.syncNicotineVapePurchasePlanData(plan, data);
    assert.equal(plan.weeklyTargets[0].giftedPuffs, 200);
    assert.ok(plan.weeklyTargets[0].personalPuffs < 200);
    assert.ok(plan.weeklyTargets[0].personalPuffs >= 40);
});

test('6. monthly vape cap resets by calendar month', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-06-28' }),
        makeVapePurchase({ id: 'p2', date: '2026-06-29' }),
        makeVapePurchase({ id: 'p3', date: '2026-07-02' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-06'), 2);
    assert.equal(rt.countVapePurchasesInMonth(NICOTINE_ID, '2026-07'), 1);
});

test('7. days-between-purchases calculation from baseline', () => {
    const purchases = [
        makeVapePurchase({ id: 'p1', date: '2026-06-01' }),
        makeVapePurchase({ id: 'p2', date: '2026-06-08' }),
        makeVapePurchase({ id: 'p3', date: '2026-06-15' })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const baseline = rt.computeNicotineVapeBaseline(NICOTINE_ID, {
        windowDays: 30,
        asOfDate: '2026-06-30'
    });
    assert.equal(baseline.avgDaysBetweenPurchases, 7);
});

test('8. vape lifespan from depleted purchases', () => {
    const purchases = [
        makeVapePurchase({
            id: 'p1',
            date: '2026-06-01',
            isDepleted: true,
            remainingAmount: 0,
            remainingPuffs: 0,
            depletedAt: localIso(2026, 6, 8, 12, 0)
        })
    ];
    const rt = setup(makeNicotineData({ purchases }));
    const baseline = rt.computeNicotineVapeBaseline(NICOTINE_ID, {
        windowDays: 30,
        asOfDate: '2026-06-30'
    });
    assert.equal(baseline.avgLifespanDays, 7);
});

test('9. nicotine-strength steps appear on weekly rows without auto-confirm', () => {
    const plan = makeCombinedPlan({
        nicotineVapeGoals: ['reduce-nicotine-strength'],
        nicotineStrengthSteps: [50, 35, 20, 10, 5, 0]
    });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID);
    assert.ok(plan.weeklyTargets.some(w => w.targetNicotineMgPerMl === 50 || w.targetNicotineMgPerMl === 35));
    assert.ok(plan.weeklyTargets.every(w => w.strengthConfirmed === false));
});

test('10. spending target marks week over budget', () => {
    const plan = makeCombinedPlan({
        weeklySpendCap: 25,
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-01',
            weekEnd: '2026-07-07',
            weeklySpendCap: 25,
            targetMonthlySpend: 80,
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
    assert.ok(['over', 'partial'].includes(plan.weeklyTargets[0].status));
    assert.equal(plan.weeklyTargets[0].metricStatuses?.spending, 'over');
    assert.match(plan.weeklyTargets[0].statusExplanation || '', /spend/i);
});

test('11. adaptive remaining weeks never rewrite completed weeks', () => {
    const plan = makeCombinedPlan({
        startDate: '2026-07-01',
        endDate: '2026-09-01'
    });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID);
    // Anchor weeks around local today (2026-07-28)
    plan.weeklyTargets[0].weekStart = '2026-07-15';
    plan.weeklyTargets[0].weekEnd = '2026-07-21';
    plan.weeklyTargets[1].weekStart = '2026-07-22';
    plan.weeklyTargets[1].weekEnd = '2026-07-28';
    plan.weeklyTargets[2].weekStart = '2026-07-29';
    plan.weeklyTargets[2].weekEnd = '2026-08-04';
    const historicalDaily = plan.weeklyTargets[0].dailyTarget;
    const historicalLife = plan.weeklyTargets[0].targetLifespanDays;

    plan._adaptiveBias = 'tighten';
    const adaptive = rt.buildAdaptiveRemainingWeekTargets(plan, NICOTINE_ID);
    assert.ok(adaptive.length > 0);
    rt.applyAdaptiveRemainingWeekTargets(plan, NICOTINE_ID);
    assert.equal(plan.weeklyTargets[0].dailyTarget, historicalDaily);
    assert.equal(plan.weeklyTargets[0].targetLifespanDays, historicalLife);
    assert.ok(plan.weeklyTargets[1].adaptive === true || plan.weeklyTargets[2].adaptive === true);
});

test('12. persistence after reload keeps combined vape taper plan', () => {
    const plan = makeCombinedPlan({ weeklyTargets: [] });
    const data = makeNicotineData({ taperPlansV2: [plan] });
    const rt = setup(data);
    plan.weeklyTargets = rt.generateNicotineVapePurchaseWeeklyTargets(plan, NICOTINE_ID, data);
    plan.nicotineVapeGoals = rt.normalizeNicotineVapeGoals(plan);
    rt.migrateTaperPlan(plan, NICOTINE_ID, data);
    rt.saveData(data);

    const reloaded = rt.__reloadTestAppDataFromStorage();
    const stored = reloaded.taperPlansV2.find(p => p.id === plan.id);
    assert.ok(stored);
    assert.equal(stored.reductionType, 'nicotine-vape-purchase');
    assert.ok(rt.planHasNicotineVapeGoal(stored, 'reduce-personal-puffs'));
    assert.equal(stored.goalPuffsPerDay, plan.goalPuffsPerDay);
    assert.ok(Array.isArray(stored.weeklyTargets) && stored.weeklyTargets.length > 0);
});

test('13. no unrelated substance columns in nicotine catalog', () => {
    const plan = makeCombinedPlan();
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    const catalog = rt.getTaperByWeekColumnCatalog(NICOTINE_ID, plan);
    assert.ok(!catalog.includes('buyPlanned'));
    assert.ok(!catalog.includes('buyDiff'));
    assert.ok(!catalog.includes('weeklyBuyCapStatus'));
    assert.ok(!catalog.includes('monthlyBuyCapStatus'));
    assert.ok(!catalog.includes('targets'));
    // coke-style cost-per-gram / grams columns are not present as such
    assert.ok(!catalog.includes('costPerGram'));
    assert.ok(!catalog.includes('grams'));
});

test('14. local-date week detection uses inclusive local ranges', () => {
    const plan = makeCombinedPlan({
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-26', weekEnd: '2026-08-01', weeklyMax: 100 },
            { week: 2, weekStart: '2026-08-02', weekEnd: '2026-08-08', weeklyMax: 90 }
        ]
    });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    const week = rt.getWeekRowForDate(plan, '2026-08-01');
    assert.equal(week.week, 1);
    const next = rt.getWeekRowForDate(plan, '2026-08-02');
    assert.equal(next.week, 2);
});
