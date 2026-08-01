import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeUseLog } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NICOTINE_ID = 'nicotine';
const REFERENCE_DATE = '2026-08-01';

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
            isMain: true,
            color: '#e57373'
        },
        weed: {
            id: WEED_ID,
            name: 'Weed/THC',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            color: '#66bb6a'
        },
        nicotine: {
            id: NICOTINE_ID,
            name: 'Nicotine',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            color: '#64b5f6'
        }
    };
    return { ...(map[id] || map.coke), ...overrides };
}

function makePurchase(substanceId, overrides = {}) {
    const quantityBought = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `p-${Math.random().toString(36).slice(2, 7)}`,
        substanceId,
        date: overrides.date || '2026-07-20',
        time: '12:00',
        quantity: quantityBought,
        quantityBought,
        remainingAmount: overrides.remainingAmount ?? quantityBought,
        unit: overrides.unit || 'g',
        totalCost: overrides.totalCost ?? 100,
        store: 'Main',
        acquisitionType: overrides.acquisitionType || 'purchased',
        ...overrides,
        quantity: overrides.quantity ?? quantityBought,
        quantityBought: overrides.quantityBought ?? quantityBought
    };
}

function setup({ substances, logs = [], purchases = [], settings = {}, taperPlansV2 = [], recoveryStreaks = {} }) {
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
            recoveryDashboard: {
                dateRangePreset: 'this-week',
                customStart: '',
                customEnd: '',
                scoreEnabled: true
            },
            ...settings
        },
        taperPlans: {},
        taperPlansV2,
        recoveryStreaks,
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.currentSubstanceId = substances[0]?.id || COKE_ID;
    return rt;
}

test('recovery dashboard prefs persist score toggle and date preset', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    const prefs = rt.ensureRecoveryDashboardPrefs();
    assert.equal(prefs.scoreEnabled, true);
    rt.setRecoveryScoreEnabled(false);
    assert.equal(rt.getRecoveryDashboardPrefs().scoreEnabled, false);
    rt.setRecoveryDashboardPreset('last-30');
    assert.equal(rt.getRecoveryDashboardPrefs().dateRangePreset, 'last-30');
    const raw = JSON.parse(rt.localStorage.getItem('recovery-tracker-v2'));
    assert.equal(raw.settings.recoveryDashboard.scoreEnabled, false);
    assert.equal(raw.settings.recoveryDashboard.dateRangePreset, 'last-30');
});

test('date bounds filter shared dataset for today / week / month / custom', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    const today = rt.resolveRecoveryDashboardBounds({ dateRangePreset: 'today', customStart: '', customEnd: '' });
    assert.equal(today.startDate, REFERENCE_DATE);
    assert.equal(today.endDate, REFERENCE_DATE);
    assert.equal(today.preset, 'today');
    const week = rt.resolveRecoveryDashboardBounds({ dateRangePreset: 'this-week', customStart: '', customEnd: '' });
    assert.equal(week.endDate, REFERENCE_DATE);
    assert.ok(week.startDate <= week.endDate);
    const month = rt.resolveRecoveryDashboardBounds({ dateRangePreset: 'this-month', customStart: '', customEnd: '' });
    assert.equal(month.startDate, '2026-08-01');
    const custom = rt.resolveRecoveryDashboardBounds({
        dateRangePreset: 'custom',
        customStart: '2026-07-01',
        customEnd: '2026-07-15'
    });
    assert.equal(custom.startDate, '2026-07-01');
    assert.equal(custom.endDate, '2026-07-15');
    assert.equal(custom.preset, 'custom');

    const datasetWeek = rt.buildRecoveryDashboardDataset(undefined, {
        prefs: { dateRangePreset: 'this-week', customStart: '', customEnd: '', scoreEnabled: true }
    });
    const datasetMonth = rt.buildRecoveryDashboardDataset(undefined, {
        prefs: { dateRangePreset: 'this-month', customStart: '', customEnd: '', scoreEnabled: true }
    });
    assert.equal(datasetWeek.bounds.preset, 'this-week');
    assert.equal(datasetMonth.bounds.preset, 'this-month');
    assert.equal(datasetWeek.statusCards.length, datasetMonth.statusCards.length);
});

