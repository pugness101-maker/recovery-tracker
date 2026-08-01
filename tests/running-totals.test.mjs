import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
const WEED_ID = 'weed-thc';
const NIC_ID = 'nicotine';
const LSD_ID = 'lsd';
const XANAX_ID = 'xannax';
const REFERENCE_DATE = '2026-08-05';

function makeLog(overrides = {}) {
    return {
        id: overrides.id || `l-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: overrides.substanceId || COKE_ID,
        date: overrides.date || '2026-08-01',
        time: overrides.time || '12:00',
        amount: overrides.amount ?? 0.2,
        personalAmount: overrides.personalAmount,
        sharedAmount: overrides.sharedAmount,
        totalAmount: overrides.totalAmount,
        transactionType: overrides.transactionType || 'use',
        type: overrides.type || 'quick',
        weedProductType: overrides.weedProductType,
        unit: overrides.unit,
        notes: overrides.notes || '',
        ...overrides
    };
}

function setup({ logs = [], purchases = [], settings = {} } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [
            {
                id: COKE_ID,
                name: 'Coke',
                trackingMode: 'powder',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                active: true,
                isMain: true
            },
            {
                id: WEED_ID,
                name: 'Weed/THC',
                trackingMode: 'weed',
                primaryUnit: 'g',
                defaultUnit: 'g',
                costTrackingEnabled: true,
                active: true
            },
            {
                id: NIC_ID,
                name: 'Nicotine',
                trackingMode: 'nicotine',
                primaryUnit: 'puffs',
                defaultUnit: 'puffs',
                costTrackingEnabled: true,
                active: true
            },
            {
                id: LSD_ID,
                name: 'LSD',
                trackingMode: 'lsd',
                primaryUnit: 'µg',
                defaultUnit: 'µg',
                active: true
            },
            {
                id: XANAX_ID,
                name: 'Xanax',
                trackingMode: 'xanax',
                primaryUnit: 'mg',
                defaultUnit: 'mg',
                active: true
            }
        ],
        logs,
        purchases,
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            calendarView: { weekStarts: 'monday' },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true, taperPlansV2: true }
    });
    rt.ensureRunningTotalsPrefs();
    return rt;
}

function rowsFor(rt, filters = {}) {
    const built = rt.buildRunningTotalsRows({
        substanceId: COKE_ID,
        dateRangePreset: 'custom',
        customStart: '2026-08-01',
        customEnd: '2026-08-31',
        personalUseOnly: true,
        includeSharedPersonal: true,
        resetMode: 'daily',
        groupBy: 'session',
        newestFirst: false,
        ...filters
    });
    return built.rows;
}

test('chronological coke example accumulates daily/weekly/monthly running totals', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'a', date: '2026-08-01', time: '09:00', amount: 0.2 }),
            makeLog({ id: 'b', date: '2026-08-01', time: '14:30', amount: 0.15 }),
            makeLog({ id: 'c', date: '2026-08-02', time: '22:00', amount: 0.3 })
        ]
    });

    const rows = rowsFor(rt);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].runningDaily, 0.2);
    assert.equal(rows[0].runningWeekly, 0.2);
    assert.equal(rows[0].runningMonthly, 0.2);
    assert.equal(rows[1].runningDaily, 0.35);
    assert.equal(rows[1].runningWeekly, 0.35);
    assert.equal(rows[1].runningMonthly, 0.35);
    assert.equal(rows[2].runningDaily, 0.3);
    assert.equal(rows[2].runningWeekly, 0.65);
    assert.equal(rows[2].runningMonthly, 0.65);
    assert.equal(rows[2].runningRange, 0.65);
});

test('daily reset clears at local midnight; monthly resets on first of month', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'd1', date: '2026-07-31', time: '20:00', amount: 1 }),
            makeLog({ id: 'd2', date: '2026-08-01', time: '08:00', amount: 0.5 }),
            makeLog({ id: 'd3', date: '2026-08-01', time: '18:00', amount: 0.25 })
        ]
    });

    const rows = rowsFor(rt, {
        customStart: '2026-07-01',
        customEnd: '2026-08-31',
        resetMode: 'daily'
    });
    assert.equal(rows[0].runningDaily, 1);
    assert.equal(rows[0].runningMonthly, 1);
    assert.equal(rows[0].runningReset, 1);
    assert.equal(rows[1].runningDaily, 0.5);
    assert.equal(rows[1].runningMonthly, 0.5);
    assert.equal(rows[1].runningReset, 0.5);
    assert.equal(rows[2].runningDaily, 0.75);
    assert.equal(rows[2].runningMonthly, 0.75);
});

test('Shared Use counts only personal portion; gifts and adjustments excluded', () => {
    const rt = setup({
        logs: [
            makeLog({
                id: 's1',
                date: '2026-08-01',
                time: '10:00',
                amount: 1,
                totalAmount: 1,
                personalAmount: 0.4,
                sharedAmount: 0.6,
                transactionType: 'shared_use'
            }),
            makeLog({
                id: 'g1',
                date: '2026-08-01',
                time: '11:00',
                amount: 2,
                transactionType: 'gift_given'
            }),
            makeLog({
                id: 'adj',
                date: '2026-08-01',
                time: '12:00',
                amount: 3,
                transactionType: 'inventory_adjustment'
            }),
            makeLog({ id: 'u1', date: '2026-08-01', time: '13:00', amount: 0.1 })
        ]
    });

    assert.equal(rt.isRunningTotalsEligibleLog({ transactionType: 'gift_given' }), false);
    assert.equal(rt.isRunningTotalsEligibleLog({ transactionType: 'inventory_adjustment' }), false);
    assert.equal(rt.isRunningTotalsEligibleLog({
        transactionType: 'shared_use',
        amount: 1
    }, { personalUseOnly: true, includeSharedPersonal: true }), true);

    const rows = rowsFor(rt);
    assert.equal(rows.length, 2);
    assert.ok(rows[0].sessionAmount <= 0.4 + 1e-9);
    assert.equal(rows[1].runningDaily, rtRoundSum(rows[0].accumulateAmount, 0.1));
});

function rtRoundSum(a, b) {
    return Math.round((a + b) * 10000) / 10000;
}

test('editing or deleting a session recalculates later running totals', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'e1', date: '2026-08-01', time: '09:00', amount: 0.2 }),
            makeLog({ id: 'e2', date: '2026-08-01', time: '14:00', amount: 0.15 }),
            makeLog({ id: 'e3', date: '2026-08-02', time: '10:00', amount: 0.3 })
        ]
    });

    let rows = rowsFor(rt);
    assert.equal(rows[2].runningWeekly, 0.65);

    const data = rt.appData || rt.__getTestAppData?.();
    // Prefer mutating via exported app data if available
    const appData = typeof rt.getAppData === 'function' ? rt.getAppData() : null;
    const store = appData || (typeof globalThis !== 'undefined' ? null : null);

    // Reload with edited middle session
    const rt2 = setup({
        logs: [
            makeLog({ id: 'e1', date: '2026-08-01', time: '09:00', amount: 0.2 }),
            makeLog({ id: 'e2', date: '2026-08-01', time: '14:00', amount: 0.05 }),
            makeLog({ id: 'e3', date: '2026-08-02', time: '10:00', amount: 0.3 })
        ]
    });
    rows = rowsFor(rt2);
    assert.equal(rows[1].runningDaily, 0.25);
    assert.equal(rows[2].runningWeekly, 0.55);

    const rt3 = setup({
        logs: [
            makeLog({ id: 'e1', date: '2026-08-01', time: '09:00', amount: 0.2 }),
            makeLog({ id: 'e3', date: '2026-08-02', time: '10:00', amount: 0.3 })
        ]
    });
    rows = rowsFor(rt3);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].runningWeekly, 0.5);
});

test('product-specific units for weed, nicotine, LSD, Xanax', () => {
    const rt = setup({
        logs: [
            makeLog({
                id: 'bud',
                substanceId: WEED_ID,
                date: '2026-08-01',
                time: '09:00',
                amount: 0.5,
                unit: 'g',
                weedProductType: 'bud',
                normalizedGrams: 0.5
            }),
            makeLog({
                id: 'cart',
                substanceId: WEED_ID,
                date: '2026-08-01',
                time: '10:00',
                amount: 10,
                weedProductType: 'cart',
                estimatedPercentUsed: 10
            }),
            makeLog({
                id: 'ed',
                substanceId: WEED_ID,
                date: '2026-08-01',
                time: '11:00',
                amount: 2,
                weedProductType: 'edibles',
                edibleCount: 2,
                thcMgUsed: 20,
                cbdMgUsed: 5
            }),
            makeLog({
                id: 'pr',
                substanceId: WEED_ID,
                date: '2026-08-01',
                time: '12:00',
                amount: 1,
                weedProductType: 'pre-rolls',
                normalizedGrams: 0.7
            }),
            makeLog({
                id: 'nic',
                substanceId: NIC_ID,
                date: '2026-08-01',
                time: '13:00',
                amount: 40,
                unit: 'puffs'
            }),
            makeLog({
                id: 'lsd1',
                substanceId: LSD_ID,
                date: '2026-08-01',
                time: '14:00',
                amount: 100,
                tabsUsed: 1,
                ugUsed: 100
            }),
            makeLog({
                id: 'xan',
                substanceId: XANAX_ID,
                date: '2026-08-01',
                time: '15:00',
                amount: 2,
                pillsUsed: 2,
                mgUsed: 1
            })
        ]
    });

    const bud = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: WEED_ID, amount: 0.5, unit: 'g', weedProductType: 'bud', normalizedGrams: 0.5
    }));
    assert.equal(bud.sessionUnit, 'g');
    assert.equal(bud.accumulateUnit, 'g');

    const cart = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: WEED_ID, weedProductType: 'cart', estimatedPercentUsed: 12, amount: 12
    }));
    assert.equal(cart.sessionUnit, '%');
    assert.equal(cart.accumulateAmount, 12);

    const ed = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        amount: 2,
        thcMgUsed: 20,
        cbdMgUsed: 5
    }));
    assert.equal(ed.sessionUnit, 'edible');
    assert.ok(ed.accumulateUnit.includes('THC') || ed.accumulateAmount === 20 || ed.accumulateAmount === 2);

    const nic = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: NIC_ID, amount: 40, unit: 'puffs'
    }));
    assert.equal(nic.sessionUnit, 'puffs');

    const lsd = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: LSD_ID, tabsUsed: 1, ugUsed: 100, amount: 100
    }));
    assert.equal(lsd.accumulateUnit, 'µg');

    const xanax = rt.getRunningTotalsSessionMeasure(makeLog({
        substanceId: XANAX_ID, pillsUsed: 2, mgUsed: 1, amount: 2
    }));
    assert.equal(xanax.sessionUnit, 'pills');
    assert.ok(xanax.accumulateUnit === 'mg' || xanax.accumulateAmount === 1 || xanax.accumulateAmount === 2);

    const dataset = rt.buildRunningTotalsDataset(undefined, {
        filters: {
            substanceId: 'all',
            dateRangePreset: 'custom',
            customStart: '2026-08-01',
            customEnd: '2026-08-31',
            newestFirst: false
        }
    });
    assert.ok(dataset.series.length >= 2);
    assert.equal(dataset.incompatible, true);
});

test('prefs persist reset mode and filters; CSV export includes columns', () => {
    const rt = setup({
        logs: [makeLog({ id: 'p1', amount: 0.2 })]
    });
    rt.persistRunningTotalsPrefs({
        filters: {
            substanceId: COKE_ID,
            resetMode: 'weekly',
            groupBy: 'day',
            personalUseOnly: true
        }
    });
    const prefs = rt.getRunningTotalsPrefs();
    assert.equal(prefs.filters.resetMode, 'weekly');
    assert.equal(prefs.filters.groupBy, 'day');
    assert.ok(rt.RUNNING_TOTALS_RESET_MODES.includes('inventory'));

    const csv = rt.exportRunningTotalsCsv({
        substanceId: COKE_ID,
        dateRangePreset: 'custom',
        customStart: '2026-08-01',
        customEnd: '2026-08-31',
        newestFirst: false
    });
    assert.match(csv, /runningDaily/);
    assert.match(csv, /runningWeekly/);
    assert.match(csv, /0\.2/);
});

test('distributed child logs are not double-counted', () => {
    const rt = setup({
        logs: [
            makeLog({ id: 'parent', date: '2026-08-01', time: '09:00', amount: 0.5, isMultiDay: true }),
            makeLog({
                id: 'child',
                date: '2026-08-01',
                time: '09:00',
                amount: 0.25,
                isDistributedChild: true,
                parentLogId: 'parent'
            })
        ]
    });
    const rows = rowsFor(rt);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'parent');
});

test('reset key helpers cover daily weekly monthly inventory lifetime', () => {
    const rt = setup();
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'daily'), '2026-08-01');
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'monthly'), '2026-08');
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'yearly'), '2026');
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'lifetime'), 'all');
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'selected-range'), 'all');
    assert.equal(rt.getRunningTotalsResetKey('2026-08-01', 'inventory', 'p-1'), 'p-1');
    const weekKey = rt.getRunningTotalsResetKey('2026-08-01', 'weekly');
    assert.ok(weekKey);
});
