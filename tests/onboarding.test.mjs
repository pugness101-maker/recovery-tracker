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
        }, {
            id: 'alcohol',
            name: 'Alcohol',
            trackingMode: 'alcohol',
            primaryUnit: 'drinks',
            defaultUnit: 'drinks',
            units: ['drinks'],
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
    return rt;
}

test('onboarding markup exists in Simple Mode shell', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(html, /id="onboarding-overlay"/);
    assert.match(html, /id="onboarding-root"/);
    assert.doesNotMatch(html, /id="onboarding-setup-section"/);
    assert.doesNotMatch(html, /Onboarding \/ Setup/);
    assert.doesNotMatch(html, /Review setup/);
    assert.doesNotMatch(html, /Change tracked substances/);
    assert.doesNotMatch(html, /Change primary substance/);
    assert.doesNotMatch(html, /Restart onboarding/);
    assert.doesNotMatch(html, /id="onboarding-settings-summary"/);
    assert.match(html, /Manage Substances/);
    assert.match(html, /openSubstanceEditor\(\)/);
    assert.match(html, /id="experience-mode"/);
    assert.match(html, /data-section="settingsAppearance"/);
    assert.match(css, /\.onboarding-overlay/);
    assert.match(css, /\.sm-empty-hint/);
    assert.doesNotMatch(css, /\.onboarding-settings-facts/);
});

test('fresh install shows onboarding', () => {
    const rt = setup();
    assert.equal(rt.hasMeaningfulRecoveryData(rt.__getTestAppData()), false);
    assert.equal(rt.shouldShowOnboarding(rt.__getTestAppData()), true);
    assert.equal(rt.maybeStartOnboarding(rt.__getTestAppData()), true);
});

test('existing user skips onboarding automatically', () => {
    const rt = setup({
        logs: [{ id: 1, substanceId: 'coke', date: '2026-08-01', amount: 0.2, transactionType: 'use', type: 'quick' }]
    });
    rt.migrateOnboardingV1(rt.__getTestAppData());
    assert.equal(rt.hasMeaningfulRecoveryData(rt.__getTestAppData()), true);
    assert.equal(rt.shouldShowOnboarding(rt.__getTestAppData()), false);
    assert.equal(rt.__getTestAppData().settings.onboardingCompleted, true);
    assert.equal(rt.maybeStartOnboarding(rt.__getTestAppData()), false);
    assert.equal(rt.getExperienceMode(), 'simple');
});

test('completing onboarding persists onboardingCompleted and selections', () => {
    const rt = setup();
    const result = rt.completeOnboarding({
        next: 'home',
        draft: {
            selectedIds: ['coke', 'nicotine'],
            primaryId: 'coke',
            intentId: 'use-less',
            taperChoice: 'later',
            experienceMode: 'simple',
            reminder: 'none',
            otherEnabled: false,
            otherName: ''
        }
    });
    const data = rt.__getTestAppData();
    assert.equal(result.onboardingCompleted, true);
    assert.equal(data.settings.onboardingCompleted, true);
    assert.equal(data.substances.find(s => s.id === 'coke').active, true);
    assert.equal(data.substances.find(s => s.id === 'coke').isMain, true);
    assert.equal(data.substances.find(s => s.id === 'nicotine').active, true);
    assert.equal(data.substances.find(s => s.id === 'alcohol').active, false);
    assert.equal(rt.getOnboardingState().primarySubstanceId, 'coke');
    assert.equal(rt.shouldShowOnboarding(data), false);
});

test('Simple/Detailed choice maps to Experience Mode', () => {
    const simple = setup();
    simple.completeOnboarding({
        next: 'home',
        draft: {
            selectedIds: ['coke'],
            primaryId: 'coke',
            intentId: 'track-use',
            experienceMode: 'simple',
            reminder: 'none',
            otherEnabled: false
        }
    });
    assert.equal(simple.getExperienceMode(), 'simple');
    assert.equal(simple.isSimpleExperienceMode(), true);

    const detailed = setup();
    detailed.completeOnboarding({
        next: 'home',
        draft: {
            selectedIds: ['coke'],
            primaryId: 'coke',
            intentId: 'understand',
            experienceMode: 'advanced',
            reminder: 'none',
            otherEnabled: false
        }
    });
    assert.equal(detailed.getExperienceMode(), 'advanced');
    assert.equal(detailed.isAdvancedExperienceMode(), true);
});

test('taper is not automatically created without explicit confirmation', () => {
    const rt = setup();
    const before = (rt.__getTestAppData().taperPlansV2 || []).length;
    const result = rt.completeOnboarding({
        next: 'quick-log',
        draft: {
            selectedIds: ['coke'],
            primaryId: 'coke',
            intentId: 'use-less',
            taperChoice: 'now',
            experienceMode: 'simple',
            reminder: 'none',
            otherEnabled: false
        }
    });
    assert.equal(result.taperSetupRequested, true);
    assert.equal(result.taperCreated, false);
    assert.equal((rt.__getTestAppData().taperPlansV2 || []).length, before);
    assert.deepEqual(rt.__getTestAppData().taperPlans, {});
});

