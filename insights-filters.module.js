// ——— Shared Insights filter state (source of truth) ———
// Every Insights section must consume these filters. Display settings
// (columns, chart widgets, reset mode) stay separate.

const INSIGHTS_FILTERS_KEY = 'insightsFilters';

function getDefaultInsightsFilters() {
    return {
        substanceId: typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all',
        productType: '',
        dateRangePreset: 'last-7',
        customStart: '',
        customEnd: '',
        transactionType: ''
    };
}

function ensureInsightsFilters(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultInsightsFilters();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultInsightsFilters();
    if (!data.settings[INSIGHTS_FILTERS_KEY] || typeof data.settings[INSIGHTS_FILTERS_KEY] !== 'object') {
        // Seed from existing globals / dashboard substance when available
        const seeded = { ...defaults };
        try {
            const dash = data.settings.dashboardSubstanceId
                || data.settings.recoveryDashboard?.selectedDashboardSubstance;
            if (dash) seeded.substanceId = dash;
            if (typeof statsDateRangePreset === 'string' && statsDateRangePreset) {
                seeded.dateRangePreset = statsDateRangePreset;
            }
            if (typeof statsCustomStartDate === 'string') seeded.customStart = statsCustomStartDate;
            if (typeof statsCustomEndDate === 'string') seeded.customEnd = statsCustomEndDate;
        } catch (_) { /* optional */ }
        data.settings[INSIGHTS_FILTERS_KEY] = seeded;
    }
    const prefs = data.settings[INSIGHTS_FILTERS_KEY];
    Object.keys(defaults).forEach(key => {
        if (prefs[key] === undefined) prefs[key] = defaults[key];
    });
    if (!prefs.substanceId) prefs.substanceId = defaults.substanceId;
    if (!prefs.dateRangePreset) prefs.dateRangePreset = defaults.dateRangePreset;
    // Non-weed substances cannot keep a weed product-type filter
    if (prefs.productType && !insightsFiltersIsWeedSubstance(prefs.substanceId, data)) {
        prefs.productType = '';
    }
    return prefs;
}

function getInsightsFilters(data = appData) {
    return ensureInsightsFilters(data);
}

/** Named accessors matching product requirements */
function getSelectedInsightsSubstance(data = appData) {
    return getInsightsFilters(data).substanceId;
}
function getSelectedInsightsProductType(data = appData) {
    return getInsightsFilters(data).productType || '';
}
function getSelectedInsightsDateRange(data = appData) {
    const f = getInsightsFilters(data);
    return {
        preset: f.dateRangePreset,
        customStart: f.customStart || '',
        customEnd: f.customEnd || ''
    };
}
function getSelectedInsightsTransactionType(data = appData) {
    return getInsightsFilters(data).transactionType || '';
}

function insightsFiltersIsAll(substanceId) {
    const id = String(substanceId ?? '').trim();
    return !id || id === 'all' || (typeof DASHBOARD_ALL !== 'undefined' && id === DASHBOARD_ALL);
}

function insightsFiltersIsWeedSubstance(substanceId, data = appData) {
    if (insightsFiltersIsAll(substanceId)) return false;
    if (typeof isWeedTrackingMode === 'function') return !!isWeedTrackingMode(substanceId, data);
    const sub = (data?.substances || []).find(s => String(s.id) === String(substanceId));
    return String(sub?.trackingMode || '').toLowerCase() === 'weed';
}

function loadInsightsFiltersIntoState(data = appData) {
    const f = ensureInsightsFilters(data);
    // Keep in-memory Insights globals aligned with persisted shared filters.
    // These lets are declared later in app.js — assignment throws in TDZ and is ignored.
    try {
        currentSubstanceId = f.substanceId;
        selectedDashboardSubstance = f.substanceId;
        statsDateRangePreset = f.dateRangePreset || 'last-7';
        statsCustomStartDate = f.customStart || '';
        statsCustomEndDate = f.customEnd || '';
    } catch (_) { /* Temporal Dead Zone / early init */ }
    return f;
}

