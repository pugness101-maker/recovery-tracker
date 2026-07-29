import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';

function makeSubstance(id) {
    const map = {
        coke: {
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        },
        weed: {
            id: WEED_ID,
            name: 'Weed',
            trackingMode: 'weed',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }
    };
    return map[id] || map.coke;
}

function makeData({ substances, purchases = [] }) {
    return {
        substances,
        logs: [],
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            spreadPercentLeftUsage: true,
            buyMonthRunningMode: 'within-year'
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    };
}

function makeCokePurchase(overrides = {}) {
    const quantityBought = overrides.quantityBought ?? overrides.quantity ?? 3.5;
    return {
        id: overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-07-02',
        time: '12:00',
        quantity: quantityBought,
        quantityBought,
        unit: 'g',
        totalCost: 140,
        store: overrides.store || 'Main',
        paymentMethod: overrides.paymentMethod || 'Cash',
        ...overrides,
        quantity: overrides.quantity ?? quantityBought,
        quantityBought: overrides.quantityBought ?? quantityBought
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

function findWeek(rows, weekEnd) {
    return rows.find(row => row.weekEnd === weekEnd);
}

const julyRunningPurchases = [
    makeCokePurchase({ id: 'j1', date: '2026-07-02', quantityBought: 7, totalCost: 255 }),
    makeCokePurchase({ id: 'j2', date: '2026-07-08', quantityBought: 3.5, totalCost: 125 }),
    makeCokePurchase({ id: 'j3', date: '2026-07-20', quantityBought: 3.3, totalCost: 155 }),
    makeCokePurchase({ id: 'j4', date: '2026-07-27', quantityBought: 3.7, totalCost: 155 })
];

test('multiple purchases across weeks in one month accumulate running bought and cost', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: julyRunningPurchases
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-28'
    });

    assert.equal(findWeek(rows, '2026-07-04').runningAmountBought, 7);
    assert.equal(findWeek(rows, '2026-07-04').runningCostThisMonth, 255);
    assert.equal(findWeek(rows, '2026-07-11').runningAmountBought, 10.5);
    assert.equal(findWeek(rows, '2026-07-11').runningCostThisMonth, 380);
    assert.equal(findWeek(rows, '2026-07-25').runningAmountBought, 13.8);
    assert.equal(findWeek(rows, '2026-07-25').runningCostThisMonth, 535);
    assert.equal(findWeek(rows, '2026-07-28').runningAmountBought, 17.5);
    assert.equal(findWeek(rows, '2026-07-28').runningCostThisMonth, 690);
});

test('monthly reset does not carry prior-month purchases', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'jun', date: '2026-06-15', quantityBought: 100, totalCost: 4000 }),
            makeCokePurchase({ id: 'jul', date: '2026-07-03', quantityBought: 2, totalCost: 80 })
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-06-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(rows, '2026-07-04').runningAmountBought, 2);
    assert.equal(findWeek(rows, '2026-07-04').runningCostThisMonth, 80);
    const juneRow = rows.find(r => r.weekEnd.startsWith('2026-06') && r.purchased > 0);
    assert.ok(juneRow);
    assert.equal(juneRow.runningAmountBought, 100);
});

test('week crossing month boundary only counts ending-month purchases for running values', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'jun28', date: '2026-06-28', quantityBought: 5, totalCost: 200 }),
            makeCokePurchase({ id: 'jun30', date: '2026-06-30', quantityBought: 1, totalCost: 40 }),
            makeCokePurchase({ id: 'jul01', date: '2026-07-01', quantityBought: 2, totalCost: 80 }),
            makeCokePurchase({ id: 'jul03', date: '2026-07-03', quantityBought: 3, totalCost: 120 })
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-06-20',
        endDate: '2026-07-10'
    });
    assert.equal(findWeek(rows, '2026-06-30').runningAmountBought, 6);
    assert.equal(findWeek(rows, '2026-06-30').runningCostThisMonth, 240);
    assert.equal(findWeek(rows, '2026-07-04').runningAmountBought, 5);
    assert.equal(findWeek(rows, '2026-07-04').runningCostThisMonth, 200);
});

test('week with zero purchases keeps prior month-to-date running totals', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'j1', date: '2026-07-02', quantityBought: 7, totalCost: 255 }),
            makeCokePurchase({ id: 'j2', date: '2026-07-08', quantityBought: 3.5, totalCost: 125 }),
            makeCokePurchase({ id: 'j3', date: '2026-07-20', quantityBought: 3.3, totalCost: 155 })
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-25'
    });
    const emptyWeek = findWeek(rows, '2026-07-18');
    assert.ok(emptyWeek, 'expected empty mid-month week row');
    assert.equal(emptyWeek.purchased, 0);
    assert.equal(emptyWeek.cost, 0);
    assert.equal(emptyWeek.purchaseCount, 0);
    assert.equal(emptyWeek.runningAmountBought, 10.5);
    assert.equal(emptyWeek.runningCostThisMonth, 380);
});

test('custom date range clamps running totals to the selected range', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'before', date: '2026-07-02', quantityBought: 7, totalCost: 255 }),
            makeCokePurchase({ id: 'in', date: '2026-07-08', quantityBought: 3.5, totalCost: 125 }),
            makeCokePurchase({ id: 'after', date: '2026-07-27', quantityBought: 3.7, totalCost: 155 })
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-05',
        endDate: '2026-07-18'
    });
    assert.equal(findWeek(rows, '2026-07-11').runningAmountBought, 3.5);
    assert.equal(findWeek(rows, '2026-07-11').runningCostThisMonth, 125);
    assert.equal(rows.some(r => r.weekEnd > '2026-07-18'), false);
});

