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

function makeWeedPurchase(overrides = {}) {
    const type = overrides.weedProductType || 'bud';
    return {
        id: overrides.id || `weed-${type}-${Math.random().toString(36).slice(2, 7)}`,
        substanceId: WEED_ID,
        date: overrides.date || '2026-08-01',
        time: overrides.time || '12:00',
        quantityBought: overrides.quantityBought ?? 3.5,
        quantity: overrides.quantity ?? 3.5,
        unit: overrides.unit || 'grams',
        totalCost: overrides.totalCost ?? 40,
        remainingAmount: overrides.remainingAmount ?? 3.5,
        isDepleted: false,
        weedProductType: type,
        budGrams: type === 'bud' ? (overrides.budGrams ?? 3.5) : undefined,
        cartGrams: type === 'cart' ? (overrides.cartGrams ?? 1) : undefined,
        ediblesMg: type === 'edibles' ? (overrides.ediblesMg ?? 100) : undefined,
        preRollCount: type === 'pre-rolls' || type === 'prerolls' ? (overrides.preRollCount ?? 5) : undefined,
        gramsPerPreRoll: type === 'pre-rolls' || type === 'prerolls' ? (overrides.gramsPerPreRoll ?? 0.5) : undefined,
        totalPreRollGrams: type === 'pre-rolls' || type === 'prerolls' ? (overrides.totalPreRollGrams ?? 2.5) : undefined,
        ...overrides
    };
}

function el(id, { value = '', options = null, tag = 'select' } = {}) {
    const optionList = options ? options.map(o => ({
        value: o.value,
        textContent: o.label || o.value,
        get value() { return o.value; }
    })) : [];
    const node = {
        id,
        tagName: tag.toUpperCase(),
        _value: value,
        style: {},
        options: optionList,
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
        },
        get value() { return this._value; },
        set value(v) { this._value = String(v ?? ''); },
        get innerHTML() { return ''; },
        set innerHTML(html) {
            if (typeof html !== 'string') return;
            const matches = [...html.matchAll(/value="([^"]*)"[^>]*>([^<]*)</g)];
            this.options = matches.map(m => ({ value: m[1], textContent: m[2] }));
            if (!this.options.some(o => o.value === this._value)) this._value = '';
        },
        appendChild(opt) {
            this.options.push({ value: opt.value, textContent: opt.textContent });
        }
    };
    return node;
}