function syncInsightsFilterUi(data = appData) {
    const f = ensureInsightsFilters(data);
    const setVal = (id, value) => {
        const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
        if (el && value != null) el.value = value;
    };
    setVal('stats-substance', f.substanceId);
    setVal('stats-date-range', f.dateRangePreset);
    setVal('stats-custom-start', f.customStart || '');
    setVal('stats-custom-end', f.customEnd || '');
    setVal('stats-product-type', f.productType || '');
    setVal('stats-transaction-type', f.transactionType || '');
    const customWrap = typeof document !== 'undefined' ? document.getElementById('stats-custom-range-wrap') : null;
    if (customWrap) customWrap.classList.toggle('hidden', f.dateRangePreset !== 'custom');
    const productWrap = typeof document !== 'undefined' ? document.getElementById('stats-product-type-wrap') : null;
    if (productWrap) {
        const show = insightsFiltersIsWeedSubstance(f.substanceId, data);
        productWrap.classList.toggle('hidden', !show);
        if (!show) {
            const sel = document.getElementById('stats-product-type');
            if (sel) sel.value = '';
        }
    }
}

/**
 * Push shared Insights filters into section-specific prefs (without saveData loops).
 * Section-local display prefs (reset mode, chart interval, etc.) are preserved.
 */
function syncSectionFiltersFromInsights(data = appData) {
    const f = ensureInsightsFilters(data);
    const substanceId = f.substanceId || 'all';
    const datePatch = {
        substanceId,
        productType: f.productType || '',
        dateRangePreset: f.dateRangePreset || 'last-7',
        customStart: f.customStart || '',
        customEnd: f.customEnd || '',
        transactionType: f.transactionType || ''
    };

    // Materialize Insights date range into concrete custom bounds so every
    // section resolver (financial, charts, running totals) sees the same window.
    if (typeof getStatsDateRange === 'function') {
        try {
            const bounds = getStatsDateRange();
            if (bounds?.startDate && bounds?.endDate) {
                datePatch.customStart = bounds.startDate;
                datePatch.customEnd = bounds.endDate;
                datePatch.dateRangePreset = 'custom';
            }
        } catch (_) { /* optional */ }
    }

    if (typeof ensureRunningTotalsPrefs === 'function') {
        const rt = ensureRunningTotalsPrefs(data);
        rt.filters = { ...rt.filters, ...datePatch };
    }
    if (typeof ensureChartSystemPrefs === 'function') {
        const ch = ensureChartSystemPrefs(data);
        ch.filters = { ...ch.filters, ...datePatch };
    }
    if (typeof ensureFinancialAnalyticsPrefs === 'function') {
        const fin = ensureFinancialAnalyticsPrefs(data);
        fin.filters = { ...(fin.filters || {}), ...datePatch };
    }
    if (typeof ensurePurchaseAnalyticsPrefs === 'function') {
        const pa = ensurePurchaseAnalyticsPrefs(data);
        pa.filters = { ...(pa.filters || {}), ...datePatch };
    }
    return f;
}

function invalidateInsightsSectionCaches() {
    if (typeof invalidateInsightsDatasetCache === 'function') invalidateInsightsDatasetCache();
    if (typeof invalidateChartSystemCache === 'function') invalidateChartSystemCache();
    if (typeof invalidateFinancialAnalyticsCache === 'function') invalidateFinancialAnalyticsCache();
    if (typeof invalidatePurchaseAnalyticsCache === 'function') invalidatePurchaseAnalyticsCache();
}

/**
 * Persist shared Insights filters, sync globals + section prefs, optionally re-render.
 */
