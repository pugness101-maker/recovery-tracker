import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const STORAGE_KEY = 'recovery-tracker-v2';
const COKE_ID = 'coke';

function legacyV2Payload(taperPlansV2 = []) {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        taperPlans: {},
        taperPlansV2,
        settings: { currency: '$', substanceSettings: {} },
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function legacyTaperWithBuyingReduction(overrides = {}) {
    return {
        id: 'legacy-taper-1',
        name: 'Legacy buying taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
        reductionType: 'reduce-amount',
        startingDailyAverage: 2,
        goalDailyAverage: 0.5,
        reductionAmount: 0.2,
        purchaseTaperEnabled: true,
        purchaseReductionMode: 'weekly_buy_amount',
        purchaseStartingWeeklyAmount: 7,
        purchaseGoalWeeklyAmount: 3,
        purchaseReductionAmountPerWeek: 0.5,
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-28',
            weekEnd: '2026-08-03',
            targetAmount: 7
        }],
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        ...overrides
    };
}

test('loadData startup path normalizes buying reduction without TDZ ReferenceError', () => {
    const taper = legacyTaperWithBuyingReduction();
    const payload = legacyV2Payload([taper]);
    const beforeCount = payload.taperPlansV2.length;

    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(payload) }
    });

    const data = rt.__getTestAppData();
    const afterCount = data.taperPlansV2.length;
    assert.equal(beforeCount, 1);
    assert.equal(afterCount, 1, 'normalization must not create duplicate taper records');
    assert.equal(data.taperPlansV2[0].id, 'legacy-taper-1');
    assert.ok(rt.BUYING_REDUCTION_RULE_KEYS.length >= 8);
    assert.ok(data.taperPlansV2[0].buyingReductionSettings);
    assert.equal(data.taperPlansV2[0]._buyingReductionMigrated, true);
});

test('normalizeAppDataSafe + repairDataConsistency preserve taper ids and count', () => {
    const rt = loadRecoveryTrackerApp();
    const taperA = legacyTaperWithBuyingReduction({ id: 'taper-a', name: 'A' });
    const taperB = legacyTaperWithBuyingReduction({
        id: 'taper-b',
        name: 'B',
        isPrimary: false,
        startDate: '2026-09-01',
        endDate: '2026-10-31',
        goalDailyAverage: 1,
        purchaseReductionMode: 'weekly_spend',
        purchaseStartingWeeklySpend: 200,
        purchaseWeeklySpendTarget: 150
    });
    const data = legacyV2Payload([taperA, taperB]);
    const beforeIds = new Set(data.taperPlansV2.map(p => p.id));
    const beforeCount = data.taperPlansV2.length;

    rt.normalizeAppDataSafe(data);
    rt.repairDataConsistency(data);

    const afterCount = data.taperPlansV2.length;
    const afterIds = new Set(data.taperPlansV2.map(p => p.id));
    assert.equal(afterCount, beforeCount);
    assert.deepEqual(afterIds, beforeIds);

    const createdIds = [...afterIds].filter(id => !beforeIds.has(id));
    assert.equal(createdIds.length, 0, 'migration must not create new taper records');
});

test('legacy v1 taperPlans migrate to v2 without buying reduction TDZ crash', () => {
    const payload = legacyV2Payload([]);
    payload.taperPlans = {
        [COKE_ID]: {
            id: 'v1-plan',
            name: 'V1 taper',
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            reductionType: 'reduce-amount',
            goalDailyAverage: 0.5,
            purchaseTaperEnabled: true,
            purchaseReductionMode: 'reduce_buy_amount',
            purchaseStartingWeeklyAmount: 5,
            weeklyTargets: []
        }
    };
    payload.migrations = {};

    const rt = loadRecoveryTrackerApp({
        localStorage: { [STORAGE_KEY]: JSON.stringify(payload) }
    });
    const data = rt.__getTestAppData();
    assert.ok(Array.isArray(data.taperPlansV2));
    assert.ok(data.taperPlansV2.length >= 1);
    const plan = data.taperPlansV2.find(p => p.substanceId === COKE_ID);
    assert.ok(plan);
    assert.ok(plan.buyingReductionSettings || plan.purchaseTaperEnabled === false);
});