test('substance filtering excludes other substances', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke'), makeSubstance('weed')],
        purchases: [
            makeCokePurchase({ id: 'c1', date: '2026-07-02', quantityBought: 4, totalCost: 160 }),
            {
                id: 'w1',
                substanceId: WEED_ID,
                date: '2026-07-02',
                time: '12:00',
                quantity: 99,
                quantityBought: 99,
                unit: 'g',
                totalCost: 999,
                store: 'Other'
            }
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(rows, '2026-07-04').runningAmountBought, 4);
    assert.equal(findWeek(rows, '2026-07-04').runningCostThisMonth, 160);
});

test('deleted archived and hidden purchases are excluded', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: [
            makeCokePurchase({ id: 'kept', date: '2026-07-02', quantityBought: 4, totalCost: 160 }),
            makeCokePurchase({
                id: 'archived',
                date: '2026-07-03',
                quantityBought: 50,
                totalCost: 500,
                archivedAt: '2026-07-03T12:00:00.000Z'
            }),
            makeCokePurchase({
                id: 'hidden',
                date: '2026-07-08',
                quantityBought: 40,
                totalCost: 400,
                inventoryHidden: true
            })
        ]
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(rows, '2026-07-04').runningAmountBought, 4);
    assert.equal(findWeek(rows, '2026-07-11').runningAmountBought, 4);
    assert.equal(findWeek(rows, '2026-07-11').runningCostThisMonth, 160);
});

test('newest-first display with chronological calculation', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: julyRunningPurchases
    }));
    const rows = rt.getBuyWeeklySummaries(COKE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-28'
    });
    assert.ok(rows[0].weekEnd >= rows[1].weekEnd);
    const byEnd = new Map(rows.map(r => [r.weekEnd, r.runningAmountBought]));
    assert.equal(byEnd.get('2026-07-04'), 7);
    assert.equal(byEnd.get('2026-07-11'), 10.5);
    assert.equal(byEnd.get('2026-07-25'), 13.8);
    assert.equal(byEnd.get('2026-07-28'), 17.5);
});

test('hidden and restored optional columns persist', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: julyRunningPurchases
    }));
    const defaults = rt.getDefaultColumnSettings('buyWeekly');
    assert.equal(defaults.visible.week, true);
    assert.equal(defaults.visible.purchased, true);
    assert.equal(defaults.visible.cost, true);
    assert.equal(defaults.visible.runningAmountBought, true);
    assert.equal(defaults.visible.store, false);

    rt.saveTableColumnConfig('buyWeekly', {
        order: defaults.order,
        visible: {
            ...defaults.visible,
            runningAmountBought: false,
            runningCostThisMonth: false,
            store: true
        },
        widths: { ...defaults.widths, store: 180 }
    });

    assert.equal(rt.getEffectiveColumnOrder('buyWeekly').includes('runningAmountBought'), false);
    assert.equal(rt.getEffectiveColumnOrder('buyWeekly').includes('store'), true);
    assert.equal(rt.getTableColumnConfig('buyWeekly').widths.store, 180);

    rt.saveTableColumnConfig('buyWeekly', {
        order: defaults.order,
        visible: {
            ...defaults.visible,
            runningAmountBought: true,
            runningCostThisMonth: true,
            store: false
        },
        widths: defaults.widths
    });
    assert.equal(rt.getEffectiveColumnOrder('buyWeekly').includes('runningAmountBought'), true);
    assert.equal(rt.getEffectiveColumnOrder('buyWeekly').includes('store'), false);
});

test('CSV values match the visible weekly table running totals', () => {
    const rt = setup(makeData({
        substances: [makeSubstance('coke')],
        purchases: julyRunningPurchases
    }));
    const bounds = { startDate: '2026-07-01', endDate: '2026-07-28' };
    const rows = rt.getBuyWeeklySummaries(COKE_ID, bounds);
    const csv = rt.buildBuyWeeklySummaryCsvRows(COKE_ID, bounds);
    assert.ok(csv[0].includes('Running Amount Bought'));
    assert.ok(csv[0].includes('Running Cost This Month'));
    assert.equal(csv.length, rows.length + 1);

    const amountIdx = csv[0].indexOf('Running Amount Bought');
    const costIdx = csv[0].indexOf('Running Cost This Month');
    const weekIdx = csv[0].indexOf('Week');
    const final = csv.find(row => String(row[weekIdx]).includes('7/28'));
    assert.ok(final);
    assert.equal(final[amountIdx], 17.5);
    assert.equal(final[costIdx], 690);

    const monthRows = rt.getBuyMonthSummaryRows(COKE_ID, bounds);
    const julyMonth = monthRows.find(r => r.monthKey === '2026-07');
    assert.equal(julyMonth.purchased, 17.5);
    assert.equal(julyMonth.cost, 690);
});

test('column tooltips explain calendar-month reset', () => {
    const rt = loadRecoveryTrackerApp();
    assert.match(
        rt.getTableColumnTooltip('buyWeekly', 'runningAmountBought'),
        /Resets on the first day of each month/
    );
    assert.match(
        rt.getTableColumnTooltip('buyWeekly', 'runningCostThisMonth'),
        /Resets on the first day of each month/
    );
});
