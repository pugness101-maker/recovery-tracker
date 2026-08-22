import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const NICOTINE_ID = 'nicotine';

function makeData(overrides = {}) {
    return {
        substances: [
            {
                id: COKE_ID,
                name: 'Coke',
                trackingMode: 'powder',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                taperTrackingEnabled: true,
                active: true
            },
            {
                id: NICOTINE_ID,
                name: 'Nicotine',
                trackingMode: 'nicotine',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                costTrackingEnabled: true,
                taperTrackingEnabled: true,
                active: true
            }
        ],
        logs: [
            {
                id: 'log-coke-1',
                substanceId: COKE_ID,
                date: '2026-07-28',
                amount: 0.5,
                unit: 'g',
                transactionType: 'use',
                type: 'session',
                startTime: '20:00',
                endTime: '21:00'
            },
            {
                id: 'log-nic-1',
                substanceId: NICOTINE_ID,
                nicotineProductType: 'vape',
                date: '2026-07-28',
                amount: 200,
                unit: 'puffs',
                transactionType: 'use',
                type: 'quick'
            }
        ],
        purchases: [
            {
                id: 'purchase-1',
                substanceId: COKE_ID,
                date: '2026-07-01',
                quantity: 3.5,
                quantityBought: 3.5,
                remainingAmount: -0.2,
                unit: 'g',
                totalCost: 280
            },
            {
                id: 'purchase-missing-link',
                substanceId: COKE_ID,
                date: '2026-07-02',
                quantity: 1,
                quantityBought: 1,
                remainingAmount: 1,
                unit: 'g',
                totalCost: 80
            }
        ],
        cravings: [],
        settings: { currency: '$', substanceSettings: {}, spreadPercentLeftUsage: true },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true },
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setTestReferenceDate('2026-07-28');
    return rt;
}

test('Phase 1: canonical usage matches normalized substance metrics', () => {
    const rt = setup(makeData());
    const metrics = rt.buildNormalizedSubstanceMetrics(COKE_ID);
    const today = rt.getCanonicalUsageOnDate(COKE_ID, '2026-07-28');
    assert.equal(metrics.usage.today, today);
    assert.ok(metrics.usage.today >= 0.5 - 0.001);

    const engine = rt.buildNormalizedCalcEngine({ substanceId: COKE_ID });
    assert.equal(engine.entryCount, 1);
    assert.ok(engine.logs.every(l => l.substanceId === COKE_ID));
    assert.equal(engine.metrics.substanceId, COKE_ID);
});

test('Phase 1: Data Health detects negative remaining and broken links', () => {
    const data = makeData({
        logs: [
            {
                id: 'orphan-link-log',
                substanceId: COKE_ID,
                date: '2026-07-27',
                amount: 0.1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick',
                purchaseId: 'does-not-exist'
            },
            {
                id: 'legacy-log',
                substanceId: COKE_ID,
                date: '2026-07-26',
                amount: 0.1,
                unit: 'g',
                transactionType: 'session',
                type: 'session'
            }
        ]
    });
    const rt = setup(data);
    const live = rt.__getTestAppData();
    const purchase = live.purchases.find(p => p.id === 'purchase-1');
    purchase.remainingAmount = -0.2;
    rt.saveData(live);

    const report = rt.scanDataHealth(rt.__getTestAppData());
    assert.ok(report.total > 0);
    assert.ok(report.counts.negativeRemaining >= 1);
    assert.ok(report.counts.brokenInventoryLink >= 1);
    assert.ok(report.counts.legacyRecord >= 1);

    const preview = rt.previewDataHealthRepairs(report);
    assert.ok(preview.fixableCount >= 1);

    const result = rt.applyDataHealthRepairs(report, {
        fixIds: report.issues.filter(i => i.fix === 'clamp-negative-remaining').map(i => i.id)
    });
    assert.ok(result.applied >= 1);
    const after = rt.__getTestAppData().purchases.find(p => p.id === 'purchase-1').remainingAmount;
    assert.ok(after >= 0);
});

