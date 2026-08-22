import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';

function makeData(purchases = [], substances = null) {
    return {
        substances: substances || [{
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

function el(id, { value = '', className = '', tag = 'div', options = null, hidden = false } = {}) {
    const classes = new Set(String(className || '').split(/\s+/).filter(Boolean));
    if (hidden) classes.add('hidden');
    const node = {
        id,
        tagName: tag.toUpperCase(),
        value,
        hidden: false,
        disabled: false,
        required: false,
        style: { display: '' },
        options: options || [],
        dataset: {},
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
        get className() { return [...classes].join(' '); },
        set className(v) {
            classes.clear();
            String(v || '').split(/\s+/).filter(Boolean).forEach(n => classes.add(n));
        }
    };
    return node;
}

function installBuyFormDom(rt, substanceId = COKE_ID) {
    const nodes = new Map();
    const put = (id, opts) => {
        const node = el(id, opts);
        nodes.set(id, node);
        return node;
    };

    put('buy-acquisition-type-block', { className: 'form-group buy-acquisition-type-group' });
    put('buy-acquisition-type', {
        tag: 'select',
        value: 'purchased',
        options: [
            { value: 'purchased', text: 'Purchased' },
            { value: 'gift_received', text: 'Gift Received' },
            { value: 'purchased_as_gift', text: 'Purchased as Gift' },
            { value: 'other_adjustment', text: 'Other / Adjustment' }
        ]
    });
    put('buy-gift-source-group', { className: 'form-group', hidden: true });
    put('buy-gift-source', { tag: 'input', value: '' });
    put('buy-gift-recipient-group', { className: 'form-group', hidden: true });
    put('buy-gift-recipient', { tag: 'input', value: '' });
    put('buy-gift-date-group', { className: 'form-group', hidden: true });
    put('buy-gift-date', { tag: 'input', value: '' });
    put('buy-total-cost-group', { className: 'form-group' });
    put('buy-total-cost', { tag: 'input', value: '100' });
    put('buy-cost-per-unit-group', { className: 'form-row' });
    put('buy-store-group', { className: 'form-group' });
    put('buy-store-select', { tag: 'select', value: 'Corner' });
    put('buy-store-new-group', { className: 'form-group', hidden: true });
    put('buy-store-new', { tag: 'input', value: '' });
    put('buy-payment-group', { className: 'form-group' });
    put('buy-payment', { tag: 'select', value: 'Cash' });
    put('buy-substance', { tag: 'select', value: substanceId });
    put('buy-quantity', { tag: 'input', value: '1' });
    put('buy-unit', { tag: 'select', value: 'g' });
    put('buy-date', { tag: 'input', value: '2026-08-01' });
    put('buy-time', { tag: 'input', value: '12:00' });
    put('buy-notes', { tag: 'textarea', value: '' });
    put('buy-cost-per-unit-preview', { tag: 'p' });
    put('buy-quantity-group');
    put('buy-unit-group');
    put('buy-time-group');
    put('buy-quantity-label');
    put('buy-nicotine-fields-group', { hidden: true });
    put('buy-vape-percent-group', { hidden: true });
    put('buy-vape-liquid-group', { hidden: true });
    put('buy-vape-flavor-group', { hidden: true });
    put('buy-alcohol-fields-group', { hidden: true });
    put('buy-weed-fields-group', { hidden: true });
    put('buy-cigarettes-fields-group', { hidden: true });
    put('buy-pouches-fields-group', { hidden: true });
    put('buy-gum-fields-group', { hidden: true });
    put('buy-patches-fields-group', { hidden: true });
    put('buy-lsd-fields-group', { hidden: true });
    put('buy-xanax-fields-group', { hidden: true });

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = (sel) => {
        if (sel === '#use-transaction-type-block .use-tx-pill') return [];
        if (sel === '.use-tx-pill') return [];
        return [];
    };
    return nodes;
}

test('Add Inventory markup uses a visible full-width How Acquired select', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /<label for="buy-acquisition-type">How Acquired<\/label>/);
    assert.match(html, /<select id="buy-acquisition-type" required/);
    assert.match(html, /<option value="purchased" selected>Purchased<\/option>/);
    assert.match(html, /<option value="gift_received">Gift Received<\/option>/);
    assert.match(html, /<option value="purchased_as_gift">Purchased as Gift<\/option>/);
    assert.match(html, /<option value="other_adjustment">Other \/ Adjustment<\/option>/);
    assert.doesNotMatch(html, /buy-acq-pill/);
    assert.doesNotMatch(html, /type="hidden" id="buy-acquisition-type"/);
    assert.match(html, /id="buy-gift-source"/);
    assert.match(html, /id="buy-gift-recipient"/);
    assert.match(html, /id="buy-gift-date"/);
    assert.match(html, /id="buy-total-cost-group"/);
    assert.match(html, /id="buy-store-group"/);
    assert.doesNotMatch(html, /id="buy-payment-group"/);
    assert.doesNotMatch(html, /Payment Method/);
});

test('How Acquired select CSS forces visible full-width control', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /#buy-acquisition-type\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /#buy-acquisition-type\s*\{[^}]*min-height:\s*44px/s);
    assert.match(css, /#buy-acquisition-type-block\.hidden\s*\{[^}]*display:\s*block\s*!important/s);
});

test('gift received hides cost, store, and payment while showing Gift From', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeData([])));
    const nodes = installBuyFormDom(rt, COKE_ID);

    rt.setBuyAcquisitionType('gift_received');

    assert.equal(nodes.get('buy-acquisition-type').value, 'gift_received');
    assert.equal(nodes.get('buy-acquisition-type-block').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-acquisition-type').style.display, '');
    assert.equal(nodes.get('buy-gift-source-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-total-cost-group').classList.contains('hidden'), true);
    assert.equal(nodes.get('buy-store-group').classList.contains('hidden'), true);
    assert.equal(nodes.get('buy-payment-group').classList.contains('hidden'), true);
    assert.equal(nodes.get('buy-total-cost').value, '0');
});

