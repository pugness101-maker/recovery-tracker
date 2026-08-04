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
        'useAmount', 'sessionDuration', 'useGapPrevious',
        'inventoryRemaining', 'inventoryPercent',
        'spend', 'purchaseCount', 'purchaseAmount', 'breakBetweenPurchases',
        'taperStatus', 'plannedAmount', 'actualAmount', 'useDifference',
        'plannedSpending', 'actualSpending', 'spendingDifference',
        'transactionType', 'store'
    ]);
    assertMissing(keys, [
        'gramsPerHour', 'puffs', 'percentLeft', 'tabs', 'ug', 'pills', 'mg', 'drinks',
        'costPerGram', 'costPerVape', 'paymentMethod', 'costPerUnit', 'daysSinceUse', 'useGapCurrent',
        'daysSincePurchase', 'averageGapBetweenPurchases', 'purchasesPerWeek', 'purchasesPerMonth',
        'taperPlannedVsActual', 'productType', 'periodPreviousValue'
    ]);
});

test('coke metric filter includes g/hr and excludes nicotine/LSD/alcohol specifics', () => {
    const rt = setup();
    const keys = keysFor(rt, 'coke');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'gramsPerHour', 'useGapPrevious',
        'inventoryRemaining', 'inventoryPercent', 'supplyDuration',
        'spend', 'purchaseAmount', 'purchaseCount', 'costPerGram', 'breakBetweenPurchases',
        'taperStatus', 'plannedAmount', 'actualAmount', 'useDifference',
        'plannedSpending', 'actualSpending', 'spendingDifference', 'transactionType', 'store'
    ]);
    assertMissing(keys, [
        'puffs', 'percentLeft', 'tabs', 'ug', 'pills', 'mg', 'drinks', 'costPerVape', 'paymentMethod',
        'useGapCurrent', 'daysSincePurchase', 'averageGapBetweenPurchases', 'purchasesPerWeek', 'purchasesPerMonth',
        'plannedGrams', 'actualGrams'
    ]);
});

test('nicotine metric filter shows only compatible simplified metrics', () => {
    const rt = setup();
    const keys = keysFor(rt, 'nicotine');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'useGapPrevious',
        'purchaseCount', 'taperStatus', 'plannedAmount', 'actualAmount',
        'useDifference', 'transactionType', 'store'
    ]);
    assertMissing(keys, [
        'gramsPerHour', 'tabs', 'ug', 'pills', 'mg', 'drinks', 'costPerGram', 'paymentMethod', 'useGapCurrent',
        'puffs', 'percentLeft', 'vapesPurchased', 'costPerVape', 'monthlySpending', 'breakBetweenVapePurchases',
        'averageGapBetweenPurchases', 'purchasesPerWeek', 'purchasesPerMonth'
    ]);
});

test('lsd metric filter shows simplified use, inventory, purchase, taper, and field metrics', () => {
    const rt = setup();
    const keys = keysFor(rt, 'lsd');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'useGapPrevious',
        'inventoryRemaining', 'inventoryPercent',
        'purchaseAmount', 'purchaseCount', 'spend', 'store',
        'taperStatus', 'plannedAmount', 'actualAmount', 'useDifference', 'transactionType'
    ]);
    assertMissing(keys, ['puffs', 'gramsPerHour', 'pills', 'mg', 'drinks', 'costPerVape', 'useGapCurrent', 'tabs', 'ug', 'costPerTab', 'costPerUg']);
});

test('xanax metric filter shows simplified metrics and hides strength helpers', () => {
    const rt = setup();
    const keys = keysFor(rt, 'xanax');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'useGapPrevious',
        'inventoryRemaining', 'inventoryPercent',
        'purchaseAmount', 'purchaseCount', 'spend', 'store',
        'taperStatus', 'plannedAmount', 'actualAmount', 'useDifference', 'transactionType'
    ]);
    assertMissing(keys, ['puffs', 'tabs', 'ug', 'gramsPerHour', 'drinks', 'costPerGram', 'useGapCurrent', 'strengthPerPill', 'missingStrengthFlag', 'costPerPill', 'costPerMg']);
});

test('alcohol metric filter shows simplified metrics and hides alcohol-only helpers', () => {
    const rt = setup();
    const keys = keysFor(rt, 'alcohol');
    assertHas(keys, [
        'useAmount', 'sessionDuration', 'useGapPrevious',
        'purchaseAmount', 'purchaseCount', 'spend', 'store',
        'taperStatus', 'plannedAmount', 'actualAmount', 'useDifference', 'transactionType'
    ]);
    assertMissing(keys, ['puffs', 'tabs', 'pills', 'gramsPerHour', 'percentLeft', 'inventoryRemaining', 'useGapCurrent', 'drinks', 'multiDayDuration', 'costPerDrink', 'statusLabel']);
});

test('xannax substance id resolves to xanax metric family', () => {
    const rt = setup();
    assert.equal(rt.resolveCcrMetricSubstanceFamily('xannax'), 'xanax');
    assert.ok(keysFor(rt, 'xannax').includes('useAmount'));
});

