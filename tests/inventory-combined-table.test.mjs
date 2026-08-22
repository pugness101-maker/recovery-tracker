import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';
const REFERENCE_DATE = '2026-07-28';

function makePurchase(id, overrides = {}) {
    return {
        id,
        substanceId: COKE_ID,
        date: '2026-07-28',
        time: '12:00',
        quantityBought: 3.5,
        quantity: 3.5,
        unit: 'g',
        totalCost: 150,
        remainingAmount: 3.5,
        isDepleted: false,
        inventoryStatus: 'active',
        store: `Store ${id}`,
        paymentMethod: 'Cash',
        notes: '',
        ...overrides
    };
}

function makeData(purchases, settings = {}) {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            active: true,
            isMain: true,
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs: [],
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            calendarView: { weekStarts: 'sunday' },
            ...settings
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true }
    };
}

const SAMPLE = [
    makePurchase('active-today', { remainingAmount: 2, inventoryStatus: 'active' }),
    makePurchase('week-buy', { date: '2026-07-26', remainingAmount: 1, inventoryStatus: 'active' }),
    makePurchase('old-depleted', {
        date: '2026-07-01',
        remainingAmount: 0,
        isDepleted: true,
        inventoryStatus: 'depleted'
    }),
    makePurchase('gifted', {
        date: '2026-07-20',
        remainingAmount: 0,
        isDepleted: true,
        inventoryStatus: 'gifted',
        acquisitionType: 'purchased_as_gift',
        giftRecipient: 'Sam'
    }),
    makePurchase('hidden', {
        date: '2026-07-15',
        remainingAmount: 1,
        inventoryHidden: true
    })
];

function setup(purchases = SAMPLE, settings = {}) {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeData(purchases, settings));
    rt.__setTestAppData(data);
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.inventoryListFilters.substanceId = COKE_ID;
    rt.inventoryListFilters.datePreset = 'all';
    rt.inventoryListFilters.dateStart = '';
    rt.inventoryListFilters.dateEnd = '';
    rt.inventoryTabFilterRef.value = 'all';
    rt.inventorySearchQueryRef.value = '';
    return rt;
}

test('Inventory markup is one table with date shortcuts and no payment UI', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /data-inv-view=/);
    assert.doesNotMatch(html, /setLayoutInventoryView\('active'\)/);
    assert.match(html, /data-inv-date="today"/);
    assert.match(html, /data-inv-date="week"/);
    assert.match(html, /data-inv-date="month"/);
    assert.match(html, /data-inv-date="last-7"/);
    assert.match(html, /data-inv-date="last-30"/);
    assert.match(html, /data-inv-date="all"/);
    assert.match(html, /data-inv-date="custom"/);
    assert.match(html, />Last 7 Days</);
    assert.match(html, />Last 30 Days</);
    assert.match(html, />All Time</);
    assert.match(html, />Custom Range</);
    assert.match(html, /id="inventory-filter-date-start"/);
    assert.match(html, /id="inventory-filter-date-end"/);
    assert.match(html, /<option value="history">History<\/option>/);
    assert.equal((html.match(/openLayoutAddPurchase\(\)/g) || []).length, 1);
    assert.equal((html.match(/id="buy-form"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="buy-payment-group"/);
    assert.doesNotMatch(html, /id="inventory-filter-payment"/);
    assert.doesNotMatch(html, /Payment Method/);
    assert.doesNotMatch(html, /inventory-filter-vape-only/);
    assert.doesNotMatch(html, />Vape only</);
    assert.match(html, /Quantity Bought/);
    assert.match(html, /Quantity Remaining/);
    assert.match(html, /Total Cost/);
    assert.match(html, /Cost Per Unit/);
    assert.match(html, /id="inventory-filter-acquisition"/);
    assert.match(html, />Purchased</);
    assert.match(html, />Gift Received</);
    assert.match(html, />Purchased as Gift</);
    assert.match(html, />Adjustment</);
    assert.match(html, /id="inventory-filter-total-cost-min"/);
    assert.match(html, /id="inventory-filter-qty-bought-min"/);
    assert.match(html, /id="inventory-filter-qty-remaining-min"/);
    assert.match(html, /id="inventory-filter-amount-used-min"/);
    assert.match(html, /id="inventory-filter-pct-used-min"/);
    assert.match(html, /id="inventory-filter-cost-per-unit-min"/);
    assert.match(html, /id="inventory-filter-purchase-min"/);
    assert.match(html, /Clear Filters/);
});

test('Combined inventory table includes active, depleted, gifted, hidden, and historical rows', () => {
    const rt = setup();
    const rows = rt.getInventoryFilteredPurchases(COKE_ID);
    const ids = rows.map(p => String(p.id)).sort();
    assert.equal(ids.join(','), 'active-today,gifted,hidden,old-depleted,week-buy');
    assert.equal(rt.getPurchaseHistoryVisibleColumns(COKE_ID).includes('payment'), false);

    rt.inventoryTabFilterRef.value = 'history';
    const history = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.equal(history.join(','), 'gifted,hidden,old-depleted');
});

