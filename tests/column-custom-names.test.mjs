import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeData() {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [{
            id: 'log-1',
            substanceId: COKE_ID,
            date: '2026-08-01',
            time: '12:00',
            amount: 1,
            transactionType: 'use',
            type: 'quick'
        }],
        purchases: [{
            id: 'p1',
            substanceId: COKE_ID,
            date: '2026-08-01',
            time: '12:00',
            quantityBought: 3.5,
            quantity: 3.5,
            unit: 'g',
            totalCost: 140,
            remainingAmount: 2.5
        }],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            useCustomNamesInCsvExport: false
        },
        taperPlans: {},
        taperPlansV2: [{
            id: 'taper-1',
            substanceId: COKE_ID,
            name: 'Coke taper',
            status: 'active',
            reductionType: 'reduce-amount',
            startDate: '2026-08-01',
            endDate: '2026-08-28',
            weeklyTargets: [
                { week: 1, weekStart: '2026-08-01', weekEnd: '2026-08-07', weeklyMax: 7, dailyTarget: 1 }
            ],
            isPrimary: true
        }],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, taperPlansV2: true }
    };
}

function setup() {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(makeData());
    rt.currentSubstanceId = COKE_ID;
    return rt;
}

test('sanitizeCustomColumnName trims, collapses spaces, rejects blank, and limits length', () => {
    const rt = setup();
    assert.equal(rt.sanitizeCustomColumnName('  Monthly   Running  '), 'Monthly Running');
    assert.equal(rt.sanitizeCustomColumnName('   '), '');
    assert.equal(rt.sanitizeCustomColumnName(null), '');
    const long = 'x'.repeat(60);
    assert.equal(rt.sanitizeCustomColumnName(long).length, rt.COLUMN_CUSTOM_NAME_MAX_LENGTH);
});

test('rename changes display label but keeps internal key and default label', () => {
    const rt = setup();
    const variant = null;
    const base = rt.getTableColumnConfig('statsWeekly', variant);
    rt.saveTableColumnConfig('statsWeekly', {
        ...base,
        customNames: { monthRunning: 'My Month Total' }
    }, variant);

    assert.equal(
        rt.resolveColumnDisplayLabel('statsWeekly', 'monthRunning', { substanceId: COKE_ID }),
        'My Month Total'
    );
    assert.equal(
        rt.getDefaultColumnLabel('statsWeekly', 'monthRunning', { substanceId: COKE_ID }),
        'Monthly Running Total'
    );
    assert.ok(rt.getEffectiveColumnOrder('statsWeekly').includes('monthRunning'));
});

test('reorder hide resize and rename work together', () => {
    const rt = setup();
    const config = rt.getTableColumnConfig('buyWeekly');
    const order = [...config.order];
    const moved = order[0];
    order.push(order.shift());
    rt.saveTableColumnConfig('buyWeekly', {
        order,
        visible: { ...config.visible, store: false, payment: true },
        widths: { ...config.widths, purchased: 155 },
        customNames: { purchased: 'Bought Amt', cost: 'Cash Out' }
    });

    const next = rt.getTableColumnConfig('buyWeekly');
    assert.equal(next.order[next.order.length - 1], moved);
    assert.equal(next.visible.store, false);
    assert.equal(next.visible.payment, true);
    assert.equal(next.widths.purchased, 155);
    assert.equal(rt.resolveColumnDisplayLabel('buyWeekly', 'purchased', { substanceId: COKE_ID }), 'Bought Amt');
    assert.equal(rt.resolveColumnDisplayLabel('buyWeekly', 'cost', { substanceId: COKE_ID }), 'Cash Out');
    assert.ok(!rt.getEffectiveColumnOrder('buyWeekly').includes('store'));
    assert.ok(rt.getEffectiveColumnOrder('buyWeekly').includes('payment'));
});

test('reset name and reset all names restore defaults', () => {
    const rt = setup();
    const taperKey = rt.getTaperByWeekColumnVariantKey(COKE_ID, rt.__getTestAppData().taperPlansV2[0]);
    const cfg = rt.getTableColumnConfig('taperByWeek', taperKey);
    rt.saveTableColumnConfig('taperByWeek', {
        ...cfg,
        customNames: { status: 'Health', difference: 'Delta', bought: 'Grabbed' }
    }, taperKey);

    assert.equal(
        rt.resolveColumnDisplayLabel('taperByWeek', 'status', {
            substanceId: COKE_ID,
            plan: rt.__getTestAppData().taperPlansV2[0],
            variantKey: taperKey
        }),
        'Health'
    );

    // Reset all names via config clear (modal Reset all names → empty inputs → apply)
    rt.saveTableColumnConfig('taperByWeek', {
        ...rt.getTableColumnConfig('taperByWeek', taperKey),
        customNames: {}
    }, taperKey);
    assert.equal(
        rt.resolveColumnDisplayLabel('taperByWeek', 'status', {
            substanceId: COKE_ID,
            plan: rt.__getTestAppData().taperPlansV2[0],
            variantKey: taperKey
        }),
        rt.getDefaultColumnLabel('taperByWeek', 'status', {
            substanceId: COKE_ID,
            plan: rt.__getTestAppData().taperPlansV2[0]
        })
    );
});

