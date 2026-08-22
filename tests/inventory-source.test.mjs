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

test('purchase history uses a single Source column without Source Legacy', () => {
    const rt = setup();
    const labels = rt.TABLE_COLUMN_LABELS?.purchaseHistory || {};
    assert.equal(labels.store, 'Source');
    assert.equal(labels.supplier, undefined);
    const defaults = rt.getDefaultColumnSettings('purchaseHistory');
    assert.ok(defaults.order.includes('store'));
    assert.ok(!defaults.order.includes('supplier'));
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /buy-source-mount/);
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /store: 'Source'/);
    assert.doesNotMatch(app, /supplier: 'Source \(legacy\)'/);
});

function makeBuyFormDom(nodes) {
    const put = (id, props = {}) => {
        const classes = new Set();
        const node = {
            id,
            value: props.value ?? '',
            innerHTML: props.innerHTML ?? '',
            hidden: !!props.hidden,
            classList: {
                add(...n) { n.forEach(x => classes.add(x)); },
                remove(...n) { n.forEach(x => classes.delete(x)); },
                toggle(n, f) {
                    if (f === true) classes.add(n);
                    else if (f === false) classes.delete(n);
                    else if (classes.has(n)) classes.delete(n);
                    else classes.add(n);
                },
                contains(n) { return classes.has(n); }
            },
            style: props.style || { display: '' },
            insertAdjacentHTML(position, html) {
                if (position === 'beforebegin') this._before = html;
            },
            setAttribute() {},
            removeAttribute() {}
        };
        nodes.set(id, node);
        return node;
    };
    put('buy-source-mount');
    put('buy-store-group', { hidden: true });
    put('buy-payment-group');
    put('buy-supplier-contact-picker');
    put('buy-gift-source-group');
    put('buy-gift-recipient-group');
    put('buy-acquisition-type', { value: 'purchased', style: { display: '' } });
    return nodes;
}

test('inventory source patch receives a real Element with insertAdjacentHTML', () => {
    const rt = setup();
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    const put = (id, props = {}) => {
        const classes = new Set();
        const node = {
            id,
            value: props.value ?? '',
            innerHTML: props.innerHTML ?? '',
            hidden: !!props.hidden,
            classList: {
                add(...n) { n.forEach(x => classes.add(x)); },
                remove(...n) { n.forEach(x => classes.delete(x)); },
                toggle(n, f) {
                    if (f === true) classes.add(n);
                    else if (f === false) classes.delete(n);
                    else if (classes.has(n)) classes.delete(n);
                    else classes.add(n);
                },
                contains(n) { return classes.has(n); }
            },
            style: props.style || { display: '' },
            insertAdjacentHTML(position, html) {
                if (position === 'beforebegin') this._before = html;
            },
            setAttribute() {},
            removeAttribute() {}
        };
        nodes.set(id, node);
        return node;
    };
    put('buy-acquisition-type', { value: 'purchased' });
    const store = put('buy-store-group', { hidden: true });
    put('buy-payment-group');
    put('buy-supplier-contact-picker');
    rt.inventorySourcePickerMountedRef.value = false;
    rt.inventorySourcePickerMountWarnedRef.value = false;

    assert.equal(rt.isInventorySourceDomElement(store), true);
    assert.equal(rt.ensureBuySourcePickerMounted(), true);
    assert.ok(store._before?.includes('id="buy-source-group"'));
});

test('inventory source prefers buy-source-mount innerHTML over legacy store group', () => {
    const rt = setup();
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    const mount = makeBuyFormDom(nodes).get('buy-source-mount');
    rt.inventorySourcePickerMountedRef.value = false;

    assert.equal(rt.ensureBuySourcePickerMounted(), true);
    assert.match(mount.innerHTML, /buy-source-group/);
    assert.equal(nodes.has('buy-source-group'), false);
});

test('missing target element fails gracefully without repeated console errors', () => {
    const rt = setup();
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        rt.document.getElementById = () => null;
        rt.inventorySourcePickerMountedRef.value = false;
        rt.inventorySourcePickerMountWarnedRef.value = false;

        assert.equal(rt.ensureBuySourcePickerMounted(), false);
        assert.equal(rt.ensureBuySourcePickerMounted(), false);
        assert.equal(rt.ensureBuySourcePickerMounted(), false);
        const mountWarnings = warnings.filter(w => w.includes('[inventory-source]'));
        assert.equal(mountWarnings.length, 1, 'should warn once, not on every retry');
    } finally {
        console.warn = originalWarn;
    }
});

test('rerender does not duplicate source patch listeners', () => {
    const rt = setup();
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    makeBuyFormDom(nodes);
    rt.inventorySourcePickerMountedRef.value = false;

    rt.initInventorySource();
    const first = nodes.get('buy-source-mount')?.innerHTML || nodes.get('buy-store-group')?._before || '';
    rt.initInventorySource();
    rt.initInventorySource();
    const second = nodes.get('buy-source-mount')?.innerHTML || nodes.get('buy-store-group')?._before || '';
    assert.equal(first, second);
    const countIds = (html) => (html.match(/id="buy-source-group"/g) || []).length;
    assert.ok(countIds(first) <= 1);
    assert.ok(countIds(second) <= 1);
});

test('updateBuyAcquisitionTypeUI patch runs once per render without error spam', () => {
    const rt = setup();
    const nodes = new Map();
    rt.document.getElementById = (id) => nodes.get(id) || null;
    makeBuyFormDom(nodes);
    rt.inventorySourcePickerMountedRef.value = false;

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    rt.initInventorySource();
    if (typeof rt.updateBuyAcquisitionTypeUI === 'function') {
        for (let i = 0; i < 5; i += 1) rt.updateBuyAcquisitionTypeUI();
    }

    console.warn = originalWarn;
    const patchFails = warnings.filter(w => w.includes('acquisition UI patch failed'));
    assert.equal(patchFails.length, 0);
    assert.equal(rt.inventorySourcePickerMountedRef.value, true);
});