test('restart onboarding does not delete data', () => {
    const rt = setup({
        logs: [{ id: 'keep-1', substanceId: 'coke', date: '2026-08-13', amount: 0.25, unit: 'g', transactionType: 'use', type: 'quick' }],
        purchases: [{ id: 'p1', substanceId: 'coke', date: '2026-08-01', quantityBought: 1, remainingAmount: 1 }],
        taperPlansV2: [{ id: 't1', substanceId: 'coke', status: 'active', name: 'Existing taper' }]
    });
    rt.migrateOnboardingV1(rt.__getTestAppData());
    const preserved = rt.restartOnboarding(rt.__getTestAppData());
    const data = rt.__getTestAppData();
    assert.equal(preserved.logsPreserved, true);
    assert.equal(preserved.purchasesPreserved, true);
    assert.equal(preserved.tapersPreserved, true);
    assert.equal(data.logs[0].id, 'keep-1');
    assert.equal(data.purchases[0].id, 'p1');
    assert.equal(data.taperPlansV2[0].id, 't1');
    assert.equal(rt.shouldShowOnboarding(data), true);
});

test('Skip Setup works', () => {
    const rt = setup();
    const beforeSubs = rt.__getTestAppData().substances.map(s => ({ id: s.id, active: s.active, isMain: s.isMain }));
    const result = rt.skipOnboarding(rt.__getTestAppData());
    assert.equal(result.skipped, true);
    assert.equal(result.onboardingCompleted, true);
    assert.equal(rt.__getTestAppData().settings.onboardingCompleted, true);
    assert.equal(rt.shouldShowOnboarding(rt.__getTestAppData()), false);
    assert.equal(rt.getExperienceMode(), 'simple');
    assert.deepEqual(
        rt.__getTestAppData().substances.map(s => ({ id: s.id, active: s.active, isMain: s.isMain })),
        beforeSubs
    );
    assert.deepEqual(rt.__getTestAppData().logs, []);
});

test('first-entry action opens Quick Log with the primary substance', () => {
    const rt = setup();
    rt.completeOnboarding({
        next: 'quick-log',
        draft: {
            selectedIds: ['nicotine'],
            primaryId: 'nicotine',
            intentId: 'track-use',
            experienceMode: 'simple',
            reminder: 'none',
            otherEnabled: false
        }
    });
    const ctx = rt.getSimpleQuickLogContext();
    assert.equal(ctx.substanceId, 'nicotine');
    assert.equal(ctx.locked, true);
});

test('refresh does not restart completed onboarding', () => {
    const rt = setup();
    rt.completeOnboarding({
        next: 'home',
        draft: {
            selectedIds: ['coke'],
            primaryId: 'coke',
            intentId: 'track-use',
            experienceMode: 'simple',
            reminder: 'evening',
            otherEnabled: false
        }
    });
    const snap = rt.__getStorageSnapshot();
    assert.ok(snap);
    const stored = JSON.parse(snap);
    assert.equal(stored.settings.onboardingCompleted, true);

    rt.__reloadTestAppDataFromStorage();
    assert.equal(rt.__getTestAppData().settings.onboardingCompleted, true);
    assert.equal(rt.shouldShowOnboarding(rt.__getTestAppData()), false);
    assert.equal(rt.maybeStartOnboarding(rt.__getTestAppData()), false);
});

test('importing existing data does not trigger destructive onboarding', () => {
    const rt = setup();
    const exported = {
        substances: [
            { id: 'coke', name: 'Coke', active: true, isMain: true, trackingMode: 'powder', units: ['g'], defaultUnit: 'g' },
            { id: 'nicotine', name: 'Nicotine', active: true, isMain: false, trackingMode: 'nicotine', units: ['puffs'], defaultUnit: 'puffs' }
        ],
        logs: [{ id: 'imp-1', substanceId: 'coke', date: '2026-08-01', amount: 0.4, unit: 'g', transactionType: 'use', type: 'quick' }],
        purchases: [{ id: 'imp-p', substanceId: 'coke', date: '2026-08-01', quantityBought: 2, remainingAmount: 1 }],
        settings: { currency: '$', experienceMode: 'advanced', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [{ id: 'imp-t', substanceId: 'coke', status: 'active' }]
    };
    const merged = rt.mergeImportedData(rt.__getTestAppData(), exported);
    assert.equal(merged.settings.onboardingCompleted, true);
    assert.equal(merged.settings.experienceMode, 'advanced');
    assert.equal(merged.logs.some(l => l.id === 'imp-1'), true);
    assert.equal(merged.purchases.some(p => p.id === 'imp-p'), true);
    assert.equal(merged.taperPlansV2.some(t => t.id === 'imp-t'), true);
    assert.equal(rt.shouldShowOnboarding(merged), false);
    assert.equal(rt.hasMeaningfulRecoveryData(merged), true);
});

test('reminders store a preference without faking schedules', () => {
    const rt = setup();
    const stored = rt.applyOnboardingReminderPreference('morning');
    assert.equal(stored.reminder, 'morning');
    assert.equal(stored.reminderScheduled, false);
    assert.ok(['unsupported', 'not-requested', 'pending', 'default', 'denied', 'granted'].includes(stored.reminderPermission));
});
