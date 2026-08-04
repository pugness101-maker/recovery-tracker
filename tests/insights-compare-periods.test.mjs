import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NICOTINE_ID = 'nicotine';
const LSD_ID = 'lsd';
const REFERENCE_DATE = '2026-08-18';

function makeSubstance(id, overrides = {}) {
    const map = {
        coke: {
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        },
        weed: {
            id: WEED_ID,
            name: 'Weed/THC',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        nicotine: {
            id: NICOTINE_ID,
            name: 'Nicotine',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        lsd: {
            id: LSD_ID,
            name: 'LSD',
            trackingMode: 'dose',
            primaryUnit: 'ug',
            defaultUnit: 'ug',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }
    };
    return { ...(map[id] || map.coke), ...overrides };
}

function makePurchase(substanceId, overrides = {}) {
    const quantityBought = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId,
        date: overrides.date || '2026-08-01',
        time: '12:00',
        quantity: quantityBought,
        quantityBought,
        unit: overrides.unit || 'g',
        totalCost: overrides.totalCost ?? 100,
        store: 'Main',
        acquisitionType: 'purchased',
        ...overrides,
        quantity: overrides.quantity ?? quantityBought,
        quantityBought: overrides.quantityBought ?? quantityBought
    };
}

function setup({ substances, logs = [], purchases = [], settings = {} }) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances,
        logs,
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            spreadPercentLeftUsage: true,
            comparePeriods: { preset: 'past-30', chartView: 'monthly', customStart: '', customEnd: '' },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.currentSubstanceId = substances[0]?.id || COKE_ID;
    return rt;
}

test('past 30 days vs previous 30 days uses equal-length local windows', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    rt.statsComparePreset = 'past-30';
    const pair = rt.resolveComparePeriodPair('past-30');
    assert.equal(pair.current.endDate, REFERENCE_DATE);
    assert.equal(pair.current.startDate, '2026-07-20');
    assert.equal(pair.current.daysInRange, 30);
    assert.equal(pair.previous.endDate, '2026-07-19');
    assert.equal(pair.previous.startDate, '2026-06-20');
    assert.equal(pair.previous.daysInRange, 30);
});

test('this month vs last month labels partial current period', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    const pair = rt.resolveComparePeriodPair('this-month');
    assert.equal(pair.current.startDate, '2026-08-01');
    assert.equal(pair.current.endDate, REFERENCE_DATE);
    assert.equal(pair.current.partial, true);
    assert.match(pair.current.label, /partial period/i);
    assert.equal(pair.previous.startDate, '2026-07-01');
    assert.equal(pair.previous.endDate, '2026-07-18');
});

test('Coke compare: lower use and spending mark Improved; gifts excluded from personal use', () => {
    const logs = [
        makeUseLog({ id: 'c1', substanceId: COKE_ID, date: '2026-08-02', amount: 1 }),
        makeUseLog({ id: 'c2', substanceId: COKE_ID, date: '2026-08-10', amount: 1 }),
        makeUseLog({ id: 'c3', substanceId: COKE_ID, date: '2026-07-05', amount: 3 }),
        makeUseLog({ id: 'c4', substanceId: COKE_ID, date: '2026-07-12', amount: 2 }),
        {
            id: 'gift-out',
            substanceId: COKE_ID,
            date: '2026-08-05',
            time: '12:00',
            amount: 5,
            transactionType: 'gift_given',
            type: 'quick',
            recipientName: 'Sam'
        },
        {
            id: 'shared',
            substanceId: COKE_ID,
            date: '2026-08-08',
            time: '12:00',
            amount: 2,
            transactionType: 'shared_use',
            type: 'quick',
            personalAmount: 0.5,
            sharedAmount: 1.5,
            sharedWithName: 'Alex'
        }
    ];
    const purchases = [
        makePurchase(COKE_ID, { id: 'pc1', date: '2026-08-03', quantityBought: 2, totalCost: 80 }),
        makePurchase(COKE_ID, { id: 'pc2', date: '2026-07-04', quantityBought: 4, totalCost: 160 })
    ];
    const rt = setup({ substances: [makeSubstance('coke')], logs, purchases });
    rt.statsComparePreset = 'this-month';
    const result = rt.buildComparePeriodResult(COKE_ID, rt.__getTestAppData(), 'this-month');
    const byId = Object.fromEntries(result.metrics.map(m => [m.id, m]));

    assert.ok(byId.totalUse.current < byId.totalUse.previous);
    assert.equal(byId.totalUse.status, 'Improved');
    assert.ok(byId.totalSpent.current < byId.totalSpent.previous);
    assert.equal(byId.totalSpent.status, 'Improved');
    // Gift given and legacy shared_use must not inflate personal-use totals
    assert.ok(byId.totalUse.current < 5);
    assert.ok(byId.giftGiven.current >= 5);
    assert.equal(byId.sharedAmount, undefined, 'sharedAmount compare metric was removed');
    // Only transactionType use counts (2g from c1+c2); shared personal portion excluded
    assert.equal(byId.totalUse.current, 2);

    const chips = rt.buildComparePeriodSummaryChips(result);
    assert.ok(chips.some(c => /Use/.test(c.text)));
    assert.ok(chips.some(c => /Spending/.test(c.text)));
});

