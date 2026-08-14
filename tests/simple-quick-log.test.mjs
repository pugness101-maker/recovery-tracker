import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function baseData(overrides = {}) {
    return {
        substances: [{
            id: 'coke',
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            units: ['g'],
            active: true,
            isMain: true,
            taperTrackingEnabled: true
        }, {
            id: 'nicotine',
            name: 'Nicotine',
            trackingMode: 'nicotine',
            primaryUnit: 'puffs',
            defaultUnit: 'puffs',
            units: ['puffs'],
            active: true,
            isMain: false,
            taperTrackingEnabled: true
        }],
        logs: [],
        purchases: [],
        cravings: [],
        goals: [],
        budgets: [],
        contacts: [],
        settings: { currency: '$', substanceSettings: {}, experienceMode: 'simple' },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { experienceModeV1: true },
        ...overrides
    };
}

function setup(overrides = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(baseData(overrides));
    if (typeof rt.ensureExperienceMode === 'function') rt.ensureExperienceMode();
    if (typeof rt.setTestReferenceDate === 'function') rt.setTestReferenceDate('2026-08-13');
    return rt;
}

function cokeLog(overrides = {}) {
    return {
        id: overrides.id ?? 'coke-1',
        substanceId: 'coke',
        date: '2026-08-13',
        startTime: '22:42',
        time: '22:42',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use',
        type: 'quick',
        timestamp: '2026-08-14T03:42:00.000Z',
        createdAt: '2026-08-14T03:42:00.000Z',
        ...overrides
    };
}

test('Quick Log markup keeps Simple shortcuts without redesigning Advanced', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(html, /id="sm-recent-amounts"/);
    assert.match(html, /id="sm-locked-substance-chip"/);
    assert.match(html, /id="sm-toast"/);
    assert.match(html, /sm-log-more-field/);
    assert.match(html, /More Options/);
    assert.match(css, /\.sm-action-repeat/);
    assert.match(css, /\.sm-recently-logged/);
    assert.match(css, /\.sm-toast/);
    assert.match(html, /id="use-entry-type-group"/);
    assert.match(html, /id="use-transaction-type-block"/);
});

test('last-used amount restores per substance', () => {
    const rt = setup();
    rt.rememberQuickLogSettings({
        substanceId: 'coke',
        amount: 0.25,
        unit: 'g',
        purchaseId: 'bag-1',
        transactionType: 'use'
    });
    const mem = rt.getQuickLogMemoryForSubstance('coke');
    assert.equal(mem.amount, 0.25);
    assert.equal(mem.unit, 'g');
    assert.equal(mem.purchaseId, 'bag-1');
    assert.equal(rt.getSimpleModePrefs().lastQuickSubstanceId, 'coke');
    assert.equal(rt.getRecentAmountsForSubstance('coke')[0], 0.25);
});

test('nicotine preferences do not leak into Coke', () => {
    const rt = setup();
    rt.rememberQuickLogSettings({
        substanceId: 'nicotine',
        productType: 'vape',
        amount: 250,
        unit: 'puffs',
        purchaseId: 'geek-bar',
        vapeMode: 'puffs',
        logMode: 'vape_puffs',
        transactionType: 'use'
    });
    rt.rememberQuickLogSettings({
        substanceId: 'coke',
        amount: 0.1,
        unit: 'g',
        transactionType: 'use'
    });
    const nic = rt.getQuickLogMemoryForSubstance('nicotine');
    const coke = rt.getQuickLogMemoryForSubstance('coke');
    assert.equal(nic.amount, 250);
    assert.equal(nic.productType, 'vape');
    assert.equal(nic.unit, 'puffs');
    assert.equal(nic.purchaseId, 'geek-bar');
    assert.equal(coke.amount, 0.1);
    assert.equal(coke.unit, 'g');
    assert.notEqual(coke.productType, 'vape');
    assert.notEqual(coke.unit, 'puffs');
    assert.notEqual(coke.purchaseId, 'geek-bar');
    assert.ok(!rt.getRecentAmountsForSubstance('coke').includes(250));
    assert.ok(rt.getRecentAmountsForSubstance('nicotine').includes(250));
});

test('Repeat Last updates timestamp and does not reuse IDs', () => {
    const original = cokeLog({
        id: 'old-coke-1',
        date: '2026-08-01',
        startTime: '08:15',
        time: '08:15',
        timestamp: '2026-08-01T13:15:00.000Z',
        createdAt: '2026-08-01T13:15:00.000Z'
    });
    const rt = setup({ logs: [original] });
    const later = new Date(2026, 7, 13, 23, 28, 0);
    const result = rt.repeatSimpleLastEntry({ confirm: false, now: later });
    assert.equal(result.ok, true);
    assert.ok(result.log);
    assert.notEqual(result.log.id, original.id);
    assert.notEqual(String(result.log.id), String(original.id));
    assert.notEqual(result.log.timestamp, original.timestamp);
    assert.notEqual(result.log.createdAt, original.createdAt);
    assert.equal(result.log.date, '2026-08-13');
    assert.equal(result.log.startTime, '23:28');
    assert.equal(result.log.amount, 0.25);
    assert.equal(result.log.substanceId, 'coke');
    const data = rt.__getTestAppData();
    assert.equal(data.logs.length, 2);
    const ids = data.logs.map(l => String(l.id));
    assert.equal(new Set(ids).size, 2);
});

