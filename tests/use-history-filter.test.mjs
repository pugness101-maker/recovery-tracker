import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';
const COKE_ID = 'coke';
const LSD_ID = 'lsd';

function makeSubstances() {
    return [
        {
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
        },
        {
            id: NICOTINE_ID,
            name: 'Nicotine',
            icon: '💨',
            color: '#78909c',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            units: ['puffs', 'cigarettes', 'pouches', 'pieces', 'patches'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        },
        {
            id: LSD_ID,
            name: 'LSD',
            icon: '🌀',
            color: '#ce93d8',
            trackingMode: 'lsd',
            primaryUnit: 'ug',
            units: ['ug', 'tabs'],
            defaultUnit: 'ug',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
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

function cokeLog(id, date, amount = 0.5) {
    return {
        id,
        substanceId: COKE_ID,
        date,
        startTime: '20:00',
        endTime: '22:00',
        amount,
        unit: 'g',
        transactionType: 'use',
        type: 'session',
        estimatedCost: amount * 80
    };
}

function nicotineVapeLog(id, date, amount = 1000, extra = {}) {
    return {
        id,
        substanceId: NICOTINE_ID,
        nicotineProductType: 'vape',
        date,
        amount,
        unit: 'puffs',
        transactionType: 'use',
        type: 'quick',
        ...extra
    };
}

function nicotineCigLog(id, date, amount = 2) {
    return {
        id,
        substanceId: NICOTINE_ID,
        nicotineProductType: 'cigarettes',
        date,
        amount,
        cigarettesUsed: amount,
        unit: 'cigarettes',
        transactionType: 'use',
        type: 'quick'
    };
}

function lsdLog(id, date) {
    return {
        id,
        substanceId: LSD_ID,
        date,
        amount: 100,
        ugUsed: 100,
        tabsUsed: 1,
        unit: 'ug',
        transactionType: 'use',
        type: 'quick'
    };
}

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setTestReferenceDate('2026-07-28');
    rt.setUseLogFilter('all');
    return rt;
}

function substanceIdsInRows(rows) {
    return [...new Set(rows.map(({ entry }) => entry.substanceId))];
}

test('1. Nicotine selection excludes Coke rows', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000),
            nicotineCigLog('nic-2', '2026-07-22', 3)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });

    const filtered = rt.getFilteredUseLogsForView({ substanceId: NICOTINE_ID });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every(l => l.substanceId === NICOTINE_ID));
    assert.ok(!filtered.some(l => l.substanceId === COKE_ID));

    const rows = rt.buildUseHistoryRows(NICOTINE_ID);
    assert.equal(rows.length, 2);
    assert.deepEqual(substanceIdsInRows(rows), [NICOTINE_ID]);
});

test('2. Coke selection excludes Nicotine rows', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            cokeLog('coke-2', '2026-07-21', 0.8),
            nicotineVapeLog('nic-1', '2026-07-21', 4000)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });

    const filtered = rt.getFilteredUseLogsForView({ substanceId: COKE_ID });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every(l => l.substanceId === COKE_ID));

    const rows = rt.buildUseHistoryRows(COKE_ID);
    assert.equal(rows.length, 2);
    assert.deepEqual(substanceIdsInRows(rows), [COKE_ID]);
});

test('3. Summary cards match visible rows', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000),
            nicotineCigLog('nic-2', '2026-07-22', 3),
            nicotineVapeLog('nic-3', '2026-07-23', 500)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });

    const rows = rt.buildUseHistoryRows();
    const totals = rt.getUseLogTotalsForView();
    assert.equal(totals.entryCount, rows.length);
    assert.equal(totals.entryCount, 3);
    assert.equal(totals.logs.length, 3);
    assert.ok(totals.logs.every(l => l.substanceId === NICOTINE_ID));
});

test('4. Switching substances immediately refreshes the table dataset', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000)
        ]
    });
    const rt = setup(data);

    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    assert.equal(rt.__getUseHistoryEntryCount(), 1);
    assert.deepEqual(substanceIdsInRows(rt.buildUseHistoryRows()), [NICOTINE_ID]);

    rt.setSelectedSubstanceId(COKE_ID, { refresh: false });
    assert.equal(rt.__getUseHistoryEntryCount(), 1);
    assert.deepEqual(substanceIdsInRows(rt.buildUseHistoryRows()), [COKE_ID]);

    rt.setSelectedSubstanceId(rt.DASHBOARD_ALL, { refresh: false });
    assert.equal(rt.__getUseHistoryEntryCount(), 2);
});