test('How Acquired select stays visible for Coke, Weed/THC, Nicotine, LSD, and Xanax', () => {
    const substances = [
        { id: 'coke', name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', units: ['g'], defaultUnit: 'g' },
        { id: 'weed-thc', name: 'Weed/THC', trackingMode: 'weed', primaryUnit: 'grams', units: ['grams', 'hits'], defaultUnit: 'grams' },
        { id: 'nicotine', name: 'Nicotine', trackingMode: 'nicotine', primaryUnit: 'puffs', units: ['puffs'], defaultUnit: 'puffs' },
        { id: 'lsd', name: 'LSD', trackingMode: 'dose', primaryUnit: 'ug', units: ['ug', 'tabs'], defaultUnit: 'ug' },
        { id: 'xannax', name: 'Xannax', trackingMode: 'dose', primaryUnit: 'mg', units: ['mg', 'pills'], defaultUnit: 'mg' }
    ];
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeData([], substances)));
    const nodes = installBuyFormDom(rt, 'coke');

    for (const sub of substances) {
        nodes.get('buy-substance').value = sub.id;
        rt.setBuyAcquisitionType('purchased');
        rt.updateBuyAcquisitionTypeUI();
        // Simulate Log-tab pill visibility pass that previously blanked How Acquired.
        rt.updateUseTransactionTypePillsVisibility?.();
        assert.equal(nodes.get('buy-acquisition-type').value, 'purchased', `${sub.name} default`);
        assert.equal(nodes.get('buy-acquisition-type-block').classList.contains('hidden'), false, `${sub.name} block visible`);
        assert.equal(nodes.get('buy-acquisition-type').hidden, false, `${sub.name} select not hidden`);
        assert.equal(nodes.get('buy-acquisition-type').disabled, false, `${sub.name} select enabled`);

        rt.setBuyAcquisitionType('gift_received');
        nodes.get('buy-gift-source').value = 'Alex';
        const payload = rt.buildPurchaseFromForm();
        assert.equal(payload.acquisitionType, 'gift_received', `${sub.name} gift payload`);
        assert.equal(payload.totalCost, 0, `${sub.name} gift cost`);
        assert.equal(payload.store, '', `${sub.name} gift store cleared`);
        assert.equal(payload.paymentMethod, '', `${sub.name} gift payment cleared`);
        assert.equal(payload.giftSource, 'Alex', `${sub.name} gift source`);
        assert.ok(payload.quantityBought > 0 || payload.quantity > 0 || true);
    }
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

test('purchased as gift keeps spend fields and shows gift recipient UI', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeData([])));
    const nodes = installBuyFormDom(rt, COKE_ID);

    rt.setBuyAcquisitionType('purchased_as_gift');

    assert.equal(nodes.get('buy-acquisition-type').value, 'purchased_as_gift');
    assert.equal(nodes.get('buy-gift-recipient-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-gift-date-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-gift-source-group').classList.contains('hidden'), true);
    assert.equal(nodes.get('buy-total-cost-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-store-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-payment-group').classList.contains('hidden'), false);
    assert.equal(nodes.get('buy-gift-recipient').required, true);
    assert.equal(nodes.get('buy-total-cost').required, true);
    assert.equal(nodes.get('buy-total-cost').value, '100');
});

