import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const SUBSTANCE_ID = 'weed-thc';
const NICOTINE_ID = 'nicotine';

function setup(logs, substances = null) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeTestData(logs, substances));
    return rt;
}

function findWeek(summaries, weekEnd) {
    return summaries.find((row) => row.weekEnd === weekEnd);
}

function makeSharedLog({ id, substanceId, date, total, personal, other }) {
    return {
        id,
        substanceId,
        date,
        time: '12:00',
        amount: total,
        totalAmount: total,
        personalAmount: personal,
        sharedAmount: other,
        transactionType: 'shared_use',
        type: 'quick'
    };
}

function makeGiftLog({ id, substanceId, date, amount }) {
    return {
        id,
        substanceId,
        date,
        time: '12:00',
        amount,
        transactionType: 'gift_given',
        type: 'quick'
    };
}

function makeAdjustmentLog({ id, substanceId, date, amount }) {
    return {
        id,
        substanceId,
        date,
        time: '12:00',
        amount,
        transactionType: 'inventory_adjustment',
        adjustmentDirection: 'remove',
        type: 'quick'
    };
}

test('multiple weeks in one month accumulate month-to-date usage', () => {
    const rt = setup([
        makeUseLog({ id: 'j1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 7 }),
        makeUseLog({ id: 'j2', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 3 }),
        makeUseLog({ id: 'j3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 3 }),
        makeUseLog({ id: 'j4', substanceId: SUBSTANCE_ID, date: '2026-07-28', amount: 0.2 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 7);
    assert.equal(findWeek(summaries, '2026-07-11').runningTotal, 10);
    assert.equal(findWeek(summaries, '2026-07-25').runningTotal, 13);
    assert.equal(findWeek(summaries, '2026-07-31').runningTotal, 13.2);
});

test('custom range spanning multiple months resets monthly running totals', () => {
    const rt = setup([
        makeUseLog({ id: 'm1', substanceId: SUBSTANCE_ID, date: '2026-05-20', amount: 50 }),
        makeUseLog({ id: 'm2', substanceId: SUBSTANCE_ID, date: '2026-06-15', amount: 40 }),
        makeUseLog({ id: 'j1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 7 }),
        makeUseLog({ id: 'j2', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 3 }),
        makeUseLog({ id: 'j3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 3.1 }),
        makeUseLog({ id: 'j4', substanceId: SUBSTANCE_ID, date: '2026-07-27', amount: 1.1 })
    ]);

    const bounds = { startDate: '2026-05-15', endDate: '2026-07-28' };
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, bounds);

    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 7);
    assert.equal(findWeek(summaries, '2026-07-11').runningTotal, 10);
    assert.equal(findWeek(summaries, '2026-07-25').runningTotal, 13.1);
    assert.equal(findWeek(summaries, '2026-07-28').runningTotal, 14.2);

    const juneRow = findWeek(summaries, '2026-06-20') || summaries.find(s => s.weekEnd.startsWith('2026-06'));
    assert.ok(juneRow, 'expected a June weekly row');
    assert.equal(juneRow.runningTotal, 40);

    const mayRow = summaries.find(s => s.weekEnd.startsWith('2026-05'));
    assert.ok(mayRow, 'expected a May weekly row');
    assert.equal(mayRow.runningTotal, 50);
});

test('monthly reset does not carry prior months into custom range rows', () => {
    const rt = setup([
        makeUseLog({ id: 'jun', substanceId: SUBSTANCE_ID, date: '2026-06-10', amount: 100 }),
        makeUseLog({ id: 'jul', substanceId: SUBSTANCE_ID, date: '2026-07-03', amount: 2 })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-06-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 2);
    assert.ok(findWeek(summaries, '2026-07-04').runningTotal < 100);
});

test('month-split week rows only count usage in the ending month', () => {
    const rt = setup([
        makeUseLog({ id: 'jun', substanceId: SUBSTANCE_ID, date: '2026-06-30', amount: 1 }),
        makeUseLog({ id: 'jul', substanceId: SUBSTANCE_ID, date: '2026-07-01', amount: 2 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    const juneRow = findWeek(summaries, '2026-06-30');
    const julyRow = findWeek(summaries, '2026-07-04');

    assert.ok(juneRow, 'expected June month-split row');
    assert.ok(julyRow, 'expected July month-split row');
    assert.equal(juneRow.runningTotal, 1);
    assert.equal(julyRow.runningTotal, 2);
});

test('week crossing month boundary in custom range resets to ending month', () => {
    const rt = setup([
        makeUseLog({ id: 'jun28', substanceId: SUBSTANCE_ID, date: '2026-06-28', amount: 5 }),
        makeUseLog({ id: 'jun30', substanceId: SUBSTANCE_ID, date: '2026-06-30', amount: 1 }),
        makeUseLog({ id: 'jul01', substanceId: SUBSTANCE_ID, date: '2026-07-01', amount: 2 }),
        makeUseLog({ id: 'jul03', substanceId: SUBSTANCE_ID, date: '2026-07-03', amount: 3 })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-06-20',
        endDate: '2026-07-10'
    });
    assert.equal(findWeek(summaries, '2026-06-30').runningTotal, 6);
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 5);
});

test('partial first month in custom range starts from range start, not month start', () => {
    const rt = setup([
        makeUseLog({ id: 'before', substanceId: SUBSTANCE_ID, date: '2026-06-10', amount: 25 }),
        makeUseLog({ id: 'in', substanceId: SUBSTANCE_ID, date: '2026-06-22', amount: 4 }),
        makeUseLog({ id: 'in2', substanceId: SUBSTANCE_ID, date: '2026-06-28', amount: 1 })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-06-20',
        endDate: '2026-06-30'
    });
    const lateJune = findWeek(summaries, '2026-06-30')
        || summaries.find(s => s.weekEnd >= '2026-06-28');
    assert.ok(lateJune);
    assert.equal(lateJune.runningTotal, 5);
});

test('partial final month in custom range caps at range end', () => {
    const rt = setup([
        makeUseLog({ id: 'j1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 7 }),
        makeUseLog({ id: 'j2', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 3 }),
        makeUseLog({ id: 'j3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 3.1 }),
        makeUseLog({ id: 'j4', substanceId: SUBSTANCE_ID, date: '2026-07-27', amount: 1.1 }),
        makeUseLog({ id: 'after', substanceId: SUBSTANCE_ID, date: '2026-07-30', amount: 99 })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-28'
    });
    assert.equal(findWeek(summaries, '2026-07-28').runningTotal, 14.2);
    assert.equal(summaries.some(s => s.weekEnd > '2026-07-28'), false);
});

test('newest-first display with chronological calculation', () => {
    const rt = setup([
        makeUseLog({ id: 'w1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 2 }),
        makeUseLog({ id: 'w2', substanceId: SUBSTANCE_ID, date: '2026-07-09', amount: 3 }),
        makeUseLog({ id: 'w3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 4 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.ok(summaries[0].weekEnd > summaries[1].weekEnd);
    assert.ok(summaries[1].weekEnd > summaries[2].weekEnd);

    const runningByWeekEnd = new Map(summaries.map((row) => [row.weekEnd, row.runningTotal]));
    assert.equal(runningByWeekEnd.get('2026-07-04'), 2);
    assert.equal(runningByWeekEnd.get('2026-07-11'), 5);
    assert.equal(runningByWeekEnd.get('2026-07-25'), 9);
});

test('substance filtering excludes other substances from monthly running totals', () => {
    const rt = setup([
        makeUseLog({ id: 'weed', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 4 }),
        makeUseLog({ id: 'alc', substanceId: 'alcohol', date: '2026-07-02', amount: 99 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 4);
    assert.equal(rt.sumPersonalUseAmountThroughDate('alcohol', '2026-07-04'), 99);
});

test('product-type filtering keeps nicotine vape personal amounts separate from other substances', () => {
    const rt = setup([
        {
            id: 'v1',
            substanceId: NICOTINE_ID,
            date: '2026-07-02',
            time: '12:00',
            amount: 100,
            estimatedPuffsUsed: 100,
            nicotineProductType: 'vape',
            unit: 'puffs',
            transactionType: 'use',
            type: 'quick',
            logMode: 'vape_puffs'
        },
        {
            id: 'c1',
            substanceId: NICOTINE_ID,
            date: '2026-07-03',
            time: '12:00',
            amount: 5,
            nicotineProductType: 'cigarettes',
            unit: 'cigarettes',
            transactionType: 'use',
            type: 'quick'
        },
        makeUseLog({ id: 'weed', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 50 })
    ], [{
        id: NICOTINE_ID,
        name: 'Nicotine',
        icon: '💨',
        color: '#78909c',
        trackingMode: 'nicotine',
        primaryUnit: 'puffs',
        units: ['puffs', 'cigarettes'],
        defaultUnit: 'puffs',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    }, {
        id: SUBSTANCE_ID,
        name: 'Weed/THC',
        icon: '🌿',
        color: '#66bb6a',
        trackingMode: 'weed',
        primaryUnit: 'grams',
        units: ['grams'],
        defaultUnit: 'grams',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    }]);

    const nicotine = rt.getWeeklyTrackingSummaries(NICOTINE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    const weed = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(nicotine, '2026-07-04').runningTotal, 105);
    assert.equal(findWeek(weed, '2026-07-04').runningTotal, 50);
});

test('shared use counts only personal amount in monthly running total', () => {
    const rt = setup([
        makeUseLog({ id: 'p1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 2 }),
        makeSharedLog({
            id: 's1',
            substanceId: SUBSTANCE_ID,
            date: '2026-07-08',
            total: 10,
            personal: 3,
            other: 7
        })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 2);
    assert.equal(findWeek(summaries, '2026-07-11').runningTotal, 5);
});

test('gift and adjustment logs are excluded from monthly running total', () => {
    const rt = setup([
        makeUseLog({ id: 'p1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 4 }),
        makeGiftLog({ id: 'g1', substanceId: SUBSTANCE_ID, date: '2026-07-03', amount: 20 }),
        makeAdjustmentLog({ id: 'a1', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 15 })
    ]);
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, {
        startDate: '2026-07-01',
        endDate: '2026-07-31'
    });
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 4);
    assert.equal(
        summaries.every(row => row.runningTotal === 4 || row.runningTotal === 0),
        true
    );
    assert.equal(summaries.reduce((max, row) => Math.max(max, row.runningTotal), 0), 4);
});

test('CSV export matches weekly table monthly running totals', () => {
    const rt = setup([
        makeUseLog({ id: 'j1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 7 }),
        makeUseLog({ id: 'j2', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 3 }),
        makeUseLog({ id: 'j3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 3.1 }),
        makeUseLog({ id: 'j4', substanceId: SUBSTANCE_ID, date: '2026-07-27', amount: 1.1 }),
        makeUseLog({ id: 'jun', substanceId: SUBSTANCE_ID, date: '2026-06-15', amount: 40 })
    ]);
    const bounds = { startDate: '2026-06-01', endDate: '2026-07-28' };
    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, bounds);
    const csv = rt.buildStatsWeeklySummaryCsvRows(SUBSTANCE_ID, bounds);
    assert.equal(csv[0].join(','), 'Week Start,Week End,Usage,Unit,Monthly Running Total');
    assert.equal(csv.length, summaries.length + 1);
    summaries.forEach((summary, index) => {
        const row = csv[index + 1];
        assert.equal(row[0], summary.weekStart);
        assert.equal(row[1], summary.weekEnd);
        assert.equal(row[2], summary.totalUsage);
        assert.equal(row[4], summary.runningTotal);
    });
    const julyFinal = csv.find(row => row[1] === '2026-07-28');
    assert.ok(julyFinal);
    assert.equal(julyFinal[4], 14.2);
});

test('column label and tooltip describe calendar-month reset', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(
        rt.TABLE_COLUMN_TOOLTIPS.statsWeekly.monthRunning,
        'Cumulative use within the calendar month of this row. Resets on the first day of each month.'
    );
    assert.equal(
        rt.getTableColumnTooltip('statsWeekly', 'monthRunning'),
        'Cumulative use within the calendar month of this row. Resets on the first day of each month.'
    );
});

test('multiple logs on the same day are summed from individual entries', () => {
    const rt = setup([
        makeUseLog({ id: 'a', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 0.1 }),
        makeUseLog({ id: 'b', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 0.2 }),
        makeUseLog({ id: 'c', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 1 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 0.3);
    assert.equal(findWeek(summaries, '2026-07-11').runningTotal, 1.3);
});

test('monthly running total resets at the start of a new calendar month', () => {
    const rt = setup([
        makeUseLog({ id: 'jul', substanceId: SUBSTANCE_ID, date: '2026-07-30', amount: 5 }),
        makeUseLog({ id: 'aug', substanceId: SUBSTANCE_ID, date: '2026-08-02', amount: 1.5 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    assert.equal(findWeek(summaries, '2026-07-31').runningTotal, 5);
    assert.equal(findWeek(summaries, '2026-08-08').runningTotal, 1.5);
});

test('display rounding is not applied to stored running totals', () => {
    const rt = setup([
        makeUseLog({ id: 'j1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 7 }),
        makeUseLog({ id: 'j2', substanceId: SUBSTANCE_ID, date: '2026-07-08', amount: 3 }),
        makeUseLog({ id: 'j3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 3 }),
        makeUseLog({ id: 'j4', substanceId: SUBSTANCE_ID, date: '2026-07-28', amount: 0.2 })
    ]);

    const row = findWeek(rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12), '2026-07-31');
    assert.equal(row.runningTotal, 13.2);
    assert.notEqual(row.runningTotal, 13.5);
    assert.equal(rt.formatAmount(row.runningTotal), '13.2');
});

test('table stays newest-first while cumulative totals follow chronological order', () => {
    const rt = setup([
        makeUseLog({ id: 'w1', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 2 }),
        makeUseLog({ id: 'w2', substanceId: SUBSTANCE_ID, date: '2026-07-09', amount: 3 }),
        makeUseLog({ id: 'w3', substanceId: SUBSTANCE_ID, date: '2026-07-20', amount: 4 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    assert.ok(summaries[0].weekEnd > summaries[1].weekEnd);
    assert.ok(summaries[1].weekEnd > summaries[2].weekEnd);

    const runningByWeekEnd = new Map(summaries.map((row) => [row.weekEnd, row.runningTotal]));
    assert.equal(runningByWeekEnd.get('2026-07-04'), 2);
    assert.equal(runningByWeekEnd.get('2026-07-11'), 5);
    assert.equal(runningByWeekEnd.get('2026-07-25'), 9);
});
