import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_DATE = '2026-08-13';
const COKE_ID = 'coke';

const FORBIDDEN_GOAL_UI = [
    /Active Goals/i,
    /Goal Analytics/i,
    /Create goal/i,
    /New goal/i,
    /Near goal/i,
    /Within goal/i,
    /Above goal/i,
    /No goal set/i,
    /Goal status/i,
    /Goals near limit/i,
    /Spending goals/i,
    /Convert Taper to Goal/i,
    /Goals &amp; Plans/i,
    /Goals & Plans/i
];

function cokeSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        units: ['g'],
        active: true,
        isMain: true,
        taperTrackingEnabled: true
    };
}

function activeCokeTaper(overrides = {}) {
    return {
        id: 'taper-coke-1',
        name: 'Coke taper',
        substanceId: COKE_ID,
        status: 'active',
        isPrimary: true,
        startDate: '2026-08-01',
        endDate: '2026-09-01',
        reductionType: 'reduce-amount',
        weeklyTargets: [{
            week: 1,
            weekStart: '2026-08-10',
            weekEnd: '2026-08-16',
            targetAmount: 3.5,
            dailyTarget: 0.5
        }],
        ...overrides
    };
}

function baseData(overrides = {}) {
    return {
        substances: [cokeSubstance()],
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
    if (typeof rt.setTestReferenceDate === 'function') rt.setTestReferenceDate(REFERENCE_DATE);
    if (typeof rt.ensureExperienceMode === 'function') rt.ensureExperienceMode();
    if (typeof rt.ensureTaperPlansV2 === 'function') rt.ensureTaperPlansV2(rt.__getTestAppData());
    return rt;
}

function assertNoForbiddenGoalUi(source, label) {
    for (const pattern of FORBIDDEN_GOAL_UI) {
        assert.doesNotMatch(source, pattern, `${label} still contains ${pattern}`);
    }
}

test('Simple Mode markup has no Goal UI', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const mod = fs.readFileSync(path.join(root, 'experience-mode.module.js'), 'utf8');
    assert.match(html, /id="simple-home"/);
    assert.match(html, /id="simple-progress"/);
    assertNoForbiddenGoalUi(html, 'index.html');
    assertNoForbiddenGoalUi(mod, 'experience-mode.module.js');
    assert.match(mod, /Taper target/);
    assert.match(mod, /No active taper/);
    assert.match(mod, /sm-metric-label">Taper</);
    assert.doesNotMatch(mod, /Goal:|Near goal|Within goal|No goal set|Goal status/);
});

test('Advanced Mode markup has no Goal UI, Active Goals, or Goal Analytics', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /Goal Analytics/);
    assert.doesNotMatch(html, /id="goal-insights-panel"/);
    assert.doesNotMatch(html, /statsGoalAnalytics/);
    assert.doesNotMatch(html, /openRecoveryQuickAction\('goal'\)/);
    assert.doesNotMatch(html, /Create goal/);
    assert.doesNotMatch(html, /Active Goals/);
    assert.match(html, /id="rd-summary-grid"/);
    assert.match(html, />Tapers</);
    assert.match(html, /Charts &amp; Trends/);
    assert.match(html, /tapers, and recovery/);
});

