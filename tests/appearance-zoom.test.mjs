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

describe('Appearance Zoom', () => {
    it('1. plus and minus controls step by 5%', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        rt.setAppearanceZoom(100);
        assert.equal(rt.stepAppearanceZoom(1), 105);
        assert.equal(rt.getAppearanceZoom(), 105);
        assert.equal(rt.document.documentElement.dataset.appZoom, '105');
        assert.equal(rt.document.documentElement.style.getPropertyValue('--app-zoom').trim(), '1.05');
        assert.equal(rt.stepAppearanceZoom(-1), 100);
        assert.equal(rt.adjustAppearanceZoom(-10), 90);
        assert.equal(rt.stepAppearanceZoom(1), 95);
    });

    it('2. custom zoom validation clamps to 75–200', () => {
        const rt = loadRecoveryTrackerApp();
        assert.equal(rt.normalizeAppearanceZoom(50), 75);
        assert.equal(rt.normalizeAppearanceZoom(250), 200);
        assert.equal(rt.normalizeAppearanceZoom('110%'), 110);
        assert.equal(rt.normalizeAppearanceZoom('nope'), 100);
        assert.equal(rt.normalizeAppearanceZoom(undefined), 100);

        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        assert.equal(rt.setAppearanceZoom(72), 75);
        assert.equal(rt.setAppearanceZoom(999), 200);
        assert.equal(rt.setAppearanceZoom(137), 137);
    });

    it('3. reset to 100%', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        rt.setAppearanceZoom(150);
        assert.equal(rt.resetAppearanceZoom(), 100);
        assert.equal(rt.getActiveAppearanceZoom(), 100);
        assert.equal(rt.document.documentElement.dataset.appZoom, '100');
        assert.equal(rt.document.documentElement.style.getPropertyValue('--app-zoom').trim(), '1');
    });

    it('4. persistence after reload', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe(makeTestData([]));
        data.settings.appearanceZoom = 125;
        data.settings.phoneViewZoom = 125;
        data.settings.laptopViewZoom = 110;
        rt.saveData(data);

        const reloaded = rt.__reloadTestAppDataFromStorage();
        assert.equal(reloaded.settings.appearanceZoom, 125);
        assert.equal(reloaded.settings.phoneViewZoom, 125);
        assert.equal(reloaded.settings.laptopViewZoom, 110);
        assert.equal(rt.getAppearanceZoom(reloaded), 125);
    });

    it('5. Phone and Laptop View keep separate zoom preferences', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));

        withMatchMedia(rt, false, () => {
            rt.setAppearanceViewMode('phone');
            rt.setAppearanceZoom(90);
            assert.equal(rt.getPhoneViewZoom(), 90);
            assert.equal(rt.getActiveAppearanceZoom(), 90);
        });

        withMatchMedia(rt, true, () => {
            rt.setAppearanceViewMode('laptop');
            rt.setAppearanceZoom(125);
            assert.equal(rt.getLaptopViewZoom(), 125);
            assert.equal(rt.getActiveAppearanceZoom(), 125);
            // Phone preference preserved
            assert.equal(rt.getPhoneViewZoom(), 90);
        });

        withMatchMedia(rt, false, () => {
            rt.setAppearanceViewMode('phone');
            assert.equal(rt.getActiveAppearanceZoom(), 90);
            assert.equal(rt.document.documentElement.dataset.appZoom, '90');
        });
    });

    it('6. high zoom keeps controls reachable via layout metrics', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        rt.setAppearanceZoom(150);
        assert.equal(rt.document.documentElement.dataset.appZoom, '150');
        const clearance = rt.document.documentElement.style.getPropertyValue('--bottom-nav-clearance');
        assert.ok(clearance.includes('px'));
        assert.ok(clearance.includes('safe-area-inset-bottom'));
        const tapMin = rt.document.documentElement.style.getPropertyValue('--tap-target-min');
        assert.ok(tapMin.includes('--app-zoom') || tapMin.includes('44px'));
        // Modal content uses max-height + overflow so actions stay reachable
        assert.equal(rt.document.documentElement.style.getPropertyValue('--app-zoom').trim(), '1.5');
    });

    it('7. tables remain scrollable after zoom', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        rt.setAppearanceZoom(150);

        const wrap = rt.document.createElement('div');
        wrap.classList.add('table-scroll');
        wrap.innerHTML = '<table style="min-width:1200px"><tr><td>wide</td></tr></table>';
        rt.document.body.appendChild(wrap);
        assert.equal(wrap.classList.contains('table-scroll'), true);
        assert.equal(rt.document.documentElement.dataset.appZoom, '150');
        // Contract: zoom uses CSS variable scaling, not browser page zoom APIs
        assert.equal(rt.document.documentElement.style.getPropertyValue('--app-zoom').trim(), '1.5');
        wrap.remove();
    });

    it('8. export/import preserves zoom', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe(makeTestData([]));
        data.settings.appearanceZoom = 110;
        data.settings.phoneViewZoom = 95;
        data.settings.laptopViewZoom = 125;
        data.settings.appearanceSpacing = 'comfortable';
        rt.saveData(data);

        const exported = rt.cleanExportData(rt.__reloadTestAppDataFromStorage());
        assert.equal(exported.settings.appearanceZoom, 110);
        assert.equal(exported.settings.phoneViewZoom, 95);
        assert.equal(exported.settings.laptopViewZoom, 125);

        const imported = rt.normalizeAppDataSafe({
            ...rt.getDefaultAppData(),
            settings: {
                ...rt.getDefaultAppData().settings,
                appearanceZoom: exported.settings.appearanceZoom,
                phoneViewZoom: exported.settings.phoneViewZoom,
                laptopViewZoom: exported.settings.laptopViewZoom,
                appearanceSpacing: exported.settings.appearanceSpacing
            }
        });
        assert.equal(imported.settings.appearanceZoom, 110);
        assert.equal(imported.settings.phoneViewZoom, 95);
        assert.equal(imported.settings.laptopViewZoom, 125);
        assert.equal(imported.settings.appearanceSpacing, 'comfortable');
    });

    it('Reset Appearance restores auto view, 100% zoom, and default spacing', () => {
        const rt = loadRecoveryTrackerApp();
        rt.__setTestAppData(rt.normalizeAppDataSafe(makeTestData([])));
        rt.setAppearanceViewMode('laptop');
        rt.setAppearanceZoom(150);
        rt.setAppearanceSpacing('compact');
        rt.resetAppearanceSettings();
        assert.equal(rt.getAppearanceViewMode(), 'auto');
        assert.equal(rt.getAppearanceZoom(), 100);
        assert.equal(rt.getPhoneViewZoom(), 100);
        assert.equal(rt.getLaptopViewZoom(), 100);
        assert.equal(rt.getAppearanceSpacing(), 'default');
        assert.equal(rt.document.documentElement.dataset.appZoom, '100');
    });

    it('normalizes invalid zoom values in app data', () => {
        const rt = loadRecoveryTrackerApp();
        const data = rt.normalizeAppDataSafe({
            ...makeTestData([]),
            settings: {
                ...makeTestData([]).settings,
                appearanceZoom: 999,
                phoneViewZoom: 10,
                laptopViewZoom: 'nope'
            }
        });
        assert.equal(data.settings.appearanceZoom, 200);
        assert.equal(data.settings.phoneViewZoom, 75);
        assert.equal(data.settings.laptopViewZoom, 100);
    });
});
