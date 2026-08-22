import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';

const REMOVED_COLUMNS = [
    'supplier',
    'giftRecipient',
    'budgetStatus',
    'productType',
    'inventoryLifespan',
    'giftStatus',
    'linkedUsers',
    'purchaseQualityRating'
];

function makeData(purchases, contacts = []) {
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
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs: [],
        purchases,
        contacts,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {}
    };
}

function makePurchase(id, overrides = {}) {
    return {
        id,
        substanceId: COKE_ID,
        date: '2026-08-01',
        time: '12:00',
        quantityBought: 3.5,
        quantity: 3.5,
        unit: 'g',
        totalCost: 150,
        remainingAmount: 3.5,
        isDepleted: false,
        paymentMethod: 'Cash',
        notes: '',
        ...overrides
    };
}

function setup(purchases = [], contacts = []) {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeData(purchases, contacts));
    rt.__setTestAppData(data);
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.inventoryListFilters.substanceId = COKE_ID;
    rt.inventoryTabFilterRef.value = 'all';
    if (typeof rt.initInventorySource === 'function') rt.initInventorySource();
    return rt;
}

test('inventory table catalog has a single Source column and omits removed columns', () => {
    const rt = setup();
    const defaults = rt.getDefaultColumnSettings('purchaseHistory');
    const labels = rt.TABLE_COLUMN_LABELS.purchaseHistory;
    assert.equal(rt.getPurchaseHistoryColumnLabel('store'), 'Source');
    assert.equal(labels.store, 'Source');
    assert.ok(defaults.order.includes('store'));
    REMOVED_COLUMNS.forEach(id => {
        assert.ok(!defaults.order.includes(id), `${id} should not be in defaults.order`);
        assert.equal(defaults.visible[id], undefined, `${id} should not have a visible flag`);
        assert.equal(labels[id], undefined, `${id} should not have a column label`);
    });
    const visible = rt.getPurchaseHistoryVisibleColumns(COKE_ID);
    REMOVED_COLUMNS.forEach(id => {
        assert.ok(!visible.includes(id), `${id} should not be a visible inventory column`);
    });
    assert.deepEqual([...rt.PURCHASE_HISTORY_REMOVED_COLUMN_IDS], REMOVED_COLUMNS);
});

test('column presets and customizer omit removed inventory columns', () => {
    const rt = setup();
    for (const presetId of rt.COLUMN_PRESET_IDS) {
        const def = rt.getColumnPresetDefinition(presetId, 'purchaseHistory', COKE_ID);
        REMOVED_COLUMNS.forEach(id => {
            assert.ok(!def.order.includes(id), `${presetId} preset still lists ${id}`);
            assert.equal(def.visible[id], undefined, `${presetId} preset still has visible.${id}`);
        });
    }
    const cost = rt.getColumnPresetDefinition('cost', 'purchaseHistory', COKE_ID);
    assert.ok(cost.order.includes('store'));
    assert.equal(cost.visible.store, true);
});

test('legacy saved column keys are ignored without dropping purchases', () => {
    const purchases = [
        makePurchase('keep-1', { store: 'Rio Mart' }),
        makePurchase('keep-2', { store: '', supplierContactId: 'c-michael' })
    ];
    const rt = setup(purchases, [
        { id: 'c-michael', name: 'Michael', roles: ['dealer_supplier'], active: true }
    ]);
    const defaults = rt.getDefaultColumnSettings('purchaseHistory');
    const loaded = rt.normalizeStoredColumnSettings('purchaseHistory', {
        order: ['select', 'date', 'store', 'supplier', 'giftRecipient', 'budgetStatus', 'productType',
            'inventoryLifespan', 'giftStatus', 'linkedUsers', 'purchaseQualityRating', 'actions'],
        visible: {
            store: true,
            supplier: true,
            giftRecipient: true,
            budgetStatus: true,
            productType: true,
            inventoryLifespan: true,
            giftStatus: true,
            linkedUsers: true,
            purchaseQualityRating: true
        },
        widths: {
            supplier: 180,
            giftRecipient: 160,
            budgetStatus: 110
        },
        customNames: {
            supplier: 'Source Legacy',
            giftRecipient: 'Gift person'
        }
    });
    REMOVED_COLUMNS.forEach(id => {
        assert.ok(!loaded.order.includes(id), `normalized order still has ${id}`);
        assert.equal(loaded.visible[id], undefined);
        assert.equal(loaded.widths[id], undefined);
        assert.equal(loaded.customNames?.[id], undefined);
    });
    assert.ok(loaded.order.includes('store'));
    assert.equal(loaded.visible.store, true);
    defaults.order.forEach(id => {
        assert.ok(loaded.order.includes(id), `missing default column ${id}`);
    });

    rt.savePurchaseHistoryColumnSettings(loaded);
    const rows = rt.getFilteredPurchasesForPurchaseHistory();
    assert.equal(rows.length, 2);
    assert.equal((rt.__getTestAppData().purchases || []).length, 2);
    assert.equal(rt.__getTestAppData().purchases[0].id, 'keep-1');
    const visible = rt.getPurchaseHistoryVisibleColumns(COKE_ID);
    REMOVED_COLUMNS.forEach(id => assert.ok(!visible.includes(id)));
});

