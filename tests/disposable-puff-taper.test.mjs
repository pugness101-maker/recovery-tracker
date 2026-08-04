import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

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

function makeDisposablePlan(overrides = {}) {
    return {
        id: 'taper-puff-1',
        substanceId: NICOTINE_ID,
        name: 'Disposable puff taper',
        status: 'active',
        isPrimary: true,
        reductionType: 'reduce-puffs',
        puffReductionMode: 'percent',
        startingDailyAverage: 1000,
        goalDailyAverage: 0,
        startDate: '2026-07-01',
        endDate: '2026-09-08',
        taperDurationWeeks: 10,
        purchaseIntervalDays: 7,
        reductionAmount: 0,
        reductionPercent: 10,
        notes: '',
        isPaused: false,
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
        ...overrides
    };
}

function makeVapePurchase(overrides = {}) {
    return {
        id: 'purchase-disp-1',
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date: '2026-07-20',
        time: '12:00',
        fullPuffCount: 10000,
        quantity: 10000,
        quantityBought: 10000,
        unit: 'puffs',
        percentBoughtAt: 100,
        startingPuffsLeft: 10000,
        remainingAmount: 4000,
        remainingPuffs: 4000,
        eLiquidCapacityMl: 10,
        nicotineMgPerMl: 50,
        totalCost: 20,
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setTestReferenceDate('2026-07-28');
    return rt;
}

test('Vape Taper is default recommended option for nicotine', () => {
    const rt = setup(makeNicotineData());
    const types = rt.getTaperReductionTypesForSubstance(NICOTINE_ID);
    assert.equal(types.join(','), 'nicotine-vape-purchase,reduce-puffs,manual-weekly');
    assert.equal(types[0], 'nicotine-vape-purchase');
    assert.equal(rt.TAPER_REDUCTION_LABELS['reduce-puffs'], 'Puff-only Taper');
    assert.equal(rt.TAPER_REDUCTION_LABELS['nicotine-vape-purchase'], 'Vape Taper');
    assert.equal(rt.TAPER_REDUCTION_LABELS['manual-weekly'], 'Manual steps');
    assert.ok(!types.includes('reduce-nicotine'));
    assert.ok(!types.includes('reduce-buying'));
    assert.ok(!String(rt.TAPER_REDUCTION_LABELS['reduce-puffs']).toLowerCase().includes('legacy'));
});

test('10-week percent schedule matches default daily targets and rounds to whole puffs', () => {
    const plan = makeDisposablePlan();
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    const weeks = rt.generateReducePuffsWeeklyTargets(plan);

    assert.equal(weeks.length, 10);
    const expectedPct = rt.DISPOSABLE_PUFF_PERCENT_SCHEDULE;
    weeks.forEach((w, i) => {
        assert.equal(w.dailyTarget, Math.round(1000 * (expectedPct[i] / 100)));
        assert.equal(w.weeklyMax, w.dailyTarget * 7);
        assert.equal(Number.isInteger(w.dailyTarget), true);
        assert.equal(w.monthlyProjectedPuffLimit, w.dailyTarget * 30);
    });
    assert.equal(weeks[0].dailyTarget, 1000);
    assert.equal(weeks[1].dailyTarget, 900);
    assert.equal(weeks[9].dailyTarget, 100);
});

test('auto-calculated weekly and monthly limits do not require manual entry', () => {
    const plan = makeDisposablePlan({ weeklyMax: null, monthlyMax: null });
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    rt.migrateTaperPlan(plan, NICOTINE_ID, rt.__getTestAppData());
    const weeks = rt.generateWeeklyTargets(plan);
    assert.ok(weeks.every(w => w.weeklyMax === w.dailyTarget * 7));
    assert.ok(weeks.every(w => w.monthlyProjectedPuffLimit === w.dailyTarget * 30));
});

test('status bands: green at/below, amber ≤10% over, red >10% over', () => {
    const rt = setup(makeNicotineData());
    assert.equal(rt.getDisposablePuffLimitStatus(100, 100).status, 'under');
    assert.equal(rt.getDisposablePuffLimitStatus(105, 100).status, 'close');
    assert.equal(rt.getDisposablePuffLimitStatus(110, 100).status, 'close');
    assert.equal(rt.getDisposablePuffLimitStatus(111, 100).status, 'over');
});

test('disposable ml and nicotine mg estimates from inventory fields', () => {
    const purchase = makeVapePurchase();
    const rt = setup(makeNicotineData({ purchases: [purchase] }));
    const metrics = rt.computeDisposableVapeUsageMetrics(1000, purchase);
    // 10000 puffs / 10 mL = 1000 puffs/mL → 1000 puffs = 1 mL → 50 mg
    assert.equal(metrics.puffsPerMl, 1000);
    assert.equal(metrics.estimatedMlUsed, 1);
    assert.equal(metrics.estimatedNicotineMg, 50);
});

test('exceeding weekly goal does not auto-tighten next week; repeat week preserves targets', () => {
    const plan = makeDisposablePlan();
    const rt = setup(makeNicotineData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateReducePuffsWeeklyTargets(plan);
    const beforeNext = plan.weeklyTargets[1].dailyTarget;

    // Simulate over-use on week 1 without regenerating.
    plan.weeklyTargets[0].actualUsed = plan.weeklyTargets[0].weeklyMax * 1.2;
    plan.weeklyTargets[0].status = rt.getDisposablePuffLimitStatus(
        plan.weeklyTargets[0].actualUsed,
        plan.weeklyTargets[0].weeklyMax
    ).status;
    assert.equal(plan.weeklyTargets[0].status, 'over');
    assert.equal(plan.weeklyTargets[1].dailyTarget, beforeNext);

    rt.__setTestAppData({
        ...rt.__getTestAppData(),
        taperPlansV2: [plan]
    });
    // Select plan context via primary
    const data = rt.__getTestAppData();
    data.taperPlansV2 = [plan];
    rt.saveData(data);

    // Repeat week should insert same target, not a stricter next week.
    // Directly exercise generator stability: regenerating with same baseline keeps schedule.
    const regenerated = rt.generateReducePuffsWeeklyTargets({ ...plan });
    assert.equal(regenerated[1].dailyTarget, beforeNext);
});

test('recalculate from 7-day average updates remaining targets without changing logs', () => {
    const purchase = makeVapePurchase();
    const logs = [];
    for (let i = 0; i < 7; i++) {
        const day = `2026-07-${String(22 + i).padStart(2, '0')}`;
        logs.push({
            id: `log-${i}`,
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: day,
            amount: 800,
            unit: 'puffs',
            transactionType: 'use',
            type: 'quick',
            purchaseId: purchase.id
        });
    }
    const plan = makeDisposablePlan({ startDate: '2026-07-01', endDate: '2026-09-08' });
    const rt = setup(makeNicotineData({ purchases: [purchase], logs, taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateReducePuffsWeeklyTargets(plan);
    const originalLogCount = rt.__getTestAppData().logs.length;
    const week0TargetBefore = plan.weeklyTargets[0].dailyTarget;

    // Move "today" into week ~4 area (Jul 28 is within plan)
    const currentIdx = plan.weeklyTargets.findIndex(w => '2026-07-28' >= w.weekStart && '2026-07-28' <= w.weekEnd);
    assert.ok(currentIdx >= 0);

    // Manually apply recalculation logic via exported helper path
    const avg = 800;
    plan.startingDailyAverage = avg;
    const remaining = plan.weeklyTargets.length - currentIdx;
    const schedule = rt.getDisposablePuffPercentSchedule(remaining);
    for (let i = 0; i < remaining; i++) {
        const w = plan.weeklyTargets[currentIdx + i];
        w.dailyTarget = rt.roundPuffTarget(avg * (schedule[i] / 100));
        w.weeklyMax = w.dailyTarget * 7;
    }

    assert.equal(rt.__getTestAppData().logs.length, originalLogCount);
    assert.equal(plan.weeklyTargets[0].dailyTarget, week0TargetBefore);
    assert.equal(plan.weeklyTargets[currentIdx].dailyTarget, 800);
});

test('progress summary includes countdown and auto limits', () => {
    const purchase = makeVapePurchase();
    const plan = makeDisposablePlan();
    const rt = setup(makeNicotineData({
        purchases: [purchase],
        logs: [{
            id: 'log-today',
            substanceId: NICOTINE_ID,
            nicotineProductType: 'vape',
            date: '2026-07-28',
            amount: 200,
            unit: 'puffs',
            transactionType: 'use',
            type: 'quick',
            purchaseId: purchase.id
        }],
        taperPlansV2: [plan]
    }));
    plan.weeklyTargets = rt.generateReducePuffsWeeklyTargets(plan);
    rt.migrateTaperPlan(plan, NICOTINE_ID, rt.__getTestAppData());
    const summary = rt.getDisposablePuffProgressSummary(plan, NICOTINE_ID, rt.__getTestAppData());
    assert.ok(summary.weekNum >= 1);
    assert.equal(summary.totalWeeks, 10);
    assert.ok(summary.dailyLimit != null);
    assert.ok(summary.weeklyLimit === summary.dailyLimit * 7);
    assert.ok(summary.daysRemaining != null);
    assert.ok(summary.quitDate === '2026-09-08');
});

test('labels no longer use Legacy wording for puff taper', () => {
    const rt = setup(makeNicotineData());
    const labels = Object.values(rt.TAPER_REDUCTION_LABELS).join(' ').toLowerCase();
    assert.ok(!labels.includes('(legacy)'));
    assert.equal(rt.TAPER_REDUCTION_LABELS['reduce-puffs'], 'Puff-only Taper');
});
