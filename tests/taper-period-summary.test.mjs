import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COKE_ID = 'coke';

function makeCokeSubstance() {
    return {
        id: COKE_ID,
        name: 'Coke',
        trackingMode: 'powder',
        primaryUnit: 'g',
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true,
        active: true
    };
}

function makePlan(overrides = {}) {
    return {
        id: 'taper-coke',
        substanceId: COKE_ID,
        name: 'Coke taper',
        status: 'active',
        isPrimary: true,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        reductionType: 'reduce-amount',
        goalDailyAverage: 0.5,
        reductionAmount: 0.25,
        weeklyTargets: [
            { week: 1, weekStart: '2026-07-01', weekEnd: '2026-07-06', weeklyMax: 14, targetAmount: 14 }
        ],
        ...overrides
    };
}

function setup({ plan = makePlan(), logs = [], purchases = [], dateStr = '2026-07-15' } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(dateStr);
    rt.__setTestAppData({
        substances: [makeCokeSubstance()],
        logs,
        purchases,
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [plan],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { taperPlansV2: true }
    });
    return rt;
}

test('Taper Summary section sits between Plan and Current Week Summary in HTML', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const planIdx = html.indexOf('data-section="taperPlanHeader"');
    const summaryIdx = html.indexOf('data-section="taperPeriodSummary"');
    const weekIdx = html.indexOf('data-section="taperCurrentWeekSummary"');
    assert.ok(planIdx >= 0);
    assert.ok(summaryIdx > planIdx);
    assert.ok(weekIdx > summaryIdx);
    assert.match(html, /id="taper-period-total-used"/);
    assert.match(html, /id="taper-period-avg-cost-day"/);
});

test('getTaperPeriodSummary totals usage and cost for elapsed taper days only', () => {
    const rt = setup({
        logs: [
            {
                id: 'log-1',
                substanceId: COKE_ID,
                date: '2026-07-10',
                amount: 2,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'log-2',
                substanceId: COKE_ID,
                date: '2026-07-12',
                amount: 1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick',
                purchaseId: 'buy-1'
            },
            {
                id: 'log-outside',
                substanceId: COKE_ID,
                date: '2026-08-05',
                amount: 99,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            }
        ],
        purchases: [{
            id: 'buy-1',
            substanceId: COKE_ID,
            date: '2026-07-01',
            quantity: 3,
            totalCost: 30,
            remaining: 0
        }]
    });
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const summary = rt.getTaperPeriodSummary(plan, COKE_ID);

    assert.equal(summary.ok, true);
    assert.equal(summary.elapsedDays, 15);
    assert.equal(summary.totalDays, 31);
    assert.equal(summary.totalUsed, 3);
    assert.equal(summary.avgPerDay, 3 / 15);
    assert.ok(summary.totalCost > 0);
    assert.equal(summary.avgCostPerDay, summary.totalCost / 15);
});

test('getTaperPeriodSummary ignores other substances and pre-start usage', () => {
    const rt = setup({
        plan: makePlan({ startDate: '2026-07-10', endDate: '2026-07-20' }),
        logs: [
            {
                id: 'before',
                substanceId: COKE_ID,
                date: '2026-07-05',
                amount: 5,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            },
            {
                id: 'during',
                substanceId: COKE_ID,
                date: '2026-07-12',
                amount: 1,
                unit: 'g',
                transactionType: 'use',
                type: 'quick'
            }
        ],
        dateStr: '2026-07-12'
    });
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const summary = rt.getTaperPeriodSummary(plan, COKE_ID);

    assert.equal(summary.totalUsed, 1);
    assert.equal(summary.elapsedDays, 3);
});

test('getTaperPeriodSummary returns zero totals before taper start', () => {
    const rt = setup({ dateStr: '2026-06-20' });
    const plan = rt.__getTestAppData().taperPlansV2[0];
    const summary = rt.getTaperPeriodSummary(plan, COKE_ID);

    assert.equal(summary.notStarted, true);
    assert.equal(summary.totalUsed, 0);
    assert.equal(summary.totalCost, 0);
    assert.equal(summary.elapsedDays, 0);
});
