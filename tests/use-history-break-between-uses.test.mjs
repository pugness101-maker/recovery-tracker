import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';
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

function makeData(logs = []) {
    return {
        substances: makeSubstances(),
        logs,
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { inventoryLinkedV1: true, purchaseIdLinkV2: true, vapeInventoryLinkV2: true }
    };
}

function setup(logs = []) {
    const rt = loadRecoveryTrackerApp();
    const data = makeData(logs);
    rt.__setTestAppData(data);
    rt.setSelectedSubstanceId(COKE_ID);
    rt.setTestReferenceDate('2026-07-28');
    return { rt, data };
}

function coke(overrides = {}) {
    return {
        id: overrides.id ?? Math.floor(Math.random() * 1e9),
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

test('Break Between Uses column is optional in Use History catalog', () => {
    const { rt } = setup();
    const catalog = rt.getUseHistoryColumnCatalog(COKE_ID);
    assert.ok(catalog.includes('breakBetweenUses'));
    const defaults = rt.getDefaultUseHistoryColumnSettings(COKE_ID);
    assert.equal(defaults.visible.breakBetweenUses, false);
    assert.equal(
        rt.resolveColumnDisplayLabel('useHistory', 'breakBetweenUses', { substanceId: COKE_ID }),
        'Break Between Uses'
    );
});

test('first use shows em dash; same-day and multi-day gaps format correctly', () => {
    const first = coke({ id: 1, date: '2026-07-26', startTime: '10:00', endTime: '11:00' });
    const sameDay = coke({ id: 2, date: '2026-07-26', startTime: '19:00', endTime: '20:00' });
    const nextDay = coke({ id: 3, date: '2026-07-28', startTime: '10:00', endTime: '11:00' });
    const { rt, data } = setup([first, sameDay, nextDay]);

    const firstDetails = rt.getBreakBetweenUsesDetails(first, data);
    assert.equal(firstDetails.hours, null);
    assert.equal(firstDetails.text, '—');
    assert.match(rt.renderBreakSincePreviousCell(first, data), /^—$/);

    const same = rt.getBreakBetweenUsesDetails(sameDay, data);
    assert.equal(same.hours, 8);
    assert.equal(same.text, '8h');
    assert.match(rt.renderBreakSincePreviousCell(sameDay, data), /8h/);
    assert.match(rt.formatBreakBetweenUsesTooltip(same), /Previous use:/);
    assert.match(rt.formatBreakBetweenUsesTooltip(same), /Break:/);

    const multi = rt.getBreakBetweenUsesDetails(nextDay, data);
    assert.equal(multi.hours, 38);
    assert.equal(multi.text, '1d 14h');
});

test('overnight previous session end is used for break start', () => {
    const overnight = coke({
        id: 10,
        date: '2026-07-26',
        startTime: '23:00',
        endTime: '02:00',
        endDate: '2026-07-27',
        amount: 0.5
    });
    const next = coke({
        id: 11,
        date: '2026-07-27',
        startTime: '10:00',
        endTime: '11:00',
        amount: 0.4
    });
    const { rt, data } = setup([overnight, next]);
    // previous end 02:00 → current start 10:00 = 8h
    assert.equal(rt.computeBreakSincePreviousUseHours(next, data), 8);
});

test('shared personal qualifies; gifts and adjustments excluded', () => {
    const shared = coke({
        id: 20,
        date: '2026-07-26',
        startTime: '10:00',
        endTime: '11:00',
        transactionType: 'shared_use',
        personalAmount: 0.5,
        sharedAmount: 0.5,
        totalAmount: 1
    });
    const gift = coke({
        id: 21,
        date: '2026-07-26',
        startTime: '12:00',
        endTime: '13:00',
        transactionType: 'gift_given'
    });
    const adj = coke({
        id: 22,
        date: '2026-07-26',
        startTime: '14:00',
        endTime: '15:00',
        transactionType: 'inventory_adjustment'
    });
    const later = coke({
        id: 23,
        date: '2026-07-26',
        startTime: '20:00',
        endTime: '21:00'
    });
    const { rt, data } = setup([shared, gift, adj, later]);
    assert.equal(rt.computeBreakSincePreviousUseHours(later, data), 9);
});

test('substance-specific previous use', () => {
    const cokeA = coke({ id: 30, date: '2026-07-26', startTime: '10:00', endTime: '11:00' });
    const weedA = {
        id: 31,
        substanceId: WEED_ID,
        date: '2026-07-26',
        startTime: '12:00',
        endTime: '13:00',
        amount: 1,
        unit: 'g',
        transactionType: 'use',
        type: 'session'
    };
    const cokeB = coke({ id: 32, date: '2026-07-26', startTime: '18:00', endTime: '19:00' });
    const { rt, data } = setup([cokeA, weedA, cokeB]);
    // coke B should measure from coke A end (11:00), not weed (13:00) → 7h
    assert.equal(rt.computeBreakSincePreviousUseHours(cokeB, data), 7);
});

test('sorting by break duration uses chronological previous, not display order', () => {
    const a = coke({ id: 40, date: '2026-07-26', startTime: '08:00', endTime: '09:00' });
    const b = coke({ id: 41, date: '2026-07-26', startTime: '12:00', endTime: '13:00' }); // 3h break
    const c = coke({ id: 42, date: '2026-07-27', startTime: '12:00', endTime: '13:00' }); // 23h break
    const { rt, data } = setup([a, b, c]);
    const rows = [
        { entry: c, sub: { id: COKE_ID } },
        { entry: b, sub: { id: COKE_ID } },
        { entry: a, sub: { id: COKE_ID } }
    ];
    const sorted = rt.sortUseHistoryDisplayRows(rows, { col: 'breakBetweenUses', dir: 'desc' }, data);
    assert.equal(sorted[0].entry.id, 42);
    assert.equal(sorted[1].entry.id, 41);
    // first use (null) last
    assert.equal(sorted[2].entry.id, 40);
});

test('CSV export includes Break Between Uses when visible', () => {
    const a = coke({ id: 50, date: '2026-07-26', startTime: '10:00', endTime: '11:00' });
    const b = coke({ id: 51, date: '2026-07-26', startTime: '15:00', endTime: '16:00' });
    const { rt } = setup([a, b]);
    const variantKey = rt.getUseHistoryColumnVariantKey(COKE_ID);
    const base = rt.getDefaultUseHistoryColumnSettings(COKE_ID);
    rt.saveTableColumnConfig('useHistory', {
        ...base,
        visible: {
            ...base.visible,
            breakBetweenUses: true,
            date: true
        }
    }, variantKey);
    assert.ok(rt.getUseHistoryVisibleColumns(COKE_ID).includes('breakBetweenUses'));
    const { headers, body } = rt.buildUseHistoryCsvRows({ substanceId: COKE_ID });
    assert.ok(headers.some(h => /Break Between Uses/i.test(h)));
    const breakCol = headers.findIndex(h => /Break Between Uses/i.test(h));
    const texts = body.map(row => row[breakCol]);
    assert.ok(texts.includes('4h'));
    assert.ok(texts.includes('') || texts.includes('—'));
});

test('edit/delete recalculation uses live shared engine', () => {
    const a = coke({ id: 60, date: '2026-07-26', startTime: '10:00', endTime: '11:00' });
    const b = coke({ id: 61, date: '2026-07-26', startTime: '14:00', endTime: '15:00' });
    const c = coke({ id: 62, date: '2026-07-26', startTime: '20:00', endTime: '21:00' });
    const { rt, data } = setup([a, b, c]);
    assert.equal(rt.computeBreakSincePreviousUseHours(c, data), 5);
    // Delete middle session — break from A end 11:00 to C start 20:00 = 9h
    data.logs = data.logs.filter(l => l.id !== 61);
    assert.equal(rt.computeBreakSincePreviousUseHours(c, data), 9);
    // Edit C start later
    c.startTime = '22:00';
    assert.equal(rt.computeBreakSincePreviousUseHours(c, data), 11);
});

test('CCR applies breakSincePreviousUse metric to Break Between Uses cell', () => {
    const a = coke({ id: 70, date: '2026-07-26', startTime: '10:00', endTime: '11:00' });
    const b = coke({ id: 71, date: '2026-07-26', startTime: '12:00', endTime: '13:00' });
    const { rt, data } = setup([a, b]);
    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'short-break',
                name: 'Short break',
                metric: 'breakSincePreviousUse',
                operator: 'lt',
                value: 3,
                sectionScope: ['useHistory'],
                colors: { background: '#333', text: '#f00', border: '#f00' },
                statusLabel: ''
            })
        ]
    });
    const html = rt.renderBreakSincePreviousCell(b, data);
    assert.match(html, /ccr-applied|style=/);
    assert.match(html, /1h/);
});
