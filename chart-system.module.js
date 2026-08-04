// ——— Chart System ———
// Interactive SVG/CSS charts over normalized Log, Inventory, Goals, Plans, and Finance data.
// Local-only. Spliced into app.js ahead of `const defaultData`.
// Never mutates source records. Never combines incompatible units.

const CHART_DATE_PRESETS = Object.freeze([
    { id: 'today', label: 'Today' },
    { id: 'last-7', label: 'Last 7 days' },
    { id: 'last-30', label: 'Last 30 days' },
    { id: 'this-week', label: 'This week' },
    { id: 'this-month', label: 'This month' },
    { id: 'past-3-months', label: 'Past 3 months' },
    { id: 'past-6-months', label: 'Past 6 months' },
    { id: 'past-12-months', label: 'Past 12 months' },
    { id: 'this-year', label: 'This year' },
    { id: 'all-time', label: 'All time' },
    { id: 'custom', label: 'Custom range' }
]);

const CHART_INTERVALS = Object.freeze([
    'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rolling-7', 'rolling-30'
]);

const CHART_TYPES = Object.freeze([
    'line', 'bar', 'stacked-bar', 'area', 'donut', 'heatmap', 'calendar-heatmap',
    'scatter', 'histogram', 'progress', 'cumulative', 'flow'
]);

const CHART_UNIT_FAMILIES = Object.freeze({
    mass_g: ['g', 'gram', 'grams'],
    count: ['count', 'edible', 'edibles', 'pill', 'pills', 'tab', 'tabs', 'pre-roll', 'joint'],
    percent: ['%', 'percent', 'pct'],
    puffs: ['puff', 'puffs'],
    thc_mg: ['thc_mg', 'mg_thc', 'thc mg'],
    cbd_mg: ['cbd_mg', 'mg_cbd'],
    money: ['$', 'usd', 'money', 'cost'],
    days: ['day', 'days'],
    score: ['score']
});

const CHART_METRICS = Object.freeze([
    // Use
    { id: 'use_amount', label: 'Use amount', category: 'use', defaultType: 'line', unitFamily: 'auto' },
    { id: 'use_days', label: 'Use-day count', category: 'use', defaultType: 'bar', unitFamily: 'count' },
    { id: 'session_count', label: 'Session count', category: 'use', defaultType: 'bar', unitFamily: 'count' },
    { id: 'avg_use_per_day', label: 'Average use per day', category: 'use', defaultType: 'line', unitFamily: 'auto' },
    { id: 'avg_amount_per_use_day', label: 'Average amount per use day', category: 'use', defaultType: 'line', unitFamily: 'auto' },
    { id: 'use_by_product', label: 'Use by product type', category: 'use', defaultType: 'bar', unitFamily: 'auto' },
    { id: 'use_by_weekday', label: 'Use by weekday', category: 'use', defaultType: 'bar', unitFamily: 'auto' },
    { id: 'use_heatmap', label: 'Use weekday/hour heatmap', category: 'use', defaultType: 'heatmap', unitFamily: 'count' },
    { id: 'rolling_7_use', label: 'Rolling 7-day use', category: 'use', defaultType: 'area', unitFamily: 'auto' },
    { id: 'rolling_30_use', label: 'Rolling 30-day use', category: 'use', defaultType: 'area', unitFamily: 'auto' },
    // Spending
    { id: 'spend_amount', label: 'Spending', category: 'spending', defaultType: 'line', unitFamily: 'money' },
    { id: 'rolling_30_spend', label: 'Rolling 30-day spending', category: 'spending', defaultType: 'area', unitFamily: 'money' },
    { id: 'running_monthly_spend', label: 'Running monthly spending', category: 'spending', defaultType: 'cumulative', unitFamily: 'money' },
    { id: 'spend_by_substance', label: 'Spending by substance', category: 'spending', defaultType: 'bar', unitFamily: 'money' },
    { id: 'spend_by_product', label: 'Spending by product type', category: 'spending', defaultType: 'bar', unitFamily: 'money' },
    { id: 'spend_by_store', label: 'Spending by store', category: 'spending', defaultType: 'bar', unitFamily: 'money' },
    { id: 'spend_by_supplier', label: 'Spending by supplier', category: 'spending', defaultType: 'bar', unitFamily: 'money' },
    { id: 'spend_by_payment', label: 'Spending by payment method', category: 'spending', defaultType: 'donut', unitFamily: 'money' },
    { id: 'spend_heatmap', label: 'Spending weekday/hour heatmap', category: 'spending', defaultType: 'heatmap', unitFamily: 'money' },
    // Purchases
    { id: 'purchase_count', label: 'Purchase count', category: 'purchases', defaultType: 'bar', unitFamily: 'count' },
    { id: 'purchase_amount', label: 'Purchase amount', category: 'purchases', defaultType: 'line', unitFamily: 'auto' },
    { id: 'avg_purchase_size', label: 'Average purchase size', category: 'purchases', defaultType: 'line', unitFamily: 'auto' },
    { id: 'avg_purchase_cost', label: 'Average purchase cost', category: 'purchases', defaultType: 'line', unitFamily: 'money' },
    { id: 'avg_cost_per_unit', label: 'Average cost per unit', category: 'purchases', defaultType: 'line', unitFamily: 'money' },
    { id: 'days_between_purchases', label: 'Days between purchases', category: 'purchases', defaultType: 'scatter', unitFamily: 'days' },
    { id: 'purchase_heatmap', label: 'Purchase weekday/hour heatmap', category: 'purchases', defaultType: 'heatmap', unitFamily: 'count' },
    { id: 'cost_histogram', label: 'Purchase cost distribution', category: 'purchases', defaultType: 'histogram', unitFamily: 'money' },
    // Inventory
    { id: 'inventory_remaining', label: 'Remaining inventory', category: 'inventory', defaultType: 'area', unitFamily: 'auto' },
    { id: 'inventory_flow', label: 'Purchased → used → gifted → adjusted → remaining', category: 'inventory', defaultType: 'flow', unitFamily: 'auto' },
    { id: 'days_of_supply', label: 'Days of supply remaining', category: 'inventory', defaultType: 'progress', unitFamily: 'days' },
    { id: 'inventory_value', label: 'Active inventory value', category: 'inventory', defaultType: 'bar', unitFamily: 'money' },
    // Goals / plans
    { id: 'goal_vs_actual', label: 'Actual vs goal target', category: 'goals', defaultType: 'line', unitFamily: 'auto' },
    { id: 'plan_vs_actual', label: 'Actual vs taper target', category: 'goals', defaultType: 'line', unitFamily: 'auto' },
    { id: 'goal_adherence', label: 'Goal adherence over time', category: 'goals', defaultType: 'bar', unitFamily: 'percent' },
    { id: 'plan_adherence', label: 'Plan adherence over time', category: 'goals', defaultType: 'bar', unitFamily: 'percent' },
    { id: 'weekly_target_progress', label: 'Weekly target progress', category: 'goals', defaultType: 'progress', unitFamily: 'percent' },
    { id: 'spend_target_progress', label: 'Spending target progress', category: 'goals', defaultType: 'progress', unitFamily: 'percent' },
    // Recovery
    { id: 'no_use_streak', label: 'No-use streak', category: 'recovery', defaultType: 'line', unitFamily: 'days' },
    { id: 'no_purchase_streak', label: 'No-purchase streak', category: 'recovery', defaultType: 'line', unitFamily: 'days' },
    { id: 'recovery_score', label: 'Recovery score history', category: 'recovery', defaultType: 'area', unitFamily: 'score' },
    { id: 'milestone_timeline', label: 'Achievement timeline', category: 'recovery', defaultType: 'scatter', unitFamily: 'count' }
]);

const CHART_PRESETS = Object.freeze({
    recovery_overview: {
        name: 'Recovery Overview',
        widgets: ['no_use_streak', 'recovery_score', 'use_amount', 'spend_amount', 'goal_adherence']
    },
    use_trends: {
        name: 'Use Trends',
        widgets: ['use_amount', 'rolling_7_use', 'rolling_30_use', 'use_by_weekday', 'use_heatmap']
    },
    spending: {
        name: 'Spending',
        widgets: ['spend_amount', 'rolling_30_spend', 'running_monthly_spend', 'spend_by_store', 'spend_by_supplier', 'spend_heatmap']
    },
    purchase_behavior: {
        name: 'Purchase Behavior',
        widgets: ['purchase_count', 'avg_purchase_cost', 'avg_cost_per_unit', 'days_between_purchases', 'purchase_heatmap', 'cost_histogram']
    },
    inventory: {
        name: 'Inventory',
        widgets: ['inventory_remaining', 'inventory_flow', 'days_of_supply', 'inventory_value']
    },
    goals_plans: {
        name: 'Goals & Plans',
        widgets: ['goal_vs_actual', 'plan_vs_actual', 'goal_adherence', 'plan_adherence', 'weekly_target_progress', 'spend_target_progress']
    },
    weed: {
        name: 'Weed',
        widgets: ['use_amount', 'use_by_product', 'inventory_remaining', 'avg_cost_per_unit', 'spend_amount']
    },
    nicotine: {
        name: 'Nicotine',
        widgets: ['use_amount', 'inventory_remaining', 'purchase_count', 'spend_amount', 'days_of_supply']
    }
});

let chartSystemCache = null;
let chartSystemCacheKey = '';
let chartSystemUi = {
    fullscreenId: '',
    selectedPoint: null,
    builderOpen: false,
    tableAltId: ''
};

function chToNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function chRound(value, decimals = 2) {
    const n = chToNumber(value, NaN);
    if (!Number.isFinite(n)) return null;
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
}

function chTrim(value) {
    return String(value ?? '').trim();
}

function chToday() {
    return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().slice(0, 10);
}

function chAllId() {
    return typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all';
}

function chIsAll(substanceId) {
    const id = chTrim(substanceId);
    return !id || id === chAllId() || id === 'all';
}

function invalidateChartSystemCache() {
    chartSystemCache = null;
    chartSystemCacheKey = '';
}

function getDefaultChartFilters() {
    return {
        substanceId: chAllId(),
        productType: '',
        dateRangePreset: 'last-30',
        customStart: '',
        customEnd: '',
        transactionType: '',
        interval: 'daily',
        groupBy: 'none',
        comparePeriod: 'previous-period',
        includeGifts: false,
        personalUseOnly: true
    };
}