test('Data Health classifies duplicates and orphans as review-required', () => {
    const data = makeData({
        logs: [
            {
                id: 'dup-id',
                substanceId: COKE_ID,
                date: '2026-07-27',
                amount: 0.1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'dup-id',
                substanceId: COKE_ID,
                date: '2026-07-28',
                amount: 0.2,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'orphan-sub',
                substanceId: 'missing-substance',
                date: '2026-07-26',
                amount: 0.1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            }
        ]
    });
    const rt = setup(data);
    const report = rt.scanDataHealth(rt.__getTestAppData());
    const dup = report.issues.find(i => i.fix === 'dedupe-log');
    const orphan = report.issues.find(i => i.fix === 'clear-orphan-substance');
    assert.ok(dup);
    assert.ok(orphan);
    assert.equal(rt.isDataHealthIssueSafe(dup), false);
    assert.equal(rt.isDataHealthIssueSafe(orphan), false);

    const clamp = report.issues.find(i => i.fix === 'clamp-negative-remaining');
    assert.ok(clamp);
    assert.equal(rt.isDataHealthIssueSafe(clamp), true);

    const preview = rt.previewDataHealthRepairs(report);
    assert.ok(preview.reviewRequiredCount >= 2);
    assert.ok(preview.safeFixableCount >= 1);
});

test('clear-orphan-substance apply quarantines orphan and increments applied', () => {
    const data = makeData({
        logs: [{
            id: 'orphan-only',
            substanceId: 'missing-substance',
            date: '2026-07-26',
            amount: 0.1,
            unit: 'g',
            transactionType: 'use',
            type: 'quick'
        }]
    });
    const rt = setup(data);
    const report = rt.scanDataHealth(rt.__getTestAppData());
    const orphan = report.issues.find(i => i.fix === 'clear-orphan-substance');
    assert.ok(orphan);

    const result = rt.applyDataHealthRepairs(report, {
        fixIds: [orphan.id],
        skipBackup: true,
        skipSave: true,
        runMaintenance: false
    });
    assert.equal(result.applied, 1);
    assert.equal(result.skippedUnhandled, 0);

    const log = rt.__getTestAppData().logs.find(l => l.id === 'orphan-only');
    assert.equal(log.dataHealthOrphanSubstanceId, 'missing-substance');
    assert.equal(log.needsReview, true);
    assert.equal(log.substanceId, undefined);
});

test('applyAllSafeDataHealthRepairs skips review-required duplicates', () => {
    const data = makeData({
        logs: [
            {
                id: 'dup-id',
                substanceId: COKE_ID,
                date: '2026-07-27',
                amount: 0.1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'dup-id',
                substanceId: COKE_ID,
                date: '2026-07-28',
                amount: 0.2,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            }
        ]
    });
    const rt = setup(data);
    const beforeCount = rt.__getTestAppData().logs.length;
    const report = rt.scanDataHealth(rt.__getTestAppData());
    const safeIds = report.issues.filter(i => rt.isDataHealthIssueSafe(i)).map(i => i.id);
    rt.applyDataHealthRepairs(report, { fixIds: safeIds, reason: 'test-safe-only', skipBackup: true });
    assert.equal(rt.__getTestAppData().logs.length, beforeCount, 'safe repair must not dedupe logs');
});

test('Phase 2: change history snapshot can be restored', () => {
    const rt = setup(makeData());
    const beforeCount = rt.__getTestAppData().logs.length;
    rt.pushChangeHistory('test-edit', { summary: 'Before deleting a log' });
    const data = rt.__getTestAppData();
    data.logs = data.logs.filter(l => l.id !== 'log-coke-1');
    rt.saveData(data);
    assert.equal(rt.__getTestAppData().logs.length, beforeCount - 1);

    const history = rt.loadChangeHistory();
    assert.ok(history.length >= 1);
    const entryId = history[0].id;
    rt.restoreChangeHistoryEntry(entryId, { confirmRestore: false });
    assert.ok(rt.__getTestAppData().logs.some(l => l.id === 'log-coke-1'));
});

test('Phase 2: import preview reports new vs updated records', () => {
    const rt = setup(makeData());
    const incoming = makeData({
        logs: [
            {
                id: 'log-coke-1',
                substanceId: COKE_ID,
                date: '2026-07-28',
                amount: 0.9,
                unit: 'g',
                transactionType: 'use',
                type: 'session'
            },
            {
                id: 'log-new',
                substanceId: COKE_ID,
                date: '2026-07-29',
                amount: 0.2,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            }
        ]
    });
    const preview = rt.buildImportPreview(incoming, rt.__getTestAppData());
    assert.equal(preview.summary.updatedLogs, 1);
    assert.equal(preview.summary.newLogs, 1);
    assert.ok(preview.conflicts.length >= 1);
});

