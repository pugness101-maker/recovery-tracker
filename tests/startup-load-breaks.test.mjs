import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STORAGE_KEY = 'recovery-tracker-v2';
const COKE_ID = 'coke';

function savedAppData(overrides = {}) {
    return {
        substances: [{
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
        }],
        logs: [
            {
                id: 101,
                substanceId: COKE_ID,
                date: '2026-07-26',
                startTime: '10:00',
                endTime: '11:00',
                amount: 0.5,
                unit: 'g',
                transactionType: 'use',
                type: 'session'
            },
            {
                id: 102,
                substanceId: COKE_ID,
                date: '2026-07-26',
                startTime: '19:00',
                endTime: '20:00',
                amount: 0.4,
                unit: 'g',
                transactionType: 'use',
                type: 'session'
            }
        ],
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID,
            experienceMode: 'advanced'
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: {
            inventoryLinkedV1: true,
            purchaseIdLinkV2: true,
            vapeInventoryLinkV2: true,
            experienceModeV1: true
        },
        ...overrides
    };
}

function loadWithSavedData(data, extraStorage = {}) {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => {
        errors.push(args.map(value => String(value)).join(' '));
        origError.apply(console, args);
    };
    let rt;
    try {
        rt = loadRecoveryTrackerApp({
            localStorage: {
                [STORAGE_KEY]: JSON.stringify(data),
                ...extraStorage
            }
        });
    } finally {
        console.error = origError;
    }
    return { rt, errors };
}

function assertNoTdz(errors, label) {
    const joined = errors.join('\n');
    assert.doesNotMatch(
        joined,
        /before initialization|Cannot access ['"]USE_BREAK_FIELDS['"]|Cannot access ['"]BUY_BREAK_FIELDS['"]/,
        `${label} must not hit a TDZ error: ${joined}`
    );
}

test('USE_BREAK_FIELDS is initialized before the startup loadData() call', () => {
    const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const useBreakIdx = src.indexOf("const USE_BREAK_FIELDS = Object.freeze(['breakMinutes', 'breakHours', 'breakText'])");
    const buyBreakIdx = src.indexOf("const BUY_BREAK_FIELDS = Object.freeze(['buyBreakMinutes', 'buyBreakHours', 'buyBreakText'])");
    const loadIdx = src.indexOf('appData = loadData()');
    assert.ok(useBreakIdx >= 0, 'USE_BREAK_FIELDS must be declared');
    assert.ok(buyBreakIdx >= 0, 'BUY_BREAK_FIELDS must be declared');
    assert.ok(loadIdx >= 0, 'startup loadData() call must exist');
    assert.ok(useBreakIdx < loadIdx, 'USE_BREAK_FIELDS must be initialized before loadData()');
    assert.ok(buyBreakIdx < loadIdx, 'BUY_BREAK_FIELDS must be initialized before loadData()');
    assert.equal(src.split('const USE_BREAK_FIELDS').length - 1, 1);
    assert.equal(src.split('const BUY_BREAK_FIELDS').length - 1, 1);
});

test('cloud init in initializeApp runs after local data is persisted', () => {
    const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const start = src.indexOf('function initializeApp()');
    const end = src.indexOf('function refreshAppAfterDataChange()');
    assert.ok(start >= 0 && end > start, 'initializeApp body must be locatable');
    const body = src.slice(start, end);
    const persistIdx = body.indexOf('persistLoadedAppDataIfNeeded()');
    const cloudIdx = body.indexOf('initCloudSync()');
    assert.ok(persistIdx >= 0, 'initializeApp must persist loaded data');
    assert.ok(cloudIdx >= 0, 'initializeApp must start cloud sync');
    assert.ok(persistIdx < cloudIdx, 'cloud initialization must run after local data load/persist');
});

test('existing saved data loads through the real startup path without a TDZ crash', () => {
    const saved = savedAppData();
    const { rt, errors } = loadWithSavedData(saved);
    assertNoTdz(errors, 'startup loadData');

    const data = rt.__getTestAppData();
    assert.ok(Array.isArray(data.logs));
    assert.equal(data.logs.length, 2);
    assert.equal(data.logs[0].id, 101);
    assert.equal(data.logs[1].id, 102);

    const normalized = rt.normalizeAppDataSafe(data);
    assert.ok(normalized);
    assert.equal(normalized.logs.length, 2);

    const first = data.logs.find(log => log.id === 101);
    const second = data.logs.find(log => log.id === 102);
    assert.equal(rt.getBreakBetweenUsesDetails(first, data).hours, null);
    assert.equal(rt.getBreakBetweenUsesDetails(first, data).text, '—');
    assert.equal(rt.getBreakBetweenUsesDetails(second, data).hours, 8);
    assert.equal(rt.getBreakBetweenUsesDetails(second, data).text, '8h');
    assert.equal(second.breakHours, 8);

    const statusBefore = rt.getCloudSyncStatus();
    assert.ok(statusBefore);
    rt.initCloudSync();
    const statusAfter = rt.getCloudSyncStatus();
    assert.ok(statusAfter);
    assert.equal(typeof statusAfter.status, 'string');
});

test('Simple and Advanced modes still load from saved data', () => {
    const simpleSaved = savedAppData({
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID,
            experienceMode: 'simple'
        }
    });
    const { rt: simpleRt, errors: simpleErrors } = loadWithSavedData(simpleSaved);
    assertNoTdz(simpleErrors, 'simple mode startup');
    simpleRt.ensureExperienceMode();
    assert.equal(simpleRt.getExperienceMode(), 'simple');
    assert.equal(simpleRt.isSimpleExperienceMode(), true);

    const advancedSaved = savedAppData({
        settings: {
            currency: '$',
            substanceSettings: {},
            dashboardSubstanceId: COKE_ID,
            experienceMode: 'advanced'
        }
    });
    const { rt: advancedRt, errors: advancedErrors } = loadWithSavedData(advancedSaved);
    assertNoTdz(advancedErrors, 'advanced mode startup');
    advancedRt.ensureExperienceMode();
    assert.equal(advancedRt.getExperienceMode(), 'advanced');
    assert.equal(advancedRt.isAdvancedExperienceMode(), true);
});
