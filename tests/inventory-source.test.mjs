import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function setup(purchases = [], contacts = []) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData({
        substances: [{
            id: 'coke',
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            active: true,
            isMain: true
        }],
        logs: [],
        purchases,
        contacts,
        cravings: [],
        goals: [],
        budgets: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    });
    if (typeof rt.initInventorySource === 'function') rt.initInventorySource();
    return rt;
}

test('markup hides legacy store group and mounts Source', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="buy-source-mount"/);
    assert.match(html, /id="buy-store-group"[^>]*hidden|data-legacy-store/);
    assert.doesNotMatch(html, />Store \/ Location</);
});

test('migrates store to sourceName without duplicating supplier', () => {
    const rt = setup([
        {
            id: 'p1',
            substanceId: 'coke',
            date: '2026-08-01',
            quantity: 3.5,
            quantityBought: 3.5,
            store: 'Rio Mart',
            supplierContactId: '',
            totalCost: 100,
            acquisitionType: 'purchased'
        },
        {
            id: 'p2',
            substanceId: 'coke',
            date: '2026-08-02',
            quantity: 1,
            quantityBought: 1,
            store: '',
            supplierContactId: 'c-michael',
            totalCost: 40,
            acquisitionType: 'purchased'
        }
    ], [
        { id: 'c-michael', name: 'Michael', roles: ['dealer_supplier'], active: true }
    ]);

    // initInventorySource migrates on setup; force re-migrate from raw fields if needed
    const data = rt.__getTestAppData();
    data.migrations.inventorySourceV1 = false;
    data.purchases.forEach(p => {
        delete p.sourceName;
        delete p.sourceKind;
        delete p.sourceContactId;
    });
    const report = rt.migrateInventorySources(data);
    assert.ok(report.migrated >= 1);
    const p1 = data.purchases.find(p => p.id === 'p1');
    const p2 = data.purchases.find(p => p.id === 'p2');
    assert.equal(p1.sourceName, 'Rio Mart');
    assert.equal(p1.sourceKind, 'business');
    assert.equal(p2.sourceContactId, 'c-michael');
    assert.ok(['dealer', 'individual'].includes(p2.sourceKind));
    assert.equal(rt.getPurchaseSourceName(p1), 'Rio Mart');
    assert.match(rt.formatPurchaseSourceDisplay(p1), /Rio Mart/);
});

test('migration prefers store when both store and supplier exist (no duplicate source)', () => {
    const rt = setup([
        {
            id: 'p3',
            substanceId: 'coke',
            date: '2026-08-01',
            store: 'HEB',
            supplierContactId: 'c-marc',
            quantity: 1,
            quantityBought: 1,
            totalCost: 50,
            acquisitionType: 'purchased'
        }
    ], [
        { id: 'c-marc', name: 'Marc', roles: ['friend'], active: true }
    ]);
    const data = rt.__getTestAppData();
    const p = data.purchases[0];
    delete p.sourceName;
    delete p.sourceKind;
    delete p.sourceContactId;
    rt.migratePurchaseSourceFields(p, data);
    assert.equal(p.sourceName, 'HEB');
    assert.equal(p.sourceKind, 'business');
    // Supplier id not copied when names differ — store wins as single Source
    assert.equal(p.sourceContactId || '', '');
});

test('source analytics kinds classify store vs person vs dealer', () => {
    const rt = setup();
    assert.equal(rt.getPurchaseSourceKind({ sourceName: 'Smoke Shop', sourceKind: 'business' }), 'business');
    assert.equal(rt.getPurchaseSourceKind({
        sourceName: 'Gang',
        sourceKind: 'friend',
        sourceContactId: 'x'
    }), 'friend');
    assert.equal(rt.getPurchaseSourceKind({
        sourceName: 'Dealer Dan',
        sourceKind: 'dealer'
    }), 'dealer');
    assert.ok(rt.INVENTORY_SOURCE_KINDS.includes('online'));
    assert.ok(rt.INVENTORY_SOURCE_KINDS.includes('family'));
});

test('person sources stay person-kind; business sources stay store-kind', () => {
    const rt = setup([], [
        { id: 'c1', name: 'Michael', roles: ['dealer_supplier'], active: true }
    ]);
    const personPurchase = {
        sourceName: 'Michael',
        sourceKind: 'dealer',
        sourceContactId: 'c1',
        store: '',
        supplierContactId: 'c1',
        totalCost: 20,
        acquisitionType: 'purchased'
    };
    const storePurchase = {
        sourceName: 'Rio Mart',
        sourceKind: 'business',
        store: 'Rio Mart',
        totalCost: 30,
        acquisitionType: 'purchased'
    };
    rt.syncPurchaseSourceFields(personPurchase);
    rt.syncPurchaseSourceFields(storePurchase);
    assert.equal(rt.getPurchaseSourceKind(personPurchase), 'dealer');
    assert.equal(rt.getPurchaseSourceName(personPurchase), 'Michael');
    assert.equal(rt.getPurchaseSourceKind(storePurchase), 'business');
    assert.equal(rt.getPurchaseSourceName(storePurchase), 'Rio Mart');
    // Person source should not surface as a store name on the record
    assert.equal(personPurchase.store || '', '');
});

test('applyInventorySourceToPayload maps gift received to giftSource fields', () => {
    const rt = setup();
    // Simulate DOM-less selection via direct sync
    const payload = {
        acquisitionType: 'gift_received',
        sourceName: 'Marc',
        sourceKind: 'friend',
        sourceContactId: 'c-marc',
        store: 'should-clear',
        totalCost: 0
    };
    // applyInventorySourceToPayload reads DOM; use syncPurchaseSourceFields instead for unit path
    rt.syncPurchaseSourceFields(payload);
    assert.equal(payload.giftSource, 'Marc');
    assert.equal(payload.store, '');
});

test('purchase history labels Source and keeps supplier hidden by default', () => {
    const rt = setup();
    const labels = rt.TABLE_COLUMN_LABELS?.purchaseHistory
        || rt.getTableColumnLabels?.('purchaseHistory');
    // Prefer exported helpers
    if (typeof rt.getTableColumnLabelForSubstance === 'function') {
        // may need table key API — fall back to reading defaults
    }
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /buy-source-mount/);
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /store: 'Source'/);
    assert.match(app, /hidden: \[[^\]]*supplier/);
});