function persistInsightsFilters(patch = {}, options = {}) {
    const {
        data = appData,
        render = false,
        save = true,
        syncSections = true
    } = options;
    const prefs = ensureInsightsFilters(data);
    Object.assign(prefs, patch || {});

    if (prefs.productType && !insightsFiltersIsWeedSubstance(prefs.substanceId, data)) {
        prefs.productType = '';
    }

    // Keep in-memory globals in sync (core Insights dataset uses these)
    try {
        currentSubstanceId = prefs.substanceId;
        selectedDashboardSubstance = prefs.substanceId;
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'substanceId')) {
            selectedSubstanceId = prefs.substanceId;
        }
        statsDateRangePreset = prefs.dateRangePreset || 'last-7';
        statsCustomStartDate = prefs.customStart || '';
        statsCustomEndDate = prefs.customEnd || '';
    } catch (_) { /* ignore */ }

    if (typeof saveDashboardViewSubstanceId === 'function') {
        try { saveDashboardViewSubstanceId(prefs.substanceId); } catch (_) { /* ignore */ }
    }
    if (typeof persistRecoveryDashboardPrefs === 'function') {
        try {
            persistRecoveryDashboardPrefs({ selectedDashboardSubstance: prefs.substanceId }, data);
        } catch (_) { /* ignore */ }
    }

    if (syncSections) syncSectionFiltersFromInsights(data);
    invalidateInsightsSectionCaches();
    syncInsightsFilterUi(data);

    if (save && typeof saveData === 'function') saveData(data);
    if (render && typeof updateStats === 'function') updateStats();
    return prefs;
}

function setSelectedInsightsSubstance(substanceId, options = {}) {
    let next = substanceId || (typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all');
    if (!insightsFiltersIsAll(next) && typeof normalizeSubstanceRef === 'function') {
        next = normalizeSubstanceRef(next, options.data || appData) || next;
    }
    const patch = { substanceId: next };
    // Clear weed product type when leaving Weed
    if (!insightsFiltersIsWeedSubstance(next, options.data || appData)) {
        patch.productType = '';
    }
    return persistInsightsFilters(patch, { render: true, ...options });
}

function setSelectedInsightsProductType(productType, options = {}) {
    const data = options.data || appData;
    const f = ensureInsightsFilters(data);
    if (!insightsFiltersIsWeedSubstance(f.substanceId, data)) {
        return persistInsightsFilters({ productType: '' }, { render: true, ...options, data });
    }
    return persistInsightsFilters({ productType: productType || '' }, { render: true, ...options, data });
}

function setSelectedInsightsDateRange(preset, customStart = '', customEnd = '', options = {}) {
    return persistInsightsFilters({
        dateRangePreset: preset || 'last-7',
        customStart: customStart || '',
        customEnd: customEnd || ''
    }, { render: true, ...options });
}

function setSelectedInsightsTransactionType(transactionType, options = {}) {
    return persistInsightsFilters({ transactionType: transactionType || '' }, { render: true, ...options });
}

/** Clear visible section roots so stale substance data never flashes under a new label. */
function clearInsightsSectionOutputs() {
    if (typeof document === 'undefined') return;
    const ids = [
        'running-totals-root',
        'chart-dashboard-root',
        'financial-analytics-root',
        'purchase-analytics-root',
        'insights-contacts-root',
        'goal-insights-panel',
        'stats-weekly-summary',
        'stats-monthly-summary'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="settings-hint" role="status">Updating filters…</div>';
    });
}

/**
 * Render Insights module sections that must always follow shared filters,
 * including when All Substances is selected.
 */
function renderInsightsFilteredSections() {
    syncSectionFiltersFromInsights(appData);
    try {
        if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
    } catch (err) { console.error('Financial analytics render failed', err); }
    try {
        if (typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();
    } catch (err) { console.error('Purchase analytics render failed', err); }
    try {
        if (typeof renderChartDashboardView === 'function') renderChartDashboardView();
    } catch (err) { console.error('Chart dashboard render failed', err); }
    try {
        if (typeof renderInsightsContactAnalytics === 'function') renderInsightsContactAnalytics();
    } catch (err) { console.error('Contact insights render failed', err); }
    try {
        if (typeof renderRunningTotalsView === 'function') renderRunningTotalsView();
    } catch (err) { console.error('Running totals render failed', err); }
    try {
        if (typeof renderPlanAnalyticsPanel === 'function') renderPlanAnalyticsPanel();
    } catch (err) { console.error('Plan analytics render failed', err); }
}

function onInsightsProductTypeChange() {
    const value = typeof document !== 'undefined'
        ? (document.getElementById('stats-product-type')?.value || '')
        : '';
    setSelectedInsightsProductType(value);
}

function onInsightsTransactionTypeChange() {
    const value = typeof document !== 'undefined'
        ? (document.getElementById('stats-transaction-type')?.value || '')
        : '';
    setSelectedInsightsTransactionType(value);
}