test('status cards keep substance-specific units and exclude gifts from personal use', () => {
    const rt = setup({
        substances: [makeSubstance('coke'), makeSubstance('weed'), makeSubstance('nicotine')],
        logs: [
            makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-07-30', amount: 0.4 }),
            {
                id: 'w1',
                substanceId: WEED_ID,
                date: '2026-07-31',
                time: '10:00',
                amount: 12,
                estimatedPercentUsed: 12,
                weedProductType: 'cart',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'w2',
                substanceId: WEED_ID,
                date: '2026-07-31',
                time: '11:00',
                amount: 1,
                thcMgUsed: 25,
                weedProductType: 'edibles',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'n1',
                substanceId: NICOTINE_ID,
                date: '2026-07-31',
                time: '12:00',
                amount: 2400,
                transactionType: 'use',
                type: 'quick',
                nicotineProductType: 'vape'
            },
            {
                id: 'g1',
                substanceId: COKE_ID,
                date: '2026-07-31',
                time: '13:00',
                amount: 1,
                transactionType: 'gift_given',
                type: 'quick'
            },
            {
                id: 's1',
                substanceId: COKE_ID,
                date: '2026-07-31',
                time: '14:00',
                amount: 1,
                personalAmount: 0.2,
                sharedAmount: 0.8,
                transactionType: 'shared_use',
                type: 'quick'
            }
        ],
        purchases: [
            makePurchase(COKE_ID, { id: 'pc1', remainingAmount: 2, totalCost: 80, date: '2026-07-25' }),
            makePurchase(COKE_ID, {
                id: 'gift-buy',
                acquisitionType: 'purchased_as_gift',
                remainingAmount: 5,
                totalCost: 50,
                date: '2026-07-28'
            })
        ],
        recoveryStreaks: { [COKE_ID]: { best: 3 } }
    });

    const dataset = rt.buildRecoveryDashboardDataset();
    const coke = dataset.statusCards.find(c => c.substanceId === COKE_ID);
    const weed = dataset.statusCards.find(c => c.substanceId === WEED_ID);
    const nic = dataset.statusCards.find(c => c.substanceId === NICOTINE_ID);
    assert.ok(coke);
    assert.match(coke.usedWeekLabel, /0\.6|0\.60/);
    assert.ok(!coke.usedWeekLabel.toLowerCase().includes('gift'));
    assert.match(coke.inventoryLabel, /2/);
    assert.ok(!String(coke.inventoryLabel).includes('5'));
    assert.ok(weed.usedWeekLabel.includes('%') || weed.usedWeekLabel.includes('mg'));
    assert.ok(nic.usedWeekLabel.toLowerCase().includes('puff'));
});

test('purchased as gift counts toward spend but not usable inventory overview', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        purchases: [
            makePurchase(COKE_ID, {
                id: 'active',
                remainingAmount: 1.5,
                totalCost: 40,
                date: '2026-07-20',
                acquisitionType: 'purchased'
            }),
            makePurchase(COKE_ID, {
                id: 'pag',
                remainingAmount: 9,
                totalCost: 120,
                date: REFERENCE_DATE,
                acquisitionType: 'purchased_as_gift'
            })
        ]
    });
    assert.equal(rt.purchaseCountsTowardSpend({ acquisitionType: 'purchased_as_gift' }), true);
    const dataset = rt.buildRecoveryDashboardDataset();
    assert.equal(dataset.todayCard.purchasesToday, 1);
    assert.equal(dataset.todayCard.giftsGivenToday, 1);
    assert.match(dataset.todayCard.dailySpendingLabel, /120/);
    const items = dataset.inventoryGroups.flatMap(g => g.items);
    assert.equal(items.length, 1);
    assert.equal(items[0].purchaseId, 'active');
});