test('Dashboard summary source has no Active Goals tile', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /\['Active tapers'/);
    assert.match(app, /\['Substances tracked'/);
    assert.match(app, /\['Current no-use streak'/);
    assert.doesNotMatch(app, /\['Active goals'/);
    assert.doesNotMatch(app, /Create goal/);
});

test('Insights source has no Goal Analytics section', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.doesNotMatch(html, /Goal Analytics/);
    assert.doesNotMatch(app, /Spending goals/);
    assert.doesNotMatch(app, /Linked goals/);
    assert.match(app, /function renderGoalInsightsPanel\(\) \{/);
    assert.match(app, /Goals were removed/);
});

test('Simple Home uses active taper targets and does not invent a target', () => {
    const none = setup({
        logs: [{ id: 1, substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.2, unit: 'g', transactionType: 'use', type: 'quick' }]
    });
    const emptyCard = none.buildSimpleTodayCard(cokeSubstance(), none.__getTestAppData());
    assert.equal(emptyCard.target, null);
    assert.equal(emptyCard.status.key, 'none');
    assert.equal(emptyCard.status.label, 'No active taper');
    assert.equal(emptyCard.status.homeLabel, 'No active taper');
    assert.equal(none.getSimpleTaperDailyTarget(COKE_ID, REFERENCE_DATE), null);

    const rt = setup({
        logs: [{ id: 1, substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.2, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()]
    });
    const card = rt.buildSimpleTodayCard(cokeSubstance(), rt.__getTestAppData());
    assert.equal(card.target, 0.5);
    assert.equal(card.remaining, 0.3);
    assert.equal(card.status.key, 'within');
    assert.equal(card.status.homeLabel, 'Within taper target');
    assert.equal(rt.getDailyLimitForDate(COKE_ID, REFERENCE_DATE), 0.5);
});

test('Simple Progress uses active taper targets including near/above/none', () => {
    const none = setup();
    const noneProgress = none.buildSimpleProgressDataset(COKE_ID, '7', none.__getTestAppData());
    assert.equal(noneProgress.target, null);
    assert.equal(noneProgress.status.label, 'No active taper');

    const within = setup({
        logs: [{ id: 1, substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.2, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()]
    });
    const withinProgress = within.buildSimpleProgressDataset(COKE_ID, '7', within.__getTestAppData());
    assert.equal(withinProgress.target, 0.5);
    assert.equal(withinProgress.status.label, 'Within target');

    const near = setup({
        logs: [{ id: 1, substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.42, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()]
    });
    assert.equal(near.buildSimpleProgressDataset(COKE_ID, '7', near.__getTestAppData()).status.label, 'Near target');

    const above = setup({
        logs: [{ id: 1, substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.6, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()]
    });
    assert.equal(above.buildSimpleProgressDataset(COKE_ID, '7', above.__getTestAppData()).status.label, 'Above target');
});

test('legacy data containing Goals still loads without crashing or converting to tapers', () => {
    const rt = setup({
        logs: [{ id: 'keep-log', substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.1, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()],
        goals: [{
            id: 'legacy-goal-1',
            name: 'Stay under 0.5 g',
            status: 'active',
            substanceId: COKE_ID,
            type: 'daily-limit',
            target: 0.5
        }]
    });
    const loaded = rt.normalizeAppDataSafe({
        ...rt.__getTestAppData(),
        goals: [{ id: 'legacy-goal-1', name: 'Stay under 0.5 g', status: 'active', substanceId: COKE_ID }]
    });
    assert.ok(Array.isArray(loaded.goals));
    assert.equal(loaded.goals[0].id, 'legacy-goal-1');
    assert.equal(rt.evaluateAllGoals().length, 0);
    assert.equal(rt.saveGoalRecord({ name: 'Nope' }).ok, false);
    assert.equal(rt.getGoalById('legacy-goal-1'), null);
    assert.equal(loaded.taperPlansV2.length, 1);
    assert.equal(loaded.taperPlansV2[0].id, 'taper-coke-1');
    assert.equal(loaded.logs[0].id, 'keep-log');
    assert.ok(!loaded.taperPlansV2.some(p => p.id === 'legacy-goal-1'));
});

test('new JSON exports omit obsolete Goal records and keep tapers', () => {
    const rt = setup({
        logs: [{ id: 'keep-log', substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.1, unit: 'g', transactionType: 'use', type: 'quick' }],
        taperPlansV2: [activeCokeTaper()],
        goals: [{ id: 'legacy-goal-1', name: 'Stay under 0.5 g', status: 'active' }]
    });
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.equal(Object.prototype.hasOwnProperty.call(exported, 'goals'), false);
    assert.equal(exported.taperPlansV2.length, 1);
    assert.equal(exported.taperPlansV2[0].id, 'taper-coke-1');
    assert.equal(exported.logs[0].id, 'keep-log');
});

test('existing tapers keep working and lifecycle actions still mutate plans', () => {
    const rt = setup({ taperPlansV2: [activeCokeTaper()] });
    const data = rt.__getTestAppData();
    assert.equal(rt.getDailyLimitForDate(COKE_ID, REFERENCE_DATE), 0.5);
    assert.ok(rt.TAPER_TEMPLATES.length >= 6);

    rt.duplicateTaperPlanById('taper-coke-1');
    assert.equal(rt.getTaperUiState().mode, 'duplicate');
    assert.equal(data.taperPlansV2.length, 1);

    const copy = { ...activeCokeTaper(), id: 'taper-coke-copy', name: 'Coke taper copy', isPrimary: false };
    data.taperPlansV2.push(copy);

    rt.pauseTaperPlanById('taper-coke-1');
    assert.equal(rt.getTaperPlanById('taper-coke-1').status, 'paused');
    assert.equal(rt.getDailyLimitForDate(COKE_ID, REFERENCE_DATE, rt.getTaperPlanById('taper-coke-1')), null);

    rt.completeTaperPlanById(copy.id);
    assert.equal(rt.getTaperPlanById(copy.id).status, 'completed');

    rt.archiveTaperPlanById(copy.id);
    assert.equal(rt.getTaperPlanById(copy.id).status, 'archived');
});

test('saveData keeps existing user records including unused legacy goals', () => {
    const rt = setup({
        logs: [{ id: 'keep-log', substanceId: COKE_ID, date: REFERENCE_DATE, amount: 0.1, unit: 'g', transactionType: 'use', type: 'quick' }],
        purchases: [{ id: 'keep-buy', substanceId: COKE_ID, date: REFERENCE_DATE, amount: 1, totalCost: 80, transactionType: 'buy' }],
        taperPlansV2: [activeCokeTaper()],
        goals: [{ id: 'legacy-goal-1', name: 'Stay under 0.5 g', status: 'active' }]
    });
    const before = JSON.parse(JSON.stringify(rt.__getTestAppData()));
    assert.equal(rt.saveData(rt.__getTestAppData()), true);
    const reloaded = rt.__reloadTestAppDataFromStorage();
    assert.equal(reloaded.logs[0].id, before.logs[0].id);
    assert.equal(reloaded.purchases[0].id, before.purchases[0].id);
    assert.equal(reloaded.taperPlansV2[0].id, before.taperPlansV2[0].id);
    assert.equal(reloaded.goals[0].id, 'legacy-goal-1');
    assert.equal(reloaded.goals.length, 1);
});