test('Inventory date shortcuts use local dates and week-start preference', () => {
    const rt = setup();

    rt.setInventoryDateFilter('today');
    let bounds = rt.getInventoryDateFilterBounds();
    assert.equal(bounds.startDate, REFERENCE_DATE);
    assert.equal(bounds.endDate, REFERENCE_DATE);
    assert.equal(rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).join(','), 'active-today');

    rt.setInventoryDateFilter('week');
    bounds = rt.getInventoryDateFilterBounds();
    assert.equal(bounds.startDate, '2026-07-26');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    const weekIds = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.equal(weekIds.join(','), 'active-today,week-buy');

    rt.setInventoryDateFilter('month');
    assert.ok(rt.getInventoryFilteredPurchases(COKE_ID).some(p => p.id === 'old-depleted'));

    rt.setInventoryDateFilter('last-7');
    bounds = rt.getInventoryDateFilterBounds();
    assert.equal(bounds.startDate, '2026-07-22');
    assert.equal(bounds.endDate, REFERENCE_DATE);
    assert.ok(!rt.getInventoryFilteredPurchases(COKE_ID).some(p => p.id === 'old-depleted'));

    rt.setInventoryDateFilter('last-30');
    bounds = rt.getInventoryDateFilterBounds();
    assert.equal(bounds.startDate, '2026-06-29');
    assert.ok(rt.getInventoryFilteredPurchases(COKE_ID).some(p => p.id === 'old-depleted'));

    rt.setInventoryDateFilter('custom');
    rt.inventoryListFilters.dateStart = '2026-07-15';
    rt.inventoryListFilters.dateEnd = '2026-07-20';
    const customIds = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.equal(customIds.join(','), 'gifted,hidden');

    const monday = setup(SAMPLE, { calendarView: { weekStarts: 'monday' } });
    monday.setInventoryDateFilter('week');
    const mondayBounds = monday.getInventoryDateFilterBounds();
    assert.equal(mondayBounds.startDate, '2026-07-27');
    assert.equal(mondayBounds.endDate, REFERENCE_DATE);
});

test('Legacy paymentMethod records still load and save after the field is removed', () => {
    const rt = setup();
    const original = rt.__getTestAppData().purchases.find(p => p.id === 'active-today');
    assert.equal(original.paymentMethod, 'Cash');
    rt.saveData(rt.__getTestAppData());
    const reloaded = rt.normalizeAppDataSafe(JSON.parse(rt.__getStorageSnapshot()));
    assert.equal(reloaded.purchases.find(p => p.id === 'active-today').paymentMethod, 'Cash');
    assert.equal(reloaded.purchases.length, SAMPLE.length);
    assert.doesNotMatch(JSON.stringify(rt.getPurchaseHistoryVisibleColumns(COKE_ID)), /payment/);
});

test('Inventory search, status, and remaining filters still combine with date shortcuts', () => {
    const rt = setup();
    rt.setInventoryDateFilter('last-30');
    rt.inventorySearchQueryRef.value = 'Store week-buy';
    const searched = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.equal(searched.length, 1);
    assert.equal(searched[0].id, 'week-buy');

    rt.inventorySearchQueryRef.value = '';
    rt.inventoryTabFilterRef.value = 'active';
    const active = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.equal(active.join(','), 'active-today,week-buy');
});