function getDefaultChartSettings() {
    return {
        showLegend: true,
        showGrid: true,
        showDataLabels: false,
        smoothLines: true,
        yAxisZero: true,
        compactMode: false,
        detailedMode: true,
        decimalPrecision: 2,
        showUnits: true,
        tooltipDetail: 'full',
        animation: true
    };
}

function defaultChartWidgets() {
    return CHART_PRESETS.recovery_overview.widgets.map((metricId, index) => ({
        id: `chart-w-${index + 1}-${metricId}`,
        metricId,
        title: CHART_METRICS.find(m => m.id === metricId)?.label || metricId,
        chartType: CHART_METRICS.find(m => m.id === metricId)?.defaultType || 'line',
        visible: true,
        pinnedToDashboard: false,
        width: 'full',
        order: index,
        overrides: {},
        settings: getDefaultChartSettings()
    }));
}

function getDefaultChartSystemPrefs() {
    return {
        filters: getDefaultChartFilters(),
        widgets: defaultChartWidgets(),
        activePreset: 'recovery_overview',
        presets: {},
        filtersCollapsed: false,
        builderCollapsed: true,
        maxPoints: 120
    };
}

function ensureChartSystemPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultChartSystemPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultChartSystemPrefs();
    if (!data.settings.chartSystem || typeof data.settings.chartSystem !== 'object') {
        data.settings.chartSystem = {
            ...defaults,
            filters: { ...defaults.filters },
            widgets: defaults.widgets.map(w => ({ ...w, settings: { ...w.settings }, overrides: { ...w.overrides } })),
            presets: {}
        };
    }
    const prefs = data.settings.chartSystem;
    if (!prefs.filters || typeof prefs.filters !== 'object') prefs.filters = { ...defaults.filters };
    Object.keys(defaults.filters).forEach(key => {
        if (prefs.filters[key] === undefined) prefs.filters[key] = defaults.filters[key];
    });
    if (!Array.isArray(prefs.widgets) || !prefs.widgets.length) prefs.widgets = defaultChartWidgets();
    prefs.widgets = prefs.widgets
        .filter(w => w && w.metricId !== 'personal_vs_shared' && getChartMetricMeta(w.metricId || 'use_amount'))
        .map((w, i) => ({
            ...w,
            id: w.id || `chart-w-${i}-${w.metricId || 'use_amount'}`,
            settings: { ...getDefaultChartSettings(), ...(w.settings || {}) },
            overrides: { ...(w.overrides || {}) },
            order: w.order == null ? i : w.order
        })).sort((a, b) => a.order - b.order);
    if (!prefs.widgets.length) prefs.widgets = defaultChartWidgets();
    if ('includeSharedUse' in prefs.filters) delete prefs.filters.includeSharedUse;
    if (!prefs.presets || typeof prefs.presets !== 'object') prefs.presets = {};
    prefs.maxPoints = Math.max(30, Math.round(chToNumber(prefs.maxPoints, 120)));
    return prefs;
}

function getChartSystemPrefs(data = appData) {
    return ensureChartSystemPrefs(data);
}

