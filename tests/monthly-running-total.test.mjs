import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp, makeTestData, makeUseLog } from './harness.mjs';

const SUBSTANCE_ID = 'weed-thc';

function setup(logs) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeTestData(logs));
    return rt;
}

function findWeek(summaries, weekEnd) {
    return summaries.find((row) => row.weekEnd === weekEnd);
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

test('substance filtering excludes other substances from monthly running totals', () => {
    const rt = setup([
        makeUseLog({ id: 'weed', substanceId: SUBSTANCE_ID, date: '2026-07-02', amount: 4 }),
        makeUseLog({ id: 'alc', substanceId: 'alcohol', date: '2026-07-02', amount: 99 })
    ]);

    const summaries = rt.getWeeklyTrackingSummaries(SUBSTANCE_ID, 12);
    assert.equal(findWeek(summaries, '2026-07-04').runningTotal, 4);
    assert.equal(rt.sumPersonalUseAmountThroughDate('alcohol', '2026-07-04'), 99);
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
