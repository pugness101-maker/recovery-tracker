import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

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

function setup(data) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(data);
    rt.setSelectedSubstanceId(COKE_ID);
    rt.setTestReferenceDate('2026-07-28');
    return rt;
}

test('1. standard g/hr calculation', () => {
    const rt = setup(makeData());
    const entry = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '18:00',
        endTime: '21:00',
        amount: 0.9,
        unit: 'g',
        transactionType: 'use',
        type: 'session'
    };
    assert.equal(rt.computeUseHistoryGramsPerHour(entry), 0.3);
    assert.equal(rt.formatUseHistoryGramsPerHour(entry), '0.30');

    const entry2 = {
        ...entry,
        startTime: '12:00',
        endTime: '14:30',
        amount: 1.2
    };
    assert.equal(Number(rt.computeUseHistoryGramsPerHour(entry2).toFixed(2)), 0.48);
    assert.equal(rt.formatUseHistoryGramsPerHour(entry2), '0.48');
});

test('2. session crossing midnight', () => {
    const rt = setup(makeData());
    const entry = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '23:00',
        endTime: '02:00',
        endDate: '2026-07-29',
        amount: 0.9,
        unit: 'g',
        transactionType: 'use',
        type: 'session'
    };
    assert.equal(rt.getUseHistorySessionDurationHours(entry), 3);
    assert.equal(rt.computeUseHistoryGramsPerHour(entry), 0.3);
    assert.equal(rt.formatUseHistoryGramsPerHour(entry), '0.30');
});

test('3. mg-to-g conversion', () => {
    const rt = setup(makeData());
    const entry = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '10:00',
        endTime: '12:00',
        amount: 600,
        unit: 'mg',
        transactionType: 'use',
        type: 'session'
    };
    assert.equal(rt.getUseLogAmountInGramsForRate(entry), 0.6);
    assert.equal(rt.computeUseHistoryGramsPerHour(entry), 0.3);
    assert.equal(rt.formatUseHistoryGramsPerHour(entry), '0.30');
});

test('4. missing duration shows em dash (Quick Use not treated as zero-rate)', () => {
    const rt = setup(makeData());
    const quick = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        amount: 0.5,
        unit: 'g',
        transactionType: 'use',
        type: 'quick'
    };
    assert.equal(rt.getUseHistorySessionDurationHours(quick), null);
    assert.equal(rt.computeUseHistoryGramsPerHour(quick), null);
    assert.equal(rt.formatUseHistoryGramsPerHour(quick), '—');

    const zeroDuration = {
        ...quick,
        type: 'session',
        startTime: '12:00',
        endTime: '12:00',
        durationMs: 0
    };
    assert.equal(rt.computeUseHistoryGramsPerHour(zeroDuration), null);
    assert.equal(rt.formatUseHistoryGramsPerHour(zeroDuration), '—');
});

test('5. Shared Use uses personal amount only', () => {
    const rt = setup(makeData());
    const entry = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '18:00',
        endTime: '21:00',
        amount: 1.5,
        totalAmount: 1.5,
        personalAmount: 0.9,
        sharedAmount: 0.6,
        unit: 'g',
        transactionType: 'shared_use',
        type: 'session',
        sharedWithName: 'Friend'
    };
    assert.equal(rt.getUseLogAmountInGramsForRate(entry), 0.9);
    assert.equal(rt.computeUseHistoryGramsPerHour(entry), 0.3);
    assert.equal(rt.formatUseHistoryGramsPerHour(entry), '0.30');
});

test('6. Gift and adjustment exclusion', () => {
    const rt = setup(makeData());
    const base = {
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '18:00',
        endTime: '21:00',
        amount: 0.9,
        unit: 'g',
        type: 'session'
    };
    for (const transactionType of ['gift_given', 'gift_received', 'inventory_adjustment']) {
        const entry = { ...base, transactionType };
        assert.equal(rt.computeUseHistoryGramsPerHour(entry), null, transactionType);
        assert.equal(rt.formatUseHistoryGramsPerHour(entry), '—', transactionType);
    }
});

