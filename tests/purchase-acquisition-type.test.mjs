import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';

function makeData(purchases = []) {
    return {
        substances: [{
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs: [],
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function makePurchase(overrides = {}) {
    return {
        id: overrides.id || `purchase-${Math.random().toString(36).slice(2, 8)}`,
        substanceId: COKE_ID,
        date: '2026-08-01',
        time: '12:00',
        quantityBought: 3.5,
        quantity: 3.5,
        unit: 'g',
        totalCost: 150,
        costPerUnit: 150 / 3.5,
        remainingAmount: 3.5,
        store: 'Corner',
        paymentMethod: 'Cash',
        notes: '',
        ...overrides
    };
}

test('Add Inventory markup includes required How Acquired options', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="buy-acquisition-type"/);
    assert.match(html, /data-acq="purchased"/);
    assert.match(html, /data-acq="gift_received"/);
    assert.match(html, /data-acq="other_adjustment"/);
    assert.match(html, /id="buy-gift-source"/);
    assert.match(html, /id="buy-total-cost-group"/);
    assert.match(html, /id="buy-payment-group"/);
});

test('gift received acquisition adds inventory but is excluded from spend analytics', () => {
    const purchased = makePurchase({ id: 'buy-1', totalCost: 100, quantityBought: 2, quantity: 2, remainingAmount: 2 });
    const gifted = makePurchase({
        id: 'gift-1',
        acquisitionType: 'gift_received',
        giftSource: 'Alex',
        totalCost: 0,
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        paymentMethod: ''
    });
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate('2026-08-01');
    const data = rt.normalizeAppDataSafe(makeData([purchased, gifted]));
    rt.__setTestAppData(data);

    const gift = data.purchases.find(p => p.id === 'gift-1');
    assert.equal(rt.getPurchaseAcquisitionType(gift), 'gift_received');
    assert.equal(rt.getPurchaseGiftSource(gift), 'Alex');
    assert.equal(rt.purchaseCountsAsBuySpend(gift), false);
    assert.equal(rt.getPurchaseSpendAmount(gift), 0);
    assert.equal(rt.getPurchaseRemainingAmount(gift), 1);

    const insight = rt.getPurchasesForInsightMetrics(COKE_ID, data);
    assert.equal(insight.length, 1);
    assert.equal(insight[0].id, 'buy-1');

    const inventory = rt.getPurchasesForBuyMetrics(COKE_ID, data);
    assert.equal(inventory.length, 2);

    const stats = rt.getBuyStats(COKE_ID);
    assert.equal(stats.countMonth, 1);
    assert.ok(Math.abs(stats.spentMonth - 100) < 0.001);
});

test('other / adjustment acquisition is excluded from purchase counts and averages', () => {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeData([
        makePurchase({ id: 'buy-1', totalCost: 80, quantityBought: 2, quantity: 2, remainingAmount: 2, costPerUnit: 40 }),
        makePurchase({
            id: 'adj-1',
            acquisitionType: 'other_adjustment',
            totalCost: 999,
            quantityBought: 5,
            quantity: 5,
            remainingAmount: 5,
            costPerUnit: 200
        })
    ]));
    rt.__setTestAppData(data);

    const adj = data.purchases.find(p => p.id === 'adj-1');
    assert.equal(rt.getPurchaseAcquisitionType(adj), 'other_adjustment');
    assert.equal(rt.getPurchaseSpendAmount(adj), 0);
    assert.equal(adj.totalCost, 0);
    const avgPurchases = rt.getPurchasesForInsightMetrics(COKE_ID, data);
    assert.equal(avgPurchases.length, 1);
    assert.equal(avgPurchases[0].costPerUnit, 40);
    assert.equal(rt.getPurchaseSpendAmount(data.purchases.find(p => p.id === 'buy-1')), 80);
});

test('legacy gift flags migrate to acquisitionType gift_received', () => {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeData([
        makePurchase({ id: 'legacy-gift', isGiftReceived: true, totalCost: 50, giftSource: 'Sam' })
    ]));
    const purchase = data.purchases[0];
    assert.equal(purchase.acquisitionType, 'gift_received');
    assert.equal(purchase.totalCost, 0);
    assert.equal(rt.getPurchaseGiftSource(purchase), 'Sam');
    assert.equal(rt.purchaseQualifiesForCostPerGram(purchase, COKE_ID, data), false);
});

test('export / import / duplicate preserve acquisition type and gift source', () => {
    const rt = loadRecoveryTrackerApp();
    const original = makePurchase({
        id: 'gift-keep',
        acquisitionType: 'gift_received',
        giftSource: 'Jordan',
        totalCost: 0,
        paymentMethod: '',
        remainingAmount: 4,
        quantityBought: 4,
        quantity: 4
    });
    const data = rt.normalizeAppDataSafe(makeData([original]));
    rt.__setTestAppData(data);

    const exported = rt.cleanExportData(data);
    const exportedPurchase = exported.purchases.find(p => p.id === 'gift-keep');
    assert.equal(exportedPurchase.acquisitionType, 'gift_received');
    assert.equal(exportedPurchase.giftSource, 'Jordan');
    assert.equal(exportedPurchase.isGiftReceived, true);

    const reimported = rt.normalizeAppDataSafe({
        ...rt.getDefaultAppData(),
        substances: data.substances,
        purchases: exported.purchases
    });
    const roundTrip = reimported.purchases.find(p => p.id === 'gift-keep');
    assert.equal(rt.getPurchaseAcquisitionType(roundTrip), 'gift_received');
    assert.equal(rt.getPurchaseGiftSource(roundTrip), 'Jordan');

    rt.__setTestAppData(data);
    const dup = rt.duplicatePurchaseNow('gift-keep');
    assert.ok(dup);
    assert.equal(rt.getPurchaseAcquisitionType(dup), 'gift_received');
    assert.equal(rt.getPurchaseGiftSource(dup), 'Jordan');
    assert.equal(rt.getPurchaseSpendAmount(dup), 0);
});

test('inventory history badge markup for gift received', () => {
    const rt = loadRecoveryTrackerApp();
    const badge = rt.renderPurchaseAcquisitionBadge({
        acquisitionType: 'gift_received',
        giftSource: 'Alex'
    });
    assert.match(badge, /Gift Received/);
    assert.match(badge, /badge-gift-received/);
    assert.equal(rt.renderPurchaseAcquisitionBadge({ acquisitionType: 'purchased' }), '');
});
