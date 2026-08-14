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
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {},
        ...overrides
    };
}

function setup(overrides = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData(baseData(overrides));
    if (typeof rt.ensureExperienceMode === 'function') rt.ensureExperienceMode();
    return rt;
}

test('Experience Mode markup and CSS exist', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(html, /id="experience-mode"/);
    assert.match(html, /id="simple-home"/);
    assert.match(html, /id="simple-progress"/);
    assert.match(html, /id="simple-plan-wizard"/);
    assert.match(html, /id="sm-recent-amounts"/);
    assert.match(html, /Experience Mode/);
    assert.match(css, /experience-simple/);
    assert.match(css, /\.sm-today-card/);
    assert.match(css, /\.sm-trend-chart/);
    assert.match(css, /\.sm-cal-grid/);
});

test('new installs default to Simple; existing users migrate to Advanced', () => {
    const rtNew = setup({ migrations: {} });
    assert.equal(rtNew.getExperienceMode(), 'simple');
    assert.equal(rtNew.isSimpleExperienceMode(), true);

    const rtExisting = loadRecoveryTrackerApp();
    const existingData = baseData({
        logs: [{ id: 1, substanceId: 'coke', date: '2026-08-01', amount: 0.2, transactionType: 'use', type: 'quick' }],
        migrations: {},
        settings: { currency: '$', substanceSettings: {} }
    });
    rtExisting.__setTestAppData(existingData);
    const data = rtExisting.__getTestAppData();
    delete data.settings.experienceMode;
    delete data.migrations.experienceModeV1;
    rtExisting.migrateExperienceModeV1(data);
    assert.equal(data.settings.experienceMode, 'advanced');
    assert.equal(data.migrations.experienceModeV1, true);
});

test('experience mode persists through settings and save/load', () => {
    const rt = setup();
    rt.persistExperienceMode('advanced');
    assert.equal(rt.getExperienceMode(), 'advanced');
    assert.equal(rt.isAdvancedExperienceMode(), true);

    const snap = rt.__getStorageSnapshot();
    assert.ok(snap);
    const stored = JSON.parse(snap);
    assert.equal(stored.settings.experienceMode, 'advanced');

    rt.persistExperienceMode('simple');
    assert.equal(rt.getExperienceMode(), 'simple');
});

test('simple mode prefs and recent amounts persist', () => {
    const rt = setup();
    rt.rememberRecentAmount('coke', 0.25);
    rt.rememberRecentAmount('coke', 0.5);
    rt.rememberRecentAmount('coke', 0.25);
    const amounts = rt.getRecentAmountsForSubstance('coke');
    assert.equal(amounts[0], 0.25);
    assert.equal(amounts[1], 0.5);
    assert.ok(amounts.length >= 2);

    const prefs = rt.getSimpleModePrefs();
    assert.ok(prefs.quickLogBySubstance);
    assert.equal(prefs.progressRange, '7');

    rt.persistSimpleModePrefs({ progressRange: '30', progressSubstanceId: 'coke' });
    assert.equal(rt.getSimpleModePrefs().progressRange, '30');
});

test('simple home dataset uses canonical per-substance totals', () => {
    const rt = setup({
        logs: [
            { id: 1, substanceId: 'coke', date: '2026-08-13', amount: 0.4, unit: 'g', transactionType: 'use', type: 'quick' },
            { id: 2, substanceId: 'nicotine', date: '2026-08-13', amount: 250, unit: 'puffs', transactionType: 'use', type: 'quick', nicotineProductType: 'vape' }
        ]
    });
    if (typeof rt.setTestReferenceDate === 'function') {
        rt.setTestReferenceDate('2026-08-13');
    }
    const dataset = rt.buildSimpleHomeDataset(rt.__getTestAppData());
    assert.ok(Array.isArray(dataset.cards));
    const coke = dataset.cards.find(c => c.substanceId === 'coke');
    assert.ok(coke, 'coke card present');
    assert.equal(coke.used, 0.4);
    assert.equal(coke.status.key, 'none');
});

test('goal status wording is non-shaming', () => {
    const rt = setup();
    assert.equal(rt.resolveSimpleGoalStatus(1, 2).label, 'Within goal');
    assert.equal(rt.resolveSimpleGoalStatus(1.8, 2).label, 'Near goal');
    assert.equal(rt.resolveSimpleGoalStatus(2.1, 2).label, 'Above goal');
    assert.equal(rt.resolveSimpleGoalStatus(1, null).label, 'No goal set');
});

test('progress dataset uses same range engine and does not invent combined units', () => {
    const rt = setup({
        logs: [
            { id: 1, substanceId: 'coke', date: '2026-08-10', amount: 0.3, unit: 'g', transactionType: 'use', type: 'quick' },
            { id: 2, substanceId: 'coke', date: '2026-08-13', amount: 0.4, unit: 'g', transactionType: 'use', type: 'quick' }
        ]
    });
    const dataset = rt.buildSimpleProgressDataset('coke', '7', rt.__getTestAppData());
    assert.equal(dataset.substanceId, 'coke');
    assert.ok(dataset.series.length >= 1);
    assert.ok(Number.isFinite(dataset.dailyAvg));
    assert.equal(dataset.unit, 'g');
});

test('plan intents remain available and export includes experienceMode', () => {
    const rt = setup();
    assert.ok(rt.SIMPLE_PLAN_INTENTS.some(i => i.id === 'use-less'));
    assert.ok(rt.SIMPLE_PLAN_INTENTS.some(i => i.id === 'track-only'));
    assert.deepEqual([...rt.EXPERIENCE_PROGRESS_RANGES], ['7', '30', '90', 'all']);

    rt.persistExperienceMode('simple');
    const data = rt.__getTestAppData();
    assert.equal(data.settings.experienceMode, 'simple');
    // Existing records untouched
    assert.deepEqual(data.logs, []);
    assert.deepEqual(data.purchases, []);
});
