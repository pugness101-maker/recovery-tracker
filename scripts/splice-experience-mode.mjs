#!/usr/bin/env node
/**
 * Splice Experience Mode (Simple / Advanced) into app.js + index.html + styles.css
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const mod = fs.readFileSync(path.join(root, 'experience-mode.module.js'), 'utf8');

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    if (src.includes(repl) && repl.length > 40) {
        console.warn('Already applied:', label);
        return src;
    }
    return src.replace(find, repl);
}

function insertOnce(src, marker, insertion, label, after = false) {
    if (src.includes(insertion.slice(0, Math.min(60, insertion.length)))) {
        console.warn('Already inserted:', label);
        return src;
    }
    const idx = src.indexOf(marker);
    if (idx < 0) {
        console.warn('Missing marker:', label);
        return src;
    }
    if (after) {
        return src.slice(0, idx + marker.length) + insertion + src.slice(idx + marker.length);
    }
    return src.slice(0, idx) + insertion + src.slice(idx);
}

// ——— app.js module block ———
const MODULE_START = '// ——— App-wide Experience Mode (Simple / Advanced) ———';
const MODULE_END = 'const defaultData = {';

if (app.includes(MODULE_START)) {
    const start = app.indexOf(MODULE_START);
    const end = app.indexOf(MODULE_END, start);
    if (end < 0) throw new Error('Could not find defaultData after experience-mode block');
    app = app.slice(0, start) + mod + '\n\n' + app.slice(end);
    console.log('Refreshed experience-mode module');
} else {
    const idx = app.indexOf(MODULE_END);
    if (idx < 0) throw new Error('defaultData missing');
    app = app.slice(0, idx) + mod + '\n\n' + app.slice(idx);
    console.log('Inserted experience-mode module');
}

// default settings
app = tryReplace(app,
    `        taperSuggestions: {
            autoSuggestEnabled: true,
            lookbackDays: 30
        }
    },`,
    `        taperSuggestions: {
            autoSuggestEnabled: true,
            lookbackDays: 30
        },
        experienceMode: 'simple',
        simpleModePrefs: null
    },`,
    'default experienceMode');

// ensureAppDataSettings hook
app = tryReplace(app,
    `    ensureInsightsLayoutPrefs(data);
    applyInsightsSimplifyNavMigration(data);
    ensureInventorySourcesMigrated(data);`,
    `    ensureInsightsLayoutPrefs(data);
    applyInsightsSimplifyNavMigration(data);
    ensureExperienceMode(data);
    ensureInventorySourcesMigrated(data);`,
    'ensureExperienceMode in settings');

// init after insights simplify
app = tryReplace(app,
    `if (typeof initInsightsSimplify === 'function') {
    try { initInsightsSimplify(); } catch (_) { /* DOM may be absent in tests */ }
}`,
    `if (typeof initInsightsSimplify === 'function') {
    try { initInsightsSimplify(); } catch (_) { /* DOM may be absent in tests */ }
}
if (typeof initExperienceMode === 'function') {
    try { initExperienceMode(); } catch (_) { /* DOM may be absent in tests */ }
}`,
    'initExperienceMode');

// initializeApp
app = tryReplace(app,
    `    if (typeof initCombinedNavigation === 'function') initCombinedNavigation();
    const route = typeof applyRouteRedirectIfNeeded === 'function' ? applyRouteRedirectIfNeeded() : null;`,
    `    if (typeof initCombinedNavigation === 'function') initCombinedNavigation();
    if (typeof initExperienceMode === 'function') {
        try { initExperienceMode(); } catch (err) { console.error('[experience-mode] init failed', err); }
    }
    const route = typeof applyRouteRedirectIfNeeded === 'function' ? applyRouteRedirectIfNeeded() : null;`,
    'initializeApp experience mode');

// refreshAppAfterDataChange
app = tryReplace(app,
    `    applyDashboardLayout();
    updateUndoButtonState();
    renderDashboardLayoutEditor();
}`,
    `    applyDashboardLayout();
    updateUndoButtonState();
    renderDashboardLayoutEditor();
    if (typeof applyExperienceMode === 'function') {
        try { applyExperienceMode(appData); } catch (_) { /* ignore */ }
    }
}`,
    'refreshAppAfterDataChange experience');

// switchTab hook — end of function before closing brace of switchTab
app = tryReplace(app,
    `    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        syncRecoveryScoreSettingsToggle();
        syncUseCustomNamesInCsvToggle();
        if (typeof syncInCellProgressBarsToggle === 'function') syncInCellProgressBarsToggle();
        if (typeof renderConditionalColorRulesSettings === 'function') renderConditionalColorRulesSettings();
        if (typeof ensureContactsMigrated === 'function') ensureContactsMigrated(appData);
        if (typeof renderContactsView === 'function') renderContactsView();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    }
    applyCollapsedSections();
}`,
    `    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        syncRecoveryScoreSettingsToggle();
        syncUseCustomNamesInCsvToggle();
        if (typeof syncInCellProgressBarsToggle === 'function') syncInCellProgressBarsToggle();
        if (typeof renderConditionalColorRulesSettings === 'function') renderConditionalColorRulesSettings();
        if (typeof ensureContactsMigrated === 'function') ensureContactsMigrated(appData);
        if (typeof renderContactsView === 'function') renderContactsView();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
        if (typeof syncExperienceModeSettingsUI === 'function') syncExperienceModeSettingsUI(appData);
    }
    applyCollapsedSections();
    if (typeof onExperienceModeTabChange === 'function') {
        try { onExperienceModeTabChange(tabId); } catch (_) { /* ignore */ }
    }
}`,
    'switchTab experience hooks');

// Remember quick log before form reset; optional inventory in simple mode
app = tryReplace(app,
    `function resetUseFormAfterSave() {
    editingUseId = null;
    document.getElementById('use-log-form')?.reset();
    setDefaultUseLogDateTime();
    setUseLogType('quick');
    setUseFormSubmitLabel('Save Entry');
    document.getElementById('cancel-use-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateUseUnitDropdown();
    setUsePurchaseLinkMode('auto');
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
    setAlcoholUseEntryMode('single_day');
    const alcoholSplitEl = document.getElementById('use-alcohol-split-evenly');
    if (alcoholSplitEl) alcoholSplitEl.checked = true;
    updateVapeUseFormUI();
}`,
    `function resetUseFormAfterSave() {
    if (typeof onExperienceModeAfterUseLogSave === 'function') {
        try { onExperienceModeAfterUseLogSave(); } catch (_) { /* ignore */ }
    }
    editingUseId = null;
    document.getElementById('use-log-form')?.reset();
    setDefaultUseLogDateTime();
    setUseLogType('quick');
    setUseFormSubmitLabel('Save Entry');
    document.getElementById('cancel-use-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateUseUnitDropdown();
    setUsePurchaseLinkMode(
        (typeof isSimpleExperienceMode === 'function' && isSimpleExperienceMode()) ? 'none' : 'auto'
    );
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
    setAlcoholUseEntryMode('single_day');
    const alcoholSplitEl = document.getElementById('use-alcohol-split-evenly');
    if (alcoholSplitEl) alcoholSplitEl.checked = true;
    updateVapeUseFormUI();
    if (typeof applySimpleLogFormLayout === 'function') {
        try { applySimpleLogFormLayout(appData); } catch (_) { /* ignore */ }
    }
}`,
    'resetUseFormAfterSave experience');

app = tryReplace(app,
    `function refreshUseLogRelatedViews() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
    renderUseLogTab();
    updateDashboard();
    updateStats();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
}`,
    `function refreshUseLogRelatedViews() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
    renderUseLogTab();
    updateDashboard();
    updateStats();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
    if (typeof isSimpleExperienceMode === 'function' && isSimpleExperienceMode()) {
        try { renderSimpleHome(appData); } catch (_) { /* ignore */ }
        try { renderSimpleProgress(appData); } catch (_) { /* ignore */ }
    }
}`,
    'refreshUseLogRelatedViews experience');

// Wrap showNewTaperPlan for simple wizard
app = tryReplace(app,
    `function showNewTaperPlan() {
    if (taperEditingPlan && taperFormDirty && !confirmDiscardTaperFormChanges()) return false;
    taperFormPlanId = null;
    taperEditingPlan = true;
    resetTaperFormLifecycleState();
    setInputValue('taper-editing-plan-id', '');
    setText('taper-setup-title', 'Create Taper Plan');
    setText('taper-generate-btn', 'Save Plan');
    ensureTaperSetupVisible();`,
    `function showNewTaperPlan() {
    if (typeof isSimpleExperienceMode === 'function' && isSimpleExperienceMode()
        && typeof openSimplePlanWizard === 'function'
        && !window.__smPlanWizardBypass) {
        openSimplePlanWizard();
        return false;
    }
    if (taperEditingPlan && taperFormDirty && !confirmDiscardTaperFormChanges()) return false;
    taperFormPlanId = null;
    taperEditingPlan = true;
    resetTaperFormLifecycleState();
    setInputValue('taper-editing-plan-id', '');
    setText('taper-setup-title', 'Create Taper Plan');
    setText('taper-generate-btn', 'Save Plan');
    ensureTaperSetupVisible();`,
    'showNewTaperPlan wizard gate');

// Test exports
app = tryReplace(app,
    `        resolveSimpleGoalStatus,
        SIMPLE_PLAN_INTENTS,`,
    `        resolveSimpleTaperStatus,
        getSimpleTaperDailyTarget,
        SIMPLE_TAPER_STATUS,
        SIMPLE_PLAN_INTENTS,`,
    'experience mode taper status exports');
app = tryReplace(app,
    `        resolveSimpleTaperStatus,
        SIMPLE_PLAN_INTENTS,`,
    `        resolveSimpleTaperStatus,
        getSimpleTaperDailyTarget,
        SIMPLE_TAPER_STATUS,
        SIMPLE_PLAN_INTENTS,`,
    'experience mode taper status exports (already renamed)');

app = tryReplace(app,
    `        rememberQuickLogFromForm,
        applyExperienceMode,`,
    `        rememberQuickLogFromForm,
        rememberQuickLogSettings,
        rememberQuickLogFromEntry,
        getQuickLogMemoryForSubstance,
        applyQuickLogMemoryToForm,
        openSimpleQuickLog,
        getSimpleQuickLogContext,
        resolveSimpleInventoryPrefill,
        repeatSimpleLastEntry,
        cloneSimpleRepeatLog,
        findSimpleQuickLogDuplicate,
        logsLookLikeSimpleDuplicate,
        buildSimpleRecentLogs,
        undoSimpleLoggedEntry,
        notifyUseLogSaved,
        notifySimpleQuickLogSaved,
        mergeSimpleModePrefs,
        SIMPLE_DUPLICATE_WINDOW_MS,
        formatSimpleRepeatLastLabel,
        applyExperienceMode,`,
    'simple quick log test exports');

app = tryReplace(app,
    `        cleanExportData,`,
    `        cleanExportData,
        mergeImportedData,`,
    'export mergeImportedData');

app = tryReplace(app,
    `    if (!confirmTaperBeforeLog(substanceId, amount, type === 'quick', editingUseId, transactionType, payload.date)) return;`,
    `    if (!confirmTaperBeforeLog(substanceId, amount, type === 'quick', editingUseId, transactionType, payload.date)) return;

    if (editingUseId == null
        && typeof confirmSimpleQuickLogDuplicate === 'function'
        && !confirmSimpleQuickLogDuplicate({ ...payload, timestamp: eventTimestamp }, appData)) {
        return;
    }`,
    'simple duplicate warning');

app = tryReplace(app,
    `            alert(getUseUpdateSuccessMessage(editResult.updated));`,
    `            if (typeof notifyUseLogSaved === 'function') notifyUseLogSaved(editResult.updated, { isUpdate: true });
            else alert(getUseUpdateSuccessMessage(editResult.updated));`,
    'vape edit notify');

app = tryReplace(app,
    `        alert(getUseUpdateSuccessMessage(updated));`,
    `        if (typeof notifyUseLogSaved === 'function') notifyUseLogSaved(updated, { isUpdate: true });
        else alert(getUseUpdateSuccessMessage(updated));`,
    'use update notify');

app = tryReplace(app,
    `        alert(getUseSaveSuccessMessage(log));`,
    `        if (typeof notifyUseLogSaved === 'function') notifyUseLogSaved(log);
        else alert(getUseSaveSuccessMessage(log));`,
    'use save notify xanax/lsd');

app = tryReplace(app,
    `    alert(getUseSaveSuccessMessage(log));`,
    `    if (typeof notifyUseLogSaved === 'function') notifyUseLogSaved(log);
    else alert(getUseSaveSuccessMessage(log));`,
    'use save notify default');

app = tryReplace(app,
    `    merged.settings = {
        ...merged.settings,
        ...imported.settings,
        substanceSettings: {
            ...(merged.settings?.substanceSettings || {}),
            ...(imported.settings?.substanceSettings || {})
        }
    };`,
    `    merged.settings = {
        ...merged.settings,
        ...imported.settings,
        substanceSettings: {
            ...(merged.settings?.substanceSettings || {}),
            ...(imported.settings?.substanceSettings || {})
        }
    };
    if (typeof mergeSimpleModePrefs === 'function'
        && (current.settings?.simpleModePrefs || imported.settings?.simpleModePrefs)) {
        merged.settings.simpleModePrefs = mergeSimpleModePrefs(
            current.settings?.simpleModePrefs,
            imported.settings?.simpleModePrefs
        );
    }`,
    'merge simpleModePrefs on import');

app = tryReplace(app,
    `        experienceMode: 'simple',
        simpleModePrefs: null
    },`,
    `        experienceMode: 'simple',
        simpleModePrefs: null,
        onboardingCompleted: false,
        onboarding: null
    },`,
    'default onboarding settings');

app = tryReplace(app,
    `    if (typeof mergeSimpleModePrefs === 'function'
        && (current.settings?.simpleModePrefs || imported.settings?.simpleModePrefs)) {
        merged.settings.simpleModePrefs = mergeSimpleModePrefs(
            current.settings?.simpleModePrefs,
            imported.settings?.simpleModePrefs
        );
    }`,
    `    if (typeof mergeSimpleModePrefs === 'function'
        && (current.settings?.simpleModePrefs || imported.settings?.simpleModePrefs)) {
        merged.settings.simpleModePrefs = mergeSimpleModePrefs(
            current.settings?.simpleModePrefs,
            imported.settings?.simpleModePrefs
        );
    }
    if (typeof reconcileOnboardingAfterImport === 'function') {
        reconcileOnboardingAfterImport(merged);
    }`,
    'reconcile onboarding after import');

app = tryReplace(app,
    `        formatSimpleRepeatLastLabel,
        applyExperienceMode,`,
    `        formatSimpleRepeatLastLabel,
        hasMeaningfulRecoveryData,
        shouldShowOnboarding,
        maybeStartOnboarding,
        startOnboarding,
        skipOnboarding,
        completeOnboarding,
        restartOnboarding,
        applyOnboardingTrackedSubstances,
        applyOnboardingReminderPreference,
        reconcileOnboardingAfterImport,
        getOnboardingState,
        getOnboardingDraft,
        ONBOARDING_INTENTS,
        ONBOARDING_STEP_IDS,
        migrateOnboardingV1,
        applyExperienceMode,`,
    'onboarding test exports');

// ——— HTML ———

// Simple home shell inside dashboard
html = tryReplace(html,
    `            <section id="dashboard-tab" class="tab active dashboard-page">
                <div class="safety-notice dash-safety">
                    <strong>Safety Note:</strong> If you feel unsafe, may overdose, or have severe withdrawal symptoms, call emergency services or a medical professional immediately.
                </div>

                <header class="dash-header">`,
    `            <section id="dashboard-tab" class="tab active dashboard-page">
                <div class="safety-notice dash-safety">
                    <strong>Safety Note:</strong> If you feel unsafe, may overdose, or have severe withdrawal symptoms, call emergency services or a medical professional immediately.
                </div>

                <div id="simple-home" class="simple-home" aria-live="polite"></div>

                <div id="advanced-home-wrap" class="advanced-home-wrap">
                <header class="dash-header">`,
    'simple home shell start');

html = tryReplace(html,
    `                <span class="hidden" id="quick-log-btn"></span>
                <span class="hidden" id="quick-undo-btn"></span>
            </section>
            </section>`,
    `                <span class="hidden" id="quick-log-btn"></span>
                <span class="hidden" id="quick-undo-btn"></span>
                </div><!-- /advanced-home-wrap -->
            </section>`,
    'simple home shell end + fix duplicate section');

// Recent amounts host in log form
html = tryReplace(html,
    `                        <div class="use-log-amount-grid" id="use-amount-mode-group">
                            <div class="form-group use-log-compact">
                                <label for="use-amount" id="use-amount-label">Amount</label>
                                <input type="number" id="use-amount" min="0" step="0.01" value="1" required>
                            </div>
                            <div class="form-group use-log-compact" id="use-unit-group">
                                <label for="use-unit">Unit</label>
                                <select id="use-unit" required></select>
                            </div>
                        </div>`,
    `                        <div class="use-log-amount-grid" id="use-amount-mode-group">
                            <div class="form-group use-log-compact">
                                <label for="use-amount" id="use-amount-label">Amount</label>
                                <input type="number" id="use-amount" min="0" step="0.01" value="1" required>
                            </div>
                            <div class="form-group use-log-compact" id="use-unit-group">
                                <label for="use-unit">Unit</label>
                                <select id="use-unit" required></select>
                            </div>
                        </div>
                        <div id="sm-recent-amounts" class="sm-recent-amounts hidden" aria-live="polite"></div>`,
    'recent amounts chips');

// Move entry type + transaction into more-options friendly wrappers
html = tryReplace(html,
    `                    <div class="use-log-entry-toggle use-entry-type-three" id="use-entry-type-group">`,
    `                    <div class="use-log-entry-toggle use-entry-type-three sm-log-more-field" id="use-entry-type-group">`,
    'mark entry type as more-field');

html = tryReplace(html,
    `                    <div class="use-log-field-block" id="use-transaction-type-block">`,
    `                    <div class="use-log-field-block sm-log-more-field" id="use-transaction-type-block">`,
    'mark tx type as more-field');

html = tryReplace(html,
    `                        <div class="form-group use-log-compact use-log-notes-group">
                            <label for="use-notes">Notes</label>
                            <textarea id="use-notes" rows="2" placeholder="Optional notes…"></textarea>
                        </div>`,
    `                        <div class="form-group use-log-compact use-log-notes-group sm-log-more-field">
                            <label for="use-notes">Notes</label>
                            <textarea id="use-notes" rows="2" placeholder="Optional notes…"></textarea>
                        </div>`,
    'notes more-options field');

html = tryReplace(html,
    `                        <div class="form-group use-log-compact" id="use-substance-group">
                            <label for="use-substance">Substance</label>
                            <select id="use-substance" required></select>
                        </div>`,
    `                        <div class="form-group use-log-compact" id="use-substance-group">
                            <label for="use-substance">Substance</label>
                            <select id="use-substance" required></select>
                            <div id="sm-locked-substance-chip" class="sm-locked-substance-chip hidden">
                                <span id="sm-locked-substance-name"></span>
                                <button type="button" class="sm-text-btn" onclick="unlockSimpleQuickLogSubstance()">Change</button>
                            </div>
                        </div>`,
    'locked substance chip');

if (!html.includes('id="sm-toast"')) {
    html = tryReplace(html,
        `    <script src="app.js" defer></script>`,
        `    <div id="sm-toast" class="sm-toast hidden" role="status" aria-live="polite"></div>
    <script src="app.js" defer></script>`,
        'simple toast host');
} else {
    console.warn('Already inserted: simple toast host');
}

html = tryReplace(html,
    `    <div id="sm-toast" class="sm-toast hidden" role="status" aria-live="polite"></div>`,
    `    <div id="onboarding-overlay" class="modal onboarding-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="modal-content onboarding-modal-content">
            <div id="onboarding-root"></div>
        </div>
    </div>
    <div id="sm-toast" class="sm-toast hidden" role="status" aria-live="polite"></div>`,
    'onboarding overlay');

html = tryReplace(html,
    `                    <details class="use-log-advanced" id="use-advanced-section">
                        <summary class="use-log-advanced-summary">Advanced options</summary>
                        <div class="use-log-advanced-body">
                            <div id="use-inventory-fields-group">`,
    `                    <details class="use-log-advanced" id="use-advanced-section">
                        <summary class="use-log-advanced-summary">More Options</summary>
                        <div class="use-log-advanced-body">
                            <div id="sm-more-options-slot" class="sm-more-options-slot"></div>
                            <div id="use-inventory-fields-group">`,
    'more options rename');

// Simple progress shell
html = tryReplace(html,
    `            <section id="insights-calendar-tab" class="tab combined-page insights-calendar-page">
                <div class="page-header-row combined-page-header">
                    <div>
                        <h2>Insights &amp; Calendar</h2>
                        <p class="settings-hint">Analytics and calendar share the same filters and date context where possible.</p>
                    </div>
                </div>

                <div class="combined-subnav-wrap">`,
    `            <section id="insights-calendar-tab" class="tab combined-page insights-calendar-page">
                <div id="simple-progress" class="simple-progress" aria-live="polite"></div>

                <div id="advanced-insights-wrap" class="advanced-insights-wrap">
                <div class="page-header-row combined-page-header">
                    <div>
                        <h2>Insights &amp; Calendar</h2>
                        <p class="settings-hint">Analytics and calendar share the same filters and date context where possible.</p>
                    </div>
                </div>

                <div class="combined-subnav-wrap">`,
    'simple progress shell start');

// Close advanced insights wrap just before the insights-calendar-tab section closes.
if (!html.includes('<!-- /advanced-insights-wrap -->')) {
    const buyComment = '            <!-- Buy Tracker Tab -->';
    const buyIdx = html.indexOf(buyComment);
    if (buyIdx > 0) {
        const before = html.slice(0, buyIdx);
        const closeIdx = before.lastIndexOf('</section>');
        if (closeIdx > 0) {
            html = html.slice(0, closeIdx)
                + '                </div><!-- /advanced-insights-wrap -->\n'
                + html.slice(closeIdx);
            console.log('Closed advanced-insights-wrap before Buy Tracker');
        } else {
            console.warn('Could not close advanced-insights-wrap');
        }
    }
}

// Plan wizard
html = tryReplace(html,
    `            <section id="goals-plans-tab" class="tab combined-page goals-plans-page">
                <div class="page-header-row combined-page-header">
                    <div class="page-title-block">
                        <h2>Tapers</h2>
                        <p class="settings-hint">Tapers define a gradual reduction path.</p>
                    </div>`,
    `            <section id="goals-plans-tab" class="tab combined-page goals-plans-page">
                <div id="simple-plan-wizard" class="simple-plan-wizard hidden" aria-live="polite"></div>
                <div class="sm-plan-simple-actions sm-only">
                    <button type="button" class="submit-btn" id="sm-new-plan-btn" onclick="openSimplePlanWizard()">New Plan</button>
                    <button type="button" class="secondary-btn" onclick="document.getElementById('goals-plans-tab')?.classList.add('sm-show-advanced-plan')">Advanced Plan Settings</button>
                </div>
                <div class="page-header-row combined-page-header">
                    <div class="page-title-block">
                        <h2>Tapers</h2>
                        <p class="settings-hint">Tapers define a gradual reduction path.</p>
                    </div>`,
    'plan wizard + simple actions');

// Mark some taper advanced blocks if present
html = tryReplace(html,
    `                <div id="taper-plan-toolbar" class="taper-plan-toolbar hidden">`,
    `                <div id="taper-plan-toolbar" class="taper-plan-toolbar hidden" data-sm-plan-advanced="true">`,
    'taper toolbar advanced mark');

// Experience mode in Appearance settings
html = tryReplace(html,
    `                <div class="settings-section">
                    <div class="form-group">
                        <label for="theme-preference">Theme</label>`,
    `                <div class="settings-section">
                    <div class="form-group experience-mode-group">
                        <label id="experience-mode-label" for="experience-mode">Experience Mode</label>
                        <div class="experience-mode-control" role="group" aria-labelledby="experience-mode-label">
                            <button type="button" class="experience-mode-btn active" data-experience-mode="simple" aria-pressed="true" onclick="onExperienceModeChange('simple')">Simple</button>
                            <button type="button" class="experience-mode-btn" data-experience-mode="advanced" aria-pressed="false" onclick="onExperienceModeChange('advanced')">Advanced</button>
                        </div>
                        <select id="experience-mode" class="experience-mode-select visually-hidden" aria-label="Experience Mode" onchange="onExperienceModeChange(this.value)">
                            <option value="simple">Simple</option>
                            <option value="advanced">Advanced</option>
                        </select>
                        <p class="settings-hint">Simple focuses on daily logging and progress. Advanced keeps the full Recovery Tracker toolkit (inventory, detailed insights, custom columns, data health).</p>
                    </div>
                    <div id="sm-advanced-more" class="sm-advanced-more">
                        <h3 class="settings-subhead">Advanced / More</h3>
                        <p class="settings-hint">These stay available anytime. Switch to Advanced Mode for the full navigation, or open them here.</p>
                        <div class="sm-advanced-more-actions">
                            <button type="button" class="secondary-btn" onclick="onExperienceModeChange('advanced'); switchTab('buy-tracker-tab')">Inventory</button>
                            <button type="button" class="secondary-btn" onclick="onExperienceModeChange('advanced'); switchTab('insights-calendar-tab')">Detailed Insights</button>
                            <button type="button" class="secondary-btn" onclick="switchTab('buy-tracker-tab')">Open Inventory (keep Simple)</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="theme-preference">Theme</label>`,
    'experience mode settings');

// Nav: add data attributes for simple labels (JS updates text)
html = tryReplace(html,
    `        <button class="nav-btn" data-tab="buy-tracker-tab" onclick="switchTab('buy-tracker-tab')">
            <span aria-hidden="true">📦</span>
            <span class="nav-btn-label-full">Inventory</span>
            <span class="nav-btn-label-short">Stock</span>
        </button>`,
    `        <button class="nav-btn" data-tab="buy-tracker-tab" data-sm-nav="inventory" onclick="switchTab('buy-tracker-tab')">
            <span aria-hidden="true">📦</span>
            <span class="nav-btn-label-full">Inventory</span>
            <span class="nav-btn-label-short">Stock</span>
        </button>`,
    'nav inventory marker');

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('Wrote app.js and index.html (CSS pass next)');
