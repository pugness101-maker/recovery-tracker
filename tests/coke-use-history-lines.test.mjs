import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';
const NICOTINE_ID = 'nicotine';
const KETAMINE_ID = 'ketamine';
const WEED_ID = 'weed-thc';

function makeSubstances() {
    return [
        {
            id: COKE_ID,
            name: 'Coke',
            icon: '❄️',
            color: '#90caf9',
            trackingMode: 'powder',
            primaryUnit: 'g',
            secondaryCountLabel: 'lines',
            units: ['g', 'mg'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        {
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            color: '#78909c',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        {
            id: KETAMINE_ID,
            name: 'Ketamine',
            icon: '💉',
            color: '#a5d6a7',
            trackingMode: 'powder',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        },
        {
            id: WEED_ID,
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            trackingMode: 'weed',
            primaryUnit: 'g',
            units: ['g'],
            defaultUnit: 'g',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            active: true
        }
    ];
}

function makeData({ logs = [], purchases = [] } = {}) {
    return {
        substances: makeSubstances(),
        logs,
        purchases,
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            spreadPercentLeftUsage: true,
            dashboardSubstanceId: 'all'
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function cokeLog(overrides = {}) {
    return {
        id: overrides.id || 'coke-1',
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '18:00',
        endTime: '21:00',
        amount: 0.9,
        unit: 'g',
        transactionType: 'use',
        type: 'session',
        ...overrides
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    rt.setTestReferenceDate('2026-07-28');
    rt.setUseLogFilter('all');
    return rt;
}

function el(id, { value = '', tag = 'input', options = [] } = {}) {
    const classes = new Set();
    const node = {
        id,
        tagName: tag.toUpperCase(),
        value,
        required: false,
        options,
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
        className: '',
        textContent: '',
        style: {},
        dataset: {}
    };
    return node;
}

function installCokeLogDom(rt, {
    amount = '0.9',
    lines = '',
    type = 'session',
    transactionType = 'use',
    date = '2026-07-28',
    startTime = '18:00',
    endTime = '21:00'
} = {}) {
    const nodes = new Map();
    const put = (id, opts) => {
        const node = el(id, opts);
        nodes.set(id, node);
        return node;
    };
    put('use-substance', { value: COKE_ID, tag: 'select', options: [{ value: COKE_ID }] });
    put('use-transaction-type', { value: transactionType, tag: 'select' });
    put('use-type', { value: type, tag: 'select' });
    put('use-date', { value: date });
    put('use-end-date', { value: date });
    put('use-start-time', { value: startTime });
    put('use-end-time', { value: endTime });
    put('use-amount', { value: String(amount) });
    put('use-unit', { value: 'g', tag: 'select' });
    put('use-count', { value: String(lines) });
    put('use-notes', { value: '' });
    put('use-gift-party', { value: '' });
    put('use-purchase-link-mode', { value: 'none', tag: 'select' });
    put('use-purchase-select', { value: '', tag: 'select' });
    rt.document.getElementById = (id) => nodes.get(id) || null;
    return nodes;
}

test('existing Lines (optional) input remains in the log form', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="use-count"/);
    assert.match(html, /id="use-count-group"/);
});

test('Coke form saves Lines on quick and session logs and does not derive from grams', () => {
    const rt = setup(makeData());
    installCokeLogDom(rt, { amount: '1.2', lines: '8', type: 'session' });
    const session = rt.buildUseEntryFromForm();
    assert.equal(session.substanceId, COKE_ID);
    assert.equal(session.amount, 1.2);
    assert.equal(session.lines, 8);
    assert.equal(session.count, 8);
    assert.equal(rt.getUseLogLines(session), 8);
    assert.equal(rt.formatUseHistoryLines(session), '8');

    installCokeLogDom(rt, { amount: '1.2', lines: '3', type: 'quick' });
    const quick = rt.buildUseEntryFromForm();
    assert.equal(quick.type, 'quick');
    assert.equal(quick.amount, 1.2);
    assert.equal(quick.lines, 3);
    assert.equal(rt.getUseLogLines(quick), 3);

    installCokeLogDom(rt, { amount: '2.5', lines: '', type: 'session' });
    const missing = rt.buildUseEntryFromForm();
    assert.equal(missing.amount, 2.5);
    assert.equal(missing.lines, null);
    assert.equal(rt.getUseLogLines(missing), null);
    assert.equal(rt.formatUseHistoryLines(missing), '—');
    assert.notEqual(rt.getUseLogLines(missing), missing.amount);
});

test('Lines column is Coke-only in Use History catalog and customization', () => {
    const rt = setup(makeData());
    const cokeCatalog = rt.getUseHistoryColumnCatalog(COKE_ID);
    assert.ok(cokeCatalog.includes('lines'));
    assert.equal(rt.getUseHistoryColumnLabel('lines', COKE_ID), 'Lines');
    assert.ok(rt.getUseHistoryVisibleColumns(COKE_ID).includes('lines'));

    assert.ok(!rt.getUseHistoryColumnCatalog(NICOTINE_ID).includes('lines'));
    assert.ok(!rt.getUseHistoryColumnCatalog(WEED_ID).includes('lines'));
    assert.ok(!rt.getUseHistoryColumnCatalog(KETAMINE_ID).includes('lines'));
    assert.ok(!rt.getUseHistoryColumnCatalog(null).includes('lines'));

    for (const presetId of ['basic', 'cost', 'inventory', 'detailed']) {
        const coke = rt.getColumnPresetDefinition(presetId, 'useHistory', COKE_ID);
        assert.ok(coke.order.includes('lines'), presetId);
        assert.equal(coke.visible.lines, true, presetId);
        const nic = rt.getColumnPresetDefinition(presetId, 'useHistory', NICOTINE_ID);
        assert.ok(!nic.order.includes('lines'), presetId);
    }
});

test('Use History shows saved Lines and em dash when missing', () => {
    const rt = setup(makeData());
    const sub = { id: COKE_ID, name: 'Coke', defaultUnit: 'g', icon: '❄️' };
    const withLines = cokeLog({ lines: 8, amount: 1 });
    const missing = cokeLog({ id: 'coke-2', amount: 1 });
    const legacyCount = cokeLog({ id: 'coke-3', amount: 1, count: 5 });
    const zeroCount = cokeLog({ id: 'coke-4', amount: 1, count: 0 });

    assert.match(rt.renderUseHistoryBodyCell('lines', withLines, sub, null), />8</);
    assert.match(rt.renderUseHistoryBodyCell('lines', missing, sub, null), /—/);
    assert.match(rt.renderUseHistoryBodyCell('lines', legacyCount, sub, null), />5</);
    assert.match(rt.renderUseHistoryBodyCell('lines', zeroCount, sub, null), /—/);
    assert.equal(rt.formatUseHistoryLines(withLines), '8');
    assert.equal(rt.formatUseHistoryLines(missing), '—');
    assert.equal(rt.getUseLogLines(missing), null);
    assert.notEqual(rt.getUseLogLines(withLines), withLines.amount);
});

test('editing a Coke log reloads and preserves Lines', () => {
    const rt = setup(makeData());
    const saved = cokeLog({ lines: 12, count: 12, amount: 0.6 });
    assert.equal(rt.getUseCount(saved), 12);
    assert.equal(rt.getUseLogLines(saved), 12);

    const empty = cokeLog({ id: 'empty', amount: 0.6, count: 0, lines: null });
    assert.equal(rt.getUseCount(empty), '');
    assert.equal(rt.getUseLogLines(empty), null);

    installCokeLogDom(rt, { amount: '0.6', lines: '12', type: 'session' });
    const rebuilt = rt.buildUseEntryFromForm();
    assert.equal(rebuilt.lines, 12);
    assert.equal(rt.getUseCount(rebuilt), 12);
});

test('Coke Log summary totals Lines and follows date filters', () => {
    const data = makeData({
        logs: [
            cokeLog({ id: 'today', date: '2026-07-28', lines: 8, amount: 0.9 }),
            cokeLog({ id: 'yesterday', date: '2026-07-27', lines: 4, amount: 0.5 }),
            cokeLog({ id: 'gift', date: '2026-07-28', lines: 99, amount: 1, transactionType: 'gift_given' }),
            cokeLog({ id: 'adj', date: '2026-07-28', lines: 50, amount: 0.2, transactionType: 'inventory_adjustment' }),
            cokeLog({ id: 'received', date: '2026-07-28', lines: 20, amount: 0.3, transactionType: 'gift_received' }),
            {
                id: 'nic-1',
                substanceId: NICOTINE_ID,
                date: '2026-07-28',
                amount: 400,
                unit: 'puffs',
                transactionType: 'use',
                type: 'quick',
                lines: 7
            }
        ]
    });
    const rt = setup(data);

    const all = rt.getUseLogTotalsForView(COKE_ID);
    assert.equal(all.totalLines, 12);
    assert.equal(rt.sumUseLinesForLogs(all.logs), 12);

    rt.setUseLogFilter('today');
    const today = rt.getUseLogTotalsForView(COKE_ID);
    assert.equal(today.totalLines, 8);
    assert.ok(today.logs.some(l => l.id === 'gift'));
    assert.equal(rt.logCountsTowardLinesTotal(today.logs.find(l => l.id === 'gift')), false);
    assert.equal(rt.logCountsTowardLinesTotal(today.logs.find(l => l.id === 'today')), true);

    rt.setUseLogFilter('all');
    const nic = rt.getUseLogTotalsForView(NICOTINE_ID);
    assert.equal(nic.totalLines, null);
});

test('gift and adjustment Lines are stored but excluded from totals', () => {
    const rt = setup(makeData());
    installCokeLogDom(rt, { lines: '9', transactionType: 'gift_given' });
    const gift = rt.buildUseEntryFromForm();
    assert.equal(gift.transactionType, 'gift_given');
    assert.equal(gift.lines, null);
    assert.equal(rt.logCountsTowardLinesTotal(gift), false);

    installCokeLogDom(rt, { lines: '9', transactionType: 'inventory_adjustment' });
    const adj = rt.buildUseEntryFromForm();
    assert.equal(adj.transactionType, 'inventory_adjustment');
    assert.equal(adj.lines, null);
    assert.equal(rt.logCountsTowardLinesTotal(adj), false);
});

test('JSON export/import preserves Lines and never invents them from grams', () => {
    const rt = setup(makeData({
        logs: [
            cokeLog({ id: 'with-lines', lines: 11, count: 11, amount: 2.2 }),
            cokeLog({ id: 'no-lines', amount: 2.2, count: 0 }),
            cokeLog({ id: 'legacy-count', amount: 0.4, count: 6 })
        ]
    }));
    const exported = rt.cleanExportData(rt.__getTestAppData());
    const byId = Object.fromEntries(exported.logs.map(l => [l.id, l]));
    assert.equal(byId['with-lines'].lines, 11);
    assert.equal(byId['no-lines'].lines, null);
    assert.equal(byId['legacy-count'].lines, 6);
    assert.notEqual(byId['no-lines'].lines, byId['no-lines'].amount);

    const imported = rt.normalizeImportedAppData(exported);
    assert.equal(imported.logs.find(l => l.id === 'with-lines').lines, 11);
    assert.equal(rt.getUseLogLines(imported.logs.find(l => l.id === 'with-lines')), 11);
    assert.equal(rt.getUseLogLines(imported.logs.find(l => l.id === 'no-lines')), null);
    assert.equal(rt.getUseLogLines(imported.logs.find(l => l.id === 'legacy-count')), 6);

    const merged = rt.mergeImportedData(makeData(), imported);
    assert.equal(merged.logs.find(l => l.id === 'with-lines').lines, 11);
});

test('Use History CSV includes Lines for Coke visible columns', () => {
    const rt = setup(makeData({
        logs: [cokeLog({ lines: 8, amount: 0.9 })]
    }));
    const csv = rt.buildUseHistoryCsvRows({ substanceId: COKE_ID });
    assert.ok(csv.headers.includes('Lines'));
    const col = csv.headers.indexOf('Lines');
    assert.equal(csv.body[0][col], '8');
});

test('selected Active Substance still controls Home and Log filtering', () => {
    const data = makeData({
        logs: [
            cokeLog({ id: 'coke-1', lines: 8 }),
            {
                id: 'nic-1',
                substanceId: NICOTINE_ID,
                date: '2026-07-28',
                amount: 400,
                unit: 'puffs',
                transactionType: 'use',
                type: 'quick'
            }
        ],
        purchases: [{
            id: 'p-coke',
            substanceId: COKE_ID,
            date: '2026-07-20',
            quantity: 3.5,
            quantityBought: 3.5,
            remainingAmount: 2,
            unit: 'g',
            totalCost: 80
        }]
    });
    const rt = setup(data);

    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    assert.equal(rt.getUseLogViewSubstanceId(), COKE_ID);
    const cokeLogs = rt.getFilteredUseLogsForView();
    assert.ok(cokeLogs.length >= 1);
    assert.ok(cokeLogs.every(l => l.substanceId === COKE_ID));

    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    assert.equal(rt.getUseLogViewSubstanceId(), NICOTINE_ID);
    const nicLogs = rt.getFilteredUseLogsForView();
    assert.ok(nicLogs.every(l => l.substanceId === NICOTINE_ID));
    assert.ok(!nicLogs.some(l => l.substanceId === COKE_ID));

    rt.setSelectedDashboardSubstance(COKE_ID, { persist: false, render: false });
    const home = rt.buildRecoveryDashboardDataset(undefined, { substanceId: COKE_ID, bypassCache: true });
    assert.ok(home.statusCards.every(c => c.substanceId === COKE_ID));
    assert.ok(!home.statusCards.some(c => c.substanceId === NICOTINE_ID));
});
