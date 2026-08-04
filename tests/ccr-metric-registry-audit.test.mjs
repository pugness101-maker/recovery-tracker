import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

const SUBSTANCES = [
    { id: 'coke', name: 'Coke', icon: '', trackingMode: 'coke', primaryUnit: 'grams', units: ['grams'], defaultUnit: 'grams' },
    { id: 'nicotine', name: 'Nicotine', icon: '', trackingMode: 'nicotine', primaryUnit: 'puffs', units: ['puffs'], defaultUnit: 'puffs' },
    { id: 'lsd', name: 'LSD', icon: '', trackingMode: 'lsd', primaryUnit: 'tabs', units: ['tabs'], defaultUnit: 'tabs' },
    { id: 'xanax', name: 'Xanax', icon: '', trackingMode: 'xanax', primaryUnit: 'pills', units: ['pills'], defaultUnit: 'pills' },
    { id: 'alcohol', name: 'Alcohol', icon: '', trackingMode: 'alcohol', primaryUnit: 'drinks', units: ['drinks'], defaultUnit: 'drinks' }
];

function log(id, substanceId, patch = {}) {
    return {
        id,
        substanceId,
        date: '2026-08-01',
        startTime: patch.startTime || '10:00',
        endTime: patch.endTime || '11:00',
        amount: patch.amount ?? 1,
        unit: patch.unit || 'grams',
        type: 'session',
        transactionType: 'use',
        productType: patch.productType || 'standard',
        statusLabel: patch.statusLabel || 'ok',
        puffs: patch.puffs ?? 40,
        percentAfter: patch.percentAfter ?? 75,
        personalAmount: patch.personalAmount ?? 1,
        nicotineFreeHours: patch.nicotineFreeHours ?? 12,
        tabs: patch.tabs ?? 1,
        ug: patch.ug ?? 100,
        pills: patch.pills ?? 2,
        mg: patch.mg ?? 1,
        strengthPerPill: patch.strengthPerPill ?? 0.5,
        drinks: patch.drinks ?? 2,
        multiDayDuration: patch.multiDayDuration ?? 2,
        durationDays: patch.durationDays ?? 2,
        ...patch
    };
}

function purchase(id, substanceId, patch = {}) {
    return {
        id,
        substanceId,
        date: patch.date || '2026-08-01',
        quantity: patch.quantity ?? 4,
        quantityBought: patch.quantityBought ?? patch.quantity ?? 4,
        remainingAmount: patch.remainingAmount ?? 2,
        totalCost: patch.totalCost ?? 80,
        store: patch.store || 'Main Store',
        inventoryStatus: patch.inventoryStatus || 'active',
        supplyDuration: 5,
        costPerGram: 20,
        costPerVape: 40,
        costPerTab: 10,
        costPerUg: 0.1,
        costPerPill: 5,
        costPerMg: 10,
        percentLeft: 50,
        puffsRemaining: 250,
        currentVapeAge: 3,
        vapeLifespan: 8,
        nicotineStrength: 5,
        tabsRemaining: 2,
        ugRemaining: 200,
        pillsRemaining: 3,
        mgRemaining: 1.5,
        needsStrengthReview: true,
        ...patch
    };
}

function setup() {
    const logs = [
        log('coke-a', 'coke', { startTime: '08:00', endTime: '09:00', amount: 1 }),
        log('coke-b', 'coke', { startTime: '12:00', endTime: '13:00', amount: 1.5 }),
        log('nic-log', 'nicotine', { amount: 40, unit: 'puffs' }),
        log('lsd-log', 'lsd', { amount: 1, unit: 'tabs' }),
        log('xanax-log', 'xanax', { amount: 2, unit: 'pills' }),
        log('alc-log', 'alcohol', { amount: 2, unit: 'drinks' })
    ];
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData(logs, SUBSTANCES));
    data.purchases = [
        purchase('coke-p1', 'coke', { date: '2026-07-01', totalCost: 60 }),
        purchase('coke-p2', 'coke', { date: '2026-08-01', totalCost: 80 }),
        purchase('nic-p1', 'nicotine', { date: '2026-07-15', totalCost: 40 }),
        purchase('nic-p2', 'nicotine', { date: '2026-08-01', totalCost: 45 }),
        purchase('lsd-p1', 'lsd', { totalCost: 50 }),
        purchase('xanax-p1', 'xanax', { totalCost: 30 }),
        purchase('alc-p1', 'alcohol', { totalCost: 24 })
    ];
    data.taperPlansV2 = [{
        id: 'plan',
        substanceId: 'coke',
        weeklyTargets: [{ plannedGrams: 1 }],
        target: 1
    }];
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    return { rt, data };
}

