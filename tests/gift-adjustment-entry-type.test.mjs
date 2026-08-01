import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function el(id, { value = '', className = '', hidden = false, dataset = {}, textContent = '' } = {}) {
    const classes = new Set(String(className || '').split(/\s+/).filter(Boolean));
    if (hidden) classes.add('hidden');
    const node = {
        id,
        value,
        textContent,
        dataset: { ...dataset },
        style: {},
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

function installUseLogDom(rt) {
    const nodes = new Map();
    const put = (id, opts) => {
        const node = el(id, opts);
        nodes.set(id, node);
        return node;
    };

    put('use-type', { value: 'quick' });
    put('use-transaction-type', { value: 'use' });
    put('use-substance', { value: 'coke' });
    put('use-entry-type-group', { className: 'use-log-entry-toggle use-entry-type-three' });
    put('use-transaction-type-block', { className: 'use-log-field-block' });
    put('use-adjustment-direction-group', { className: 'use-log-field-block', hidden: true });
    put('use-gift-party-group', { className: 'form-group', hidden: true });
    put('use-shared-fields-group', { className: 'form-group', hidden: true });
    put('use-gift-party-label', { textContent: 'Recipient Name' });
    put('use-amount-label', { textContent: 'Amount' });
    put('use-purchase-link-label', { textContent: 'Use From Inventory' });
    put('use-start-time-group');
    put('use-end-time-group', { hidden: true });
    put('use-end-date-group', { hidden: true });
    put('use-datetime-grid');
    put('use-start-time-label', { textContent: 'Start' });
    put('use-end-time', { value: '' });
    put('use-duration-preview', { hidden: true });
    put('use-log-form');

    const buttons = [
        el(null, { className: 'use-entry-toggle-btn type-toggle-btn active', dataset: { type: 'quick' } }),
        el(null, { className: 'use-entry-toggle-btn type-toggle-btn', dataset: { type: 'session' } }),
        el(null, { className: 'use-entry-toggle-btn type-toggle-btn', dataset: { type: 'gift_adjustment' } })
    ];
    const pills = [
        el(null, { className: 'use-tx-pill active', dataset: { tx: 'use', txGroup: 'use' } }),
        el(null, { className: 'use-tx-pill', dataset: { tx: 'shared_use', txGroup: 'use' } }),
        el(null, { className: 'use-tx-pill', dataset: { tx: 'gift_given', txGroup: 'gift' } }),
        el(null, { className: 'use-tx-pill', dataset: { tx: 'gift_received', txGroup: 'gift' } }),
        el(null, { className: 'use-tx-pill', dataset: { tx: 'inventory_adjustment', txGroup: 'gift' } })
    ];

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel === '.use-log-core-card') return el(null, { className: 'use-log-core-card' });
        if (sel === '.use-adj-pill.active') return el(null, { dataset: { dir: 'add' } });
        return null;
    };
    rt.document.querySelectorAll = (sel) => {
        if (sel === '#use-entry-type-group .use-entry-toggle-btn') return buttons;
        if (sel === '.use-entry-toggle-btn, .type-toggle-btn') return buttons;
        if (sel === '.use-tx-pill') return pills;
        if (sel === '.use-end-time-field') return [];
        return [];
    };

    return { nodes, buttons, pills };
}

test('Log tab markup includes Gift / Adjustment beside Quick Use and Session', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /data-type="gift_adjustment"/);
    assert.match(html, /selectUseEntryType\('gift_adjustment'\)/);
    assert.match(html, /Gift \/ Adjustment/);
    assert.match(html, /use-entry-type-three/);
    assert.match(html, /data-tx-group="gift"/);
    assert.match(html, /data-tx="gift_given"/);
    assert.match(html, /data-tx="gift_received"/);
    assert.match(html, /data-tx="inventory_adjustment"/);
});

test('entry toggle CSS uses three equal columns and stacks on mobile', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.use-log-entry-toggle\.use-entry-type-three\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css, /@media \(max-width:\s*640px\)\s*\{\s*\.use-log-entry-toggle\.use-entry-type-three\s*\{\s*grid-template-columns:\s*1fr;/);
});

test('selecting Gift / Adjustment shows gift pills and keeps gift_given transaction type', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe({
        ...rt.getDefaultAppData(),
        substances: [{
            id: 'coke',
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'session',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g'
        }]
    }));
    const { nodes, buttons, pills } = installUseLogDom(rt);

    rt.selectUseEntryType('gift_adjustment');

    assert.equal(nodes.get('use-transaction-type').value, 'gift_given');
    assert.equal(nodes.get('use-type').value, 'quick');
    assert.equal(buttons.find(b => b.dataset.type === 'gift_adjustment').classList.contains('active'), true);
    assert.equal(buttons.find(b => b.dataset.type === 'quick').classList.contains('active'), false);
    assert.equal(nodes.get('use-transaction-type-block').classList.contains('hidden'), false);
    assert.equal(pills.find(p => p.dataset.tx === 'gift_given').classList.contains('hidden'), false);
    assert.equal(pills.find(p => p.dataset.tx === 'gift_received').classList.contains('hidden'), false);
    assert.equal(pills.find(p => p.dataset.tx === 'inventory_adjustment').classList.contains('hidden'), false);
    assert.equal(pills.find(p => p.dataset.tx === 'use').classList.contains('hidden'), true);
    assert.equal(pills.find(p => p.dataset.tx === 'shared_use').classList.contains('hidden'), true);
});

test('leaving Gift / Adjustment restores Quick Use personal-use mode', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(rt.normalizeAppDataSafe({
        ...rt.getDefaultAppData(),
        substances: [{
            id: 'coke',
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'session',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g'
        }]
    }));
    const { nodes, buttons } = installUseLogDom(rt);

    rt.selectUseEntryType('gift_adjustment');
    rt.setUseTransactionType('gift_received');
    rt.selectUseEntryType('session');

    assert.equal(nodes.get('use-transaction-type').value, 'use');
    assert.equal(nodes.get('use-type').value, 'session');
    assert.equal(buttons.find(b => b.dataset.type === 'session').classList.contains('active'), true);
    assert.equal(buttons.find(b => b.dataset.type === 'gift_adjustment').classList.contains('active'), false);
});

test('gift/adjustment transaction types remain non-use for analytics exclusions', () => {
    const rt = loadRecoveryTrackerApp();
    assert.equal(rt.isNonUseTransactionType('gift_given'), true);
    assert.equal(rt.isNonUseTransactionType('gift_received'), true);
    assert.equal(rt.isNonUseTransactionType('inventory_adjustment'), true);
    assert.equal(rt.isNonUseTransactionType('use'), false);
    assert.equal(rt.isNonUseTransactionType('shared_use'), false);
    assert.equal(rt.isPersonalUseLog({ transactionType: 'gift_given' }), false);
    assert.equal(rt.isPersonalUseLog({ transactionType: 'inventory_adjustment' }), false);
    assert.equal(rt.isGiftGivenLog({ transactionType: 'gift_given' }), true);
    assert.equal(rt.isGiftReceivedLog({ transactionType: 'gift_received' }), true);
});
