import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const ALCOHOL_ID = 'alcohol';

function makeAlcoholData({ purchases = [], logs = [] } = {}) {
    return {
        substances: [{
            id: ALCOHOL_ID,
            name: 'Alcohol',
            icon: '🍺',
            color: '#ffb74d',
            trackingMode: 'alcohol',
            primaryUnit: 'drinks',
            units: ['drinks', 'shots', 'beers', 'glasses of wine', 'ounces', 'milliliters', 'custom'],
            defaultUnit: 'drinks',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    return rt;
}

function makeMultiDayParent(overrides = {}) {
    return {
        id: 'alcohol-parent-1',
        type: 'quick',
        transactionType: 'use',
        substanceId: ALCOHOL_ID,
        trackingMode: 'alcohol',
        logMode: 'alcohol_multiday',
        isMultiDay: true,
        excludeFromStats: true,
        startDate: '2026-07-25',
        startTime: '18:00',
        endDate: '2026-07-27',
        endTime: '23:00',
        date: '2026-07-25',
        totalAmount: 12,
        amount: 12,
        unit: 'drinks',
        splitEvenlyAcrossDays: true,
        dailyBreakdown: [
            { date: '2026-07-25', amount: 4 },
            { date: '2026-07-26', amount: 4 },
            { date: '2026-07-27', amount: 4 }
        ],
        startedAt: '2026-07-25T23:00:00.000Z',
        endedAt: '2026-07-28T04:00:00.000Z',
        durationMs: 5 * 3600000,
        inventoryAffects: false,
        ...overrides
    };
}

function commitAlcoholMultiDay(rt, parent, data) {
    data.logs = data.logs || [];
    rt.finalizeAlcoholUseLogForSave(parent, null, null, data);
    data.logs.push(parent);
    rt.syncDistributedAlcoholEntries(parent, data);
    rt.saveData(data);
}

test('even split over multiple days creates linked daily child entries', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent();
    commitAlcoholMultiDay(rt, parent, data);

    const children = rt.getDistributedChildrenForMultiDayLog(parent.id, data);
    assert.equal(children.length, 3);
    assert.equal(children[0].amount, 4);
    assert.equal(children[1].amount, 4);
    assert.equal(children[2].amount, 4);
    assert.ok(children.every(c => c.isDistributedChild && c.parentLogId === parent.id));
    assert.match(rt.formatAlcoholUseSummary(parent), /Jul 25.*Jul 27.*12 drinks total/);
});

test('manual daily breakdown validates totals and attributes per day', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({
        id: 'alcohol-manual-1',
        splitEvenlyAcrossDays: false,
        dailyBreakdown: [
            { date: '2026-07-25', amount: 3 },
            { date: '2026-07-26', amount: 5 },
            { date: '2026-07-27', amount: 4 }
        ]
    });
    commitAlcoholMultiDay(rt, parent, data);

    const children = rt.getDistributedChildrenForMultiDayLog(parent.id, data);
    assert.deepEqual(children.map(c => c.amount), [3, 5, 4]);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-25', data), 3);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-26', data), 5);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-27', data), 4);
});

test('range crossing two months attributes usage to each month', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({
        id: 'alcohol-cross-month',
        startDate: '2026-07-30',
        endDate: '2026-08-02',
        date: '2026-07-30',
        totalAmount: 8,
        amount: 8,
        dailyBreakdown: [
            { date: '2026-07-30', amount: 2 },
            { date: '2026-07-31', amount: 2 },
            { date: '2026-08-01', amount: 2 },
            { date: '2026-08-02', amount: 2 }
        ]
    });
    commitAlcoholMultiDay(rt, parent, data);

    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-31', data), 2);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-08-01', data), 2);
    const julyTotal = rt.getStatsUsageInRange(ALCOHOL_ID, '2026-07-01', '2026-07-31', data);
    const augTotal = rt.getStatsUsageInRange(ALCOHOL_ID, '2026-08-01', '2026-08-31', data);
    assert.equal(julyTotal, 4);
    assert.equal(augTotal, 4);
});

test('editing a multi-day entry removes and regenerates daily child entries', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({ id: 'alcohol-edit-1' });
    commitAlcoholMultiDay(rt, parent, data);
    assert.equal(rt.getDistributedChildrenForMultiDayLog(parent.id, data).length, 3);

    parent.totalAmount = 9;
    parent.amount = 9;
    parent.dailyBreakdown = [
        { date: '2026-07-25', amount: 3 },
        { date: '2026-07-26', amount: 3 },
        { date: '2026-07-27', amount: 3 }
    ];
    rt.removeDistributedMultiDayEntries(parent.id, data);
    rt.syncDistributedAlcoholEntries(parent, data);
    rt.saveData(data);

    const children = rt.getDistributedChildrenForMultiDayLog(parent.id, data);
    assert.equal(children.length, 3);
    assert.deepEqual(children.map(c => c.amount), [3, 3, 3]);
});

test('deleting parent removes all linked child entries', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({ id: 'alcohol-delete-1' });
    commitAlcoholMultiDay(rt, parent, data);
    assert.equal(data.logs.length, 4);

    rt.removeDistributedMultiDayEntries(parent.id, data);
    data.logs = data.logs.filter(l => l.id !== parent.id);
    rt.saveData(data);

    assert.equal(data.logs.length, 0);
    assert.equal(rt.getDistributedChildrenForMultiDayLog(parent.id, data).length, 0);
});

test('insights do not double-count parent and child entries', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({ id: 'alcohol-nodup-1' });
    commitAlcoholMultiDay(rt, parent, data);

    const rangeTotal = rt.getStatsUsageInRange(ALCOHOL_ID, '2026-07-25', '2026-07-27', data);
    assert.equal(rangeTotal, 12);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-25', data), 4);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-26', data), 4);
    assert.equal(rt.getStatsUsageOnDate(ALCOHOL_ID, '2026-07-27', data), 4);
});

test('multi-day alcohol logs persist through storage reload and json export', () => {
    const data = makeAlcoholData();
    const rt = setup(data);
    const parent = makeMultiDayParent({
        id: 'alcohol-persist-1',
        transactionType: 'shared_use',
        personalAmount: 8,
        sharedAmount: 4,
        sharedWithName: 'Sam',
        totalAmount: 12,
        amount: 12
    });
    rt.finalizeAlcoholUseLogForSave(parent, null, {
        total: 12,
        personal: 8,
        other: 4,
        sharedWithName: 'Sam'
    }, data);
    data.logs.push(parent);
    rt.syncDistributedAlcoholEntries(parent, data);
    rt.saveData(data);

    const reloaded = rt.__reloadTestAppDataFromStorage();
    const savedParent = reloaded.logs.find(l => l.id === 'alcohol-persist-1');
    const savedChildren = rt.getDistributedChildrenForMultiDayLog('alcohol-persist-1', reloaded);
    assert.equal(savedParent.totalAmount, 12);
    assert.equal(savedParent.sharedWithName, 'Sam');
    assert.equal(savedChildren.length, 3);

    const exported = rt.cleanExportData(reloaded).logs.find(l => l.id === 'alcohol-persist-1');
    assert.equal(exported.isMultiDay, true);
    assert.equal(exported.totalAmount, 12);
    assert.equal(exported.sharedWithName, 'Sam');
    assert.deepEqual(exported.dailyBreakdown.map(d => d.amount), [4, 4, 4]);
});
