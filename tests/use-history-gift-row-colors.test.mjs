import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const COKE_ID = 'coke';

function makeData(logs = []) {
    return {
        substances: [
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
                taperTrackingEnabled: true,
                active: true
            }
        ],
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
    rt.ensureConditionalColorRules(data);
    return { rt, data };
}

function makeLog(overrides = {}) {
    return {
        id: overrides.id ?? Math.floor(Math.random() * 1e9),
        substanceId: COKE_ID,
        date: '2026-07-28',
        startTime: '12:00',
        endTime: '13:00',
        amount: 0.5,
        unit: 'g',
        transactionType: 'use',
        type: 'session',
        ...overrides
    };
}

test('gift presets exist with light/dark theme colors', () => {
    const { rt } = setup();
    const light = rt.getConditionalColorPresetRules('light');
    const dark = rt.getConditionalColorPresetRules('dark');
    const lightGiven = light.find(r => r.presetId === 'giftGiven');
    const darkGiven = dark.find(r => r.presetId === 'giftGiven');
    const lightRecv = light.find(r => r.presetId === 'giftReceived');
    const darkRecv = dark.find(r => r.presetId === 'giftReceived');

    assert.ok(lightGiven);
    assert.ok(darkGiven);
    assert.equal(lightGiven.metric, 'transactionType');
    assert.equal(lightGiven.value, 'gift_given');
    assert.equal(lightGiven.sectionScope.includes('useHistory'), true);
    assert.equal(lightGiven.colors.background.toUpperCase(), '#EDE7F6');
    assert.equal(lightGiven.colors.border.toUpperCase(), '#7E57C2');
    assert.equal(lightGiven.colors.text, '');

    assert.equal(lightRecv.colors.background.toUpperCase(), '#E3F2FD');
    assert.equal(lightRecv.colors.border.toUpperCase(), '#42A5F5');
    assert.equal(lightRecv.colors.text, '');

    assert.notEqual(darkGiven.colors.background, lightGiven.colors.background);
    assert.notEqual(darkRecv.colors.background, lightRecv.colors.background);
    assert.match(darkGiven.colors.background, /rgba\(126,\s*87,\s*194/i);
    assert.match(darkRecv.colors.background, /rgba\(66,\s*165,\s*245/i);
    // Theme default text (empty) keeps readable inherited colors in both themes
    assert.equal(darkGiven.colors.text, '');
    assert.equal(darkRecv.colors.text, '');
});

test('Gift Given rows render purple; Gift Received rows render blue', () => {
    const given = makeLog({ id: 1, transactionType: 'gift_given' });
    const received = makeLog({ id: 2, transactionType: 'gift_received' });
    const { rt } = setup([given, received]);

    const givenCcr = rt.evaluateUseHistoryRowConditionalColor(given, COKE_ID);
    assert.ok(givenCcr.matched.some(r => r.presetId === 'giftGiven' || r.name === 'Gift Given'));
    assert.match(String(givenCcr.style.background), /#EDE7F6|rgba\(126,\s*87,\s*194/i);
    assert.match(String(givenCcr.style.border), /#7E57C2|#9575CD/i);

    const recvCcr = rt.evaluateUseHistoryRowConditionalColor(received, COKE_ID);
    assert.ok(recvCcr.matched.some(r => r.presetId === 'giftReceived' || r.name === 'Gift Received'));
    assert.match(String(recvCcr.style.background), /#E3F2FD|rgba\(66,\s*165,\s*245/i);
    assert.match(String(recvCcr.style.border), /#42A5F5|#64B5F6/i);

    const givenStyle = rt.buildUseHistoryRowInlineStyle(givenCcr);
    assert.match(givenStyle, /--ccr-row-bg:/);
    assert.match(givenStyle, /--ccr-row-border:/);
    assert.ok(rt.getUseHistoryRowColorClassNames(given, givenCcr).includes('ccr-row-colored'));
    assert.ok(rt.getUseHistoryRowColorClassNames(given, givenCcr).includes('gift-given-row'));
    assert.ok(rt.getUseHistoryRowColorClassNames(received, recvCcr).includes('gift-received-row'));

    assert.match(rt.formatUseHistoryTransactionType(given, { withIcon: true }), /🎁/);
    assert.match(rt.formatUseHistoryTransactionType(received, { withIcon: true }), /📦/);
    assert.equal(rt.formatUseHistoryTransactionType(given), 'Gift given');
    assert.equal(rt.formatUseHistoryTransactionType(received), 'Gift received');
});

test('Personal Use, Shared Use, and Adjustment rows stay uncolored by gift presets', () => {
    const personal = makeLog({ id: 10, transactionType: 'use' });
    const shared = makeLog({
        id: 11,
        transactionType: 'shared_use',
        personalAmount: 0.3,
        sharedAmount: 0.2,
        totalAmount: 0.5
    });
    const adjustment = makeLog({ id: 12, transactionType: 'inventory_adjustment' });
    const { rt } = setup([personal, shared, adjustment]);

    for (const entry of [personal, shared, adjustment]) {
        const ccr = rt.evaluateUseHistoryRowConditionalColor(entry, COKE_ID);
        assert.equal(ccr.matched.length, 0, entry.transactionType);
        assert.equal(rt.buildUseHistoryRowInlineStyle(ccr), '');
        assert.equal(rt.getUseHistoryRowColorClassNames(entry, ccr).includes('ccr-row-colored'), false);
    }
});

test('custom Gift Given rule overrides default preset colors', () => {
    const given = makeLog({ id: 20, transactionType: 'gift_given' });
    const { rt, data } = setup([given]);

    rt.persistConditionalColorRulesState({
        enabled: true,
        rules: [
            ...rt.getConditionalColorRules(data),
            rt.normalizeConditionalColorRule({
                id: 'custom-gift-given',
                name: 'My Gift Given',
                metric: 'transactionType',
                operator: 'eq',
                value: 'gift_given',
                sectionScope: ['useHistory'],
                substanceScope: 'all',
                priority: 200,
                colors: {
                    background: '#FFEBEE',
                    text: '',
                    border: '#E53935'
                },
                statusLabel: ''
            })
        ]
    }, data);

    const ccr = rt.evaluateUseHistoryRowConditionalColor(given, COKE_ID, data);
    assert.ok(ccr.matched.length >= 1);
    assert.equal(ccr.matched[0].id, 'custom-gift-given');
    assert.equal(String(ccr.style.background).toUpperCase(), '#FFEBEE');
    assert.equal(String(ccr.style.border).toUpperCase(), '#E53935');
});

test('theme switching keeps gift presets readable without forced text color', () => {
    const { rt } = setup();
    const light = rt.getConditionalColorPresetRules('light').find(r => r.presetId === 'giftGiven');
    const dark = rt.getConditionalColorPresetRules('dark').find(r => r.presetId === 'giftGiven');
    assert.equal(light.colors.text, '');
    assert.equal(dark.colors.text, '');
    // Soft backgrounds differ by theme for contrast against light/dark page chrome
    assert.ok(light.colors.background !== dark.colors.background);
    const contrastLight = rt.getContrastWarning('#1a1a1a', light.colors.background);
    assert.equal(contrastLight.ok, true);
    // Dark theme uses translucent purple over dark surfaces; inherited body text should remain readable
    assert.match(dark.colors.background, /^rgba\(/i);
});

test('missing gift presets are restored for existing rule sets', () => {
    const { rt, data } = setup();
    // Simulate older save without gift presets
    data.settings.conditionalColorRules = {
        enabled: true,
        version: 1,
        rules: [
            rt.normalizeConditionalColorRule({
                id: 'only-on-track',
                name: 'On Track',
                isPreset: true,
                presetId: 'onTrack',
                metric: 'useVsTarget',
                operator: 'lt',
                value: 0.7,
                sectionScope: ['status'],
                colors: { background: '#eee', text: '#111', border: '#0f0' }
            })
        ]
    };
    const state = rt.ensureConditionalColorRules(data);
    assert.ok(state.rules.some(r => r.presetId === 'giftGiven'));
    assert.ok(state.rules.some(r => r.presetId === 'giftReceived'));
});