test('unified Source uses current source, then store, then supplier legacy', () => {
    const rt = setup([
        makePurchase('named', { sourceName: 'Smoke Shop', sourceKind: 'business', store: 'Old Store', supplierContactId: 'c-michael' }),
        makePurchase('store-only', { store: 'HEB', sourceName: '', sourceKind: '', supplierContactId: '' }),
        makePurchase('supplier-only', { store: '', sourceName: '', sourceKind: '', supplierContactId: 'c-michael' })
    ], [
        { id: 'c-michael', name: 'Michael', roles: ['dealer_supplier'], active: true }
    ]);
    const data = rt.__getTestAppData();
    const named = data.purchases.find(p => p.id === 'named');
    const storeOnly = data.purchases.find(p => p.id === 'store-only');
    const supplierOnly = data.purchases.find(p => p.id === 'supplier-only');
    assert.equal(rt.getPurchaseSourceName(named), 'Smoke Shop');
    assert.equal(rt.getPurchaseSourceName(storeOnly), 'HEB');
    assert.equal(rt.getPurchaseSourceName(supplierOnly), 'Michael');
    assert.match(rt.formatPurchaseSourceDisplay(named), /Smoke Shop/);
    assert.match(rt.formatPurchaseSourceDisplay(storeOnly), /HEB/);
    assert.match(rt.formatPurchaseSourceDisplay(supplierOnly), /Michael/);
});

test('inventory render and JSON/CSV export keep purchase records and unified Source', () => {
    const rt = setup([
        makePurchase('p1', { store: 'Rio Mart', notes: 'keep me' }),
        makePurchase('p2', { store: '', supplierContactId: 'c-marc', giftRecipient: 'Sam', acquisitionType: 'purchased_as_gift' })
    ], [
        { id: 'c-marc', name: 'Marc', roles: ['friend'], active: true }
    ]);
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    nodes.set('purchase-history-list', { id: 'purchase-history-list', innerHTML: '' });
    rt.inventoryListFilters.substanceId = COKE_ID;
    rt.inventoryTabFilterRef.value = 'all';
    rt.renderPurchaseHistory(null);
    const html = nodes.get('purchase-history-list').innerHTML;
    assert.match(html, /purchase-history-row/);
    assert.doesNotMatch(html, /Source \(legacy\)/);
    assert.doesNotMatch(html, /Purchased as Gift Recipient/);
    assert.doesNotMatch(html, /Budget Status/);
    assert.doesNotMatch(html, /Inventory Lifespan/);
    assert.doesNotMatch(html, /Gift Status/);
    assert.doesNotMatch(html, /Linked Users/);
    assert.doesNotMatch(html, /Purchase Quality/);
    assert.match(html, /data-col="store"/);
    assert.doesNotMatch(html, /data-col="supplier"/);
    assert.doesNotMatch(html, /data-col="giftRecipient"/);
    assert.doesNotMatch(html, /data-col="budgetStatus"/);
    assert.doesNotMatch(html, /data-col="productType"/);
    assert.doesNotMatch(html, /data-col="inventoryLifespan"/);
    assert.doesNotMatch(html, /data-col="giftStatus"/);
    assert.doesNotMatch(html, /data-col="linkedUsers"/);
    assert.doesNotMatch(html, /data-col="purchaseQualityRating"/);

    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(exported.purchases.length, 2);
    assert.equal(exported.purchases[0].id, 'p1');
    assert.equal(exported.purchases[1].giftRecipient, 'Sam');
    assert.ok('sourceName' in exported.purchases[0]);
    assert.equal((rt.__getTestAppData().purchases || []).length, 2);

    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /'How Acquired', 'Gift From', 'Source', 'Flavor', 'Notes'/);
    assert.doesNotMatch(app, /'Gift From', 'Store', 'Flavor'/);
});