test('Phase 3: column presets expose basic/cost/inventory/detailed', () => {
    const rt = setup(makeData());
    assert.equal(rt.COLUMN_PRESET_IDS.join(','), 'basic,cost,inventory,detailed');
    const basic = rt.getColumnPresetDefinition('basic', 'useHistory');
    assert.ok(basic.order.includes('date'));
    assert.ok(basic.order.includes('actions'));
    assert.equal(basic.visible.cost, false);

    // Cost remains available for substances that still use it (not Coke).
    const cost = rt.getColumnPresetDefinition('cost', 'useHistory', 'ketamine');
    assert.equal(cost.visible.cost, true);
    const cokeCost = rt.getColumnPresetDefinition('cost', 'useHistory', COKE_ID);
    assert.equal(cokeCost.visible.cost, false);
    assert.ok(!cokeCost.order.includes('cost'));
    assert.ok(cokeCost.order.includes('gPerHour'));

    const detailed = rt.getColumnPresetDefinition('detailed', 'useHistory');
    assert.ok(detailed.order.length >= basic.order.length);
});

test('Phase 3: legacy dashboard layout prefs are ignored safely', () => {
    const rt = loadRecoveryTrackerApp({
        localStorage: {
            'recovery-tracker-v2-dashboard-layout': JSON.stringify({
                widgets: ['todayUsed', 'quickActions']
            })
        }
    });
    rt.__setTestAppData(makeData());
    assert.equal(typeof rt.loadDashboardLayout, 'undefined');
    assert.equal(typeof rt.saveDashboardLayout, 'undefined');
    assert.ok(rt.__getTestAppData());
    assert.equal(rt.__getTestAppData().logs.length, 2);
});

test('Phase 4: adaptive remaining weeks leave historical goals intact', () => {
    const plan = {
        id: 'taper-1',
        substanceId: NICOTINE_ID,
        reductionType: 'reduce-puffs',
        puffReductionMode: 'percent',
        startingDailyAverage: 1000,
        goalDailyAverage: 0,
        startDate: '2026-07-01',
        endDate: '2026-09-08',
        taperDurationWeeks: 10,
        weeklyTargets: []
    };
    const rt = setup(makeData({ taperPlansV2: [plan] }));
    plan.weeklyTargets = rt.generateReducePuffsWeeklyTargets(plan);
    const historical = plan.weeklyTargets[0].dailyTarget;
    // Force today into a later week by adjusting week dates around 2026-07-28
    const currentIdx = plan.weeklyTargets.findIndex(w => '2026-07-28' >= w.weekStart && '2026-07-28' <= w.weekEnd);
    assert.ok(currentIdx > 0);

    const adaptive = rt.buildAdaptiveRemainingWeekTargets(plan, NICOTINE_ID);
    assert.ok(adaptive.length > 0);
    assert.equal(plan.weeklyTargets[0].dailyTarget, historical);

    rt.applyAdaptiveRemainingWeekTargets(plan, NICOTINE_ID);
    assert.equal(plan.weeklyTargets[0].dailyTarget, historical);
    assert.ok(plan.weeklyTargets[currentIdx].adaptive === true);

    const explanation = rt.getTaperStatusExplanation(plan, NICOTINE_ID);
    assert.ok(explanation.title);
    assert.ok(explanation.detail);
});

test('Phase 4: purchase break and use break stay separate in explanations', () => {
    const plan = {
        id: 'taper-purchase-1',
        substanceId: NICOTINE_ID,
        reductionType: 'nicotine-vape-purchase',
        startDate: '2026-07-01',
        endDate: '2026-08-15',
        nicotineVapeLiveMetrics: {
            daysSinceLastPurchase: 4,
            daysSinceLastUse: 1
        },
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-22',
            weekEnd: '2026-07-28',
            status: 'under'
        }]
    };
    const rt = setup(makeData({ taperPlansV2: [plan] }));
    const explanation = rt.getTaperStatusExplanation(plan, NICOTINE_ID);
    assert.match(explanation.detail, /Purchase break/i);
    assert.match(explanation.detail, /Use break/i);
    assert.match(explanation.detail, /separately/i);
});