test('Home substance-card Quick Log opens with that substance locked', () => {
    const rt = setup();
    const ctx = rt.openSimpleQuickLog('coke');
    assert.equal(ctx.substanceId, 'coke');
    assert.equal(ctx.locked, true);
    const nic = rt.openSimpleQuickLog('nicotine');
    assert.equal(nic.substanceId, 'nicotine');
    assert.equal(nic.locked, true);
    assert.equal(rt.getSimpleQuickLogContext().substanceId, 'nicotine');
});

test('recent amount buttons use actual history', () => {
    const rt = setup({
        logs: [
            cokeLog({ id: 'a', amount: 0.5, startTime: '17:20', time: '17:20', timestamp: '2026-08-13T22:20:00.000Z' }),
            cokeLog({ id: 'b', amount: 0.1, startTime: '20:15', time: '20:15', timestamp: '2026-08-14T01:15:00.000Z' }),
            cokeLog({ id: 'c', amount: 0.25, startTime: '22:42', time: '22:42', timestamp: '2026-08-14T03:42:00.000Z' }),
            {
                id: 'n1',
                substanceId: 'nicotine',
                date: '2026-08-13',
                startTime: '12:00',
                amount: 250,
                unit: 'puffs',
                transactionType: 'use',
                type: 'quick',
                nicotineProductType: 'vape'
            }
        ]
    });
    const cokeAmounts = rt.getRecentAmountsForSubstance('coke');
    assert.ok(cokeAmounts.includes(0.25));
    assert.ok(cokeAmounts.includes(0.1));
    assert.ok(cokeAmounts.includes(0.5));
    assert.equal(cokeAmounts[0], 0.25);
    assert.ok(cokeAmounts.length <= 5);
    const nicAmounts = rt.getRecentAmountsForSubstance('nicotine');
    assert.ok(nicAmounts.includes(250));
    assert.ok(!nicAmounts.includes(0.25));
});

test('inventory remains optional in Simple Quick Log', () => {
    const rt = setup();
    const none = rt.resolveSimpleInventoryPrefill('coke');
    assert.equal(none, null);

    const twoItems = setup({
        purchases: [
            { id: 'p1', substanceId: 'coke', date: '2026-08-01', remainingAmount: 1, quantityBought: 1, isDepleted: false },
            { id: 'p2', substanceId: 'coke', date: '2026-08-02', remainingAmount: 1, quantityBought: 1, isDepleted: false }
        ]
    });
    assert.equal(twoItems.resolveSimpleInventoryPrefill('coke'), null);
    twoItems.rememberQuickLogSettings({ substanceId: 'coke', amount: 0.25, unit: 'g', purchaseId: 'p2' });
    assert.equal(twoItems.resolveSimpleInventoryPrefill('coke'), 'p2');
    twoItems.rememberQuickLogSettings({ substanceId: 'coke', amount: 0.25, unit: 'g', purchaseId: 'gone' });
    assert.equal(twoItems.resolveSimpleInventoryPrefill('coke'), null);

    const oneItem = setup({
        purchases: [
            { id: 'only', substanceId: 'coke', date: '2026-08-01', remainingAmount: 2, quantityBought: 2, isDepleted: false }
        ]
    });
    assert.equal(oneItem.resolveSimpleInventoryPrefill('coke'), 'only');

    const saved = rt.commitUseLogEntry({
        id: 'no-inv',
        substanceId: 'coke',
        date: '2026-08-13',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use',
        type: 'quick',
        inventoryAffects: false
    });
    assert.equal(saved.ok, true);
    assert.equal(rt.__getTestAppData().logs.some(l => l.id === 'no-inv'), true);
});

test('save immediately updates Home Today totals', () => {
    const rt = setup();
    const before = rt.buildSimpleHomeDataset(rt.__getTestAppData());
    const cokeBefore = before.cards.find(c => c.substanceId === 'coke');
    assert.equal(cokeBefore?.used || 0, 0);
    const result = rt.commitUseLogEntry({
        id: 'home-1',
        substanceId: 'coke',
        date: '2026-08-13',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use',
        type: 'quick'
    });
    assert.equal(result.ok, true);
    const after = rt.buildSimpleHomeDataset(rt.__getTestAppData());
    const cokeAfter = after.cards.find(c => c.substanceId === 'coke');
    assert.equal(cokeAfter.used, 0.25);
});