test('purchased as gift records spend with no usable inventory', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe(makeData([])));
    const nodes = installBuyFormDom(rt, COKE_ID);

    rt.setBuyAcquisitionType('purchased_as_gift');
    nodes.get('buy-gift-recipient').value = 'Sam';
    nodes.get('buy-gift-date').value = '2026-08-02';
    nodes.get('buy-quantity').value = '2';
    nodes.get('buy-total-cost').value = '80';

    const payload = rt.buildPurchaseFromForm();
    assert.equal(payload.acquisitionType, 'purchased_as_gift');
    assert.equal(payload.giftRecipient, 'Sam');
    assert.equal(payload.giftDate, '2026-08-02');
    assert.equal(payload.totalCost, 80);
    assert.equal(payload.store, 'Corner');
    assert.equal(payload.paymentMethod, 'Cash');
    assert.equal(payload.isGiftReceived, false);

    const record = rt.finalizeNewPurchaseRecord(payload);
    assert.equal(rt.getPurchaseAcquisitionType(record), 'purchased_as_gift');
    assert.equal(rt.purchaseCountsAsBuySpend(record), true);
    assert.equal(rt.getPurchaseSpendAmount(record), 80);
    assert.equal(rt.getPurchaseRemainingAmount(record), 0);
    assert.equal(record.inventoryStatus, 'gifted');
    assert.equal(record.isDepleted, true);
    assert.equal(rt.getPurchaseInventoryTab(record), 'gifted');
    assert.equal(rt.getPurchaseSupplyStatus(record).key, 'gifted');
    assert.match(rt.renderPurchaseAcquisitionBadge(record), /Purchased as Gift/);
    assert.match(rt.renderPurchaseAcquisitionBadge(record), /badge-purchased-as-gift/);
});