function contextForMetric(key, family, data) {
    const taperRow = {
        substanceId: family === 'all' ? 'coke' : family,
        planned: 2,
        actual: 1,
        used: 1,
        target: 2,
        status: 'on_track',
        plannedAmount: 2,
        actualAmount: 1,
        difference: -1,
        percentageOfTarget: 50,
        plannedGrams: 2,
        actualGrams: 1,
        useDifference: -1,
        plannedSpending: 100,
        actualSpending: 60,
        spendingDifference: -40,
        puffTarget: 500,
        weeklyMax: 500,
        actualPuffs: 420,
        puffDifference: -80,
        vapeLifespanGoal: 10,
        daysBetweenPurchasesGoal: 7,
        monthlyVapeCap: 4,
        spendingGoal: 120,
        plannedTabs: 2,
        actualTabs: 1,
        plannedUg: 200,
        actualUg: 100,
        plannedPills: 3,
        actualPills: 2,
        plannedMg: 1.5,
        actualMg: 1,
        plannedDrinks: 3,
        actualDrinks: 2
    };
    const periodComparison = { previous: 10, difference: -2, percent: -20, directionKey: 'decrease', directionValue: 'decrease' };
    if (key.startsWith('period')) return { periodComparison };
    if ([
        'taperPlannedVsActual', 'taperStatus', 'plannedAmount', 'actualAmount', 'difference', 'percentageOfTarget',
        'plannedGrams', 'actualGrams', 'useDifference', 'plannedSpending', 'actualSpending', 'spendingDifference',
        'puffTarget', 'actualPuffs', 'puffDifference', 'puffsVsTargetRatio', 'vapeLifespanGoal',
        'daysBetweenPurchasesGoal', 'monthlyVapeCap', 'spendingGoal', 'plannedTabs', 'actualTabs',
        'plannedUg', 'actualUg', 'plannedPills', 'actualPills', 'plannedMg', 'actualMg',
        'plannedDrinks', 'actualDrinks', 'useVsTarget'
    ].includes(key)) return { record: taperRow };
    if ([
        'inventoryRemaining', 'inventoryPercent', 'daysSincePurchase', 'inventoryStatus', 'spend',
        'purchaseCount', 'purchaseAmount', 'breakBetweenPurchases', 'averageGapBetweenPurchases',
        'purchasesPerWeek', 'purchasesPerMonth', 'store', 'supplyDuration', 'costPerGram',
        'vapesPurchased', 'costPerVape', 'monthlySpending', 'breakBetweenVapePurchases',
        'percentLeft', 'puffsRemaining', 'currentVapeAge', 'vapeLifespan', 'nicotineStrength',
        'tabsRemaining', 'ugRemaining', 'costPerTab', 'costPerUg', 'pillsRemaining',
        'mgRemaining', 'missingStrengthFlag', 'costPerPill', 'costPerMg', 'costPerDrink'
    ].includes(key)) {
        const substanceId = key === 'breakBetweenVapePurchases' || key === 'costPerVape' ? 'nicotine' : (family === 'all' ? 'coke' : family);
        const purchaseRecord = [...data.purchases].reverse().find(p => p.substanceId === substanceId) || data.purchases[0];
        return { purchase: purchaseRecord, substanceId };
    }
    const substanceId = family === 'all' ? 'coke' : family;
    const matchingLogs = data.logs.filter(l => l.substanceId === substanceId);
    const logRecord = key === 'useGapPrevious'
        ? (matchingLogs[1] || data.logs[1])
        : (matchingLogs[0] || data.logs[1]);
    return { log: logRecord, substanceId };
}

test('every visible CCR metric has registry metadata and resolves against sample records', () => {
    const { rt, data } = setup();
    const visible = new Map();
    for (const family of ['all', 'coke', 'nicotine', 'lsd', 'xanax', 'alcohol']) {
        for (const metric of rt.getCcrMetricsForSubstance(family, data)) {
            visible.set(metric.key, { metric, family });
        }
    }
    assert.ok(visible.size > 20);
    assert.equal(visible.has('useGapCurrent'), false);
    assert.equal(visible.has('purchaseFrequency'), false);
    assert.equal(visible.has('daysSincePurchase'), false);
    assert.equal(visible.has('averageGapBetweenPurchases'), false);
    assert.equal(visible.has('purchasesPerWeek'), false);
    assert.equal(visible.has('purchasesPerMonth'), false);

    for (const [key, { family }] of visible) {
        const entry = rt.getCcrMetricRegistryEntry(key);
        assert.equal(entry.key, key);
        assert.equal(typeof entry.calculationFunction, 'function', `${key} resolver`);
        assert.equal(typeof entry.formatter, 'function', `${key} formatter`);
        assert.ok(entry.allowedOperators.length > 0, `${key} operators`);
        const resolved = rt.resolveCcrRegisteredMetric(key, contextForMetric(key, family, data), data);
        assert.ok(resolved, `${key} resolved`);
        assert.ok(resolved.value != null || resolved.textValue != null, `${key} value`);
    }
});

test('metric audit report flags missing data and keeps text/status operators non-numeric', () => {
    const { rt, data } = setup();
    const report = rt.buildCcrMetricAuditReport(data, { substanceScope: 'coke', section: 'useHistory' });
    assert.ok(report.some(row => row.statuses.includes('implemented')));
    assert.ok(report.some(row => row.statuses.includes('unsupported substance')));
    const emptyData = rt.normalizeAppDataSafe(makeTestData([], SUBSTANCES));
    assert.ok(rt.buildCcrMetricAuditReport(emptyData).some(row => row.statuses.includes('no available data')));
    const store = rt.getDefaultCcrMetricSettings('store');
    const transactionType = rt.getDefaultCcrMetricSettings('transactionType');
    const taperStatus = rt.getDefaultCcrMetricSettings('taperStatus');
    assert.equal(store.allowedOperators.join('|'), 'eq|neq|contains|empty|notEmpty');
    assert.equal(transactionType.allowedOperators.join('|'), 'eq|neq|contains|empty|notEmpty');
    assert.equal(taperStatus.allowedOperators.join('|'), 'eq|neq|contains|empty|notEmpty');
    assert.equal(store.allowedOperators.includes('gt'), false);
    assert.equal(transactionType.allowedOperators.includes('between'), false);
    assert.equal(taperStatus.allowedOperators.includes('between'), false);
    assert.match(rt.renderCcrMetricAuditReport(data), /Missing resolver/);
});
