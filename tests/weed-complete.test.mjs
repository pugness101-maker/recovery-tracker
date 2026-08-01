import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const WEED_ID = 'weed-thc';
const REFERENCE_DATE = '2026-08-01';

function makeWeedData({ logs = [], purchases = [], settings = {} } = {}) {
    return {
        substances: [{
            id: WEED_ID,
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            trackingMode: 'weed',
            primaryUnit: 'grams',
            units: ['grams', 'hits'],
            defaultUnit: 'grams',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs,
        purchases,
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: { currency: '$', substanceSettings: {}, ...settings },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function setup(opts = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData(makeWeedData(opts));
    rt.ensureWeedCompletePrefs();
    return rt;
}

test('bud joint logging stores entered count and normalized grams', () => {
    const rt = setup();
    const calc = rt.computeWeedBudNormalizedGrams({
        enteredAmount: 2,
        unit: 'joints',
        gramsPerUnit: 0.35
    });
    assert.equal(calc.error, undefined);
    assert.equal(calc.enteredAmount, 2);
    assert.equal(calc.enteredUnit, 'joints');
    assert.equal(calc.normalizedGrams, 0.7);
    assert.equal(calc.amount, 0.7);
    assert.equal(calc.unit, 'grams');
    assert.equal(calc.estimate, true);
    assert.match(rt.formatWeedBudUseSummary({
        enteredAmount: 2,
        enteredUnit: 'joints',
        normalizedGrams: 0.7,
        amount: 0.7,
        unit: 'grams',
        weedProductType: 'bud'
    }), /2 joints/);
});

test('pre-roll fraction computes grams without inventing strength', () => {
    const rt = setup();
    const withGrams = rt.computeWeedPreRollNormalized({ fractionOrCount: 0.5, gramsPerPreRoll: 1 });
    assert.equal(withGrams.amount, 0.5);
    assert.equal(withGrams.normalizedGrams, 0.5);
    assert.equal(withGrams.unit, 'pre-roll');
    const noGrams = rt.computeWeedPreRollNormalized({ fractionOrCount: 0.25 });
    assert.equal(noGrams.normalizedGrams, null);
    assert.equal(noGrams.amount, 0.25);
    assert.match(rt.formatWeedPreRollUseSummary({
        amount: 0.5,
        normalizedGrams: 0.5,
        weedProductType: 'pre-rolls'
    }), /0\.5 pre-roll/);
});

test('edible CBD totals and log use are calculated from strength', () => {
    const rt = setup();
    assert.equal(rt.computeWeedEdibleTotalCbdMg(10, 5), 50);
    const purchase = {
        id: 'e1',
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        quantityBought: 8,
        remainingAmount: 6,
        mgPerEdible: 20,
        cbdMgPerEdible: 5,
        unit: 'edible',
        totalCost: 40
    };
    rt.syncWeedEdibleCbdFields(purchase);
    assert.equal(purchase.totalCbdMg, 40);
    assert.equal(purchase.remainingCbdMg, 30);
    const cbdUsed = rt.getWeedEdibleLogCbdUsed({
        amount: 0.5,
        cbdMgPerEdibleAtTimeOfUse: 5,
        weedProductType: 'edibles'
    });
    assert.equal(cbdUsed, 2.5);
});

test('cart grams remaining and cost per percent are estimated clearly', () => {
    const rt = setup();
    const purchase = {
        id: 'c1',
        substanceId: WEED_ID,
        weedProductType: 'cart',
        cartGrams: 1,
        cartCount: 1,
        quantityBought: 100,
        remainingAmount: 40,
        unit: 'percent',
        cartTracksPercent: true,
        totalCost: 50
    };
    assert.equal(rt.getWeedCartEstimatedGramsRemaining(purchase), 0.4);
    assert.equal(rt.getWeedCartCostPerPercent(purchase), 0.5);
});

test('shared split validation requires personal + shared = total', () => {
    const rt = setup();
    assert.equal(rt.validateWeedSharedSplit({ total: 1, personal: 0.4, shared: 0.6 }).ok, true);
    assert.equal(rt.validateWeedSharedSplit({ total: 1, personal: 0.5, shared: 0.6 }).ok, false);
});

test('product-type filter excludes mismatched inventory', () => {
    const rt = setup({
        purchases: [
            {
                id: 'bud-1',
                substanceId: WEED_ID,
                weedProductType: 'bud',
                quantityBought: 3.5,
                remainingAmount: 3.5,
                unit: 'grams',
                date: '2026-07-01',
                time: '10:00',
                totalCost: 40
            },
            {
                id: 'cart-1',
                substanceId: WEED_ID,
                weedProductType: 'cart',
                quantityBought: 100,
                remainingAmount: 80,
                unit: 'percent',
                cartTracksPercent: true,
                date: '2026-07-02',
                time: '10:00',
                totalCost: 35
            }
        ]
    });
    assert.equal(rt.purchaseMatchesWeedProductType({ weedProductType: 'bud' }, 'cart'), false);
    assert.equal(rt.purchaseMatchesWeedProductType({ weedProductType: 'cart' }, 'cart'), true);
    assert.equal(rt.purchaseMatchesWeedProductType({ weedProductType: '' }, 'bud'), false);
});

test('migration marks missing product type Needs Review without inventing type', () => {
    const rt = setup({
        logs: [{
            id: 1,
            substanceId: WEED_ID,
            date: '2026-07-10',
            amount: 0.3,
            unit: 'grams',
            transactionType: 'use'
        }],
        purchases: [{
            id: 'legacy-p',
            substanceId: WEED_ID,
            date: '2026-07-01',
            quantityBought: 1,
            remainingAmount: 1,
            unit: 'grams',
            totalCost: 10
        }]
    });
    const data = rt.__getTestAppData();
    const report = rt.migrateCompleteWeedSupport(data);
    assert.ok(report.logsMarkedNeedsReview >= 1);
    assert.ok(report.purchasesMarkedNeedsReview >= 1);
    assert.equal(data.logs[0].needsReview, true);
    assert.equal(data.logs[0].weedProductType, undefined);
    assert.equal(data.purchases[0].needsReview, true);
    assert.equal(data.purchases[0].weedProductType, undefined);
    assert.equal(data.migrations.weedCompleteV1, true);
});

test('data health finds missing edible strength and cart percent issues', () => {
    const rt = setup({
        purchases: [
            {
                id: 'e-weak',
                substanceId: WEED_ID,
                weedProductType: 'edibles',
                quantityBought: 10,
                remainingAmount: 10,
                unit: 'edible',
                totalCost: 20
            },
            {
                id: 'cart-hi',
                substanceId: WEED_ID,
                weedProductType: 'cart',
                quantityBought: 100,
                remainingAmount: 120,
                unit: 'percent',
                cartTracksPercent: true,
                totalCost: 30
            }
        ],
        logs: [{
            id: 2,
            substanceId: WEED_ID,
            weedProductType: 'edibles',
            date: '2026-07-20',
            amount: 1,
            unit: 'edible',
            transactionType: 'use'
        }]
    });
    const report = rt.buildWeedDataHealthReport(rt.__getTestAppData());
    assert.ok(report.issueCount >= 2);
    assert.ok(report.issues.some(i => i.kind === 'missing_edible_thc_strength'));
    const preview = rt.previewWeedDataHealthRepairs(rt.__getTestAppData());
    assert.ok(preview.repairs.some(r => r.kind === 'cart_percent_above_100'));
});

test('analytics keep bud grams, cart percent, edible THC/CBD, and pre-rolls separate', () => {
    const rt = setup({
        logs: [
            {
                id: 1,
                substanceId: WEED_ID,
                weedProductType: 'bud',
                date: '2026-07-20',
                amount: 0.4,
                unit: 'grams',
                normalizedGrams: 0.4,
                transactionType: 'use'
            },
            {
                id: 2,
                substanceId: WEED_ID,
                weedProductType: 'cart',
                date: '2026-07-21',
                amount: 5,
                estimatedPercentUsed: 5,
                unit: 'percent',
                transactionType: 'use'
            },
            {
                id: 3,
                substanceId: WEED_ID,
                weedProductType: 'edibles',
                date: '2026-07-22',
                amount: 0.5,
                unit: 'edible',
                thcMgUsed: 10,
                cbdMgUsed: 2.5,
                transactionType: 'use'
            },
            {
                id: 4,
                substanceId: WEED_ID,
                weedProductType: 'pre-rolls',
                date: '2026-07-23',
                amount: 0.5,
                unit: 'pre-roll',
                normalizedGrams: 0.5,
                transactionType: 'use'
            }
        ],
        purchases: []
    });
    const analytics = rt.buildWeedProductAnalytics(rt.__getTestAppData());
    assert.equal(analytics.bud.gramsUsed, 0.4);
    assert.equal(analytics.cart.percentUsed, 5);
    assert.equal(analytics.edibles.thcMgUsed, 10);
    assert.equal(analytics.edibles.cbdMgUsed, 2.5);
    assert.equal(analytics['pre-rolls'].countUsed, 0.5);
    assert.equal(analytics['pre-rolls'].gramsUsed, 0.5);
});

test('normalized display never shows cart/edibles as generic units', () => {
    const rt = setup();
    assert.match(rt.formatWeedNormalizedUseSummary({
        weedProductType: 'cart',
        percentBefore: 100,
        percentLeftAfter: 95,
        estimatedPercentUsed: 5
    }), /100% → 95%/);
    assert.match(rt.formatWeedNormalizedUseSummary({
        weedProductType: 'edibles',
        amount: 0.25,
        thcMgUsed: 5,
        cbdMgUsed: 1
    }), /0\.25 edible/);
    assert.match(rt.formatWeedNormalizedUseSummary({
        weedProductType: 'bud',
        amount: 0.4,
        unit: 'grams'
    }), /0\.4 g Bud/);
});

test('usage-by-type buckets use pre-rolls key not pre-roll', () => {
    const rt = setup({
        logs: [{
            id: 9,
            substanceId: WEED_ID,
            weedProductType: 'pre-rolls',
            date: '2026-07-28',
            amount: 1,
            unit: 'pre-roll',
            transactionType: 'use'
        }]
    });
    const rows = rt.getWeedProductTypeUsageInRange(WEED_ID, '2026-07-01', '2026-07-31', rt.__getTestAppData());
    assert.ok(rows.some(r => r.productType === 'pre-rolls'));
    assert.ok(!rows.some(r => r.productType === 'pre-roll'));
});