test('invalid metric falls back to first valid metric for substance', () => {
    const rt = setup();
    assert.equal(rt.resolveCcrMetricForSubstance('gramsPerHour', 'nicotine'), 'useAmount');
    assert.equal(rt.resolveCcrMetricForSubstance('puffs', 'coke'), 'useAmount');
    assert.equal(rt.resolveCcrMetricForSubstance('not-a-metric', 'all'), 'useAmount');
    assert.equal(rt.resolveCcrMetricForSubstance('tabs', 'alcohol'), 'useAmount');
    assert.ok(rt.isCcrMetricValidForSubstance('gramsPerHour', 'coke'));
    assert.equal(rt.isCcrMetricValidForSubstance('gramsPerHour', 'nicotine'), false);
});

test('legacy metric keys migrate and payment method stays hidden', () => {
    const rt = setup();
    assert.equal(rt.migrateCcrMetricKey('daysSinceUse'), 'useGapCurrent');
    assert.equal(rt.migrateCcrMetricKey('duration'), 'sessionDuration');
    assert.equal(rt.migrateCcrMetricKey('gPerHour'), 'gramsPerHour');
    assert.equal(rt.migrateCcrMetricKey('purchaseFrequency'), 'averageGapBetweenPurchases');

    const migrated = rt.normalizeConditionalColorRule({
        name: 'legacy streak',
        metric: 'daysSinceUse',
        operator: 'gte',
        value: 7
    });
    assert.equal(migrated.metric, 'useGapCurrent');
    assert.equal(migrated.value, 168);
    assert.equal(migrated.enabled, false);
    assert.equal(migrated.needsReview, true);

    const payment = rt.normalizeConditionalColorRule({
        name: 'legacy payment',
        metric: 'paymentMethod',
        operator: 'eq',
        value: 'Cash'
    });
    assert.equal(payment.metric, 'paymentMethod');
    assert.equal(payment.needsReview, true);
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
    assert.match(allHtml, /<optgroup label="Purchases &amp; spending">/);
    assert.match(allHtml, /<optgroup label="Taper">/);
    assert.match(allHtml, /<optgroup label="Record fields">/);
    assert.match(allHtml, /value="useAmount"/);
    assert.match(allHtml, />Break Between Uses</);
    assert.doesNotMatch(allHtml, />Average Gap Between Purchases</);
    assert.doesNotMatch(allHtml, />Purchases Per Week</);
    assert.doesNotMatch(allHtml, />Purchases Per Month</);
    assert.doesNotMatch(allHtml, /Purchase frequency \/ average gap/);
    assert.doesNotMatch(allHtml, /value="useGapCurrent"/);
    assert.doesNotMatch(allHtml, /value="gramsPerHour"/);
    assert.doesNotMatch(allHtml, /value="paymentMethod"/);

    const cokeHtml = rt.buildCcrMetricSelectOptionsHtml('coke', 'puffs');
    assert.match(cokeHtml, /value="gramsPerHour"/);
    assert.match(cokeHtml, /selected/);
    assert.doesNotMatch(cokeHtml, /value="puffs"/);
    // Invalid preferred metric falls back to first coke metric
    assert.match(cokeHtml, /value="useAmount"[^>]*selected|selected[^>]*value="useAmount"/);

    const nicHtml = rt.buildCcrMetricSelectOptionsHtml('nicotine', 'gramsPerHour');
    assert.match(nicHtml, /value="useAmount"/);
    assert.doesNotMatch(nicHtml, /value="gramsPerHour"/);
    assert.doesNotMatch(nicHtml, /<optgroup label="Vape inventory">/);
});

test('metric select filters options by selected section', () => {
    const rt = setup();
    const useHtml = rt.buildCcrMetricSelectOptionsHtml('coke', 'useAmount', 'useHistory');
    assert.match(useHtml, /value="useAmount"/);
    assert.match(useHtml, /value="gramsPerHour"/);
    assert.match(useHtml, /value="transactionType"/);
    assert.doesNotMatch(useHtml, /value="inventoryRemaining"/);
    assert.doesNotMatch(useHtml, /value="spend"/);

    const inventoryHtml = rt.buildCcrMetricSelectOptionsHtml('coke', 'useAmount', 'inventory');
    assert.match(inventoryHtml, /value="inventoryRemaining"/);
    assert.match(inventoryHtml, /value="inventoryPercent"/);
    assert.match(inventoryHtml, /value="supplyDuration"/);
    assert.doesNotMatch(inventoryHtml, /value="useAmount"/);
});

test('Use vs target only appears when a valid target exists', () => {
    const rt = setup();
    assert.equal(keysFor(rt, 'coke').includes('useVsTarget'), false);
    const data = rt.__getTestAppData();
    data.taperPlansV2.push({
        id: 'target-plan',
        substanceId: 'coke',
        weeklyTargets: [{ plannedGrams: 1 }]
    });
    assert.equal(keysFor(rt, 'coke').includes('useVsTarget'), true);
});
