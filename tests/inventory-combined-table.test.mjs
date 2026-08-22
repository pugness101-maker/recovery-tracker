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