test('5. Nicotine product-type organization', () => {
    const data = makeData({
        logs: [
            nicotineCigLog('cig-1', '2026-07-25', 2),
            nicotineVapeLog('vape-1', '2026-07-24', 1000),
            {
                id: 'pouch-1',
                substanceId: NICOTINE_ID,
                nicotineProductType: 'pouches',
                date: '2026-07-26',
                amount: 4,
                pouchesUsed: 4,
                unit: 'pouches',
                transactionType: 'use',
                type: 'quick'
            }
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });

    const rows = rt.buildUseHistoryRows(NICOTINE_ID);
    const types = rows.map(({ entry }) => entry.nicotineProductType || 'other');
    assert.equal(types.join(','), 'vape,cigarettes,pouches');

    const catalog = rt.getUseHistoryColumnCatalog(NICOTINE_ID);
    assert.ok(catalog.includes('productType'));
    assert.ok(catalog.includes('sharedAmount'));
    assert.ok(!catalog.includes('tabs'));

    const cokeCatalog = rt.getUseHistoryColumnCatalog(COKE_ID);
    assert.ok(cokeCatalog.includes('amount'));
    assert.ok(cokeCatalog.includes('cost'));
    assert.ok(!cokeCatalog.includes('productType'));
    assert.ok(!cokeCatalog.includes('sharedAmount'));
});

test('6. Long vape labels stay in compact amount cells (no Actions overlap)', () => {
    const rt = setup(makeData());
    const checkpoint = nicotineVapeLog('vape-long', '2026-07-20', 4000, {
        isPercentLeftCheckpoint: true,
        percentBefore: 80,
        percentLeftAfter: 60,
        originalTotalEstimatedPuffs: 4000,
        estimatedFromPercent: true,
        isEstimated: true,
        inputMode: 'percent_left'
    });
    const shared = nicotineVapeLog('vape-shared', '2026-07-21', 100, {
        transactionType: 'shared_use',
        personalAmount: 60,
        sharedAmount: 40,
        totalAmount: 100,
        sharedWithName: 'Juju With A Very Long Name That Could Overflow'
    });

    const checkpointHtml = rt.formatUseHistoryVapeAmountHtml(checkpoint);
    assert.match(checkpointHtml, /use-history-amount-compact/);
    assert.match(checkpointHtml, /Percent-left checkpoint · 80% → 60%/);
    assert.match(checkpointHtml, /Estimated 4,000 puffs/);

    const sharedHtml = rt.formatUseHistoryVapeAmountHtml(shared);
    assert.match(sharedHtml, /use-history-amount-compact/);
    assert.match(sharedHtml, /Shared Use · Me 60 puffs · Juju/);

    const cols = rt.getUseHistoryVisibleColumns(NICOTINE_ID);
    assert.ok(cols.includes('actions'));
    assert.ok(cols.includes('amount'));
    assert.equal(rt.getUseHistoryColumnLabel('amount', NICOTINE_ID), 'Puffs / Percent Left');
    assert.equal(rt.getUseHistoryColumnLabel('inventory', NICOTINE_ID), 'Linked Vape');
});

test('7. All Substances mixed-unit summary', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 14.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000),
            lsdLog('lsd-1', '2026-07-22')
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(rt.DASHBOARD_ALL, { refresh: false });

    const totals = rt.getUseLogTotalsForView(null);
    assert.equal(totals.entryCount, 3);
    assert.equal(totals.totalGrams, null);

    const label = rt.formatMixedUseTotalsLabel(totals.logs);
    assert.match(label, /Coke:\s*14\.2\s*g/);
    assert.match(label, /Nicotine:.*4,?000\s*puffs/);
    assert.match(label, /LSD:.*1\s*tabs.*100\s*µg|LSD:.*100\s*µg.*1\s*tabs/);
    assert.ok(!/^\d+(\.\d+)?\s*units$/i.test(label.trim()));

    const catalog = rt.getUseHistoryColumnCatalog(null);
    assert.ok(catalog.includes('substance'));
});

test('8. Date range plus substance filtering', () => {
    const data = makeData({
        logs: [
            nicotineVapeLog('nic-old', '2026-07-01', 1000),
            nicotineVapeLog('nic-new', '2026-07-28', 500),
            cokeLog('coke-today', '2026-07-28', 0.4)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    rt.setUseLogFilter('today');

    const filtered = rt.getFilteredUseLogsForView({ substanceId: NICOTINE_ID, dateFilter: 'today' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'nic-new');

    const rows = rt.buildUseHistoryRows(NICOTINE_ID);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entry.id, 'nic-new');

    const totals = rt.getUseLogTotalsForView(NICOTINE_ID);
    assert.equal(totals.entryCount, 1);
});

test('9. CSV matching visible filtered rows', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000),
            nicotineCigLog('nic-2', '2026-07-22', 3)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });

    const visible = rt.buildUseHistoryRows();
    const csv = rt.buildUseHistoryCsvRows();
    assert.equal(csv.body.length, visible.length);
    assert.equal(csv.body.length, 2);

    const substanceCol = csv.headers.indexOf('Substance');
    if (substanceCol >= 0) {
        assert.ok(csv.body.every(row => row[substanceCol] === 'Nicotine' || row[substanceCol] === ''));
    }

    const productCol = csv.headers.indexOf('Product Type');
    assert.ok(productCol >= 0, 'Nicotine CSV should include Product Type');
    const productTypes = csv.body.map(row => row[productCol]);
    assert.ok(productTypes.includes('Vape') || productTypes.includes('vape') || productTypes.some(Boolean));
});

test('10. Persistence after refresh keeps filtered view data intact', () => {
    const data = makeData({
        logs: [
            cokeLog('coke-1', '2026-07-20', 1.2),
            nicotineVapeLog('nic-1', '2026-07-21', 4000),
            nicotineCigLog('nic-2', '2026-07-22', 3)
        ]
    });
    const rt = setup(data);
    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    rt.saveData(rt.__getTestAppData());

    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.ok(reloaded.logs.length >= 3);

    rt.setSelectedSubstanceId(NICOTINE_ID, { refresh: false });
    const filtered = rt.getFilteredUseLogsForView({ substanceId: NICOTINE_ID });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every(l => l.substanceId === NICOTINE_ID));

    const rows = rt.buildUseHistoryRows(NICOTINE_ID);
    assert.equal(rows.length, 2);
});
