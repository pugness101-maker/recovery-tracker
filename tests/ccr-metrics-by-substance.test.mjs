import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function setup() {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeTestData([]));
    rt.__setTestAppData(data);
    rt.ensureConditionalColorRules(data);
    return rt;
}

function keysFor(rt, substance) {
    return rt.getCcrMetricsForSubstance(substance).map(m => m.key);
}

function labelsFor(rt, substance) {
    return rt.getCcrMetricsForSubstance(substance).map(m => m.label);
}

function assertHas(keys, expected) {
    for (const key of expected) assert.ok(keys.includes(key), `expected ${key}`);
}

function assertMissing(keys, forbidden) {
    for (const key of forbidden) assert.ok(!keys.includes(key), `did not expect ${key}`);
}

test('registry entries expose shared metric fields', () => {
    const rt = setup();
    const sample = rt.getCcrMetricDef('useAmount');
    assert.equal(sample.key, 'useAmount');
    assert.equal(sample.id, 'useAmount');
    assert.equal(sample.label, 'Use amount');
    assert.equal(sample.group, 'use');
    assert.ok(sample.substances.includes('all'));
    assert.ok(Array.isArray(sample.sections));
    assert.equal(sample.valueType, 'number');
    assert.equal(sample.unitType, 'amount');
    assert.equal(sample.deleted, false);
});

test('all substances metric filter shows only universal metrics', () => {
    const rt = setup();
    const keys = keysFor(rt, 'all');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'breakSincePreviousUse', 'useVsTarget', 'timeSinceLastUse',
        'inventoryRemaining', 'inventoryPercent', 'daysSincePurchase', 'inventoryStatus',
        'spend', 'purchaseCount', 'purchaseAmount', 'breakBetweenPurchases', 'purchaseFrequency', 'store',
        'taperPlannedVsActual', 'taperStatus', 'plannedAmount', 'actualAmount', 'difference', 'percentageOfTarget',
        'transactionType', 'productType', 'statusLabel', 'booleanFlag',
        'periodPreviousValue', 'periodNumericChange', 'periodPercentageChange', 'periodChangeDirection'
    ]);
    assertMissing(keys, [
        'gramsPerHour', 'puffs', 'percentLeft', 'tabs', 'ug', 'pills', 'mg', 'drinks',
        'costPerGram', 'costPerVape', 'paymentMethod', 'costPerUnit', 'daysSinceUse'
    ]);
});

test('coke metric filter includes g/hr and excludes nicotine/LSD/alcohol specifics', () => {
    const rt = setup();
    const keys = keysFor(rt, 'coke');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'gramsPerHour', 'breakSincePreviousUse', 'useVsTarget', 'timeSinceLastUse',
        'inventoryRemaining', 'inventoryPercent', 'daysSincePurchase', 'supplyDuration',
        'spend', 'purchaseAmount', 'purchaseCount', 'costPerGram', 'breakBetweenPurchases', 'purchaseFrequency', 'store',
        'plannedGrams', 'actualGrams', 'useDifference', 'plannedSpending', 'actualSpending', 'spendingDifference', 'taperStatus'
    ]);
    assertMissing(keys, [
        'puffs', 'percentLeft', 'tabs', 'ug', 'pills', 'mg', 'drinks', 'costPerVape', 'paymentMethod'
    ]);
});

test('nicotine metric filter includes puffs/vape metrics and excludes g/hr and pills', () => {
    const rt = setup();
    const keys = keysFor(rt, 'nicotine');
    assertHas(keys, [
        'puffs', 'percentLeftCheckpoint', 'personalUseAmount', 'sessionDuration', 'breakSincePreviousUse',
        'timeSinceLastUse', 'nicotineFreeHours',
        'percentLeft', 'puffsRemaining', 'currentVapeAge', 'vapeLifespan', 'nicotineStrength',
        'daysSincePurchase', 'inventoryStatus',
        'vapesPurchased', 'purchaseCount', 'costPerVape', 'monthlySpending',
        'breakBetweenVapePurchases', 'purchaseFrequency', 'store',
        'puffTarget', 'actualPuffs', 'puffDifference', 'puffsVsTargetRatio',
        'vapeLifespanGoal', 'daysBetweenPurchasesGoal', 'monthlyVapeCap', 'spendingGoal', 'taperStatus'
    ]);
    assertMissing(keys, [
        'gramsPerHour', 'tabs', 'ug', 'pills', 'mg', 'drinks', 'costPerGram', 'useAmount', 'paymentMethod'
    ]);
});

test('lsd metric filter includes tabs/µg and excludes puffs/g/hr', () => {
    const rt = setup();
    const keys = keysFor(rt, 'lsd');
    assertHas(keys, [
        'tabs', 'ug', 'sessionDuration', 'breakSincePreviousUse', 'timeSinceLastUse', 'useVsTarget',
        'tabsRemaining', 'ugRemaining', 'inventoryPercent', 'daysSincePurchase', 'inventoryStatus',
        'purchaseAmount', 'purchaseCount', 'costPerTab', 'costPerUg', 'spend', 'store',
        'plannedTabs', 'actualTabs', 'plannedUg', 'actualUg', 'difference', 'percentageOfTarget', 'taperStatus'
    ]);
    assertMissing(keys, ['puffs', 'gramsPerHour', 'pills', 'mg', 'drinks', 'costPerVape']);
});

