import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function lineOf(pattern) {
    const idx = appSource.search(pattern);
    assert.ok(idx >= 0, `pattern not found: ${pattern}`);
    return appSource.slice(0, idx).split('\n').length;
}

test('startup-critical constants are declared before loadData()', () => {
    const loadDataLine = lineOf(/^function loadData\(\)/m);
    const bootstrapLine = lineOf(/^function bootstrapRecoveryTrackerFromStorage\(\)/m);
    const names = [
        'BUYING_REDUCTION_RULE_KEYS',
        'PURCHASE_TAPER_MODES',
        'PURCHASE_TAPER_FORM_MODE_MAP',
        'AUTO_SPEND_BASELINE_RANGES',
        'USE_BREAK_FIELDS',
        'BUY_BREAK_FIELDS'
    ];
    for (const name of names) {
        const constLine = lineOf(new RegExp(`^const ${name}\\b`, 'm'));
        assert.ok(constLine < loadDataLine, `${name} must be declared before loadData()`);
    }
    assert.ok(bootstrapLine > loadDataLine, 'bootstrapRecoveryTrackerFromStorage must run after loadData is defined');
    assert.ok(appSource.indexOf('bootstrapRecoveryTrackerFromStorage();') > bootstrapLine);
});

test('BUYING_REDUCTION_RULE_KEYS is not duplicated in app.js', () => {
    const matches = appSource.match(/^const BUYING_REDUCTION_RULE_KEYS\b/gm) || [];
    assert.equal(matches.length, 1, 'expected exactly one BUYING_REDUCTION_RULE_KEYS declaration');
});

test('index.html has no duplicate dashboard-last-saved id', () => {
    assert.doesNotMatch(htmlSource, /id="dashboard-last-saved"/);
    const displays = htmlSource.match(/data-last-saved-display/g) || [];
    assert.ok(displays.length >= 2, 'dashboard should expose last-saved display hooks');
});

test('legacy taperPlans mirror runs only on persistence paths', () => {
    const rt = loadRecoveryTrackerApp();
    rt.__setTestAppData({
        substances: [{ id: 'coke', name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', active: true, isMain: true }],
        logs: [], purchases: [], cravings: [], goals: [], budgets: [], contacts: [],
        taperPlans: {},
        taperPlansV2: [{
            id: 't1', name: 'T1', substanceId: 'coke', status: 'active', isPrimary: true,
            startDate: '2026-08-01', endDate: '2026-09-01', reductionType: 'reduce-amount',
            weeklyTargets: []
        }],
        settings: { currency: '$' }, recoveryStreaks: {}, privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 }, migrations: {}
    });
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlans.coke, undefined);
    rt.prepareTaperDataForPersistence(data);
    assert.equal(data.taperPlans.coke?.id, 't1');
    const exported = rt.cleanExportData(data);
    assert.equal(exported.taperPlans.coke?.id, 't1');
});

test('loadData startup with buying reduction does not throw TDZ ReferenceError', () => {
    const payload = {
        substances: [{ id: 'coke', name: 'Coke', trackingMode: 'powder', primaryUnit: 'g', defaultUnit: 'g', active: true, isMain: true, taperTrackingEnabled: true }],
        logs: [], purchases: [], cravings: [], goals: [],
        taperPlans: {},
        taperPlansV2: [{
            id: 'legacy-1', name: 'Legacy', substanceId: 'coke', status: 'active', isPrimary: true,
            startDate: '2026-07-01', endDate: '2026-08-31', reductionType: 'reduce-amount',
            purchaseTaperEnabled: true, purchaseReductionMode: 'weekly_buy_amount',
            purchaseStartingWeeklyAmount: 7, purchaseGoalWeeklyAmount: 3,
            weeklyTargets: [{ week: 1, weekStart: '2026-07-28', weekEnd: '2026-08-03', targetAmount: 7 }]
        }],
        settings: { currency: '$' }, recoveryStreaks: {}, privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 }, migrations: {}
    };
    const rt = loadRecoveryTrackerApp({ localStorage: { 'recovery-tracker-v2': JSON.stringify(payload) } });
    const data = rt.__getTestAppData();
    assert.equal(data.taperPlansV2.length, 1);
    assert.ok(data.taperPlansV2[0].buyingReductionSettings || data.taperPlansV2[0]._buyingReductionMigrated);
});