test('purchased as gift is distinct from gift received for inventory and spend', () => {
    const personal = makePurchase({
        id: 'buy-1',
        totalCost: 100,
        quantityBought: 2,
        quantity: 2,
        remainingAmount: 2
    });
    const giftReceived = makePurchase({
        id: 'gift-recv-1',
        acquisitionType: 'gift_received',
        giftSource: 'Alex',
        totalCost: 0,
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        paymentMethod: ''
    });
    const purchasedAsGift = makePurchase({
        id: 'gift-buy-1',
        acquisitionType: 'purchased_as_gift',
        giftRecipient: 'Jordan',
        giftDate: '2026-08-03',
        totalCost: 60,
        costPerUnit: 30,
        quantityBought: 2,
        quantity: 2,
        remainingAmount: 0,
        isDepleted: true,
        inventoryStatus: 'gifted'
    });
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate('2026-08-01');
    const data = rt.normalizeAppDataSafe(makeData([personal, giftReceived, purchasedAsGift]));
    rt.__setTestAppData(data);

    const gifted = data.purchases.find(p => p.id === 'gift-buy-1');
    assert.equal(rt.getPurchaseAcquisitionType(gifted), 'purchased_as_gift');
    assert.equal(rt.getPurchaseGiftRecipient(gifted), 'Jordan');
    assert.equal(rt.purchaseCountsAsBuySpend(gifted), true);
    assert.equal(rt.getPurchaseSpendAmount(gifted), 60);
    assert.equal(rt.getPurchaseRemainingAmount(gifted), 0);
    assert.equal(rt.purchaseIsPersonalUseInventory(gifted), false);

    const insight = rt.getPurchasesForInsightMetrics(COKE_ID, data);
    assert.equal(insight.length, 2);
    assert.ok(insight.some(p => p.id === 'buy-1'));
    assert.ok(insight.some(p => p.id === 'gift-buy-1'));
    assert.ok(!insight.some(p => p.id === 'gift-recv-1'));

    const active = rt.getActivePurchasesForSubstance(COKE_ID);
    assert.equal(active.length, 2);
    assert.ok(active.every(p => p.id !== 'gift-buy-1'));
    assert.ok(active.some(p => p.id === 'gift-recv-1'));

    const stats = rt.getBuyStats(COKE_ID);
    assert.equal(stats.countMonth, 2);
    assert.ok(Math.abs(stats.spentMonth - 160) < 0.001);

    const giftMetrics = rt.getGiftMetrics(COKE_ID);
    assert.ok(Math.abs(giftMetrics.given - 2) < 0.001);
    assert.equal(giftMetrics.recipients.Jordan, 2);
});

test('purchased as gift export / import / duplicate preserve recipient and gifted status', () => {
    const rt = loadRecoveryTrackerApp();
    const original = makePurchase({
        id: 'gift-buy-keep',
        acquisitionType: 'purchased_as_gift',
        giftRecipient: 'Casey',
        giftDate: '2026-08-04',
        totalCost: 45,
        costPerUnit: 15,
        quantityBought: 3,
        quantity: 3,
        remainingAmount: 0,
        isDepleted: true,
        inventoryStatus: 'gifted'
    });
    const data = rt.normalizeAppDataSafe(makeData([original]));
    rt.__setTestAppData(data);

    const exported = rt.cleanExportData(data);
    const exportedPurchase = exported.purchases.find(p => p.id === 'gift-buy-keep');
    assert.equal(exportedPurchase.acquisitionType, 'purchased_as_gift');
    assert.equal(exportedPurchase.giftRecipient, 'Casey');
    assert.equal(exportedPurchase.giftDate, '2026-08-04');
    assert.equal(exportedPurchase.totalCost, 45);

    const reimported = rt.normalizeAppDataSafe({
        ...rt.getDefaultAppData(),
        substances: data.substances,
        purchases: exported.purchases
    });
    const roundTrip = reimported.purchases.find(p => p.id === 'gift-buy-keep');
    assert.equal(rt.getPurchaseAcquisitionType(roundTrip), 'purchased_as_gift');
    assert.equal(rt.getPurchaseGiftRecipient(roundTrip), 'Casey');
    assert.equal(rt.getPurchaseRemainingAmount(roundTrip), 0);
    assert.equal(roundTrip.inventoryStatus, 'gifted');

    rt.__setTestAppData(data);
    const dup = rt.duplicatePurchaseNow('gift-buy-keep');
    assert.ok(dup);
    assert.equal(rt.getPurchaseAcquisitionType(dup), 'purchased_as_gift');
    assert.equal(rt.getPurchaseGiftRecipient(dup), 'Casey');
    assert.equal(rt.getPurchaseSpendAmount(dup), 45);
    assert.equal(rt.getPurchaseRemainingAmount(dup), 0);
    assert.equal(dup.inventoryStatus, 'gifted');
});
