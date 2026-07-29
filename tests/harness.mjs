import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appPath = path.join(root, 'app.js');

export function loadRecoveryTrackerApp() {
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Math,
        JSON,
        parseInt,
        parseFloat,
        isFinite,
        isNaN,
        Number,
        Array,
        Object,
        Map,
        Set,
        WeakMap,
        WeakSet,
        RegExp,
        Error,
        TypeError,
        RangeError,
        Infinity,
        undefined,
        NaN,
        encodeURIComponent,
        decodeURIComponent,
        structuredClone: globalThis.structuredClone ?? ((value) => JSON.parse(JSON.stringify(value))),
        alert: () => {},
        confirm: () => true,
        prompt: () => null,
        matchMedia: () => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        localStorage: {
            store: {},
            getItem(key) {
                return this.store[key] ?? null;
            },
            setItem(key, value) {
                this.store[key] = String(value);
            },
            removeItem(key) {
                delete this.store[key];
            }
        },
        document: {
            documentElement: { dataset: {} },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            createElement: () => ({
                style: {},
                classList: { add() {}, remove() {}, toggle() {} },
                appendChild() {},
                setAttribute() {}
            }),
            body: { appendChild() {} }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(appPath, 'utf8'), sandbox, { filename: 'app.js' });

    const exports = sandbox.__getRecoveryTrackerTestExports?.();
    if (!exports) {
        throw new Error('Recovery Tracker test exports are unavailable');
    }
    return exports;
}

export function makeUseLog({ id, substanceId, date, amount, time = '12:00' }) {
    return {
        id,
        substanceId,
        date,
        time,
        amount,
        transactionType: 'use',
        type: 'quick'
    };
}

export function makeTestData(logs, substances = null) {
    return {
        substances: substances ?? [{
            id: 'weed-thc',
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            trackingMode: 'weed',
            primaryUnit: 'grams',
            units: ['grams', 'hits'],
            defaultUnit: 'grams',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }, {
            id: 'alcohol',
            name: 'Alcohol',
            icon: '🍺',
            color: '#ffb74d',
            trackingMode: 'alcohol',
            primaryUnit: 'drinks',
            units: ['drinks'],
            defaultUnit: 'drinks',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }],
        logs,
        purchases: [],
        cravings: [],
        settings: {
            currency: '$',
            substanceSettings: {},
            vapeTaperCountMode: 'log-date',
            spreadPercentLeftUsage: true
        },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: {
            enabled: false,
            pinHash: '',
            autoLockMinutes: 5
        },
        migrations: {}
    };
}
