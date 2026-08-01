import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEED_ID = 'weed-thc';

function makeWeedData(purchases = [], logs = []) {
    return {
        substances: [{
            id: WEED_ID,
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            trackingMode: 'weed',
            primaryUnit: 'grams',
            units: ['grams', 'hits', 'edibles'],
            defaultUnit: 'grams',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs,
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

function makeEdiblePurchase(overrides = {}) {
    return {
        id: overrides.id || `edible-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: WEED_ID,
        date: '2026-08-01',
        time: '12:00',
        weedProductType: 'edibles',
        quantityBought: 10,
        quantity: 10,
        unit: 'edible',
        remainingAmount: 10,
        mgPerEdible: 20,
        totalThcMg: 200,
        remainingThcMg: 200,
        ediblesMg: 200,
        totalCost: 40,
        costPerUnit: 4,
        store: 'Dispensary',
        isDepleted: false,
        ...overrides
    };
}

function el(id, { value = '', options = null, tag = 'input', hidden = false } = {}) {
    const classes = new Set(hidden ? ['hidden'] : []);
    const optionList = (options || []).map(o => ({ value: o.value, textContent: o.label || o.value }));
    return {
        id,
        tagName: tag.toUpperCase(),
        _value: value,
        required: false,
        readOnly: false,
        step: '',
        min: '',
        placeholder: '',
        dataset: {},
        style: {},
        options: optionList,
        classList: {
            add(...names) { names.forEach(n => classes.add(n)); },
            remove(...names) { names.forEach(n => classes.delete(n)); },
            toggle(name, force) {
                if (force === true) classes.add(name);
                else if (force === false) classes.delete(name);
                else if (classes.has(name)) classes.delete(name);
                else classes.add(name);
                return classes.has(name);
            },
            contains(name) { return classes.has(name); }
        },
        get value() { return this._value; },
        set value(v) { this._value = String(v ?? ''); },
        get innerHTML() { return ''; },
        set innerHTML(_) { this.options = []; },
        appendChild(opt) {
            this.options.push({ value: opt.value, textContent: opt.textContent });
        },
        addEventListener() {}
    };
}

function installEdibleDom(rt, {
    amount = '0.25',
    mgPer = '20',
    purchaseId = '',
    linkMode = 'manual'
} = {}) {
    const nodes = new Map();
    const put = (id, opts) => {
        const node = el(id, opts);
        nodes.set(id, node);
        return node;
    };
    put('use-substance', { value: WEED_ID, tag: 'select' });
    put('use-weed-product-type', {
        value: 'edibles',
        tag: 'select',
        options: [
            { value: 'bud', label: 'Bud' },
            { value: 'cart', label: 'Cart' },
            { value: 'edibles', label: 'Edibles' },
            { value: 'pre-rolls', label: 'Pre-rolls' }
        ]
    });
    put('use-weed-product-type-group');
    put('use-weed-product-type-review', { tag: 'p', hidden: true });
    put('use-weed-cart-fields-group', { hidden: true });
    put('use-weed-edibles-fields-group');
    put('use-weed-edible-mg-per', { value: String(mgPer) });
    put('use-weed-edible-strength-hint', { tag: 'p', hidden: true });
    put('use-weed-edible-thc-preview', { tag: 'p' });
    put('use-amount-mode-group');
    put('use-amount', { value: String(amount) });
    put('use-amount-label', { tag: 'label' });
    put('use-unit', { value: 'edible', tag: 'select' });
    put('use-purchase-link-mode', { value: linkMode, tag: 'select' });
    put('use-purchase-select', { value: String(purchaseId), tag: 'select' });
    put('use-purchase-manual-wrap');
    put('use-purchase-preview', { tag: 'p' });
    put('use-transaction-type', { value: 'use' });
    put('use-date', { value: '2026-08-01' });
    put('use-start-time', { value: '' });
    put('use-end-time', { value: '' });
    put('use-end-date', { value: '' });
    put('use-type', { value: 'quick' });
    put('use-count', { value: '0' });
    put('use-notes', { value: '', tag: 'textarea' });
    put('use-gift-party', { value: '' });
    put('use-shared-with', { value: '' });
    put('use-inventory-fields-group');
    put('use-inventory-core-anchor');
    put('buy-weed-product-type', { value: 'edibles', tag: 'select' });
    put('buy-quantity', { value: '10' });
    put('buy-quantity-label', { tag: 'label' });
    put('buy-quantity-group');
    put('buy-edibles-mg', { value: '20' });
    put('buy-edibles-preview', { tag: 'p' });
    put('buy-weed-edibles-group');
    put('buy-weed-bud-group', { hidden: true });
    put('buy-weed-cart-group', { hidden: true });
    put('buy-weed-prerolls-group', { hidden: true });
    put('buy-unit', { value: 'edible', tag: 'select' });
    put('buy-total-cost', { value: '40' });
    put('buy-cost-per-unit-preview', { tag: 'p' });
    put('buy-preroll-preview', { tag: 'p' });

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = () => [];
    return nodes;
}

test('inventory markup and use form include edible THC fields', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /THC mg per edible/);
    assert.match(html, /id="buy-edibles-preview"/);
    assert.match(html, /id="use-weed-edibles-fields-group"/);
    assert.match(html, /id="use-weed-edible-mg-per"/);
    assert.match(html, /id="use-weed-edible-thc-preview"/);
});

test('Total THC mg = edible count × THC mg per edible', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.computeWeedEdibleTotalThcMg(10, 20), 200);
    assert.equal(rt.computeWeedEdibleTotalThcMg(0.25, 20), 5);
    assert.equal(rt.computeWeedEdibleTotalThcMg(1.5, 10), 15);
});

test('buy form builds edible purchase with mg per edible and total THC', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([])));
    installEdibleDom(rt);
    const fields = rt.parseWeedFieldsFromForm();
    assert.equal(fields.weedProductType, 'edibles');
    assert.equal(fields.edibleCount, 10);
    assert.equal(fields.mgPerEdible, 20);
    assert.equal(fields.totalThcMg, 200);

    const payload = {
        substanceId: WEED_ID,
        quantityBought: 10,
        quantity: 10,
        totalCost: 40
    };
    rt.applyWeedFieldsToPayload(payload, fields);
    rt.applyWeedQuantityFromFields(payload, fields, 40);
    assert.equal(payload.mgPerEdible, 20);
    assert.equal(payload.totalThcMg, 200);
    assert.equal(payload.remainingThcMg, 200);
    assert.equal(payload.unit, 'edible');
    assert.equal(payload.needsStrengthInfo, false);
});

test('legacy edible purchase without mg-per-edible needs review and does not invent strength', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({
        id: 'legacy-edible',
        mgPerEdible: undefined,
        totalThcMg: undefined,
        remainingThcMg: undefined,
        ediblesMg: 100
    });
    delete purchase.mgPerEdible;
    delete purchase.totalThcMg;
    delete purchase.remainingThcMg;
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase]));
    const legacy = data.purchases.find(p => p.id === 'legacy-edible');
    assert.equal(rt.getWeedEdibleMgPerEdible(legacy), null);
    assert.equal(rt.weedEdiblePurchaseNeedsStrengthInfo(legacy), true);
    assert.match(rt.formatWeedPurchaseDisplayLine(legacy), /Strength missing/);
    assert.notEqual(rt.getWeedEdibleMgPerEdible(legacy), 10);
});

test('fractional edible use computes THC and deducts count + remaining THC mg', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({ id: 'bag-1' });
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase]));
    rt.__setTestAppData(data);
    installEdibleDom(rt, { amount: '0.25', mgPer: '20', purchaseId: 'bag-1' });

    const entry = rt.buildUseEntryFromForm();
    assert.equal(entry.weedProductType, 'edibles');
    assert.equal(entry.amount, 0.25);
    assert.equal(entry.unit, 'edible');
    assert.equal(entry.mgPerEdibleAtTimeOfUse, 20);
    assert.equal(entry.thcMgUsed, 5);
    assert.match(rt.formatWeedEdibleUseSummary(entry), /0\.25 edible · 5 mg THC/);
    assert.equal(rt.formatWeedEdibleAmountLabel(1), '1 edible');

    entry.id = 'log-1';
    entry.purchaseId = 'bag-1';
    entry.linkedPurchaseId = 'bag-1';
    entry.inventoryAffects = true;
    entry.transactionType = 'use';
    data.logs.push(entry);

    const result = rt.applyLogInventoryEffect(entry, data);
    assert.equal(result.ok, true);
    const bag = data.purchases.find(p => p.id === 'bag-1');
    assert.ok(Math.abs(rt.getPurchaseRemainingAmount(bag) - 9.75) < 0.001);
    assert.ok(Math.abs(rt.getWeedEdibleRemainingThcMg(bag) - 195) < 0.001);
});

test('whole edible use deducts inventory and restores on delete', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({ id: 'bag-2', quantityBought: 4, quantity: 4, remainingAmount: 4, totalThcMg: 80, remainingThcMg: 80 });
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase]));
    rt.__setTestAppData(data);
    installEdibleDom(rt, { amount: '1', mgPer: '20', purchaseId: 'bag-2' });

    const entry = rt.buildUseEntryFromForm();
    entry.id = 'log-2';
    entry.purchaseId = 'bag-2';
    entry.linkedPurchaseId = 'bag-2';
    entry.inventoryAffects = true;
    entry.transactionType = 'use';
    data.logs.push(entry);

    assert.equal(rt.applyLogInventoryEffect(entry, data).ok, true);
    let bag = data.purchases.find(p => p.id === 'bag-2');
    assert.ok(Math.abs(rt.getPurchaseRemainingAmount(bag) - 3) < 0.001);
    assert.ok(Math.abs(rt.getWeedEdibleRemainingThcMg(bag) - 60) < 0.001);

    rt.restoreLogInventoryEffect(entry, data);
    bag = data.purchases.find(p => p.id === 'bag-2');
    assert.ok(Math.abs(rt.getPurchaseRemainingAmount(bag) - 4) < 0.001);
    assert.ok(Math.abs(rt.getWeedEdibleRemainingThcMg(bag) - 80) < 0.001);
});

test('editing edible use recalculates inventory for both count and THC', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({ id: 'bag-3' });
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase]));
    rt.__setTestAppData(data);

    const first = {
        id: 'log-3',
        type: 'quick',
        transactionType: 'use',
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        date: '2026-08-01',
        amount: 1,
        unit: 'edible',
        thcMgUsed: 20,
        mgPerEdibleAtTimeOfUse: 20,
        purchaseId: 'bag-3',
        linkedPurchaseId: 'bag-3',
        inventoryAffects: true
    };
    data.logs.push(first);
    assert.equal(rt.applyLogInventoryEffect(first, data).ok, true);

    rt.restoreLogInventoryEffect(first, data);
    first.amount = 0.5;
    first.thcMgUsed = 10;
    first.mgUsed = 10;
    assert.equal(rt.applyLogInventoryEffect(first, data).ok, true);

    const bag = data.purchases.find(p => p.id === 'bag-3');
    assert.ok(Math.abs(rt.getPurchaseRemainingAmount(bag) - 9.5) < 0.001);
    assert.ok(Math.abs(rt.getWeedEdibleRemainingThcMg(bag) - 190) < 0.001);
});

test('depleting edible inventory zeros count and remaining THC mg', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({
        id: 'bag-4',
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        totalThcMg: 20,
        remainingThcMg: 20
    });
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase]));
    rt.__setTestAppData(data);
    const log = {
        id: 'log-4',
        type: 'quick',
        transactionType: 'use',
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        date: '2026-08-01',
        amount: 1,
        unit: 'edible',
        thcMgUsed: 20,
        mgPerEdibleAtTimeOfUse: 20,
        purchaseId: 'bag-4',
        linkedPurchaseId: 'bag-4',
        inventoryAffects: true
    };
    assert.equal(rt.applyLogInventoryEffect(log, data).ok, true);
    const bag = data.purchases.find(p => p.id === 'bag-4');
    assert.equal(rt.getPurchaseRemainingAmount(bag), 0);
    assert.equal(rt.getWeedEdibleRemainingThcMg(bag), 0);
    assert.equal(bag.isDepleted, true);
});

test('cannabis use history catalog includes THC Used and Strength columns', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([])));
    const catalog = rt.getUseHistoryColumnCatalog(WEED_ID);
    assert.ok(catalog.includes('thcUsed'));
    assert.ok(catalog.includes('strength'));
    assert.equal(rt.getUseHistoryColumnLabel('thcUsed', WEED_ID), 'THC Used');
    assert.equal(rt.getUseHistoryColumnLabel('strength', WEED_ID), 'Strength');
});

test('export / import preserves edible strength and THC used', () => {
    const rt = loadRecoveryTrackerApp();
    const purchase = makeEdiblePurchase({ id: 'bag-keep' });
    const log = {
        id: 'log-keep',
        type: 'quick',
        transactionType: 'use',
        substanceId: WEED_ID,
        weedProductType: 'edibles',
        date: '2026-08-01',
        amount: 0.25,
        unit: 'edible',
        thcMgUsed: 5,
        mgPerEdibleAtTimeOfUse: 20,
        purchaseId: 'bag-keep',
        linkedPurchaseId: 'bag-keep',
        inventoryAffects: true
    };
    const data = rt.normalizeAppDataSafe(makeWeedData([purchase], [log]));
    const exported = rt.cleanExportData(data);
    const exportedPurchase = exported.purchases.find(p => p.id === 'bag-keep');
    const exportedLog = exported.logs.find(l => l.id === 'log-keep');
    assert.equal(exportedPurchase.mgPerEdible, 20);
    assert.equal(exportedPurchase.totalThcMg, 200);
    assert.equal(exportedPurchase.weedProductType, 'edibles');
    assert.equal(exportedLog.weedProductType, 'edibles');
    assert.equal(exportedLog.thcMgUsed, 5);
    assert.equal(exportedLog.mgPerEdibleAtTimeOfUse, 20);

    const reimported = rt.normalizeAppDataSafe({
        ...rt.getDefaultAppData(),
        substances: data.substances,
        purchases: exported.purchases,
        logs: exported.logs
    });
    const roundTripPurchase = reimported.purchases.find(p => p.id === 'bag-keep');
    const roundTripLog = reimported.logs.find(l => l.id === 'log-keep');
    assert.equal(rt.getWeedEdibleMgPerEdible(roundTripPurchase), 20);
    assert.equal(rt.getWeedEdibleLogThcUsed(roundTripLog), 5);
    assert.equal(rt.getWeedEdibleLogStrength(roundTripLog), 20);
});