test('Inventory numeric and acquisition filters combine and accept zero values', () => {
    const extra = [
        makePurchase('cheap-zero', {
            date: '2026-07-28',
            quantityBought: 0,
            quantity: 0,
            totalCost: 0,
            remainingAmount: 0,
            costPerUnit: 0,
            inventoryStatus: 'depleted',
            isDepleted: true
        }),
        makePurchase('gift-received', {
            date: '2026-07-21',
            quantityBought: 2,
            quantity: 2,
            totalCost: 0,
            remainingAmount: 2,
            costPerUnit: 0,
            acquisitionType: 'gift_received'
        }),
        makePurchase('adjustment', {
            date: '2026-07-22',
            quantityBought: 1,
            quantity: 1,
            totalCost: 0,
            remainingAmount: 1,
            acquisitionType: 'other_adjustment'
        })
    ];
    const rt = setup([...SAMPLE, ...extra]);
    const forceRemaining = (id, remaining) => {
        const purchase = rt.__getTestAppData().purchases.find(p => String(p.id) === id);
        assert.ok(purchase, id);
        purchase.remainingAmount = remaining;
        purchase.quantityBought = purchase.quantityBought ?? purchase.quantity;
    };
    forceRemaining('active-today', 2);
    forceRemaining('week-buy', 1);
    forceRemaining('old-depleted', 0);
    forceRemaining('gifted', 0);
    forceRemaining('cheap-zero', 0);
    forceRemaining('gift-received', 2);

    rt.inventoryListFilters.totalCostMin = '150';
    rt.inventoryListFilters.totalCostMax = '150';
    const byCost = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.ok(byCost.length >= 1);
    assert.ok(byCost.every(p => Number(rt.getPurchaseFilterTotalCost(p)) === 150));

    rt.inventoryListFilters.totalCostMin = '';
    rt.inventoryListFilters.totalCostMax = '';
    rt.inventoryListFilters.qtyBoughtMin = '0';
    rt.inventoryListFilters.qtyBoughtMax = '0';
    const zeroBought = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.equal(zeroBought.length, 1);
    assert.equal(String(zeroBought[0].id), 'cheap-zero');

    rt.inventoryListFilters.qtyBoughtMin = '';
    rt.inventoryListFilters.qtyBoughtMax = '';
    rt.inventoryListFilters.qtyRemainingMin = '2';
    const remaining = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.ok(remaining.some(p => String(p.id) === 'active-today'));
    assert.ok(remaining.some(p => String(p.id) === 'gift-received'));
    assert.ok(remaining.every(p => rt.getPurchaseFilterQuantityRemaining(p) >= 2));

    rt.inventoryListFilters.qtyRemainingMin = '';
    rt.inventoryListFilters.amountUsedMin = '1.5';
    const used = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.ok(used.some(p => String(p.id) === 'active-today'));
    assert.ok(used.every(p => rt.getPurchaseFilterAmountUsed(p) >= 1.5));

    rt.inventoryListFilters.amountUsedMin = '';
    rt.inventoryListFilters.pctUsedMin = '100';
    const fullyUsed = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.ok(fullyUsed.every(p => rt.getPurchaseFilterPercentUsed(p) >= 100));
    assert.ok(fullyUsed.some(p => String(p.id) === 'old-depleted'));

    rt.inventoryListFilters.pctUsedMin = '';
    rt.inventoryListFilters.costPerUnitMin = '0';
    rt.inventoryListFilters.costPerUnitMax = '0';
    const zeroCpu = rt.getInventoryFilteredPurchases(COKE_ID);
    assert.ok(zeroCpu.some(p => String(p.id) === 'cheap-zero'));

    rt.inventoryListFilters.costPerUnitMin = '';
    rt.inventoryListFilters.costPerUnitMax = '';
    rt.inventoryListFilters.acquisitionType = 'purchased_as_gift';
    assert.equal(rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).join(','), 'gifted');

    rt.inventoryListFilters.acquisitionType = 'gift_received';
    assert.equal(rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).join(','), 'gift-received');

    rt.inventoryListFilters.acquisitionType = 'other_adjustment';
    assert.equal(rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).join(','), 'adjustment');

    rt.inventoryListFilters.acquisitionType = 'purchased';
    rt.inventoryListFilters.purchaseDateMin = '2026-07-26';
    rt.inventoryListFilters.purchaseDateMax = '2026-07-28';
    const purchasedRecent = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.ok(purchasedRecent.includes('active-today'));
    assert.ok(purchasedRecent.includes('week-buy'));
    assert.ok(!purchasedRecent.includes('gifted'));

    rt.setInventoryDateFilter('today');
    const combined = rt.getInventoryFilteredPurchases(COKE_ID).map(p => String(p.id)).sort();
    assert.ok(combined.includes('active-today'));
    assert.ok(!combined.includes('week-buy'));

    rt.clearInventoryFilters();
    assert.equal(rt.inventoryListFilters.acquisitionType, '');
    assert.equal(rt.inventoryListFilters.totalCostMin, '');
    assert.equal(rt.inventoryListFilters.purchaseDateMin, '');
    assert.ok(rt.getInventoryFilteredPurchases(COKE_ID).length >= SAMPLE.length);
});

test('Legacy vapeOnly saved filters load without applying the removed option', () => {
    const rt = loadRecoveryTrackerApp({
        localStorage: {
            'recoveryTracker.inventoryFilters.v2': JSON.stringify({
                status: 'all',
                search: '',
                datePreset: 'all',
                vapeOnly: true,
                hasRemaining: '',
                hasCost: ''
            })
        }
    });
    const data = rt.normalizeAppDataSafe(makeData([
        makePurchase('powder', { remainingAmount: 2 }),
        makePurchase('vape-item', {
            substanceId: 'nicotine',
            nicotineProductType: 'vape',
            unit: 'puffs',
            quantityBought: 400,
            remainingAmount: 200
        })
    ]));
    rt.__setTestAppData(data);
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.setSelectedSubstanceId(rt.DASHBOARD_ALL, { refresh: false });
    rt.inventoryListFilters.substanceId = '';
    rt.inventoryListFilters.datePreset = 'all';
    rt.loadInventoryFiltersPanelState();
    assert.equal(rt.inventoryListFilters.vapeOnly, undefined);
    const ids = rt.getInventoryFilteredPurchases('').map(p => String(p.id)).sort();
    assert.ok(ids.includes('powder'));
    assert.ok(ids.includes('vape-item'));
});