function installWeedUseDom(rt, { productType = 'bud', linkMode = 'auto' } = {}) {
    const nodes = new Map();
    nodes.set('use-substance', el('use-substance', { value: WEED_ID, tag: 'select' }));
    nodes.set('use-weed-product-type', el('use-weed-product-type', {
        value: productType,
        options: [
            { value: 'bud', label: 'Bud' },
            { value: 'cart', label: 'Cart' },
            { value: 'edibles', label: 'Edibles' },
            { value: 'pre-rolls', label: 'Pre-rolls' }
        ]
    }));
    nodes.set('use-purchase-link-mode', el('use-purchase-link-mode', { value: linkMode }));
    nodes.set('use-purchase-select', el('use-purchase-select', { value: '' }));
    nodes.set('use-transaction-type', el('use-transaction-type', { value: 'use', tag: 'input' }));
    nodes.set('use-purchase-link-label', { id: 'use-purchase-link-label', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
    nodes.set('use-purchase-manual-wrap', { id: 'use-purchase-manual-wrap', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
    nodes.set('use-purchase-preview', { id: 'use-purchase-preview', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
    nodes.set('use-amount', el('use-amount', { value: '0.5', tag: 'input' }));
    nodes.set('use-unit', el('use-unit', { value: 'grams' }));
    nodes.set('use-amount-label', { id: 'use-amount-label', textContent: 'Amount' });
    nodes.set('use-weed-product-type-group', { id: 'use-weed-product-type-group', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = () => [];
    rt.document.createElement = (tag) => {
        const node = { tagName: tag.toUpperCase(), value: '', textContent: '', style: {} };
        return node;
    };
    return nodes;
}

test('Log + Inventory markup use normalized weed product type values and labels', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="use-weed-product-type"[^>]*onchange="onWeedUseProductTypeChange\(\)"/);
    assert.match(html, /<option value="bud">Bud<\/option>/);
    assert.match(html, /<option value="cart">Cart<\/option>/);
    assert.match(html, /<option value="edibles">Edibles<\/option>/);
    assert.match(html, /<option value="pre-rolls">Pre-rolls<\/option>/);
    assert.doesNotMatch(html, /value="prerolls"/);
    assert.match(html, /id="buy-weed-product-type"/);
});

test('CSS keeps weed product type above inventory with stacking order', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /#use-weed-product-type-group\s*\{[^}]*z-index:\s*2/s);
    assert.match(css, /#use-inventory-core-anchor\s*\{[^}]*z-index:\s*1/s);
    assert.match(css, /#use-weed-product-type-group\s*\{[^}]*margin-bottom:\s*14px/s);
});

test('normalizeWeedProductType maps legacy and display values', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.normalizeWeedProductType('bud'), 'bud');
    assert.equal(rt.normalizeWeedProductType('cart'), 'cart');
    assert.equal(rt.normalizeWeedProductType('edibles'), 'edibles');
    assert.equal(rt.normalizeWeedProductType('pre-rolls'), 'pre-rolls');
    assert.equal(rt.normalizeWeedProductType('prerolls'), 'pre-rolls');
    assert.equal(rt.normalizeWeedProductType('pre_rolls'), 'pre-rolls');
    assert.equal(rt.normalizeWeedProductType(''), 'bud');
    assert.equal(rt.normalizeWeedProductType('', { allowEmpty: true }), '');
    assert.equal(rt.getWeedProductTypeLabel('pre-rolls'), 'Pre-rolls');
    assert.equal(rt.getWeedProductTypeLabel('prerolls'), 'Pre-rolls');
});

test('each weed product type filters inventory and auto-selects matching supply only', () => {
    const rt = loadRecoveryTrackerApp();
    const purchases = [
        makeWeedPurchase({ id: 'bud-1', weedProductType: 'bud', date: '2026-07-01', time: '10:00' }),
        makeWeedPurchase({ id: 'cart-1', weedProductType: 'cart', date: '2026-07-02', time: '10:00', quantityBought: 2, remainingAmount: 2 }),
        makeWeedPurchase({ id: 'edibles-1', weedProductType: 'edibles', date: '2026-07-03', time: '10:00', quantityBought: 10, remainingAmount: 10 }),
        makeWeedPurchase({ id: 'preroll-legacy', weedProductType: 'prerolls', date: '2026-07-04', time: '10:00', quantityBought: 2.5, remainingAmount: 2.5 }),
        makeWeedPurchase({ id: 'preroll-1', weedProductType: 'pre-rolls', date: '2026-07-05', time: '10:00', quantityBought: 2.5, remainingAmount: 2.5 })
    ];
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData(purchases)));

    for (const type of ['bud', 'cart', 'edibles', 'pre-rolls']) {
        const active = rt.getActivePurchasesForWeedProductType(WEED_ID, type);
        assert.ok(active.length >= 1, `expected supply for ${type}`);
        assert.ok(active.every(p => rt.purchaseMatchesWeedProductType(p, type)), `${type} filter leaked other types`);
        assert.ok(!active.some(p => (p.weedProductType || 'bud') === 'bud' && type !== 'bud'), `bud must not appear for ${type}`);

        const oldest = rt.getOldestActivePurchase(WEED_ID, null, { weedProductType: type });
        assert.ok(oldest, `auto-select missing for ${type}`);
        assert.ok(rt.purchaseMatchesWeedProductType(oldest, type));
    }
});

test('selecting a weed product type retains value and does not get reset from bud inventory', () => {
    const rt = loadRecoveryTrackerApp();
    const purchases = [
        makeWeedPurchase({ id: 'bud-1', weedProductType: 'bud', date: '2026-07-01' }),
        makeWeedPurchase({ id: 'cart-1', weedProductType: 'cart', date: '2026-07-10', quantityBought: 2, remainingAmount: 2 })
    ];
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData(purchases)));
    const nodes = installWeedUseDom(rt, { productType: 'bud', linkMode: 'auto' });

    nodes.get('use-weed-product-type').value = 'cart';
    rt.onWeedUseProductTypeChange();

    assert.equal(rt.getWeedUseProductType(), 'cart');
    assert.equal(nodes.get('use-weed-product-type').value, 'cart');

    const linked = rt.resolveLinkedPurchaseId(WEED_ID, 'use');
    assert.equal(linked, 'cart-1');

    rt.updateUsePurchaseLinkUI();
    assert.equal(rt.getWeedUseProductType(), 'cart', 'product type must survive inventory UI refresh');
    assert.match(nodes.get('use-purchase-preview').textContent, /Jul 10, 2026/);
    assert.doesNotMatch(nodes.get('use-purchase-preview').textContent, /Jul 1, 2026/);
});

test('editing a log loads saved weed product type into the selector', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([])));
    const nodes = installWeedUseDom(rt, { productType: 'bud' });

    rt.setWeedUseProductType('edibles', { defaultIfEmpty: true });
    assert.equal(nodes.get('use-weed-product-type').value, 'edibles');
    assert.equal(rt.getWeedUseProductType(), 'edibles');

    rt.setWeedUseProductType('prerolls', { defaultIfEmpty: true });
    assert.equal(nodes.get('use-weed-product-type').value, 'pre-rolls');
});

test('migrateWeedProductTypeValues normalizes legacy prerolls on logs and purchases', () => {
    const rt = loadRecoveryTrackerApp();
    const data = makeWeedData(
        [makeWeedPurchase({ id: 'p1', weedProductType: 'prerolls' })],
        [{ id: 'l1', substanceId: WEED_ID, weedProductType: 'prerolls', amount: 1, date: '2026-08-01' }]
    );
    rt.migrateWeedProductTypeValues(data);
    assert.equal(data.purchases[0].weedProductType, 'pre-rolls');
    assert.equal(data.logs[0].weedProductType, 'pre-rolls');

    const normalized = rt.normalizeAppDataSafe(makeWeedData(
        [makeWeedPurchase({ id: 'p2', weedProductType: 'prerolls' })],
        [{ id: 'l2', substanceId: WEED_ID, weedProductType: 'pre_rolls', amount: 1, date: '2026-08-01' }]
    ));
    assert.equal(normalized.purchases.find(p => p.id === 'p2')?.weedProductType, 'pre-rolls');
    assert.equal(normalized.logs.find(l => l.id === 'l2')?.weedProductType, 'pre-rolls');
});

test('weed product type defaults to Bud only when empty', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeWeedData([])));
    const nodes = installWeedUseDom(rt, { productType: '' });
    nodes.get('use-weed-product-type').value = '';

    assert.equal(rt.getWeedUseProductType({ allowEmpty: true }), '');
    assert.equal(rt.ensureWeedUseProductTypeDefault(), 'bud');
    assert.equal(nodes.get('use-weed-product-type').value, 'bud');

    nodes.get('use-weed-product-type').value = 'edibles';
    assert.equal(rt.ensureWeedUseProductTypeDefault(), 'edibles');
    assert.equal(nodes.get('use-weed-product-type').value, 'edibles');
});