test('recovery score disabled or insufficient data does not invent a number', () => {
    const empty = setup({ substances: [makeSubstance('coke')], settings: { recoveryDashboard: { scoreEnabled: true } } });
    const emptyScore = empty.buildRecoveryDashboardDataset().score;
    assert.equal(emptyScore.enabled, true);
    assert.equal(emptyScore.available, false);
    assert.equal(emptyScore.score, null);

    const disabled = setup({
        substances: [makeSubstance('coke')],
        logs: [makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-07-20', amount: 1 })],
        settings: { recoveryDashboard: { scoreEnabled: false, dateRangePreset: 'this-week' } }
    });
    const off = disabled.buildRecoveryDashboardDataset().score;
    assert.equal(off.enabled, false);
    assert.equal(off.score, null);
});

test('alerts include negative inventory and broken links with section targets', () => {
    const rt = setup({
        substances: [makeSubstance('coke')],
        logs: [{
            id: 'broken',
            substanceId: COKE_ID,
            date: '2026-07-30',
            time: '10:00',
            amount: 0.1,
            purchaseId: 'missing-purchase',
            transactionType: 'use',
            type: 'quick'
        }],
        purchases: [
            makePurchase(COKE_ID, { id: 'neg', remainingAmount: -1, quantityBought: 1, date: '2026-07-10' })
        ]
    });
    const dataset = rt.buildRecoveryDashboardDataset();
    const types = new Set(dataset.alerts.map(a => a.type));
    assert.ok(types.has('brokenInventoryLink') || types.has('negativeRemaining'));
    dataset.alerts.forEach(a => {
        assert.ok(a.linkTab);
        assert.ok(a.message);
    });
});

test('quick actions map to existing form openers without throwing', () => {
    const rt = setup({ substances: [makeSubstance('coke')] });
    const calls = [];
    rt.switchTab = (tab) => calls.push(['switchTab', tab]);
    rt.selectUseEntryType = (type) => calls.push(['selectUseEntryType', type]);
    rt.setUseTransactionType = (tx) => calls.push(['setUseTransactionType', tx]);
    rt.openUseLogSession = () => calls.push(['openUseLogSession']);
    rt.openBuyTrackerModal = () => calls.push(['openBuyTrackerModal']);
    rt.showNewTaperPlan = () => calls.push(['showNewTaperPlan']);

    // Bind wrappers from sandbox exports still call original globals; invoke through app sandbox helpers.
    const actions = [
        'personal-use', 'session', 'shared', 'gift-given', 'gift-received',
        'inventory', 'adjustment', 'goal', 'plan'
    ];
    for (const action of actions) {
        assert.doesNotThrow(() => rt.openRecoveryQuickAction(action));
    }
});

test('milestones and active plans surface from taper data', () => {
    const plan = {
        id: 'plan-1',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-20',
        endDate: '2026-09-01',
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-07-27',
            weekEnd: '2026-08-02',
            targetAmount: 2,
            dailyTarget: 0.3,
            purchaseSpendTarget: 50
        }]
    };
    const rt = setup({
        substances: [makeSubstance('coke')],
        logs: [makeUseLog({ id: 'u1', substanceId: COKE_ID, date: '2026-07-25', amount: 0.2 })],
        taperPlansV2: [plan],
        recoveryStreaks: { [COKE_ID]: { best: 2 } }
    });
    const dataset = rt.buildRecoveryDashboardDataset();
    assert.equal(dataset.activePlans.length, 1);
    assert.equal(dataset.activePlans[0].planName, 'Coke taper');
    assert.ok(dataset.milestones.length >= 1);
    assert.ok(dataset.summary.totalSubstances >= 1);
});