test('7. Cost hidden only for Coke', () => {
    const rt = setup(makeData());

    const cokeCatalog = rt.getUseHistoryColumnCatalog(COKE_ID);
    assert.ok(!cokeCatalog.includes('cost'));
    assert.ok(cokeCatalog.includes('gPerHour'));
    assert.ok(cokeCatalog.includes('lines'));
    assert.ok(!cokeCatalog.includes('productType'));
    assert.ok(!cokeCatalog.includes('tabs'));
    assert.ok(!cokeCatalog.includes('pills'));

    const cokeVisible = rt.getUseHistoryVisibleColumns(COKE_ID);
    assert.ok(!cokeVisible.includes('cost'));
    assert.ok(cokeVisible.includes('gPerHour'));
    assert.ok(cokeVisible.includes('lines'));

    const cokeBasic = rt.getColumnPresetDefinition('basic', 'useHistory', COKE_ID);
    const cokeBasicVisible = cokeBasic.order.filter(id => cokeBasic.visible[id]);
    assert.equal(
        JSON.stringify(cokeBasicVisible),
        JSON.stringify(['select', 'date', 'start', 'end', 'amount', 'lines', 'gPerHour', 'actions'])
    );
    assert.equal(cokeBasic.visible.cost, false);
    assert.ok(!cokeBasic.order.includes('cost'));

    const cokeDetailed = rt.getColumnPresetDefinition('detailed', 'useHistory', COKE_ID);
    assert.ok(!cokeDetailed.order.includes('cost'));
    assert.ok(cokeDetailed.order.includes('gPerHour'));
    assert.ok(cokeDetailed.order.includes('lines'));
    assert.ok(cokeDetailed.order.includes('duration'));
    assert.ok(cokeDetailed.order.includes('inventory'));

    for (const presetId of ['basic', 'cost', 'inventory', 'detailed']) {
        const def = rt.getColumnPresetDefinition(presetId, 'useHistory', COKE_ID);
        assert.equal(def.visible.cost, false, presetId);
        assert.ok(!def.order.includes('cost'), presetId);
    }

    const weedCost = rt.getColumnPresetDefinition('cost', 'useHistory', WEED_ID);
    assert.equal(weedCost.visible.cost, true);
    assert.ok(weedCost.order.includes('cost'));

    const weedCatalog = rt.getUseHistoryColumnCatalog(WEED_ID);
    assert.ok(weedCatalog.includes('cost'));
    assert.ok(!weedCatalog.includes('gPerHour'));
    assert.ok(!weedCatalog.includes('lines'));

    const ketCatalog = rt.getUseHistoryColumnCatalog(KETAMINE_ID);
    assert.ok(ketCatalog.includes('cost'));
    assert.ok(!ketCatalog.includes('gPerHour'));
    assert.ok(!ketCatalog.includes('lines'));
});

test('8. Coke column preferences persist after reload', () => {
    const rt = setup(makeData());
    const variantKey = rt.getUseHistoryColumnVariantKey(COKE_ID);
    assert.equal(variantKey, 'cocaine');
    assert.equal(rt.resolveColumnStorageKey('useHistory', variantKey), 'useHistory::cocaine');

    rt.saveTableColumnConfig('useHistory', {
        order: ['select', 'date', 'start', 'end', 'amount', 'gPerHour', 'notes', 'actions'],
        visible: {
            select: true,
            date: true,
            start: true,
            end: true,
            amount: true,
            gPerHour: true,
            notes: true,
            actions: true,
            duration: false,
            transactionType: false,
            unit: false,
            inventory: false
        },
        widths: { gPerHour: 96 }
    }, variantKey);

    rt.setSelectedSubstanceId(NICOTINE_ID);
    const nicKey = rt.getUseHistoryColumnVariantKey(NICOTINE_ID);
    rt.saveTableColumnConfig('useHistory', {
        order: ['select', 'date', 'amount', 'notes', 'actions'],
        visible: {
            select: true,
            date: true,
            amount: true,
            notes: true,
            actions: true,
            start: false,
            end: false
        },
        widths: {}
    }, nicKey);

    const stored = rt.loadColumnSettingsStore();
    assert.ok(stored['useHistory::cocaine']);
    assert.ok(stored['useHistory::nicotine']);
    assert.equal(stored['useHistory::cocaine'].widths.gPerHour, 96);
    assert.equal(stored['useHistory::cocaine'].visible.notes, true);
    assert.equal(stored['useHistory::cocaine'].visible.duration, false);

    // Reload path: re-read store and resolve Coke columns without touching nicotine layout.
    rt.setSelectedSubstanceId(COKE_ID);
    const cokeConfig = rt.getTableColumnConfig('useHistory', 'cocaine');
    assert.equal(cokeConfig.widths.gPerHour, 96);
    assert.equal(cokeConfig.visible.notes, true);
    assert.equal(cokeConfig.visible.duration, false);

    const cokeCols = rt.getUseHistoryVisibleColumns(COKE_ID);
    assert.ok(cokeCols.includes('gPerHour'));
    assert.ok(cokeCols.includes('notes'));
    assert.ok(!cokeCols.includes('duration'));
    assert.ok(!cokeCols.includes('cost'));

    const nicConfig = rt.getTableColumnConfig('useHistory', 'nicotine');
    assert.equal(nicConfig.visible.start, false);
    assert.notEqual(nicConfig.widths.gPerHour, 96);
});
