import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRecoveryTrackerApp, makeTestData } from './harness.mjs';

function withMatchMedia(rt, matches, run) {
    const previous = rt.matchMedia;
    const listeners = [];
    rt.matchMedia = (query) => ({
        matches: typeof matches === 'function' ? matches(query) : !!matches,
        media: query,
        addEventListener(_type, cb) { listeners.push(cb); },
        removeEventListener(_type, cb) {
            const idx = listeners.indexOf(cb);
            if (idx >= 0) listeners.splice(idx, 1);
        },
        dispatch(nextMatches) {
            for (const cb of [...listeners]) cb({ matches: nextMatches, media: query });
        }
    });
    try {
        return run(listeners);
    } finally {
        rt.matchMedia = previous;
    }
}

describe('Appearance View Mode', () => {
    it('defaults to auto and uses responsive breakpoints', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe(makeTestData([]));
        assert.equal(data.settings.appearanceViewMode, 'auto');

        withMatchMedia(rt, (query) => query.includes('min-width: 768px'), () => {
            assert.equal(rt.resolveAppearanceViewLayout('auto'), 'laptop');
        });
        withMatchMedia(rt, false, () => {
            assert.equal(rt.resolveAppearanceViewLayout('auto'), 'phone');
        });
    });

    it('Phone View overrides desktop width', () => {
        const rt = loadRecoveryTrackerApp();
        withMatchMedia(rt, true, () => {
            assert.equal(rt.resolveAppearanceViewLayout('phone'), 'phone');
            rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
            rt.setAppearanceViewMode('phone');
            assert.equal(rt.getAppearanceViewMode(), 'phone');
            assert.equal(rt.document.documentElement.dataset.viewMode, 'phone');
            assert.equal(rt.document.documentElement.dataset.viewLayout, 'phone');
            assert.equal(rt.isAppearancePhoneLayout(), true);
            assert.equal(rt.isAppearanceLaptopLayout(), false);
        });
    });

    it('Laptop View overrides mobile width', () => {
        const rt = loadRecoveryTrackerApp();
        withMatchMedia(rt, false, () => {
            assert.equal(rt.resolveAppearanceViewLayout('laptop'), 'laptop');
            rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
            rt.setAppearanceViewMode('laptop');
            assert.equal(rt.getAppearanceViewMode(), 'laptop');
            assert.equal(rt.document.documentElement.dataset.viewMode, 'laptop');
            assert.equal(rt.document.documentElement.dataset.viewLayout, 'laptop');
            assert.equal(rt.isAppearanceLaptopLayout(), true);
            assert.equal(rt.isAppearancePhoneLayout(), false);
        });
    });

    it('persists after reload', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe(makeTestData([]));
        data.settings.appearanceViewMode = 'laptop';
        rt.saveData(data);

        const reloaded = rt.__reloadTestAppDataFromStorage();
        assert.equal(reloaded.settings.appearanceViewMode, 'laptop');
        assert.equal(rt.getAppearanceViewMode(reloaded), 'laptop');
        assert.equal(rt.resolveAppearanceViewLayout(rt.getAppearanceViewMode(reloaded)), 'laptop');
    });

    it('export/import preserves setting', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe(makeTestData([]));
        data.settings.appearanceViewMode = 'phone';
        rt.saveData(data);

        const exported = rt.cleanExportData(rt.__reloadTestAppDataFromStorage());
        assert.equal(exported.settings.appearanceViewMode, 'phone');

        const imported = rt.normalizeAppDataSafe({
            ...rt.getDefaultAppData(),
            settings: {
                ...rt.getDefaultAppData().settings,
                appearanceViewMode: exported.settings.appearanceViewMode
            }
        });
        assert.equal(imported.settings.appearanceViewMode, 'phone');

        const merged = rt.normalizeAppDataSafe({
            ...makeTestData([]),
            settings: {
                ...makeTestData([]).settings,
                appearanceViewMode: 'auto'
            }
        });
        merged.settings = {
            ...merged.settings,
            ...exported.settings
        };
        assert.equal(rt.normalizeAppearanceViewMode(merged.settings.appearanceViewMode), 'phone');
    });

    it('navigation dataset updates correctly for each mode', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));

        withMatchMedia(rt, false, () => {
            rt.applyAppearanceViewMode('auto');
            assert.equal(rt.document.documentElement.dataset.viewMode, 'auto');
            assert.equal(rt.document.documentElement.dataset.viewLayout, 'phone');
        });

        withMatchMedia(rt, true, () => {
            rt.applyAppearanceViewMode('auto');
            assert.equal(rt.document.documentElement.dataset.viewMode, 'auto');
            assert.equal(rt.document.documentElement.dataset.viewLayout, 'laptop');
        });

        rt.applyAppearanceViewMode('phone');
        assert.equal(rt.document.documentElement.dataset.viewLayout, 'phone');

        rt.applyAppearanceViewMode('laptop');
        assert.equal(rt.document.documentElement.dataset.viewLayout, 'laptop');
    });

    it('keeps tables usable in forced Laptop View', () => {
        const rt = loadRecoveryTrackerApp();
        withMatchMedia(rt, false, () => {
            rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
            rt.setAppearanceViewMode('laptop');
            assert.equal(rt.document.documentElement.dataset.viewLayout, 'laptop');
            // Forced laptop must not fall back to phone layout on a narrow viewport.
            assert.equal(rt.resolveAppearanceViewLayout('laptop'), 'laptop');
            assert.equal(rt.isAppearanceLaptopLayout(), true);
        });
    });

    it('normalizes invalid values to auto', () => {
        const rt = loadRecoveryTrackerApp();
        assert.equal(rt.normalizeAppearanceViewMode('nope'), 'auto');
        assert.equal(rt.normalizeAppearanceViewMode(undefined), 'auto');
        const data = rt.normalizeAppDataSafe({
            ...makeTestData([]),
            settings: {
                ...makeTestData([]).settings,
                appearanceViewMode: 'tablet'
            }
        });
        assert.equal(data.settings.appearanceViewMode, 'auto');
    });
});