test('Undo restores the prior Home state', () => {
    const rt = setup();
    rt.commitUseLogEntry({
        id: 'undo-1',
        substanceId: 'coke',
        date: '2026-08-13',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use',
        type: 'quick',
        inventoryAffects: false
    });
    assert.equal(rt.buildSimpleHomeDataset(rt.__getTestAppData()).cards.find(c => c.substanceId === 'coke').used, 0.25);
    const undone = rt.undoSimpleLoggedEntry('undo-1', { confirmDelete: false });
    assert.equal(undone.ok, true);
    assert.equal(rt.__getTestAppData().logs.some(l => l.id === 'undo-1'), false);
    assert.equal(rt.buildSimpleHomeDataset(rt.__getTestAppData()).cards.find(c => c.substanceId === 'coke')?.used || 0, 0);
});

test('duplicate warning triggers only for identical recent entries', () => {
    const nowMs = Date.parse('2026-08-13T23:28:00');
    const recent = cokeLog({
        id: 'dup-1',
        timestamp: new Date(nowMs).toISOString(),
        createdAt: new Date(nowMs).toISOString()
    });
    const rt = setup({ logs: [recent] });
    const hit = rt.findSimpleQuickLogDuplicate({
        substanceId: 'coke',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use'
    }, rt.__getTestAppData(), nowMs + 1000);
    assert.ok(hit);
    assert.equal(String(hit.id), 'dup-1');

    const differentAmount = rt.findSimpleQuickLogDuplicate({
        substanceId: 'coke',
        amount: 0.5,
        unit: 'g',
        transactionType: 'use'
    }, rt.__getTestAppData(), nowMs + 1000);
    assert.equal(differentAmount, null);

    const stale = cokeLog({
        id: 'old-dup',
        timestamp: new Date(nowMs - 120000).toISOString(),
        createdAt: new Date(nowMs - 120000).toISOString()
    });
    const rtOld = setup({ logs: [stale] });
    const miss = rtOld.findSimpleQuickLogDuplicate({
        substanceId: 'coke',
        amount: 0.25,
        unit: 'g',
        transactionType: 'use'
    }, rtOld.__getTestAppData(), nowMs);
    assert.equal(miss, null);
    assert.equal(rt.SIMPLE_DUPLICATE_WINDOW_MS, 90 * 1000);
    assert.equal(rt.logsLookLikeSimpleDuplicate(recent, { substanceId: 'coke', amount: 0.25, unit: 'g', transactionType: 'use' }), true);
});

test('existing Advanced logging still works', () => {
    const rt = setup();
    rt.persistExperienceMode('advanced');
    assert.equal(rt.isAdvancedExperienceMode(), true);
    const result = rt.commitUseLogEntry({
        id: 'adv-1',
        substanceId: 'coke',
        date: '2026-08-13',
        amount: 0.4,
        unit: 'g',
        transactionType: 'use',
        type: 'quick'
    });
    assert.equal(result.ok, true);
    assert.equal(rt.__getTestAppData().logs.some(l => l.id === 'adv-1' && l.amount === 0.4), true);
    assert.match(String(rt.handleUseLogSubmit), /notifyUseLogSaved|getUseSaveSuccessMessage/);
});

test('export/import preserves Simple Quick Log preferences', () => {
    const rt = setup();
    rt.rememberQuickLogSettings({
        substanceId: 'coke',
        amount: 0.25,
        unit: 'g',
        purchaseId: 'bag-1'
    });
    rt.rememberQuickLogSettings({
        substanceId: 'nicotine',
        productType: 'vape',
        amount: 250,
        unit: 'puffs',
        vapeMode: 'puffs'
    });
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(exported.settings.simpleModePrefs.quickLogBySubstance.coke.amount, 0.25);
    assert.equal(exported.settings.simpleModePrefs.quickLogBySubstance.nicotine.amount, 250);
    assert.deepEqual(exported.settings.simpleModePrefs.recentAmountsBySubstance.coke.slice(0, 1), [0.25]);

    const other = loadRecoveryTrackerApp();
    other.__setTestAppData(baseData({
        settings: {
            currency: '$',
            substanceSettings: {},
            experienceMode: 'simple',
            simpleModePrefs: {
                quickLogBySubstance: {
                    lsd: { substanceId: 'lsd', amount: 1, unit: 'tabs' }
                },
                recentAmountsBySubstance: { lsd: [1] }
            }
        }
    }));
    const merged = other.mergeImportedData(other.__getTestAppData(), exported);
    assert.equal(merged.settings.simpleModePrefs.quickLogBySubstance.coke.amount, 0.25);
    assert.equal(merged.settings.simpleModePrefs.quickLogBySubstance.nicotine.amount, 250);
    assert.equal(merged.settings.simpleModePrefs.quickLogBySubstance.lsd.amount, 1);
});
