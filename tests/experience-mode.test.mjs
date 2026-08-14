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
    assert.match(css, /\.experience-mode-select/);
    assert.match(css, /max-width: 22\.5rem/);
    assert.match(html, /experience-mode-select/);
    assert.match(html, /visually-hidden/);
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

test('taper status wording is non-shaming and uses taper targets', () => {
    const rt = setup();
    assert.equal(rt.resolveSimpleTaperStatus(1, 2).label, 'Within target');
    assert.equal(rt.resolveSimpleTaperStatus(1, 2).homeLabel, 'Within taper target');
    assert.equal(rt.resolveSimpleTaperStatus(1.8, 2).label, 'Near target');
    assert.equal(rt.resolveSimpleTaperStatus(1.8, 2).homeLabel, 'Near taper target');
    assert.equal(rt.resolveSimpleTaperStatus(2.1, 2).label, 'Above target');
    assert.equal(rt.resolveSimpleTaperStatus(1, null).label, 'No active taper');
    assert.equal(rt.SIMPLE_TAPER_STATUS.none.label, 'No active taper');
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

test('Simple Progress log table uses canonical logs, filters, sorts, and deduplicates', () => {
    const duplicate = {
        id: 'newest',
        substanceId: 'coke',
        date: '2026-08-13',
        startTime: '19:30',
        amount: 0.4,
        unit: 'g',
        estimatedCost: 12.5,
        notes: 'Evening log',
        transactionType: 'use',
        type: 'quick'
    };
    const rt = setup({
        logs: [
            { id: 'older', substanceId: 'coke', date: '2026-08-10', startTime: '08:00', amount: 0.2, unit: 'g', transactionType: 'use', type: 'quick' },
            duplicate,
            { ...duplicate },
            { id: 'outside', substanceId: 'coke', date: '2026-05-01', amount: 1, unit: 'g', transactionType: 'use', type: 'quick' },
            { id: 'other-substance', substanceId: 'nicotine', date: '2026-08-13', amount: 5, unit: 'puffs', transactionType: 'use', type: 'quick' },
            { id: 'child', substanceId: 'coke', date: '2026-08-12', amount: 0.1, unit: 'g', isDistributedChild: true, parentLogId: 'parent', transactionType: 'use', type: 'quick' }
        ]
    });
    rt.setTestReferenceDate('2026-08-13');

    const sevenDays = rt.buildSimpleProgressDataset('coke', '7', rt.__getTestAppData());
    assert.deepEqual(sevenDays.logs.map(row => row.id), ['newest', 'older']);
    assert.equal(sevenDays.logs[0].time, '19:30');
    assert.equal(sevenDays.logs[0].cost, 12.5);
    assert.equal(sevenDays.logs[0].notes, 'Evening log');

    const allTime = rt.buildSimpleProgressDataset('coke', 'all', rt.__getTestAppData());
    assert.deepEqual(allTime.logs.map(row => row.id), ['newest', 'older', 'outside']);

    const nicotine = rt.buildSimpleProgressDataset('nicotine', '7', rt.__getTestAppData());
    assert.deepEqual(nicotine.logs.map(row => row.id), ['other-substance']);
    assert.equal(nicotine.logs[0].productType, 'Vape');
});

test('Simple Progress flow places Log Table after Calendar before Detailed Analytics', () => {
    const source = fs.readFileSync(path.join(root, 'experience-mode.module.js'), 'utf8');
    const calendar = source.indexOf('<h3>Calendar</h3>');
    const logTable = source.indexOf('<h3>Log Table</h3>');
    const details = source.indexOf('View Detailed Analytics');
    assert.ok(calendar >= 0 && logTable > calendar && details > logTable);
    assert.match(source, /No logs for this substance in the selected date range/);

    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.sm-log-table-wrap/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.sm-log-table td::before/);
});

test('simple home uses polished substance display names instead of raw ids', () => {
    const rt = setup({
        substances: [{
            id: 'coke',
            name: 'coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            units: ['g'],
            active: true,
            isMain: true,
            taperTrackingEnabled: true
        }]
    });
    const data = rt.__getTestAppData();
    const card = rt.buildSimpleTodayCard({ id: 'coke', name: 'coke', defaultUnit: 'g' }, data);
    assert.equal(card.substanceId, 'coke');
    assert.equal(card.name, 'Coke');
    assert.equal(rt.getSimpleSubstanceDisplayName('coke', data), 'Coke');
    assert.notEqual(card.name, 'coke');
});

test('estimated spending uses canonical cost engine and selected date range', () => {
    const rt = setup({
        logs: [
            { id: 1, substanceId: 'coke', date: '2026-08-01', amount: 0.5, unit: 'g', transactionType: 'use', type: 'quick' },
            { id: 2, substanceId: 'coke', date: '2026-08-13', amount: 0.2, unit: 'g', transactionType: 'use', type: 'quick' }
        ],
        purchases: [
            { id: 1, substanceId: 'coke', date: '2026-08-01', amount: 1, totalCost: 80, costPerUnit: 80, transactionType: 'buy' }
        ]
    });
    if (typeof rt.setTestReferenceDate === 'function') rt.setTestReferenceDate('2026-08-13');
    const data = rt.__getTestAppData();
    const dataset = rt.buildSimpleProgressDataset('coke', '30', data);
    assert.equal(dataset.bounds.key, '30');
    assert.equal(dataset.bounds.days, 30);
    assert.equal(dataset.bounds.endDate, '2026-08-13');
    assert.equal(dataset.spendPeriodLabel, 'Estimated spending · 30 days');
    const expected = rt.getCanonicalCostInRange('coke', dataset.bounds.startDate, dataset.bounds.endDate, data);
    assert.equal(dataset.spend, expected);
    assert.equal(rt.formatSimpleSpendPeriodLabel({ key: 'all', days: 100 }), 'Estimated spending · All time');
    assert.equal(rt.formatSimpleSpendPeriodLabel({ key: '7', days: 7 }), 'Estimated spending · 7 days');
});

test('simple mode polish CSS keeps compact calendar and one experience-mode control', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(css, /\.sm-cal-card/);
    assert.match(css, /max-width: 22\.5rem/);
    assert.match(css, /aspect-ratio: 1 \/ 1/);
    assert.match(css, /:root\[data-view-layout="laptop"\] body\.experience-simple \.bottom-nav/);
    assert.match(css, /:root\[data-view-layout="phone"\] body\.experience-simple \.bottom-nav/);
    assert.match(css, /env\(safe-area-inset-bottom/);
    assert.match(css, /\.sm-today-grid \{[\s\S]*grid-template-columns: 1fr/);
    assert.match(css, /:root\[data-view-layout="phone"\] \.sm-today-grid/);
    assert.match(css, /auto-fill, minmax\(280px/);
    assert.doesNotMatch(css, /(?:^|\n)body\.experience-simple \.bottom-nav \{/);
    assert.match(html, /class="experience-mode-select visually-hidden"/);
    assert.match(html, /data-experience-mode="simple"/);
    assert.match(html, /for="theme-preference"/);
    assert.match(html, /appearance-view-mode/);
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
