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
            units: ['grams', 'hits'],
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

function makePurchase(overrides = {}) {
    const type = overrides.weedProductType || 'bud';
    const base = {
        id: overrides.id || `weed-${type}-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: WEED_ID,
        date: '2026-08-01',
        time: '12:00',
        totalCost: 40,
        isDepleted: false,
        weedProductType: type,
        store: 'Dispensary'
    };
    if (type === 'cart') {
        return {
            ...base,
            quantityBought: overrides.quantityBought ?? 1,
            quantity: overrides.quantity ?? 1,
            unit: overrides.unit || 'count',
            remainingAmount: overrides.remainingAmount ?? 1,
            cartGrams: overrides.cartGrams ?? 1,
            ...overrides
        };
    }
    if (type === 'bud') {
        return {
            ...base,
            quantityBought: overrides.quantityBought ?? 3.5,
            quantity: overrides.quantity ?? 3.5,
            unit: 'grams',
            remainingAmount: overrides.remainingAmount ?? 3.5,
            budGrams: overrides.budGrams ?? 3.5,
            ...overrides
        };
    }
    if (type === 'edibles') {
        return {
            ...base,
            quantityBought: overrides.quantityBought ?? 10,
            quantity: overrides.quantity ?? 10,
            unit: 'count',
            remainingAmount: overrides.remainingAmount ?? 10,
            ediblesMg: overrides.ediblesMg ?? 100,
            ...overrides
        };
    }
    return {
        ...base,
        quantityBought: overrides.quantityBought ?? 2.5,
        quantity: overrides.quantity ?? 2.5,
        unit: 'grams',
        remainingAmount: overrides.remainingAmount ?? 2.5,
        preRollCount: overrides.preRollCount ?? 5,
        gramsPerPreRoll: 0.5,
        totalPreRollGrams: 2.5,
        weedProductType: 'pre-rolls',
        ...overrides
    };
}

function el(id, { value = '', options = null, tag = 'input' } = {}) {
    const optionList = (options || []).map(o => ({ value: o.value, textContent: o.label || o.value }));
    const node = {
        id,
        tagName: tag.toUpperCase(),
        _value: value,
        style: {},
        options: optionList,
        classList: {
            add() {},
            remove() {},
            toggle(name, force) {
                return force;
            },
            contains() { return false; }
        },
        get value() { return this._value; },
        set value(v) { this._value = String(v ?? ''); },
        get innerHTML() { return ''; },
        set innerHTML(_) {},
        appendChild(opt) {
            this.options.push({ value: opt.value, textContent: opt.textContent });
        }
    };
    return node;
}

function installWeedDom(rt, {
    productType = 'bud',
    cartMode = 'checkpoints',
    percentBefore = '',
    percentAfter = '',
    percentUsed = '',
    amount = '0.5',
    unit = 'grams',
    linkMode = 'auto'
} = {}) {
    const nodes = new Map();
    const put = (id, opts) => {
        const node = el(id, opts);
        nodes.set(id, node);
        return node;
    };
    put('use-substance', { value: WEED_ID, tag: 'select' });
    put('use-weed-product-type', {
        value: productType,
        tag: 'select',
        options: [
            { value: 'bud', label: 'Bud' },
            { value: 'cart', label: 'Cart' },
            { value: 'edibles', label: 'Edibles' },
            { value: 'pre-rolls', label: 'Pre-rolls' }
        ]
    });
    put('use-weed-cart-log-mode', { value: cartMode });
    put('use-weed-cart-percent-before', { value: String(percentBefore) });
    put('use-weed-cart-percent-after', { value: String(percentAfter) });
    put('use-weed-cart-percent-used', { value: String(percentUsed) });
    put('use-weed-cart-estimated-preview', { value: '', tag: 'p' });
    put('use-weed-cart-fields-group', { tag: 'div' });
    put('use-weed-cart-checkpoints-group', { tag: 'div' });
    put('use-weed-cart-estimated-group', { tag: 'div' });
    put('use-weed-product-type-group', { tag: 'div' });
    put('use-weed-product-type-review', { tag: 'p' });
    put('use-amount-mode-group', { tag: 'div' });
    put('use-amount', { value: String(amount) });
    put('use-amount-label', { tag: 'label' });
    put('use-unit', { value: unit, tag: 'select' });
    put('use-purchase-link-mode', { value: linkMode, tag: 'select' });
    put('use-purchase-select', { value: '', tag: 'select' });
    put('use-transaction-type', { value: 'use' });
    put('use-date', { value: '2026-08-01' });
    put('use-purchase-link-label', { tag: 'label' });
    put('use-purchase-manual-wrap', { tag: 'div' });
    put('use-purchase-preview', { tag: 'p' });
    put('use-notes', { value: '' });
    put('use-type', { value: 'quick' });
    put('use-count', { value: '' });
    put('use-gift-party', { value: '' });
    put('use-shared-with', { value: '' });

    nodes.get('use-weed-cart-estimated-preview').textContent = '';
    nodes.get('use-weed-product-type-review').textContent = '';
    nodes.get('use-amount-label').textContent = 'Amount';

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = (sel) => {
        if (sel === '.use-weed-cart-mode-btn') return [];
        return [];
    };
    rt.document.createElement = (tag) => ({ tagName: tag.toUpperCase(), value: '', textContent: '', style: {} });
    return nodes;
}

test('markup includes weed cart percent fields and product-type review hint', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="use-weed-cart-fields-group"/);
    assert.match(html, /id="use-weed-cart-percent-before"/);
    assert.match(html, /id="use-weed-cart-percent-after"/);
    assert.match(html, /id="use-weed-cart-percent-used"/);
    assert.match(html, /id="use-weed-product-type-review"/);
    assert.match(html, /Needs review/);
});

test('cannabis use history catalog includes Product Type column', () => {
    const rt = loadRecoveryTrackerApp();
    const catalog = rt.getUseHistoryColumnCatalog(WEED_ID);
    assert.ok(catalog.includes('productType'));
    assert.equal(rt.getWeedProductTypeLabel('bud'), 'Bud');
    assert.equal(rt.getWeedProductTypeLabel('cart'), 'Cart');
    assert.equal(rt.getWeedProductTypeLabel('edibles'), 'Edibles');
    assert.equal(rt.getWeedProductTypeLabel('pre-rolls'), 'Pre-rolls');
});

test('Bud / Edibles / Pre-rolls keep amount or count logging; Cart uses percent', () => {
    const rt = loadRecoveryTrackerApp();
    const purchases = [
        makePurchase({ id: 'bud-1', weedProductType: 'bud' }),
        makePurchase({ id: 'cart-1', weedProductType: 'cart' }),
        makePurchase({ id: 'edibles-1', weedProductType: 'edibles' }),
        makePurchase({ id: 'pr-1', weedProductType: 'pre-rolls' })
    ];
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData(purchases)));

    for (const type of ['bud', 'edibles', 'pre-rolls']) {
        installWeedDom(rt, {
            productType: type,
            amount: type === 'bud' ? '0.25' : '2',
            unit: type === 'bud' ? 'grams' : (type === 'edibles' ? 'edible' : 'units')
        });
        const entry = rt.buildUseEntryFromForm(null, null, null, null, null, null);
        assert.equal(entry.weedProductType, type);
        assert.notEqual(entry.logMode, 'weed_cart_percent');
        assert.ok(entry.amount > 0);
        if (type === 'bud') assert.equal(entry.unit, 'grams');
        else if (type === 'edibles') assert.equal(entry.unit, 'edible');
        else assert.equal(entry.unit, 'units');
    }

    installWeedDom(rt, {
        productType: 'cart',
        cartMode: 'checkpoints',
        percentBefore: '72',
        percentAfter: '64'
    });
    const cartCalc = rt.computeWeedCartUseFromForm();
    assert.equal(cartCalc.estimatedPercentUsed, 8);
    const cartEntry = rt.buildUseEntryFromForm(null, null, null, null, null, cartCalc);
    assert.equal(cartEntry.weedProductType, 'cart');
    assert.equal(cartEntry.logMode, 'weed_cart_percent');
    assert.equal(cartEntry.unit, 'percent');
    assert.equal(cartEntry.amount, 8);
    assert.equal(cartEntry.percentBefore, 72);
    assert.equal(cartEntry.percentLeftAfter, 64);
    assert.equal(cartEntry.estimatedPercentUsed, 8);
});

test('Cart checkpoints require before >= after and calculate estimated percent used', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([
        makePurchase({ id: 'cart-1', weedProductType: 'cart' })
    ])));
    installWeedDom(rt, {
        productType: 'cart',
        cartMode: 'checkpoints',
        percentBefore: '50',
        percentAfter: '60'
    });
    const bad = rt.computeWeedCartUseFromForm();
    assert.match(bad.error, /greater than or equal/i);

    installWeedDom(rt, {
        productType: 'cart',
        cartMode: 'estimated',
        percentUsed: '12'
    });
    const quick = rt.computeWeedCartUseFromForm();
    assert.equal(quick.estimatedPercentUsed, 12);
    assert.equal(quick.error, undefined);
});

test('Cart use deducts percent from inventory and never goes below 0%', () => {
    const rt = loadRecoveryTrackerApp();
    const data = rt.normalizeAppDataSafe(makeWeedData([
        makePurchase({ id: 'cart-1', weedProductType: 'cart', quantityBought: 1, remainingAmount: 1 })
    ]));
    rt.__setTestAppData(data);
    const purchase = data.purchases.find(p => p.id === 'cart-1');
    rt.ensureWeedCartTracksPercent(purchase);
    assert.equal(purchase.remainingAmount, 100);
    assert.equal(purchase.unit, 'percent');

    const log = {
        id: 'log-1',
        substanceId: WEED_ID,
        weedProductType: 'cart',
        logMode: 'weed_cart_percent',
        transactionType: 'use',
        type: 'quick',
        date: '2026-08-01',
        amount: 8,
        unit: 'percent',
        estimatedPercentUsed: 8,
        percentBefore: 100,
        percentLeftAfter: 92,
        purchaseId: 'cart-1',
        linkedPurchaseId: 'cart-1',
        inventoryAffects: true,
        supplyUnlinked: false
    };
    const result = rt.applyLogInventoryEffect(log, data);
    assert.equal(result.ok, true);
    assert.equal(purchase.remainingAmount, 92);

    const over = {
        ...log,
        id: 'log-2',
        amount: 200,
        estimatedPercentUsed: 200,
        percentBefore: 92,
        percentLeftAfter: 0
    };
    assert.equal(rt.applyLogInventoryEffect(over, data).ok, true);
    assert.equal(purchase.remainingAmount, 0);
    assert.equal(purchase.isDepleted, true);
});

test('Cart history/recent amount formats use percent, not generic units', () => {
    const rt = loadRecoveryTrackerApp();
    const withCheckpoints = {
        substanceId: WEED_ID,
        weedProductType: 'cart',
        logMode: 'weed_cart_percent',
        amount: 8,
        unit: 'percent',
        estimatedPercentUsed: 8,
        percentBefore: 72,
        percentLeftAfter: 64
    };
    const estimatedOnly = {
        substanceId: WEED_ID,
        weedProductType: 'cart',
        logMode: 'weed_cart_percent',
        amount: 8,
        unit: 'percent',
        estimatedPercentUsed: 8
    };
    assert.equal(rt.formatWeedCartUseSummary(withCheckpoints), '72% → 64% · 8% used');
    assert.equal(rt.formatWeedCartUseSummary(estimatedOnly), '8% estimated use');
    assert.match(rt.formatUseHistoryWeedAmountHtml(withCheckpoints), /72% → 64% · 8% used/);
    assert.doesNotMatch(rt.formatUseHistoryWeedAmountHtml(withCheckpoints), /\bunits\b/i);
});

test('older Weed logs without product type show Needs review and are not invented', () => {
    const rt = loadRecoveryTrackerApp();
    const log = {
        id: 'old-1',
        substanceId: WEED_ID,
        amount: 1,
        unit: 'grams',
        date: '2026-07-01',
        transactionType: 'use'
    };
    assert.equal(rt.weedLogNeedsProductTypeReview(log), true);
    assert.equal(rt.getWeedLogProductTypeLabel(log), 'Needs review');

    const data = makeWeedData([], [log]);
    rt.migrateWeedCartPercentInventory(data);
    assert.equal(data.logs[0].needsReview, true);
    assert.equal(data.logs[0].weedProductType, undefined);

    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([], [log])));
    // editing path helper: empty select must stay empty when review is needed
    const nodes = installWeedDom(rt, { productType: '' });
    nodes.get('use-weed-product-type').value = '';
    assert.equal(rt.getWeedUseProductType({ allowEmpty: true }), '');
});

test('inventory filter still matches each weed product type', () => {
    const rt = loadRecoveryTrackerApp();
    const purchases = [
        makePurchase({ id: 'bud-1', weedProductType: 'bud' }),
        makePurchase({ id: 'cart-1', weedProductType: 'cart' }),
        makePurchase({ id: 'edibles-1', weedProductType: 'edibles' }),
        makePurchase({ id: 'pr-1', weedProductType: 'pre-rolls' })
    ];
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData(purchases)));
    for (const type of ['bud', 'cart', 'edibles', 'pre-rolls']) {
        const active = rt.getActivePurchasesForWeedProductType(WEED_ID, type);
        assert.equal(active.length, 1, type);
        assert.ok(rt.purchaseMatchesWeedProductType(active[0], type));
    }
});
