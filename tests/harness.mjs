import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appPath = path.join(root, 'app.js');

export function loadRecoveryTrackerApp(options = {}) {
    const seededStore = {};
    if (options.localStorage && typeof options.localStorage === 'object') {
        for (const [key, value] of Object.entries(options.localStorage)) {
            if (value == null) continue;
            seededStore[key] = String(value);
        }
    }
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
        Promise,
        queueMicrotask,
        process,
        fetch: () => Promise.reject(new Error('offline')),
        navigator: { onLine: true },
        alert: () => {},
        confirm: () => true,
        prompt: () => null,
        matchMedia: () => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        addEventListener: () => {},
        removeEventListener: () => {},
        localStorage: {
            store: seededStore,
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
            documentElement: {
                dataset: {},
                style: {
                    _props: {},
                    setProperty(name, value) {
                        this._props[name] = String(value);
                    },
                    getPropertyValue(name) {
                        return this._props[name] ?? '';
                    },
                    removeProperty(name) {
                        delete this._props[name];
                    }
                }
            },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            createElement: () => {
                const classes = new Set();
                return {
                    style: {},
                    className: '',
                    classList: {
                        add(...names) { names.forEach(n => classes.add(n)); },
                        remove(...names) { names.forEach(n => classes.delete(n)); },
                        toggle(name, force) {
                            if (force === true) classes.add(name);
                            else if (force === false) classes.delete(name);
                            else if (classes.has(name)) classes.delete(name);
                            else classes.add(name);
                            return classes.has(name);
                        },
                        contains(name) { return classes.has(name); }
                    },
                    appendChild() {},
                    setAttribute() {},
                    remove() {},
                    get className() { return [...classes].join(' '); },
                    set className(value) {
                        classes.clear();
                        String(value || '').split(/\s+/).filter(Boolean).forEach(n => classes.add(n));
                    }
                };
            },
            body: {
                appendChild() {},
                removeChild() {}
            }
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
            spreadPercentLeftUsage: true,
            appearanceViewMode: 'auto'
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