test('Reset to default restores visibility order width and names', () => {
    const rt = setup();
    const base = rt.getTableColumnConfig('purchaseHistory');
    rt.saveTableColumnConfig('purchaseHistory', {
        order: ['select', 'cost', 'date', 'bought', 'actions', ...base.order.filter(id => !['select', 'cost', 'date', 'bought', 'actions'].includes(id))],
        visible: { ...base.visible, notes: false, store: true },
        widths: { ...base.widths, cost: 222 },
        customNames: { cost: 'Price Tag' }
    });
    rt.resetTableColumnConfig('purchaseHistory');
    const reset = rt.getTableColumnConfig('purchaseHistory');
    const defaults = rt.getDefaultColumnSettings('purchaseHistory');
    assert.equal(reset.order.slice(0, 4).join(','), defaults.order.slice(0, 4).join(','));
    assert.equal(Object.keys(reset.customNames || {}).length, 0);
    assert.equal(rt.resolveColumnDisplayLabel('purchaseHistory', 'cost'), 'Cost');
});

test('custom names persist after refresh for table and substance family', () => {
    const rt = setup();
    const useVariant = rt.getUseHistoryColumnVariantKey(COKE_ID);
    const cfg = rt.getTableColumnConfig('useHistory', useVariant);
    rt.saveTableColumnConfig('useHistory', {
        ...cfg,
        customNames: { amount: 'Dose', gPerHour: 'Burn Rate' }
    }, useVariant);

    const rt2 = loadRecoveryTrackerApp();
    rt2.__setTestAppData(rt.__getTestAppData());
    // Column settings live in localStorage, not appData — copy via store key.
    const raw = rt.localStorage.getItem(rt.COLUMN_SETTINGS_STORAGE_KEY);
    rt2.localStorage.setItem(rt2.COLUMN_SETTINGS_STORAGE_KEY, raw);

    assert.equal(
        rt2.resolveColumnDisplayLabel('useHistory', 'amount', {
            substanceId: COKE_ID,
            variantKey: useVariant
        }),
        'Dose'
    );
    assert.equal(
        rt2.resolveColumnDisplayLabel('useHistory', 'gPerHour', {
            substanceId: COKE_ID,
            variantKey: useVariant
        }),
        'Burn Rate'
    );
});

test('CSV export uses stable defaults unless custom-names setting is on', () => {
    const rt = setup();
    const buyCfg = rt.getTableColumnConfig('buyWeekly');
    rt.saveTableColumnConfig('buyWeekly', {
        ...buyCfg,
        customNames: { purchased: 'Scooped', cost: 'Dollars Spent' }
    });

    rt.setUseCustomNamesInCsvExport(false);
    let csv = rt.buildBuyWeeklySummaryCsvRows(COKE_ID);
    assert.ok(csv[0].includes('Purchased'));
    assert.ok(!csv[0].includes('Scooped'));

    rt.setUseCustomNamesInCsvExport(true);
    csv = rt.buildBuyWeeklySummaryCsvRows(COKE_ID);
    assert.ok(csv[0].includes('Scooped'));
    assert.ok(csv[0].includes('Dollars Spent'));
});

test('blank custom name falls back to default label', () => {
    const rt = setup();
    const normalized = rt.normalizeStoredColumnSettings('statsMonthly', {
        order: ['month', 'usage', 'cost'],
        visible: { month: true, usage: true, cost: true },
        widths: {},
        customNames: { usage: '   ', cost: 'Cash Burn' }
    });
    assert.equal(normalized.customNames.usage, undefined);
    assert.equal(normalized.customNames.cost, 'Cash Burn');
    assert.equal(
        rt.resolveColumnDisplayLabel('statsMonthly', 'usage', {
            substanceId: COKE_ID,
            config: normalized
        }),
        'Usage'
    );
});

test('JSON backup includes column custom names and import restores them', () => {
    const rt = setup();
    const cfg = rt.getTableColumnConfig('buyPurchaseDetails');
    rt.saveTableColumnConfig('buyPurchaseDetails', {
        ...cfg,
        customNames: { amount: 'Qty Bought' }
    });
    const ph = rt.getTableColumnConfig('purchaseHistory');
    rt.saveTableColumnConfig('purchaseHistory', {
        ...ph,
        customNames: { remaining: 'Left Over' }
    });

    // Capture store snapshot the way exportJsonBackup does.
    const store = JSON.parse(rt.localStorage.getItem(rt.COLUMN_SETTINGS_STORAGE_KEY));
    const phStore = JSON.parse(rt.localStorage.getItem(rt.PURCHASE_HISTORY_COLUMNS_STORAGE_KEY));
    assert.equal(store.buyPurchaseDetails.customNames.amount, 'Qty Bought');
    assert.equal(phStore.customNames.remaining, 'Left Over');

    const rt2 = loadRecoveryTrackerApp();
    rt2.__setTestAppData(makeData());
    rt2.applyImportedColumnSettings({
        columnSettings: store,
        purchaseHistoryColumns: phStore
    });
    assert.equal(
        rt2.resolveColumnDisplayLabel('buyPurchaseDetails', 'amount', { substanceId: COKE_ID }),
        'Qty Bought'
    );
    assert.equal(rt2.resolveColumnDisplayLabel('purchaseHistory', 'remaining'), 'Left Over');
});