test('Weed/THC compare uses grams and improves when longest break rises', () => {
    const logs = [
        // Current month: long gap between uses → longer no-use streak
        makeUseLog({ id: 'w1', substanceId: WEED_ID, date: '2026-08-01', amount: 0.5 }),
        makeUseLog({ id: 'w2', substanceId: WEED_ID, date: '2026-08-18', amount: 0.5 }),
        // Previous equal-length window: daily use → short/no streak
        makeUseLog({ id: 'w3', substanceId: WEED_ID, date: '2026-07-01', amount: 1 }),
        makeUseLog({ id: 'w4', substanceId: WEED_ID, date: '2026-07-05', amount: 1 }),
        makeUseLog({ id: 'w5', substanceId: WEED_ID, date: '2026-07-10', amount: 1 }),
        makeUseLog({ id: 'w6', substanceId: WEED_ID, date: '2026-07-15', amount: 1 }),
        makeUseLog({ id: 'w7', substanceId: WEED_ID, date: '2026-07-18', amount: 1 })
    ];
    const rt = setup({
        substances: [makeSubstance('weed')],
        logs,
        purchases: [
            makePurchase(WEED_ID, { id: 'wp1', date: '2026-08-02', quantityBought: 3.5, totalCost: 40, unit: 'g' }),
            makePurchase(WEED_ID, { id: 'wp2', date: '2026-07-02', quantityBought: 7, totalCost: 80, unit: 'g' })
        ]
    });
    const result = rt.buildComparePeriodResult(WEED_ID, rt.__getTestAppData(), 'this-month');
    assert.equal(result.unit, 'g');
    const streak = result.metrics.find(m => m.id === 'longestNoUseStreak');
    assert.ok(streak.current > streak.previous, `expected longer streak now (${streak.current}) than before (${streak.previous})`);
    assert.equal(streak.status, 'Improved');
    assert.match(streak.currentDisplay, /days/);
});

test('Nicotine compare keeps puff units and does not mix with other substances', () => {
    const rt = setup({
        substances: [makeSubstance('nicotine'), makeSubstance('coke')],
        logs: [
            makeUseLog({ id: 'n1', substanceId: NICOTINE_ID, date: '2026-08-02', amount: 200 }),
            makeUseLog({ id: 'n2', substanceId: NICOTINE_ID, date: '2026-07-02', amount: 400 }),
            makeUseLog({ id: 'coke', substanceId: COKE_ID, date: '2026-08-02', amount: 9 })
        ],
        purchases: [
            makePurchase(NICOTINE_ID, {
                id: 'nv1',
                date: '2026-08-03',
                quantityBought: 20000,
                quantity: 20000,
                unit: 'puffs',
                nicotineProductType: 'vape',
                fullPuffCount: 20000,
                totalCost: 25
            }),
            makePurchase(NICOTINE_ID, {
                id: 'nv2',
                date: '2026-07-03',
                quantityBought: 20000,
                quantity: 20000,
                unit: 'puffs',
                nicotineProductType: 'vape',
                fullPuffCount: 20000,
                totalCost: 30
            })
        ]
    });
    const result = rt.buildComparePeriodResult(NICOTINE_ID, rt.__getTestAppData(), 'this-month');
    assert.match(String(result.unit), /puff/i);
    const use = result.metrics.find(m => m.id === 'totalUse');
    assert.equal(use.current, 200);
    assert.equal(use.previous, 400);
    assert.notEqual(use.current, 209, 'coke grams must not enter nicotine totals');
    assert.equal(use.status, 'Improved');
});

test('LSD compare tracks ug personal use only', () => {
    const rt = setup({
        substances: [makeSubstance('lsd')],
        logs: [
            makeUseLog({ id: 'l1', substanceId: LSD_ID, date: '2026-08-05', amount: 100 }),
            makeUseLog({ id: 'l2', substanceId: LSD_ID, date: '2026-07-05', amount: 200 }),
            {
                id: 'l-adj',
                substanceId: LSD_ID,
                date: '2026-08-06',
                time: '12:00',
                amount: 50,
                transactionType: 'inventory_adjustment',
                adjustmentDirection: 'remove',
                type: 'quick'
            }
        ],
        purchases: [
            makePurchase(LSD_ID, { id: 'lp1', date: '2026-08-04', quantityBought: 10, unit: 'tabs', totalCost: 60 }),
            makePurchase(LSD_ID, { id: 'lp2', date: '2026-07-04', quantityBought: 20, unit: 'tabs', totalCost: 120 })
        ]
    });
    const result = rt.buildComparePeriodResult(LSD_ID, rt.__getTestAppData(), 'this-month');
    assert.equal(result.unit, 'ug');
    const use = result.metrics.find(m => m.id === 'totalUse');
    assert.equal(use.current, 100);
    assert.equal(use.previous, 200);
    assert.equal(use.status, 'Improved');
});