test('xanax metric filter includes pills/mg and missing strength flag', () => {
    const rt = setup();
    const keys = keysFor(rt, 'xanax');
    assertHas(keys, [
        'pills', 'mg', 'strengthPerPill', 'sessionDuration', 'breakSincePreviousUse', 'timeSinceLastUse', 'useVsTarget',
        'pillsRemaining', 'mgRemaining', 'inventoryPercent', 'daysSincePurchase', 'inventoryStatus', 'missingStrengthFlag',
        'purchaseAmount', 'purchaseCount', 'costPerPill', 'costPerMg', 'spend', 'store',
        'plannedPills', 'actualPills', 'plannedMg', 'actualMg', 'difference', 'percentageOfTarget', 'taperStatus'
    ]);
    assertMissing(keys, ['puffs', 'tabs', 'ug', 'gramsPerHour', 'drinks', 'costPerGram']);
});

test('alcohol metric filter includes drinks and multi-day duration', () => {
    const rt = setup();
    const keys = keysFor(rt, 'alcohol');
    assertHas(keys, [
        'drinks', 'sessionDuration', 'multiDayDuration', 'breakSincePreviousUse', 'timeSinceLastUse', 'useVsTarget',
        'purchaseAmount', 'purchaseCount', 'costPerDrink', 'spend', 'store',
        'plannedDrinks', 'actualDrinks', 'difference', 'percentageOfTarget', 'statusLabel'
    ]);
    assertMissing(keys, ['puffs', 'tabs', 'pills', 'gramsPerHour', 'percentLeft', 'inventoryRemaining']);
});

test('xannax substance id resolves to xanax metric family', () => {
    const rt = setup();
    assert.equal(rt.resolveCcrMetricSubstanceFamily('xannax'), 'xanax');
    assert.ok(keysFor(rt, 'xannax').includes('pills'));
});

test('invalid metric falls back to first valid metric for substance', () => {
    const rt = setup();
    assert.equal(rt.resolveCcrMetricForSubstance('gramsPerHour', 'nicotine'), 'puffs');
    assert.equal(rt.resolveCcrMetricForSubstance('puffs', 'coke'), 'useAmount');
    assert.equal(rt.resolveCcrMetricForSubstance('not-a-metric', 'all'), 'useAmount');
    assert.equal(rt.resolveCcrMetricForSubstance('tabs', 'alcohol'), 'drinks');
    assert.ok(rt.isCcrMetricValidForSubstance('gramsPerHour', 'coke'));
    assert.equal(rt.isCcrMetricValidForSubstance('gramsPerHour', 'nicotine'), false);
});

test('legacy metric keys migrate and payment method stays hidden', () => {
    const rt = setup();
    assert.equal(rt.migrateCcrMetricKey('daysSinceUse'), 'timeSinceLastUse');
    assert.equal(rt.migrateCcrMetricKey('duration'), 'sessionDuration');
    assert.equal(rt.migrateCcrMetricKey('gPerHour'), 'gramsPerHour');

    const migrated = rt.normalizeConditionalColorRule({
        name: 'legacy streak',
        metric: 'daysSinceUse',
        operator: 'gte',
        value: 7
    });
    assert.equal(migrated.metric, 'timeSinceLastUse');

    const payment = rt.normalizeConditionalColorRule({
        name: 'legacy payment',
        metric: 'paymentMethod',
        operator: 'eq',
        value: 'Cash'
    });
    assert.equal(payment.metric, 'paymentMethod');
    assert.equal(rt.getCcrMetricDef('paymentMethod').deleted, true);
    assert.ok(!keysFor(rt, 'all').includes('paymentMethod'));
    assert.ok(!labelsFor(rt, 'all').includes('Payment method'));
    assert.ok(!labelsFor(rt, 'coke').includes('Payment method'));
});

test('metric select html uses optgroups and substance filtering', () => {
    const rt = setup();
    const allHtml = rt.buildCcrMetricSelectOptionsHtml('all', 'useAmount');
    assert.match(allHtml, /<optgroup label="Use">/);
    assert.match(allHtml, /<optgroup label="Inventory">/);
    assert.match(allHtml, /<optgroup label="Previous-period comparison">/);
    assert.match(allHtml, /value="useAmount"/);
    assert.doesNotMatch(allHtml, /value="gramsPerHour"/);
    assert.doesNotMatch(allHtml, /value="paymentMethod"/);

    const cokeHtml = rt.buildCcrMetricSelectOptionsHtml('coke', 'puffs');
    assert.match(cokeHtml, /value="gramsPerHour"/);
    assert.match(cokeHtml, /selected/);
    assert.doesNotMatch(cokeHtml, /value="puffs"/);
    // Invalid preferred metric falls back to first coke metric
    assert.match(cokeHtml, /value="useAmount"[^>]*selected|selected[^>]*value="useAmount"/);

    const nicHtml = rt.buildCcrMetricSelectOptionsHtml('nicotine', 'gramsPerHour');
    assert.match(nicHtml, /value="puffs"/);
    assert.doesNotMatch(nicHtml, /value="gramsPerHour"/);
    assert.match(nicHtml, /<optgroup label="Vape inventory">/);
});