function persistChartSystemPrefs(patch = {}, data = appData) {
    const prefs = ensureChartSystemPrefs(data);
    const { filters, widgets, presets, ...rest } = patch || {};
    Object.assign(prefs, rest);
    if (filters) prefs.filters = { ...prefs.filters, ...filters };
    if (widgets) prefs.widgets = widgets;
    if (presets) prefs.presets = { ...prefs.presets, ...presets };
    ensureChartSystemPrefs(data);
    invalidateChartSystemCache();
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function getChartMetricMeta(metricId) {
    return CHART_METRICS.find(m => m.id === metricId) || null;
}

function chartUnitFamilyForSubstance(substanceId, data = appData) {
    const sub = typeof getSubstance === 'function' ? getSubstance(substanceId, data) : null;
    const mode = sub?.trackingMode || '';
    if (mode === 'nicotine') return 'puffs';
    if (mode === 'weed') return 'mass_g';
    if (mode === 'xanax') return 'count';
    if (mode === 'lsd') return 'count';
    if (mode === 'powder' || mode === 'alcohol') return 'mass_g';
    return 'auto';
}

function chartIncompatibleMix(seriesList) {
    const families = new Set();
    (seriesList || []).forEach(s => {
        if (s?.unitFamily && s.unitFamily !== 'auto' && s.unitFamily !== 'money' && s.unitFamily !== 'count' && s.unitFamily !== 'days' && s.unitFamily !== 'percent' && s.unitFamily !== 'score') {
            families.add(s.unitFamily);
        }
        if (s?.unitFamily === 'puffs' || s?.unitFamily === 'mass_g' || s?.unitFamily === 'thc_mg' || s?.unitFamily === 'percent') {
            families.add(s.unitFamily);
        }
    });
    return families.size > 1;
}

function resolveChartBounds(filters = null, data = appData) {
    const f = { ...getDefaultChartFilters(), ...(filters || {}) };
    // Explicit custom window on the filter object always wins (tests + synced Insights bounds)
    if (f.customStart && f.customEnd) {
        return {
            startDate: f.customStart,
            endDate: f.customEnd,
            label: f.dateRangePreset || 'custom',
            incomplete: false
        };
    }
    if (typeof resolveFinancialBounds === 'function') {
        const bounds = resolveFinancialBounds({
            dateRangePreset: f.dateRangePreset,
            customStart: f.customStart,
            customEnd: f.customEnd
        }, data);
        if (bounds && (bounds.startDate || bounds.endDate)) return bounds;
    }
    // Fall back to Insights toolbar engine when filter preset has no custom dates yet
    if (typeof getStatsDateRange === 'function') {
        try {
            const range = getStatsDateRange();
            if (range && (range.startDate || range.endDate)) {
                return {
                    startDate: range.startDate || '',
                    endDate: range.endDate || chToday(),
                    label: range.label || f.dateRangePreset,
                    incomplete: !!range.incomplete
                };
            }
        } catch (_) { /* fall through */ }
    }
    const today = chToday();
    return { startDate: f.customStart || today, endDate: f.customEnd || today, label: f.dateRangePreset, incomplete: false };
}

function chartDaysBetween(a, b) {
    const da = typeof parseLocalDate === 'function' ? parseLocalDate(a) : null;
    const db = typeof parseLocalDate === 'function' ? parseLocalDate(b) : null;
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function chartEnumerateDates(startDate, endDate) {
    const out = [];
    const start = typeof parseLocalDate === 'function' ? parseLocalDate(startDate) : null;
    const end = typeof parseLocalDate === 'function' ? parseLocalDate(endDate) : null;
    if (!start || !end) return out;
    const cur = new Date(start.getTime());
    while (cur <= end) {
        out.push(typeof formatYYYYMMDD === 'function' ? formatYYYYMMDD(cur) : cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

function chartBucketKey(dateStr, interval) {
    if (!dateStr) return '';
    if (interval === 'yearly') return dateStr.slice(0, 4);
    if (interval === 'monthly' || interval === 'rolling-30') return dateStr.slice(0, 7);
    if (interval === 'quarterly') {
        const m = chToNumber(dateStr.slice(5, 7), 1);
        const q = Math.floor((m - 1) / 3) + 1;
        return `${dateStr.slice(0, 4)}-Q${q}`;
    }
    if (interval === 'weekly' || interval === 'rolling-7') {
        if (typeof getIsoWeekKey === 'function') return getIsoWeekKey(dateStr);
        return dateStr.slice(0, 7);
    }
    return dateStr;
}

function chartLogAmount(log, filters) {
    if (!log) return 0;
    const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : (log.transactionType || 'use');
    if (filters.personalUseOnly !== false) {
        if (typeof logCountsTowardPersonalUseStats === 'function' && !logCountsTowardPersonalUseStats(log)) return 0;
        if (typeof getLogStatsAmount === 'function') return chToNumber(getLogStatsAmount(log), 0);
        return chToNumber(log.amount, 0);
    }
    if (!filters.includeGifts && (type === 'gift_given' || type === 'gift_received')) return 0;
    if (type === 'inventory_adjustment' || type === 'shared_use') return 0;
    return chToNumber(log.amount ?? log.quantity, 0);
}

function chartPurchaseSpend(purchase) {
    if (typeof getPurchaseSpendAmount === 'function') return chToNumber(getPurchaseSpendAmount(purchase), 0);
    if (typeof purchaseCountsTowardSpend === 'function' && !purchaseCountsTowardSpend(purchase)) return 0;
    const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(purchase) : purchase.acquisitionType;
    if (acq === 'gift_received' || acq === 'other_adjustment') return 0;
    return chToNumber(purchase.totalCost ?? purchase.cost, 0);
}

function chartMatchesSubstance(recordSubstanceId, selectedId, data) {
    if (chIsAll(selectedId)) return true;
    if (typeof financialMatchesSubstance === 'function') return financialMatchesSubstance(recordSubstanceId, selectedId, data);
    return String(recordSubstanceId) === String(selectedId);
}

function chartProductType(record) {
    if (typeof normalizeWeedProductType === 'function') {
        const pt = normalizeWeedProductType(record?.weedProductType || record?.productType || '', { allowEmpty: true });
        if (pt) return pt;
    }
    return chTrim(record?.weedProductType || record?.productType || record?.flavor || '');
}

function getChartSourceLogs(filters, data = appData) {
    const bounds = resolveChartBounds(filters, data);
    const logs = (data.logs || []).filter(log => {
        if (!log || !log.date) return false;
        if (bounds.startDate && log.date < bounds.startDate) return false;
        if (bounds.endDate && log.date > bounds.endDate) return false;
        if (!chartMatchesSubstance(log.substanceId, filters.substanceId, data)) return false;
        if (filters.productType && chartProductType(log) !== filters.productType) return false;
        if (filters.transactionType) {
            const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType;
            if (type !== filters.transactionType) return false;
        }
        return true;
    });
    return { logs, bounds };
}

function getChartSourcePurchases(filters, data = appData) {
    const bounds = resolveChartBounds(filters, data);
    const purchases = (data.purchases || []).filter(p => {
        if (!p || !p.date) return false;
        if (bounds.startDate && p.date < bounds.startDate) return false;
        if (bounds.endDate && p.date > bounds.endDate) return false;
        if (!chartMatchesSubstance(p.substanceId, filters.substanceId, data)) return false;
        if (filters.productType && chartProductType(p) !== filters.productType) return false;
        return true;
    });
    return { purchases, bounds };
}

function aggregateTimeSeries(points, interval, maxPoints) {
    const map = new Map();
    points.forEach(pt => {
        const key = chartBucketKey(pt.date, interval);
        if (!key) return;
        if (!map.has(key)) map.set(key, { key, date: pt.date, value: 0, count: 0, seriesId: pt.seriesId, meta: pt.meta || {} });
        const row = map.get(key);
        row.value += chToNumber(pt.value, 0);
        row.count += chToNumber(pt.count, 1);
        if (pt.date > row.date) row.date = pt.date;
    });
    let rows = [...map.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
    if (interval === 'rolling-7' || interval === 'rolling-30') {
        const window = interval === 'rolling-7' ? 7 : 30;
        const daily = aggregateTimeSeries(points, 'daily', 10000);
        rows = daily.map((row, idx, arr) => {
            const from = Math.max(0, idx - window + 1);
            const slice = arr.slice(from, idx + 1);
            return {
                key: row.key,
                date: row.date,
                value: slice.reduce((s, r) => s + r.value, 0),
                count: slice.reduce((s, r) => s + r.count, 0),
                seriesId: row.seriesId,
                meta: { rolling: window }
            };
        });
    }
    if (rows.length > maxPoints) {
        const step = Math.ceil(rows.length / maxPoints);
        rows = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
    }
    return rows;
}

function buildUseSeries(filters, data = appData) {
    const { logs, bounds } = getChartSourceLogs(filters, data);
    const bySubstance = new Map();
    logs.forEach(log => {
        const amount = chartLogAmount(log, filters);
        if (!(amount > 0) && amount !== 0) return;
        const sid = log.substanceId || 'unknown';
        if (!bySubstance.has(sid)) bySubstance.set(sid, []);
        bySubstance.get(sid).push({
            date: log.date,
            value: amount,
            count: 1,
            seriesId: sid,
            meta: { logId: log.id, productType: chartProductType(log) }
        });
    });
    const series = [];
    bySubstance.forEach((points, sid) => {
        const family = chartUnitFamilyForSubstance(sid, data);
        const unit = typeof getSubstancePrimaryUnit === 'function' ? getSubstancePrimaryUnit(sid, data) : '';
        series.push({
            id: sid,
            label: typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(sid, data) : sid,
            unitFamily: family,
            unit,
            points: aggregateTimeSeries(points, filters.interval, ensureChartSystemPrefs(data).maxPoints),
            records: points.map(p => p.meta?.logId).filter(Boolean)
        });
    });
    return { series, bounds, recordKind: 'log' };
}

function buildSpendSeries(filters, data = appData) {
    const { purchases, bounds } = getChartSourcePurchases(filters, data);
    const points = [];
    purchases.forEach(p => {
        const spend = chartPurchaseSpend(p);
        if (!(spend > 0)) return;
        points.push({
            date: p.date,
            value: spend,
            count: 1,
            seriesId: chIsAll(filters.substanceId) ? (p.substanceId || 'spend') : 'spend',
            meta: { purchaseId: p.id }
        });
    });
    if (chIsAll(filters.substanceId)) {
        const bySub = new Map();
        points.forEach(pt => {
            if (!bySub.has(pt.seriesId)) bySub.set(pt.seriesId, []);
            bySub.get(pt.seriesId).push(pt);
        });
        const series = [...bySub.entries()].map(([sid, pts]) => ({
            id: sid,
            label: typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(sid, data) : sid,
            unitFamily: 'money',
            unit: typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$',
            points: aggregateTimeSeries(pts, filters.interval, ensureChartSystemPrefs(data).maxPoints)
        }));
        return { series, bounds, recordKind: 'purchase' };
    }
    return {
        series: [{
            id: 'spend',
            label: 'Spending',
            unitFamily: 'money',
            unit: typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$',
            points: aggregateTimeSeries(points, filters.interval, ensureChartSystemPrefs(data).maxPoints)
        }],
        bounds,
        recordKind: 'purchase'
    };
}

function buildCategoryBreakdown(items, valueFn, labelFn) {
    const map = new Map();
    items.forEach(item => {
        const label = labelFn(item) || 'Unknown';
        const value = chToNumber(valueFn(item), 0);
        if (!map.has(label)) map.set(label, { label, value: 0, count: 0 });
        const row = map.get(label);
        row.value += value;
        row.count += 1;
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
}

function buildHeatmapMatrix(records, valueFn, mode = 'count') {
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
    records.forEach(rec => {
        const d = typeof parseLocalDate === 'function' ? parseLocalDate(rec.date) : null;
        if (!d) return;
        const hour = chToNumber(String(rec.time || '12:00').split(':')[0], 12);
        const h = Math.min(23, Math.max(0, hour));
        const day = d.getDay();
        const val = chToNumber(valueFn(rec), 0);
        if (mode === 'count') matrix[day][h] += 1;
        else matrix[day][h] += val;
        counts[day][h] += 1;
    });
    if (mode === 'average') {
        for (let d = 0; d < 7; d += 1) {
            for (let h = 0; h < 24; h += 1) {
                if (counts[d][h] > 0) matrix[d][h] = matrix[d][h] / counts[d][h];
            }
        }
    }
    return { matrix, counts, days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
}

function buildInventoryFlow(filters, data = appData) {
    const { purchases, bounds } = getChartSourcePurchases({ ...filters, dateRangePreset: filters.dateRangePreset }, data);
    const { logs } = getChartSourceLogs(filters, data);
    const byKey = new Map();
    const keyFor = (sid, pt) => `${sid}::${pt || 'default'}`;

    purchases.forEach(p => {
        const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
        const qty = typeof getPurchaseQuantityBought === 'function' ? chToNumber(getPurchaseQuantityBought(p), 0) : chToNumber(p.quantityBought, 0);
        const rem = typeof getPurchaseRemainingAmount === 'function' ? chToNumber(getPurchaseRemainingAmount(p), 0) : chToNumber(p.remainingAmount, 0);
        const k = keyFor(p.substanceId, chartProductType(p));
        if (!byKey.has(k)) {
            byKey.set(k, {
                substanceId: p.substanceId,
                productType: chartProductType(p),
                purchased: 0,
                purchasedAsGift: 0,
                giftReceived: 0,
                used: 0,
                shared: 0,
                gifted: 0,
                adjusted: 0,
                remaining: 0,
                needsReview: 0
            });
        }
        const row = byKey.get(k);
        if (acq === 'purchased') row.purchased += qty;
        else if (acq === 'purchased_as_gift') row.purchasedAsGift += qty;
        else if (acq === 'gift_received') row.giftReceived += qty;
        else row.needsReview += qty;
        if (acq !== 'purchased_as_gift') row.remaining += Math.max(0, rem);
    });

    logs.forEach(log => {
        const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType;
        const amount = Math.abs(chToNumber(log.amount ?? log.quantity, 0));
        const k = keyFor(log.substanceId, chartProductType(log));
        if (!byKey.has(k)) {
            byKey.set(k, {
                substanceId: log.substanceId,
                productType: chartProductType(log),
                purchased: 0, purchasedAsGift: 0, giftReceived: 0,
                used: 0, shared: 0, gifted: 0, adjusted: 0, remaining: 0, needsReview: 0
            });
        }
        const row = byKey.get(k);
        if (type === 'use') row.used += typeof getLogStatsAmount === 'function' ? Math.abs(chToNumber(getLogStatsAmount(log), amount)) : amount;
        else if (type === 'shared_use' || type === 'session') row.shared += amount;
        else if (type === 'gift_given') row.gifted += amount;
        else if (type === 'inventory_adjustment') row.adjusted += amount;
    });

    return {
        bounds,
        flows: [...byKey.values()].map(row => ({
            ...row,
            label: `${typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(row.substanceId, data) : row.substanceId}${row.productType ? ` · ${row.productType}` : ''}`,
            unitFamily: chartUnitFamilyForSubstance(row.substanceId, data)
        }))
    };
}

function buildComparisonSeries(baseSeries, filters, data = appData) {
    if (!baseSeries?.series?.length) return null;
    const bounds = baseSeries.bounds || resolveChartBounds(filters, data);
    if (!bounds?.startDate || !bounds?.endDate) return null;
    const days = chartDaysBetween(bounds.startDate, bounds.endDate);
    if (days == null) return null;
    const prevEndDate = (() => {
        const d = typeof parseLocalDate === 'function' ? parseLocalDate(bounds.startDate) : null;
        if (!d) return '';
        d.setDate(d.getDate() - 1);
        return typeof formatYYYYMMDD === 'function' ? formatYYYYMMDD(d) : d.toISOString().slice(0, 10);
    })();
    const prevStartDate = (() => {
        const d = typeof parseLocalDate === 'function' ? parseLocalDate(prevEndDate) : null;
        if (!d) return '';
        d.setDate(d.getDate() - days);
        return typeof formatYYYYMMDD === 'function' ? formatYYYYMMDD(d) : d.toISOString().slice(0, 10);
    })();
    const prevFilters = {
        ...filters,
        dateRangePreset: 'custom',
        customStart: prevStartDate,
        customEnd: prevEndDate
    };
    return { previousFilters: prevFilters, previousBounds: { startDate: prevStartDate, endDate: prevEndDate, incomplete: false, label: 'Previous period' } };
}

function buildChartDatasetForMetric(metricId, filters, data = appData, options = {}) {
    const meta = getChartMetricMeta(metricId);
    if (!meta) return { state: 'error', message: 'Unknown metric' };
    const f = { ...getDefaultChartFilters(), ...filters };
    const prefs = ensureChartSystemPrefs(data);

    if (meta.category === 'use' || metricId.startsWith('rolling_') && metricId.includes('use') || metricId === 'use_heatmap') {
        if (metricId === 'use_heatmap') {
            const { logs, bounds } = getChartSourceLogs(f, data);
            const usable = logs.filter(log => chartLogAmount(log, f) !== 0 || (typeof logCountsTowardPersonalUseStats === 'function' && logCountsTowardPersonalUseStats(log)));
            return {
                state: usable.length ? 'ok' : 'empty',
                metricId,
                chartType: 'heatmap',
                bounds,
                heatmap: buildHeatmapMatrix(usable, log => chartLogAmount(log, f), options.heatmapMode || 'count'),
                series: []
            };
        }
        if (metricId === 'use_by_weekday') {
            const { logs, bounds } = getChartSourceLogs(f, data);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const vals = Array(7).fill(0);
            logs.forEach(log => {
                const d = typeof parseLocalDate === 'function' ? parseLocalDate(log.date) : null;
                if (!d) return;
                vals[d.getDay()] += chartLogAmount(log, f);
            });
            return {
                state: vals.some(v => v > 0) ? 'ok' : 'empty',
                metricId,
                chartType: 'bar',
                bounds,
                series: [{
                    id: 'weekday',
                    label: 'Use by weekday',
                    unitFamily: chIsAll(f.substanceId) ? 'mixed' : chartUnitFamilyForSubstance(f.substanceId, data),
                    points: days.map((label, i) => ({ key: label, date: label, value: vals[i], count: 1 }))
                }],
                warning: chIsAll(f.substanceId) ? 'All Substances: amounts are not combined across unit families; prefer grouped substance charts.' : ''
            };
        }
        if (metricId === 'use_by_product') {
            const { logs, bounds } = getChartSourceLogs(f, data);
            const rows = buildCategoryBreakdown(logs, log => chartLogAmount(log, f), log => chartProductType(log) || 'unspecified');
            return {
                state: rows.length ? 'ok' : 'empty',
                metricId,
                chartType: 'bar',
                bounds,
                series: [{
                    id: 'product',
                    label: 'Use by product',
                    unitFamily: 'auto',
                    points: rows.map(r => ({ key: r.label, date: r.label, value: r.value, count: r.count }))
                }]
            };
        }
        if (metricId === 'use_days' || metricId === 'session_count') {
            const { logs, bounds } = getChartSourceLogs(f, data);
            const points = logs.map(log => {
                const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType;
                if (metricId === 'session_count' && type !== 'session') return null;
                if (metricId === 'use_days' && chartLogAmount(log, f) <= 0) return null;
                return { date: log.date, value: 1, count: 1 };
            }).filter(Boolean);
            // unique days for use_days
            let seriesPoints = points;
            if (metricId === 'use_days') {
                const daySet = [...new Set(points.map(p => p.date))];
                seriesPoints = daySet.map(date => ({ date, value: 1, count: 1 }));
            }
            return {
                state: seriesPoints.length ? 'ok' : 'empty',
                metricId,
                chartType: 'bar',
                bounds,
                series: [{
                    id: metricId,
                    label: meta.label,
                    unitFamily: 'count',
                    unit: metricId === 'use_days' ? 'days' : 'sessions',
                    points: aggregateTimeSeries(seriesPoints, f.interval, prefs.maxPoints)
                }]
            };
        }
        const use = buildUseSeries({
            ...f,
            interval: metricId === 'rolling_7_use' ? 'rolling-7' : metricId === 'rolling_30_use' ? 'rolling-30' : f.interval
        }, data);
        if (chIsAll(f.substanceId) && chartIncompatibleMix(use.series)) {
            return {
                state: use.series.length ? 'ok' : 'empty',
                metricId,
                chartType: options.chartType || meta.defaultType,
                bounds: use.bounds,
                series: use.series,
                mode: 'grouped-small-multiples',
                warning: 'All Substances mode shows separate series. Amounts are never summed across incompatible units.'
            };
        }
        return {
            state: use.series.some(s => s.points.length) ? 'ok' : 'empty',
            metricId,
            chartType: options.chartType || meta.defaultType,
            bounds: use.bounds,
            series: use.series
        };
    }

    if (meta.category === 'spending' || metricId.includes('spend')) {
        if (metricId === 'spend_heatmap') {
            const { purchases, bounds } = getChartSourcePurchases(f, data);
            const spendPurchases = purchases.filter(p => chartPurchaseSpend(p) > 0);
            return {
                state: spendPurchases.length ? 'ok' : 'empty',
                metricId,
                chartType: 'heatmap',
                bounds,
                heatmap: buildHeatmapMatrix(spendPurchases, chartPurchaseSpend, options.heatmapMode || 'amount'),
                series: []
            };
        }
        if (metricId.startsWith('spend_by_')) {
            const { purchases, bounds } = getChartSourcePurchases(f, data);
            const spendPurchases = purchases.filter(p => chartPurchaseSpend(p) > 0);
            const dim = metricId.replace('spend_by_', '');
            const labelFn = {
                substance: p => (typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(p.substanceId, data) : p.substanceId),
                product: p => chartProductType(p) || 'unspecified',
                store: p => chTrim(p.store) || 'Unknown',
                supplier: p => (typeof financialPurchaseSupplier === 'function' ? financialPurchaseSupplier(p) : p.store) || 'Unknown',
                payment: p => chTrim(p.paymentMethod) || 'Unknown'
            }[dim] || (p => 'Unknown');
            const rows = buildCategoryBreakdown(spendPurchases, chartPurchaseSpend, labelFn);
            return {
                state: rows.length ? 'ok' : 'empty',
                metricId,
                chartType: options.chartType || meta.defaultType,
                bounds,
                series: [{
                    id: dim,
                    label: meta.label,
                    unitFamily: 'money',
                    unit: typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$',
                    points: rows.map(r => ({ key: r.label, date: r.label, value: r.value, count: r.count }))
                }]
            };
        }
        const spend = buildSpendSeries({
            ...f,
            interval: metricId === 'rolling_30_spend' ? 'rolling-30' : f.interval
        }, data);
        if (metricId === 'running_monthly_spend') {
            spend.series = spend.series.map(s => {
                let run = 0;
                let month = '';
                const points = s.points.map(pt => {
                    const m = String(pt.date || pt.key).slice(0, 7);
                    if (m !== month) { month = m; run = 0; }
                    run += pt.value;
                    return { ...pt, value: run, meta: { ...(pt.meta || {}), running: true } };
                });
                return { ...s, points };
            });
            spend.chartType = 'cumulative';
        }
        return {
            state: spend.series.some(s => s.points.length) ? 'ok' : 'empty',
            metricId,
            chartType: options.chartType || meta.defaultType,
            bounds: spend.bounds,
            series: spend.series
        };
    }

    if (meta.category === 'purchases') {
        const { purchases, bounds } = getChartSourcePurchases(f, data);
        if (metricId === 'purchase_heatmap') {
            return {
                state: purchases.length ? 'ok' : 'empty',
                metricId,
                chartType: 'heatmap',
                bounds,
                heatmap: buildHeatmapMatrix(purchases, () => 1, 'count'),
                series: []
            };
        }
        if (metricId === 'cost_histogram') {
            const costs = purchases.map(chartPurchaseSpend).filter(v => v > 0).sort((a, b) => a - b);
            if (!costs.length) return { state: 'empty', metricId, chartType: 'histogram', bounds, series: [] };
            const bins = 8;
            const min = costs[0];
            const max = costs[costs.length - 1];
            const width = Math.max(1, (max - min) / bins);
            const hist = Array.from({ length: bins }, (_, i) => ({
                key: `${chRound(min + i * width, 0)}-${chRound(min + (i + 1) * width, 0)}`,
                date: String(i),
                value: 0,
                count: 0
            }));
            costs.forEach(c => {
                let idx = Math.floor((c - min) / width);
                if (idx >= bins) idx = bins - 1;
                hist[idx].value += 1;
                hist[idx].count += 1;
            });
            return {
                state: 'ok',
                metricId,
                chartType: 'histogram',
                bounds,
                series: [{ id: 'hist', label: 'Cost distribution', unitFamily: 'count', unit: 'purchases', points: hist }]
            };
        }
        if (metricId === 'days_between_purchases') {
            const dates = [...new Set(purchases.map(p => p.date).filter(Boolean))].sort();
            const points = [];
            for (let i = 1; i < dates.length; i += 1) {
                const gap = chartDaysBetween(dates[i - 1], dates[i]);
                if (gap != null) points.push({ date: dates[i], value: gap, count: 1, key: dates[i] });
            }
            return {
                state: points.length ? 'ok' : 'insufficient',
                metricId,
                chartType: 'scatter',
                bounds,
                series: [{ id: 'gaps', label: 'Days between purchases', unitFamily: 'days', unit: 'days', points }]
            };
        }
        const points = purchases.map(p => {
            const spend = chartPurchaseSpend(p);
            const qty = typeof getPurchaseQuantityBought === 'function' ? chToNumber(getPurchaseQuantityBought(p), 0) : chToNumber(p.quantityBought, 0);
            let value = 1;
            if (metricId === 'purchase_amount') value = qty;
            if (metricId === 'avg_purchase_cost' || metricId === 'avg_purchase_size') value = metricId === 'avg_purchase_cost' ? spend : qty;
            if (metricId === 'avg_cost_per_unit') value = qty > 0 && spend > 0 ? spend / qty : 0;
            if (metricId === 'purchase_count') value = 1;
            return { date: p.date, value, count: 1, meta: { purchaseId: p.id, spend, qty } };
        }).filter(p => p.value > 0 || metricId === 'purchase_count');
        let seriesPoints = aggregateTimeSeries(points, f.interval, prefs.maxPoints);
        if (metricId === 'avg_purchase_cost' || metricId === 'avg_purchase_size' || metricId === 'avg_cost_per_unit') {
            // re-average within buckets using totals
            const map = new Map();
            points.forEach(pt => {
                const key = chartBucketKey(pt.date, f.interval);
                if (!map.has(key)) map.set(key, { key, date: pt.date, spend: 0, qty: 0, count: 0 });
                const row = map.get(key);
                row.spend += chToNumber(pt.meta?.spend, 0);
                row.qty += chToNumber(pt.meta?.qty, 0);
                row.count += 1;
                if (pt.date > row.date) row.date = pt.date;
            });
            seriesPoints = [...map.values()].map(row => ({
                key: row.key,
                date: row.date,
                value: metricId === 'avg_purchase_cost'
                    ? (row.count ? row.spend / row.count : 0)
                    : metricId === 'avg_purchase_size'
                        ? (row.count ? row.qty / row.count : 0)
                        : (row.qty > 0 ? row.spend / row.qty : 0),
                count: row.count
            })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
        }
        return {
            state: seriesPoints.length ? 'ok' : 'empty',
            metricId,
            chartType: options.chartType || meta.defaultType,
            bounds,
            series: [{
                id: metricId,
                label: meta.label,
                unitFamily: metricId.includes('cost') || metricId.includes('spend') ? 'money' : (metricId.includes('count') ? 'count' : 'auto'),
                points: seriesPoints
            }]
        };
    }

    if (meta.category === 'inventory') {
        if (metricId === 'inventory_flow') {
            const flow = buildInventoryFlow(f, data);
            return {
                state: flow.flows.length ? 'ok' : 'empty',
                metricId,
                chartType: 'flow',
                bounds: flow.bounds,
                flows: flow.flows,
                series: []
            };
        }
        const { purchases, bounds } = getChartSourcePurchases(f, data);
        if (metricId === 'inventory_value') {
            let value = 0;
            (data.purchases || []).forEach(p => {
                if (!chartMatchesSubstance(p.substanceId, f.substanceId, data)) return;
                const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
                if (acq === 'purchased_as_gift') return;
                const rem = typeof getPurchaseRemainingAmount === 'function' ? chToNumber(getPurchaseRemainingAmount(p), 0) : 0;
                const qty = typeof getPurchaseQuantityBought === 'function' ? chToNumber(getPurchaseQuantityBought(p), 0) : 0;
                const spend = chartPurchaseSpend(p);
                if (rem > 0 && qty > 0 && spend > 0) value += spend * (rem / qty);
            });
            return {
                state: value > 0 ? 'ok' : 'empty',
                metricId,
                chartType: 'progress',
                bounds,
                series: [{
                    id: 'value',
                    label: 'Active inventory value',
                    unitFamily: 'money',
                    points: [{ key: 'now', date: chToday(), value, count: 1 }],
                    target: value
                }]
            };
        }
        // remaining / days of supply approximate from current inventory snapshot
        const remainingPoints = [];
        purchases.forEach(p => {
            const rem = typeof getPurchaseRemainingAmount === 'function' ? chToNumber(getPurchaseRemainingAmount(p), 0) : 0;
            remainingPoints.push({ date: p.date, value: rem, count: 1 });
        });
        return {
            state: remainingPoints.length ? 'ok' : 'empty',
            metricId,
            chartType: options.chartType || meta.defaultType,
            bounds,
            series: [{
                id: 'inventory',
                label: meta.label,
                unitFamily: chIsAll(f.substanceId) ? 'mixed' : chartUnitFamilyForSubstance(f.substanceId, data),
                points: aggregateTimeSeries(remainingPoints, f.interval, prefs.maxPoints)
            }],
            estimate: true
        };
    }

    if (meta.category === 'goals' || meta.category === 'recovery') {
        const bounds = resolveChartBounds(f, data);
        if (metricId === 'goal_adherence' || metricId === 'goal_vs_actual') {
            const evaluations = typeof evaluateAllGoals === 'function' ? evaluateAllGoals({ data }) : [];
            const points = evaluations.slice(0, 20).map((ev, i) => ({
                key: ev.goal?.name || `goal-${i}`,
                date: ev.bounds?.endDate || chToday(),
                value: metricId === 'goal_adherence'
                    ? chToNumber(ev.progressRatio != null ? ev.progressRatio * 100 : ev.percentComplete, 0)
                    : chToNumber(ev.actual, 0),
                count: 1,
                meta: { goalId: ev.goal?.id, target: ev.target }
            }));
            return {
                state: points.length ? 'ok' : 'empty',
                metricId,
                chartType: options.chartType || meta.defaultType,
                bounds,
                series: [{ id: 'goals', label: meta.label, unitFamily: metricId === 'goal_adherence' ? 'percent' : 'auto', points }],
                overlays: points.filter(p => p.meta?.target != null).map(p => ({ type: 'target', value: p.meta.target, label: 'Target' }))
            };
        }
        if (metricId === 'plan_adherence' || metricId === 'plan_vs_actual' || metricId === 'weekly_target_progress') {
            const plans = (data.taperPlansV2 || []).filter(p => p && !p.archived);
            const points = [];
            plans.forEach(plan => {
                const weeks = Array.isArray(plan.weeklyTargets) ? plan.weeklyTargets : [];
                weeks.slice(-12).forEach(week => {
                    const actual = chToNumber(week.actualAmount ?? week.actual, 0);
                    const target = chToNumber(week.targetAmount ?? week.target, 0);
                    points.push({
                        key: week.weekStart || week.label || plan.id,
                        date: week.weekEnd || week.weekStart || chToday(),
                        value: metricId === 'plan_adherence' || metricId === 'weekly_target_progress'
                            ? (target > 0 ? Math.min(200, (actual / target) * 100) : 0)
                            : actual,
                        count: 1,
                        meta: { planId: plan.id, target }
                    });
                });
            });
            return {
                state: points.length ? 'ok' : 'empty',
                metricId,
                chartType: options.chartType || meta.defaultType,
                bounds,
                series: [{ id: 'plans', label: meta.label, unitFamily: metricId.includes('adherence') || metricId.includes('progress') ? 'percent' : 'auto', points }],
                overlays: [{ type: 'target', value: 100, label: 'Target 100%' }]
            };
        }
        if (metricId === 'no_use_streak' || metricId === 'no_purchase_streak') {
            const dates = metricId === 'no_use_streak'
                ? [...new Set((data.logs || []).filter(l => chartMatchesSubstance(l.substanceId, f.substanceId, data) && chartLogAmount(l, f) > 0).map(l => l.date))].sort()
                : [...new Set((data.purchases || []).filter(p => chartMatchesSubstance(p.substanceId, f.substanceId, data) && chartPurchaseSpend(p) > 0).map(p => p.date))].sort();
            const dayList = chartEnumerateDates(bounds.startDate || (dates[0] || chToday()), bounds.endDate || chToday());
            let streak = 0;
            const points = dayList.map(date => {
                if (dates.includes(date)) streak = 0;
                else streak += 1;
                return { date, key: date, value: streak, count: 1 };
            });
            return {
                state: points.length ? 'ok' : 'empty',
                metricId,
                chartType: 'line',
                bounds,
                series: [{ id: 'streak', label: meta.label, unitFamily: 'days', unit: 'days', points }]
            };
        }
        if (metricId === 'recovery_score') {
            let score = null;
            try {
                if (typeof computeRecoveryScore === 'function') {
                    score = computeRecoveryScore(data, { substanceId: f.substanceId });
                } else if (typeof buildRecoveryDashboardDataset === 'function') {
                    const ds = buildRecoveryDashboardDataset(data, { substanceId: f.substanceId });
                    score = ds?.score?.total ?? ds?.score;
                }
            } catch (_) { /* optional */ }
            const value = chToNumber(score?.total ?? score, NaN);
            return {
                state: Number.isFinite(value) ? 'ok' : 'insufficient',
                metricId,
                chartType: 'progress',
                bounds,
                series: [{
                    id: 'score',
                    label: 'Recovery score',
                    unitFamily: 'score',
                    points: [{ key: 'now', date: chToday(), value: Number.isFinite(value) ? value : 0, count: 1 }],
                    target: 100
                }],
                estimate: true
            };
        }
    }

    return { state: 'insufficient', metricId, message: 'Not enough data for this chart.', series: [], bounds: resolveChartBounds(f, data) };
}

function buildChartDashboardDataset(data = appData, options = {}) {
    // Do not auto-sync Insights here — callers (render/export) sync first so
    // tests can set chart prefs or pass options.filters without being overwritten.
    if (options.syncInsights) applySharedInsightsFiltersToCharts(data);
    const prefs = ensureChartSystemPrefs(data);
    const filters = { ...prefs.filters, ...(options.filters || {}) };
    const cacheKey = JSON.stringify({
        filters,
        widgets: prefs.widgets.map(w => [w.id, w.metricId, w.chartType, w.visible, w.order]),
        logs: (data.logs || []).length,
        purchases: (data.purchases || []).length,
        goals: (data.goals || []).length
    });
    if (!options.bypassCache && chartSystemCache && chartSystemCacheKey === cacheKey) return chartSystemCache;

    const widgets = prefs.widgets.filter(w => w.visible !== false).map(widget => {
        const widgetFilters = { ...filters, ...(widget.overrides || {}) };
        const dataset = buildChartDatasetForMetric(widget.metricId, widgetFilters, data, {
            chartType: widget.chartType,
            heatmapMode: widget.overrides?.heatmapMode
        });
        let comparison = null;
        if (filters.comparePeriod && filters.comparePeriod !== 'none' && dataset.series?.length) {
            const cmp = buildComparisonSeries(dataset, widgetFilters, data);
            if (cmp) {
                const prev = buildChartDatasetForMetric(widget.metricId, cmp.previousFilters, data, { chartType: widget.chartType });
                comparison = {
                    previous: prev,
                    previousBounds: cmp.previousBounds
                };
            }
        }
        return { widget, dataset, comparison };
    });

    const out = {
        generatedAt: new Date().toISOString(),
        filters,
        prefs,
        widgets,
        metrics: CHART_METRICS,
        presets: CHART_PRESETS
    };
    chartSystemCache = out;
    chartSystemCacheKey = cacheKey;
    return out;
}

// ——— SVG renderers ———

function chEsc(value) {
    return escapeHtml(String(value ?? ''));
}

function chartScaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
    const d0 = domainMin;
    const d1 = domainMax === domainMin ? domainMin + 1 : domainMax;
    return v => rangeMin + ((v - d0) / (d1 - d0)) * (rangeMax - rangeMin);
}

function chartNiceMax(values, yZero = true) {
    const nums = values.filter(Number.isFinite);
    if (!nums.length) return 1;
    const max = Math.max(...nums, yZero ? 0 : Math.min(...nums));
    if (max <= 0) return 1;
    const pow = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / pow) * pow;
}

function renderChartTooltipHtml(point, series, dataset) {
    if (!point) return '';
    const unit = series?.unit || '';
    const value = chRound(point.value, ensureChartSystemPrefs().filters ? getChartSystemPrefs().widgets[0]?.settings?.decimalPrecision || 2 : 2);
    return `<div class="ch-tooltip-inner">
        <strong>${chEsc(point.key || point.date)}</strong>
        <div>${chEsc(series?.label || '')}: ${chEsc(value)}${unit ? ` ${chEsc(unit)}` : ''}</div>
        <div class="settings-hint">Records: ${chEsc(point.count ?? 1)}${dataset?.bounds?.incomplete ? ' · Partial period' : ''}${dataset?.estimate ? ' · Estimate' : ''}</div>
    </div>`;
}

function renderSvgLineAreaChart(seriesList, options = {}) {
    const width = options.width || 640;
    const height = options.height || 220;
    const pad = { t: 16, r: 12, b: 28, l: 40 };
    const allPoints = seriesList.flatMap(s => s.points || []);
    if (!allPoints.length) return '<p class="ch-empty">No data points.</p>';
    const yZero = options.yAxisZero !== false;
    const yMax = chartNiceMax(allPoints.map(p => p.value), yZero);
    const yMin = yZero ? 0 : Math.min(...allPoints.map(p => p.value), 0);
    const xKeys = [...new Set(allPoints.map(p => p.key || p.date))];
    const xScale = i => pad.l + (xKeys.length <= 1 ? (width - pad.l - pad.r) / 2 : (i / (xKeys.length - 1)) * (width - pad.l - pad.r));
    const yScale = chartScaleLinear(yMin, yMax, height - pad.b, pad.t);
    const colors = ['var(--accent)', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f', '#c62828'];
    const grid = options.showGrid !== false
        ? [0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = yScale(yMin + (yMax - yMin) * t);
            return `<line class="ch-grid" x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" />`;
        }).join('')
        : '';

    const paths = seriesList.map((series, sIdx) => {
        const pts = (series.points || []).map(p => {
            const i = xKeys.indexOf(p.key || p.date);
            return { x: xScale(Math.max(0, i)), y: yScale(p.value), p, series };
        });
        if (!pts.length) return '';
        const lineD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
        const areaD = `${lineD} L${pts[pts.length - 1].x},${height - pad.b} L${pts[0].x},${height - pad.b} Z`;
        const color = colors[sIdx % colors.length];
        const dots = pts.map(pt => `<circle class="ch-point" cx="${pt.x}" cy="${pt.y}" r="3.5" data-series="${chEsc(series.id)}" data-key="${chEsc(pt.p.key || pt.p.date)}" data-value="${chEsc(pt.p.value)}" tabindex="0" role="img" aria-label="${chEsc(series.label)} ${chEsc(pt.p.key || pt.p.date)}: ${chEsc(pt.p.value)}"></circle>`).join('');
        if (options.chartType === 'area') {
            return `<path d="${areaD}" fill="${color}" fill-opacity="0.18"></path><path d="${lineD}" fill="none" stroke="${color}" stroke-width="2"></path>${dots}`;
        }
        return `<path d="${lineD}" fill="none" stroke="${color}" stroke-width="2"></path>${dots}`;
    }).join('');

    const xLabels = xKeys.filter((_, i) => i === 0 || i === xKeys.length - 1 || i % Math.ceil(xKeys.length / 4) === 0)
        .map(key => {
            const i = xKeys.indexOf(key);
            return `<text class="ch-axis-label" x="${xScale(i)}" y="${height - 8}" text-anchor="middle">${chEsc(String(key).slice(5) || key)}</text>`;
        }).join('');

    return `<svg class="ch-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
        ${grid}
        <line class="ch-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" />
        <line class="ch-axis" x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" />
        ${paths}
        ${xLabels}
        <text class="ch-axis-label" x="${pad.l - 6}" y="${pad.t + 4}" text-anchor="end">${chEsc(yMax)}</text>
        <text class="ch-axis-label" x="${pad.l - 6}" y="${height - pad.b}" text-anchor="end">${chEsc(yMin)}</text>
    </svg>`;
}

function renderSvgBarChart(seriesList, options = {}) {
    const width = options.width || 640;
    const height = options.height || 220;
    const pad = { t: 16, r: 12, b: 36, l: 40 };
    const points = seriesList[0]?.points || [];
    if (!points.length) return '<p class="ch-empty">No data points.</p>';
    const yMax = chartNiceMax(points.map(p => p.value), options.yAxisZero !== false);
    const barW = Math.max(4, ((width - pad.l - pad.r) / points.length) * 0.7);
    const xScale = i => pad.l + (i + 0.5) * ((width - pad.l - pad.r) / points.length);
    const yScale = chartScaleLinear(0, yMax, height - pad.b, pad.t);
    const bars = points.map((p, i) => {
        const x = xScale(i) - barW / 2;
        const y = yScale(p.value);
        const h = height - pad.b - y;
        return `<rect class="ch-bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(1, h)}" data-key="${chEsc(p.key || p.date)}" data-value="${chEsc(p.value)}" tabindex="0" role="img" aria-label="${chEsc(p.key || p.date)}: ${chEsc(p.value)}"></rect>
            ${options.showDataLabels ? `<text class="ch-axis-label" x="${xScale(i)}" y="${y - 4}" text-anchor="middle">${chEsc(chRound(p.value, 1))}</text>` : ''}`;
    }).join('');
    const labels = points.map((p, i) => {
        if (points.length > 10 && i !== 0 && i !== points.length - 1 && i % Math.ceil(points.length / 5) !== 0) return '';
        return `<text class="ch-axis-label" x="${xScale(i)}" y="${height - 10}" text-anchor="middle">${chEsc(String(p.key || p.date).slice(0, 8))}</text>`;
    }).join('');
    return `<svg class="ch-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
        <line class="ch-axis" x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" />
        ${bars}${labels}
    </svg>`;
}

function renderSvgStackedBarChart(seriesList, options = {}) {
    const width = options.width || 640;
    const height = options.height || 220;
    const pad = { t: 16, r: 12, b: 36, l: 40 };
    const keys = [...new Set(seriesList.flatMap(s => (s.points || []).map(p => p.key || p.date)))];
    if (!keys.length) return '<p class="ch-empty">No data points.</p>';
    const stacked = keys.map(key => {
        const values = seriesList.map(s => chToNumber((s.points || []).find(p => (p.key || p.date) === key)?.value, 0));
        return { key, values, total: values.reduce((a, b) => a + b, 0) };
    });
    const yMax = chartNiceMax(stacked.map(s => s.total));
    const barW = Math.max(4, ((width - pad.l - pad.r) / stacked.length) * 0.7);
    const xScale = i => pad.l + (i + 0.5) * ((width - pad.l - pad.r) / stacked.length);
    const yScale = chartScaleLinear(0, yMax, height - pad.b, pad.t);
    const colors = ['var(--accent)', '#78909c', '#ef6c00', '#2e7d32'];
    const bars = stacked.map((row, i) => {
        let yBase = height - pad.b;
        return row.values.map((val, sIdx) => {
            const y = yScale(val);
            const h = yBase - y;
            const rect = `<rect class="ch-bar" x="${xScale(i) - barW / 2}" y="${y}" width="${barW}" height="${Math.max(0, h)}" fill="${colors[sIdx % colors.length]}" data-key="${chEsc(row.key)}" data-series="${chEsc(seriesList[sIdx]?.id || sIdx)}"></rect>`;
            yBase = y;
            return rect;
        }).join('');
    }).join('');
    return `<svg class="ch-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked bar chart">${bars}</svg>`;
}

function renderSvgDonutChart(seriesList) {
    const points = seriesList[0]?.points || [];
    if (!points.length) return '<p class="ch-empty">No data points.</p>';
    const total = points.reduce((s, p) => s + chToNumber(p.value, 0), 0) || 1;
    const cx = 110;
    const cy = 110;
    const r = 70;
    const r0 = 40;
    let angle = -Math.PI / 2;
    const colors = ['var(--accent)', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f', '#c62828', '#546e7a'];
    const slices = points.map((p, i) => {
        const frac = chToNumber(p.value, 0) / total;
        const a0 = angle;
        const a1 = angle + frac * Math.PI * 2;
        angle = a1;
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const x2 = cx + r0 * Math.cos(a1);
        const y2 = cy + r0 * Math.sin(a1);
        const x3 = cx + r0 * Math.cos(a0);
        const y3 = cy + r0 * Math.sin(a0);
        const large = frac > 0.5 ? 1 : 0;
        const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
        return `<path d="${d}" fill="${colors[i % colors.length]}" data-key="${chEsc(p.key || p.date)}" data-value="${chEsc(p.value)}"><title>${chEsc(p.key || p.date)}: ${chEsc(p.value)}</title></path>`;
    }).join('');
    const legend = points.slice(0, 8).map((p, i) => `<div class="ch-legend-item"><span class="ch-swatch" style="background:${colors[i % colors.length]}"></span>${chEsc(p.key || p.date)}</div>`).join('');
    return `<div class="ch-donut-wrap"><svg class="ch-svg ch-donut" viewBox="0 0 220 220" role="img" aria-label="Donut chart">${slices}</svg><div class="ch-legend">${legend}</div></div>`;
}

function renderSvgHeatmap(heatmap) {
    if (!heatmap?.matrix) return '<p class="ch-empty">No heatmap data.</p>';
    const cellW = 18;
    const cellH = 18;
    const padL = 36;
    const padT = 20;
    const width = padL + 24 * cellW + 8;
    const height = padT + 7 * cellH + 8;
    let max = 0;
    heatmap.matrix.forEach(row => row.forEach(v => { max = Math.max(max, v); }));
    max = max || 1;
    const cells = heatmap.matrix.map((row, d) => row.map((v, h) => {
        const opacity = 0.12 + 0.88 * (v / max);
        return `<rect class="ch-heat-cell" x="${padL + h * cellW}" y="${padT + d * cellH}" width="${cellW - 1}" height="${cellH - 1}" fill="var(--accent)" fill-opacity="${opacity}" data-day="${d}" data-hour="${h}" data-value="${chEsc(v)}"><title>${chEsc(heatmap.days[d])} ${h}:00 — ${chEsc(chRound(v, 2))}</title></rect>`;
    }).join('')).join('');
    const dayLabels = heatmap.days.map((d, i) => `<text class="ch-axis-label" x="${padL - 4}" y="${padT + i * cellH + 13}" text-anchor="end">${chEsc(d)}</text>`).join('');
    return `<svg class="ch-svg ch-heatmap" viewBox="0 0 ${width} ${height}" role="img" aria-label="Heatmap">${dayLabels}${cells}</svg>`;
}

function renderSvgProgressChart(seriesList) {
    const series = seriesList[0];
    const value = chToNumber(series?.points?.[0]?.value, 0);
    const target = chToNumber(series?.target, 100) || 100;
    const pct = Math.max(0, Math.min(100, (value / target) * 100));
    return `<div class="ch-progress" role="img" aria-label="${chEsc(series?.label || 'Progress')}: ${chEsc(value)} of ${chEsc(target)}">
        <div class="ch-progress-track"><span class="ch-progress-fill" style="width:${pct}%"></span></div>
        <div class="ch-progress-meta"><strong>${chEsc(chRound(value, 2))}</strong> / ${chEsc(target)} (${chEsc(chRound(pct, 0))}%)</div>
    </div>`;
}

function renderSvgFlowChart(flows) {
    if (!flows?.length) return '<p class="ch-empty">No flow data.</p>';
    // Keep substances separate — never merge incompatible units.
    return `<div class="ch-flow-list">${flows.map(flow => {
        const stages = [
            ['Purchased', flow.purchased],
            ['Purchased as gift', flow.purchasedAsGift],
            ['Gift received', flow.giftReceived],
            ['Used', flow.used],
            ['Shared', flow.shared],
            ['Gifted', flow.gifted],
            ['Adjusted', flow.adjusted],
            ['Remaining', flow.remaining]
        ];
        const max = Math.max(...stages.map(s => s[1]), 0.0001);
        return `<div class="ch-flow-card">
            <h5>${chEsc(flow.label)}</h5>
            ${flow.needsReview ? '<p class="ch-needs-review">Needs Review: unresolved amounts present</p>' : ''}
            <div class="ch-flow-stages">${stages.map(([label, value]) => `
                <div class="ch-flow-stage">
                    <span>${chEsc(label)}</span>
                    <div class="ch-flow-track"><span style="width:${Math.max(2, (value / max) * 100)}%"></span></div>
                    <strong>${chEsc(chRound(value, 2))}</strong>
                </div>`).join('')}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderChartTableAlt(dataset) {
    const rows = [];
    (dataset.series || []).forEach(series => {
        (series.points || []).forEach(p => {
            rows.push(`<tr><td>${chEsc(series.label)}</td><td>${chEsc(p.key || p.date)}</td><td>${chEsc(chRound(p.value, 4))}</td><td>${chEsc(series.unit || '')}</td><td>${chEsc(p.count ?? '')}</td></tr>`);
        });
    });
    if (!rows.length && dataset.heatmap) {
        dataset.heatmap.matrix.forEach((row, d) => row.forEach((v, h) => {
            if (v) rows.push(`<tr><td>Heatmap</td><td>${chEsc(dataset.heatmap.days[d])} ${h}:00</td><td>${chEsc(chRound(v, 3))}</td><td></td><td></td></tr>`);
        }));
    }
    if (!rows.length) return '<p class="ch-empty">No table data.</p>';
    return `<div class="table-scroll"><table class="ch-table sheet-table"><thead><tr><th>Series</th><th>Period</th><th>Value</th><th>Unit</th><th>Count</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function renderChartWidgetHtml(entry) {
    const { widget, dataset, comparison } = entry;
    const settings = widget.settings || getDefaultChartSettings();
    const type = widget.chartType || dataset.chartType || 'line';
    let body = '';
    if (dataset.state === 'loading') body = '<div class="ch-loading">Loading chart…</div>';
    else if (dataset.state === 'error') body = `<div class="ch-error">${chEsc(dataset.message || 'Chart error')}</div>`;
    else if (dataset.state === 'insufficient') body = `<div class="ch-empty">Insufficient data. ${chEsc(dataset.message || '')}</div>`;
    else if (dataset.state === 'empty') body = '<div class="ch-empty">No data for the selected filters.</div>';
    else if (type === 'heatmap' || type === 'calendar-heatmap') body = renderSvgHeatmap(dataset.heatmap);
    else if (type === 'flow') body = renderSvgFlowChart(dataset.flows);
    else if (type === 'donut') body = renderSvgDonutChart(dataset.series || []);
    else if (type === 'progress') body = renderSvgProgressChart(dataset.series || []);
    else if (type === 'stacked-bar') body = renderSvgStackedBarChart(dataset.series || [], settings);
    else if (type === 'bar' || type === 'histogram') body = renderSvgBarChart(dataset.series || [], { ...settings, showDataLabels: settings.showDataLabels });
    else if (type === 'scatter') body = renderSvgLineAreaChart(dataset.series || [], { ...settings, chartType: 'line' });
    else body = renderSvgLineAreaChart(dataset.series || [], { ...settings, chartType: type === 'area' || type === 'cumulative' ? 'area' : 'line' });

    const summary = (() => {
        const s = dataset.series?.[0];
        const pts = s?.points || [];
        if (!pts.length) return dataset.warning || 'No summary.';
        const last = pts[pts.length - 1];
        const prev = pts.length > 1 ? pts[pts.length - 2] : null;
        const diff = prev ? last.value - prev.value : null;
        const pct = prev && prev.value ? (diff / prev.value) : null;
        return `${s.label}: ${chRound(last.value, settings.decimalPrecision)}${s.unit ? ` ${s.unit}` : ''}${diff != null ? ` · Δ ${chRound(diff, 2)}${pct != null ? ` (${chRound(pct * 100, 1)}%)` : ''}` : ''}`;
    })();

    const compareNote = comparison?.previous?.series?.[0]?.points?.length
        ? (() => {
            const cur = dataset.series?.[0]?.points?.reduce((s, p) => s + p.value, 0) || 0;
            const prev = comparison.previous.series[0].points.reduce((s, p) => s + p.value, 0) || 0;
            const diff = cur - prev;
            const pct = prev ? diff / prev : null;
            return `<p class="settings-hint">vs previous: ${chEsc(chRound(cur, 2))} vs ${chEsc(chRound(prev, 2))} · ${chEsc(chRound(diff, 2))}${pct != null ? ` / ${chEsc(chRound(pct * 100, 1))}%` : ''} · ${diff <= 0 ? 'Improved or flat' : 'Increased'}</p>`;
        })()
        : '';

    return `<article class="ch-widget" data-chart-id="${chEsc(widget.id)}" id="ch-widget-${chEsc(widget.id)}">
        <header class="ch-widget-head">
            <div>
                <h4>${chEsc(widget.title || getChartMetricMeta(widget.metricId)?.label || widget.metricId)}</h4>
                <p class="ch-sr-summary settings-hint">${chEsc(summary)}</p>
            </div>
            <div class="ch-widget-actions">
                <select aria-label="Chart type" onchange="updateChartWidgetType('${chEsc(widget.id)}', this.value)">
                    ${CHART_TYPES.map(t => `<option value="${t}"${type === t ? ' selected' : ''}>${t}</option>`).join('')}
                </select>
                <button type="button" class="btn-small" onclick="toggleChartTableAlt('${chEsc(widget.id)}')">Table</button>
                <button type="button" class="btn-small" onclick="exportChartWidgetCsv('${chEsc(widget.id)}')">CSV</button>
                <button type="button" class="btn-small" onclick="downloadChartWidgetPng('${chEsc(widget.id)}')">PNG</button>
                <button type="button" class="btn-small" onclick="toggleChartFullscreen('${chEsc(widget.id)}')">Full</button>
                <button type="button" class="btn-small" onclick="removeChartWidget('${chEsc(widget.id)}')">Remove</button>
            </div>
        </header>
        ${dataset.warning ? `<p class="ch-warning">${chEsc(dataset.warning)}</p>` : ''}
        ${dataset.estimate ? '<p class="settings-hint"><em>Estimate</em></p>' : ''}
        ${compareNote}
        <div class="ch-widget-body">${body}</div>
        <div class="ch-table-alt hidden" id="ch-table-${chEsc(widget.id)}">${renderChartTableAlt(dataset)}</div>
        <p class="settings-hint">Range: ${chEsc(dataset.bounds?.label || dataset.bounds?.startDate || '')}${dataset.bounds?.incomplete ? ' · Partial period' : ''}</p>
    </article>`;
}

function renderChartBuilderHtml(prefs) {
    const metricOpts = CHART_METRICS.map(m => `<option value="${m.id}">${chEsc(m.label)}</option>`).join('');
    return `<div class="ch-builder collapsible-section ${prefs.builderCollapsed ? 'collapsed' : ''}" data-section="chartBuilder">
        <button type="button" class="section-toggle" onclick="toggleSection('chartBuilder'); persistChartSystemPrefs({ builderCollapsed: !getChartSystemPrefs().builderCollapsed });">
            <span>Custom Chart Builder</span><span class="chevron">⌄</span>
        </button>
        <div class="section-content">
            <div class="ch-builder-grid">
                <label>Metric<select id="ch-builder-metric">${metricOpts}</select></label>
                <label>Chart type<select id="ch-builder-type">${CHART_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select></label>
                <label>Title<input id="ch-builder-title" placeholder="Optional display name"></label>
                <label>Decimals<input id="ch-builder-decimals" type="number" min="0" max="4" value="2"></label>
            </div>
            <p class="settings-hint">Invalid combinations (for example mixing grams and puffs) are blocked in All Substances mode by using separate series.</p>
            <button type="button" class="btn-primary" onclick="addChartFromBuilder()">Add chart</button>
        </div>
    </div>`;
}

function applySharedInsightsFiltersToCharts(data = appData) {
    if (typeof syncSectionFiltersFromInsights === 'function') {
        syncSectionFiltersFromInsights(data);
        return ensureChartSystemPrefs(data).filters;
    }
    if (typeof getInsightsFilters === 'function') {
        const prefs = ensureChartSystemPrefs(data);
        const inf = getInsightsFilters(data);
        prefs.filters.substanceId = inf.substanceId;
        prefs.filters.productType = inf.productType || '';
        prefs.filters.dateRangePreset = inf.dateRangePreset || prefs.filters.dateRangePreset;
        prefs.filters.customStart = inf.customStart || '';
        prefs.filters.customEnd = inf.customEnd || '';
        prefs.filters.transactionType = inf.transactionType || '';
        return prefs.filters;
    }
    return ensureChartSystemPrefs(data).filters;
}

function renderChartDashboardView() {
    const root = typeof document !== 'undefined' ? document.getElementById('chart-dashboard-root') : null;
    if (!root) return;
    root.innerHTML = '<div class="ch-loading" role="status">Loading charts…</div>';
    try {
        const prefs = ensureChartSystemPrefs(appData);
        applySharedInsightsFiltersToCharts(appData);

        const dataset = buildChartDashboardDataset(appData, { bypassCache: true });
        const f = dataset.filters;
        const substanceLabel = chIsAll(f.substanceId)
            ? 'All Substances (separate series)'
            : (typeof getSubstanceDisplayName === 'function'
                ? getSubstanceDisplayName(f.substanceId, appData)
                : f.substanceId);
        const productLabel = f.productType || 'All product types';
        const presetOpts = Object.entries(CHART_PRESETS).map(([id, p]) =>
            `<option value="${id}"${prefs.activePreset === id ? ' selected' : ''}>${chEsc(p.name)}</option>`
        ).join('');

        root.innerHTML = `
            <div class="ch-dashboard ${chartSystemUi.fullscreenId ? 'ch-has-fullscreen' : ''}">
                <div class="ch-toolbar">
                    <p class="settings-hint">Charts inherit Insights substance, product type, date range, and transaction filters. Incompatible units are never combined.</p>
                    <p class="settings-hint">Using Insights filters: <strong>${chEsc(substanceLabel)}</strong> · ${chEsc(productLabel)} · ${chEsc(f.dateRangePreset || 'range')}</p>
                    <div class="ch-toolbar-actions">
                        <button type="button" class="secondary-btn btn-sm" onclick="exportChartDashboardCsv()">Export dashboard CSV</button>
                        <button type="button" class="secondary-btn btn-sm" onclick="resetChartDashboard()">Reset dashboard</button>
                        <button type="button" class="secondary-btn btn-sm" onclick="printChartDashboard()">Print</button>
                    </div>
                </div>

                <div class="ch-filters collapsible-section ${prefs.filtersCollapsed ? 'collapsed' : ''}" data-section="chartFilters">
                    <button type="button" class="section-toggle" onclick="toggleSection('chartFilters'); persistChartSystemPrefs({ filtersCollapsed: !getChartSystemPrefs().filtersCollapsed });">
                        <span>Chart display options</span><span class="chevron">⌄</span>
                    </button>
                    <div class="section-content ch-filters-grid">
                        <label>Interval<select id="ch-filter-interval" onchange="onChartFilterChange()">${CHART_INTERVALS.map(i => `<option value="${i}"${f.interval === i ? ' selected' : ''}>${i}</option>`).join('')}</select></label>
                        <label>Compare<select id="ch-filter-compare" onchange="onChartFilterChange()">
                            <option value="none"${f.comparePeriod === 'none' ? ' selected' : ''}>None</option>
                            <option value="previous-period"${f.comparePeriod === 'previous-period' ? ' selected' : ''}>Previous period</option>
                        </select></label>
                        <label class="ch-check"><input type="checkbox" id="ch-filter-personal" ${f.personalUseOnly ? 'checked' : ''} onchange="onChartFilterChange()"> Personal-use only</label>
                        <label class="ch-check"><input type="checkbox" id="ch-filter-gifts" ${f.includeGifts ? 'checked' : ''} onchange="onChartFilterChange()"> Include gifts in use charts</label>
                        <label>Preset<select id="ch-filter-preset" onchange="applyChartPreset(this.value)">${presetOpts}</select></label>
                    </div>
                </div>

                ${renderChartBuilderHtml(prefs)}

                <div class="ch-widget-grid" id="chart-dash-widget-grid">
                    ${dataset.widgets.length
                        ? dataset.widgets.map(renderChartWidgetHtml).join('')
                        : '<div class="ch-empty">No charts yet. Use a preset or the Custom Chart Builder.</div>'}
                </div>
            </div>`;

        if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
    } catch (err) {
        console.error('[charts] render failed', err);
        root.innerHTML = `<div class="ch-error" role="alert"><p>Could not load charts.</p><p class="settings-hint">${chEsc(err?.message || String(err))}</p><button type="button" class="secondary-btn btn-sm" onclick="invalidateChartSystemCache(); renderChartDashboardView();">Retry</button></div>`;
    }
}

function onChartFilterChange() {
    const g = id => document.getElementById(id);
    // Display-only chart prefs — substance/date/product/tx come from shared Insights filters
    persistChartSystemPrefs({
        filters: {
            interval: g('ch-filter-interval')?.value || 'daily',
            comparePeriod: g('ch-filter-compare')?.value || 'none',
            personalUseOnly: !!g('ch-filter-personal')?.checked,
            includeGifts: !!g('ch-filter-gifts')?.checked
        }
    });
    renderChartDashboardView();
}

function applyChartPreset(presetId) {
    const preset = CHART_PRESETS[presetId];
    if (!preset) return;
    const widgets = preset.widgets.map((metricId, index) => ({
        id: `chart-w-${Date.now().toString(36)}-${index}-${metricId}`,
        metricId,
        title: getChartMetricMeta(metricId)?.label || metricId,
        chartType: getChartMetricMeta(metricId)?.defaultType || 'line',
        visible: true,
        pinnedToDashboard: false,
        width: 'full',
        order: index,
        overrides: {},
        settings: getDefaultChartSettings()
    }));
    persistChartSystemPrefs({ widgets, activePreset: presetId });
    renderChartDashboardView();
}

function addChartFromBuilder() {
    const metricId = document.getElementById('ch-builder-metric')?.value;
    const chartType = document.getElementById('ch-builder-type')?.value || getChartMetricMeta(metricId)?.defaultType || 'line';
    const title = chTrim(document.getElementById('ch-builder-title')?.value) || getChartMetricMeta(metricId)?.label || metricId;
    const decimals = Math.max(0, Math.min(4, chToNumber(document.getElementById('ch-builder-decimals')?.value, 2)));
    const meta = getChartMetricMeta(metricId);
    if (!meta) return;
    // Block obviously invalid: money metrics as heatmap of use, etc. Soft validation:
    if ((meta.defaultType === 'heatmap') === false && chartType === 'flow' && meta.category !== 'inventory') {
        if (typeof showToast === 'function') showToast('Flow charts are for inventory movement.', 'info');
        return;
    }
    const prefs = ensureChartSystemPrefs(appData);
    const widget = {
        id: `chart-w-${Date.now().toString(36)}-${metricId}`,
        metricId,
        title,
        chartType,
        visible: true,
        pinnedToDashboard: false,
        width: 'full',
        order: prefs.widgets.length,
        overrides: {},
        settings: { ...getDefaultChartSettings(), decimalPrecision: decimals }
    };
    persistChartSystemPrefs({ widgets: [...prefs.widgets, widget] });
    renderChartDashboardView();
}

function updateChartWidgetType(widgetId, chartType) {
    const prefs = ensureChartSystemPrefs(appData);
    prefs.widgets = prefs.widgets.map(w => w.id === widgetId ? { ...w, chartType } : w);
    persistChartSystemPrefs({ widgets: prefs.widgets });
    renderChartDashboardView();
}

function removeChartWidget(widgetId) {
    const prefs = ensureChartSystemPrefs(appData);
    persistChartSystemPrefs({ widgets: prefs.widgets.filter(w => w.id !== widgetId) });
    renderChartDashboardView();
}

function resetChartDashboard() {
    const defaults = getDefaultChartSystemPrefs();
    persistChartSystemPrefs({
        widgets: defaults.widgets,
        activePreset: defaults.activePreset,
        filters: defaults.filters
    });
    renderChartDashboardView();
}

function toggleChartTableAlt(widgetId) {
    const el = document.getElementById(`ch-table-${widgetId}`);
    if (!el) return;
    el.classList.toggle('hidden');
}

function toggleChartFullscreen(widgetId) {
    chartSystemUi.fullscreenId = chartSystemUi.fullscreenId === widgetId ? '' : widgetId;
    const node = document.getElementById(`ch-widget-${widgetId}`);
    document.querySelectorAll('.ch-widget').forEach(el => el.classList.remove('ch-fullscreen'));
    if (chartSystemUi.fullscreenId && node) node.classList.add('ch-fullscreen');
}

function exportChartWidgetCsv(widgetId) {
    const dataset = buildChartDashboardDataset(appData, { bypassCache: true });
    const entry = dataset.widgets.find(w => w.widget.id === widgetId);
    if (!entry) return '';
    const rows = [['series', 'period', 'value', 'unit', 'count']];
    (entry.dataset.series || []).forEach(series => {
        (series.points || []).forEach(p => {
            rows.push([series.label, p.key || p.date, p.value, series.unit || '', p.count ?? '']);
        });
    });
    const csv = rows.map(r => r.map(c => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    if (typeof downloadTextFile === 'function') downloadTextFile(`chart-${widgetId}-${chToday()}.csv`, csv, 'text/csv');
    return csv;
}

function exportChartDashboardCsv() {
    applySharedInsightsFiltersToCharts(appData);
    const dataset = buildChartDashboardDataset(appData, { bypassCache: true, syncInsights: true });
    const rows = [['widget', 'metric', 'series', 'period', 'value', 'unit', 'count']];
    dataset.widgets.forEach(entry => {
        (entry.dataset.series || []).forEach(series => {
            (series.points || []).forEach(p => {
                rows.push([entry.widget.title, entry.widget.metricId, series.label, p.key || p.date, p.value, series.unit || '', p.count ?? '']);
            });
        });
    });
    const csv = rows.map(r => r.map(c => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    if (typeof downloadTextFile === 'function') downloadTextFile(`chart-dashboard-${chToday()}.csv`, csv, 'text/csv');
    return csv;
}

function downloadChartWidgetPng(widgetId) {
    const widget = document.getElementById(`ch-widget-${widgetId}`);
    const svg = widget?.querySelector('svg.ch-svg');
    if (!svg) {
        if (typeof showToast === 'function') showToast('No SVG chart to export for this widget.', 'info');
        return;
    }
    try {
        const clone = svg.cloneNode(true);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(png => {
                if (!png) return;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(png);
                a.download = `chart-${widgetId}.png`;
                a.click();
            }, 'image/png');
        };
        img.src = url;
    } catch (err) {
        // Fallback: download SVG
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
        if (typeof downloadTextFile === 'function') {
            const reader = new FileReader();
            reader.onload = () => downloadTextFile(`chart-${widgetId}.svg`, reader.result, 'image/svg+xml');
            reader.readAsText(blob);
        }
    }
}

function printChartDashboard() {
    if (typeof window !== 'undefined') window.print();
}

function getPinnedChartsForRecoveryDashboard(data = appData) {
    const prefs = ensureChartSystemPrefs(data);
    return prefs.widgets.filter(w => w.pinnedToDashboard);
}

function validateChartMetricCombo(metricId, filters = {}) {
    const meta = getChartMetricMeta(metricId);
    if (!meta) return { ok: false, reason: 'Unknown metric' };
    if (chIsAll(filters.substanceId) && meta.unitFamily === 'auto' && ['use_amount', 'avg_use_per_day', 'inventory_remaining'].includes(metricId)) {
        return { ok: true, warning: 'All Substances uses separate series; values are not summed across units.' };
    }
    return { ok: true };
}