test('All Substances groups compare results by substance without combining units', () => {
    const substances = [
        makeSubstance('coke'),
        makeSubstance('weed'),
        makeSubstance('lsd')
    ];
    const rt = setup({
        substances,
        logs: [
            makeUseLog({ id: 'a1', substanceId: COKE_ID, date: '2026-08-02', amount: 1 }),
            makeUseLog({ id: 'a2', substanceId: WEED_ID, date: '2026-08-02', amount: 2 }),
            makeUseLog({ id: 'a3', substanceId: LSD_ID, date: '2026-08-02', amount: 50 }),
            makeUseLog({ id: 'b1', substanceId: COKE_ID, date: '2026-07-02', amount: 2 }),
            makeUseLog({ id: 'b2', substanceId: WEED_ID, date: '2026-07-02', amount: 4 }),
            makeUseLog({ id: 'b3', substanceId: LSD_ID, date: '2026-07-02', amount: 100 })
        ]
    });
    rt.currentSubstanceId = rt.DASHBOARD_ALL;
    const coke = rt.buildComparePeriodResult(COKE_ID, rt.__getTestAppData(), 'this-month');
    const weed = rt.buildComparePeriodResult(WEED_ID, rt.__getTestAppData(), 'this-month');
    const lsd = rt.buildComparePeriodResult(LSD_ID, rt.__getTestAppData(), 'this-month');
    assert.equal(coke.unit, 'g');
    assert.equal(weed.unit, 'g');
    assert.equal(lsd.unit, 'ug');
    assert.notEqual(
        coke.metrics.find(m => m.id === 'totalUse').current,
        weed.metrics.find(m => m.id === 'totalUse').current
    );
});

test('compare preset persists after refresh and CSV includes comparison rows', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        logs: [
            makeUseLog({ id: 'p1', substanceId: COKE_ID, date: '2026-08-02', amount: 1 }),
            makeUseLog({ id: 'p2', substanceId: COKE_ID, date: '2026-07-02', amount: 2 })
        ],
        purchases: [
            makePurchase(COKE_ID, { id: 'pp1', date: '2026-08-03', totalCost: 50, quantityBought: 1 }),
            makePurchase(COKE_ID, { id: 'pp2', date: '2026-07-03', totalCost: 90, quantityBought: 2 })
        ]
    });
    rt.statsComparePreset = 'past-3m';
    rt.statsCompareChartView = 'weekly';
    rt.persistComparePeriodsPrefs();

    const stored = rt.__getTestAppData().settings.comparePeriods;
    assert.equal(stored.preset, 'past-3m');
    assert.equal(stored.chartView, 'weekly');

    // Simulate reload
    const rt2 = loadRecoveryTrackerApp();
    rt2.setTestReferenceDate(REFERENCE_DATE);
    rt2.__setTestAppData(rt.__getTestAppData());
    rt2.loadComparePeriodsPrefsIntoState(rt2.__getTestAppData());
    assert.equal(rt2.statsComparePreset, 'past-3m');
    assert.equal(rt2.statsCompareChartView, 'weekly');

    const csv = rt.buildStatsComparePeriodsCsvRows(COKE_ID);
    assert.ok(csv.length > 1);
    assert.ok(csv[0].includes('Metric'));
    assert.ok(csv[0].includes('Status'));
    const joined = csv.map(r => r.join(',')).join('\n');
    assert.match(joined, /Total personal use/);
    assert.match(joined, /Past 3 months vs previous 3 months/);
    assert.match(joined, /Improved|Worsened|No meaningful change/);
});

test('custom period uses previous equal-length window', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    rt.statsCompareCustomStart = '2026-08-01';
    rt.statsCompareCustomEnd = '2026-08-10';
    const pair = rt.resolveComparePeriodPair('custom');
    assert.equal(pair.current.startDate, '2026-08-01');
    assert.equal(pair.current.endDate, '2026-08-10');
    assert.equal(pair.current.daysInRange, 10);
    assert.equal(pair.previous.endDate, '2026-07-31');
    assert.equal(pair.previous.startDate, '2026-07-22');
    assert.equal(pair.previous.daysInRange, 10);
});

test('higher time between purchases is Improved', () => {
    const deltaUp = loadRecoveryTrackerApp().computeCompareDelta(10, 4, { higherIsBetter: true });
    assert.equal(deltaUp.status, 'Improved');
    const deltaDown = loadRecoveryTrackerApp().computeCompareDelta(2, 8, { higherIsBetter: true });
    assert.equal(deltaDown.status, 'Worsened');
    const flat = loadRecoveryTrackerApp().computeCompareDelta(5, 5, { higherIsBetter: false });
    assert.equal(flat.status, 'No meaningful change');
});
